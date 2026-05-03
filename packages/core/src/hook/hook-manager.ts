import type { BridgeManager } from '../bridge/manager';
import type { NtqqHandler } from '../protocol/ntqq-handler';
import { createLogger } from '../utils/logger';
import { HookPacketClient } from './hook-packet-client';
import { injectHookProcess, listHookProcesses, unloadHookProcess, type HookInjectResult, type HookProcessBaseInfo } from './injector';
import { QqHookClient, type QqHookLoginState, type QqHookPacket } from './qq-hook-client';

const log = createLogger('Hook');
const CONNECT_RETRY_COUNT = 30;
const CONNECT_RETRY_INTERVAL_MS = 1000;

export type HookProcessStatus = 'available' | 'loading' | 'loaded' | 'online' | 'error' | 'disconnected';

export interface HookProcessInfo extends HookProcessBaseInfo {
  injected: boolean;
  connected: boolean;
  loggedIn: boolean;
  uin: string;
  status: HookProcessStatus;
  error: string;
  method: string;
}

interface HookProcessState extends HookProcessInfo {
  client: QqHookClient | null;
  sender: HookPacketClient | null;
  injectResult: HookInjectResult | null;
  connectTask: Promise<void> | null;
  bound: boolean;
}

export class HookManager {
  private readonly states = new Map<number, HookProcessState>();
  private readonly loadTasks = new Map<number, Promise<HookProcessInfo>>();
  private readonly unloadTasks = new Map<number, Promise<HookProcessInfo>>();

  constructor(
    private readonly ntqq: NtqqHandler,
    private readonly bridgeManager: BridgeManager,
  ) {}

  async listProcesses(): Promise<HookProcessInfo[]> {
    const processes = await listHookProcesses();
    for (const proc of processes) {
      const state = this.ensureState(proc.pid);
      state.name = proc.name;
      state.path = proc.path;
    }

    // Probe every freshly-enumerated PID in parallel to detect hooks left over
    // from a previous SnowLuma run. Positive hits are reconnected immediately
    // so the login-state snapshot can update the UI without a manual load.
    await Promise.all(
      processes
        .map(proc => this.states.get(proc.pid)!)
        .filter(state => !state.injected && !this.loadTasks.has(state.pid))
        .map(state => this.probeAndSeed(state)),
    );

    const seen = new Set(processes.map(proc => proc.pid));
    const result: HookProcessInfo[] = [];
    for (const proc of processes) {
      result.push(this.toPublicInfo(this.ensureState(proc.pid)));
    }
    for (const state of this.states.values()) {
      if (!seen.has(state.pid) && state.injected) {
        result.push(this.toPublicInfo(state));
      }
    }
    return result.sort((a, b) => a.pid - b.pid);
  }

  async loadProcess(pid: number): Promise<HookProcessInfo> {
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error('invalid pid');
    }
    const runningTask = this.loadTasks.get(pid);
    if (runningTask) return runningTask;

    const task = this.loadProcessInternal(pid);
    this.loadTasks.set(pid, task);
    try {
      return await task;
    } finally {
      this.loadTasks.delete(pid);
    }
  }

  async unloadProcess(pid: number): Promise<HookProcessInfo> {
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error('invalid pid');
    }
    const runningTask = this.unloadTasks.get(pid);
    if (runningTask) return runningTask;

    const task = this.unloadProcessInternal(pid);
    this.unloadTasks.set(pid, task);
    try {
      return await task;
    } finally {
      this.unloadTasks.delete(pid);
    }
  }

  dispose(): void {
    for (const state of this.states.values()) {
      state.client?.close();
      state.client = null;
      state.connected = false;
      state.loggedIn = false;
      state.status = state.injected ? 'disconnected' : 'available';
    }
  }

  private async loadProcessInternal(pid: number): Promise<HookProcessInfo> {
    const state = this.ensureState(pid);
    state.status = 'loading';
    state.error = '';

    try {
      if (!state.injected) {
        // Fast path: if QQ.exe still hosts a hook DLL from a previous SnowLuma
        // run, the control pipe is already listed. Skip re-injection on a hit.
        if (await QqHookClient.probePipe(pid)) {
          state.injected = true;
          state.method = 'reconnect';
          log.info('SnowLuma reconnected to existing hook in PID=%d', pid);
        } else {
          state.injectResult = injectHookProcess(pid);
          state.injected = true;
          state.method = state.injectResult.method;
          log.info('SnowLuma loaded into PID=%d via %s', pid, state.method);
        }
      }
      state.status = state.connected ? (state.loggedIn ? 'online' : 'loaded') : 'loaded';
      this.startClient(state);
    } catch (error) {
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      log.error('load failed: PID=%d err=%s', pid, state.error);
    }

    return this.toPublicInfo(state);
  }

  private async unloadProcessInternal(pid: number): Promise<HookProcessInfo> {
    const state = this.ensureState(pid);
    state.error = '';

    try {
      state.client?.close();
      state.client = null;
      state.sender = null;
      state.connectTask = null;
      state.bound = false;
      state.connected = false;
      state.loggedIn = false;
      this.bridgeManager.onPidDisconnected(pid);

      const handle = state.injectResult?.handle;
      if (state.injected && handle) {
        unloadHookProcess(pid, handle);
        log.info('SnowLuma unloaded from PID=%d via unloadModuleManual', pid);
      }

      state.injected = false;
      state.injectResult = null;
      state.method = '';
      state.uin = '0';
      state.status = 'available';
    } catch (error) {
      state.status = 'error';
      state.error = error instanceof Error ? error.message : String(error);
      log.error('unload failed: PID=%d err=%s', pid, state.error);
    }

    return this.toPublicInfo(state);
  }

  private ensureState(pid: number): HookProcessState {
    let state = this.states.get(pid);
    if (!state) {
      state = {
        pid,
        name: 'QQ.exe',
        path: '',
        injected: false,
        connected: false,
        loggedIn: false,
        uin: '0',
        status: 'available',
        error: '',
        method: '',
        client: null,
        sender: null,
        injectResult: null,
        connectTask: null,
        bound: false,
      };
      this.states.set(pid, state);
    }
    return state;
  }

  private startClient(state: HookProcessState): void {
    if (!state.client) {
      state.client = new QqHookClient(state.pid);
      state.sender = new HookPacketClient(state.client);
    }
    if (!state.bound) {
      this.bindClient(state, state.client);
      state.bound = true;
    }
    if (!state.connectTask) {
      state.connectTask = this.connectClient(state).finally(() => {
        state.connectTask = null;
      });
      void state.connectTask;
    }
  }

  private bindClient(state: HookProcessState, client: QqHookClient): void {
    client.on('packet', packet => this.handlePacket(state, packet));
    client.on('loginState', loginState => this.handleLoginState(state, loginState));
    client.on('error', error => {
      state.error = error instanceof Error ? error.message : String(error);
      if (!state.connected) state.status = 'error';
      log.warn('pipe error: PID=%d err=%s', state.pid, state.error);
    });
    client.on('close', () => {
      state.connected = false;
      if (state.loggedIn) {
        state.loggedIn = false;
        state.status = 'disconnected';
        this.bridgeManager.onPidDisconnected(state.pid);
      }
    });
  }

  private async connectClient(state: HookProcessState): Promise<void> {
    const client = state.client;
    if (!client) return;

    for (let attempt = 1; attempt <= CONNECT_RETRY_COUNT; attempt++) {
      try {
        await client.connectAll({ recv: true });
        state.connected = true;
        state.status = client.isLoggedIn ? 'online' : 'loaded';
        state.error = '';
        const loginState = client.getLoginState();
        if (loginState.loggedIn) {
          this.handleLoginState(state, loginState);
        }
        log.info('pipe connected: PID=%d', state.pid);
        return;
      } catch (error) {
        state.error = error instanceof Error ? error.message : String(error);
        if (attempt >= CONNECT_RETRY_COUNT) {
          state.status = 'error';
          log.error('pipe connect failed: PID=%d err=%s', state.pid, state.error);
          return;
        }
        await delay(CONNECT_RETRY_INTERVAL_MS);
      }
    }
  }

  private handleLoginState(state: HookProcessState, loginState: QqHookLoginState): void {
    const wasLoggedIn = state.loggedIn;
    const previousUin = state.uin;
    state.uin = loginState.uin || loginState.uinNumber.toString();
    state.loggedIn = loginState.loggedIn && isRealUin(state.uin);
    state.status = state.loggedIn ? 'online' : (state.connected ? 'loaded' : state.status);

    if (!state.loggedIn || !state.sender) return;
    if (wasLoggedIn && previousUin === state.uin) return;

    this.bridgeManager.onHookLogin(state.pid, state.uin, state.sender);
    log.success('login detected: PID=%d UIN=%s', state.pid, state.uin);
  }

  private handlePacket(state: HookProcessState, packet: QqHookPacket): void {
    if (!state.loggedIn) return;
    const uin = packet.uin || state.uin;
    if (!isRealUin(uin)) return;
    this.ntqq.onHookPacket(state.pid, { ...packet, uin });
  }

  private toPublicInfo(state: HookProcessState): HookProcessInfo {
    return {
      pid: state.pid,
      name: state.name,
      path: state.path,
      injected: state.injected,
      connected: state.connected,
      loggedIn: state.loggedIn,
      uin: state.uin,
      status: state.status,
      error: state.error,
      method: state.method,
    };
  }
}

function isRealUin(uin: string): boolean {
  if (!uin || uin === '0') return false;
  return /^\d+$/.test(uin) && uin.length >= 5;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
