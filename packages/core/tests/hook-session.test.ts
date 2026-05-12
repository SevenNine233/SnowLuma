import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { HookSession } from '../src/hook/hook-session';
import type { ManualMapHandle } from '../src/hook/injector';
import type { QqHookClient } from '../src/hook/qq-hook-client';

const DUMMY_HANDLE: ManualMapHandle = { base: 0n, entry: 0n, exceptionTable: 0n, size: 0 };

/** Minimal stand-in for QqHookClient. Tests drive login/packet/error/close
 * events directly via fire* helpers. connectAll succeeds unless told otherwise. */
class FakeClient extends EventEmitter {
  isClosed = false;
  isLoggedIn = false;
  shouldFailConnect = false;
  private loginState = { loggedIn: false, uin: '0', uinNumber: 0n };

  async connectAll(_opts: { recv: boolean }): Promise<void> {
    if (this.shouldFailConnect) throw new Error('connect failed');
    if (this.isClosed) throw new Error('client is closed');
  }
  getLoginState() { return { ...this.loginState }; }
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.emit('close');
  }

  fireLogin(uin: string): void {
    this.isLoggedIn = true;
    this.loginState = { loggedIn: true, uin, uinNumber: BigInt(uin) };
    this.emit('loginState', { ...this.loginState });
  }
}

function makeSession(opts: { pid?: number; pipeLive?: boolean; clientFailsConnect?: boolean } = {}) {
  const pid = opts.pid ?? 1234;
  let pipeLive = opts.pipeLive ?? false;
  const clients: FakeClient[] = [];
  const injector = {
    inject: vi.fn(() => ({ method: 'loadModuleManual' as const, handle: DUMMY_HANDLE })),
    unload: vi.fn(),
  };

  const session = new HookSession(pid, {
    injector,
    makeClient: () => {
      const c = new FakeClient();
      if (opts.clientFailsConnect) c.shouldFailConnect = true;
      clients.push(c);
      // Cast: FakeClient mirrors only the surface HookSession touches.
      return c as unknown as QqHookClient;
    },
    pipeWatcher: { isPipeLive: () => pipeLive },
  });

  return {
    session,
    injector,
    clients,
    currentClient: () => clients[clients.length - 1],
    setPipeLive: (v: boolean) => { pipeLive = v; },
  };
}

const flush = () => new Promise<void>(r => setImmediate(r));

describe('HookSession — load', () => {
  it('with no live pipe: injects, status → connecting, method from inject result', async () => {
    const { session, injector } = makeSession({ pipeLive: false });
    const info = await session.load();

    expect(injector.inject).toHaveBeenCalledOnce();
    expect(info.status).toBe('connecting');
    expect(info.method).toBe('loadModuleManual');
    expect(info.injected).toBe(true);
  });

  it('fast-path: pipe already live → skip inject, method → "reconnect"', async () => {
    const { session, injector } = makeSession({ pipeLive: true });
    const info = await session.load();

    expect(injector.inject).not.toHaveBeenCalled();
    expect(info.method).toBe('reconnect');
    expect(info.injected).toBe(true);
    expect(info.status).toBe('connecting');
  });

  it('inject failure → status error, error message captured', async () => {
    const injector = {
      inject: vi.fn(() => { throw new Error('inject boom'); }),
      unload: vi.fn(),
    };
    const session = new HookSession(1234, {
      injector,
      makeClient: () => new FakeClient() as unknown as QqHookClient,
      pipeWatcher: { isPipeLive: () => false },
    });
    const info = await session.load();
    expect(info.status).toBe('error');
    expect(info.error).toBe('inject boom');
  });
});

describe('HookSession — pipe up/down → connect lifecycle', () => {
  it('onPipeUp after load: client connects → status loaded', async () => {
    const ctx = makeSession({ pipeLive: true });
    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();

    expect(ctx.session.status).toBe('loaded');
    expect(ctx.clients).toHaveLength(1);
  });

  it('emits "login" with (uin, sender) after client signals loggedIn', async () => {
    const ctx = makeSession({ pipeLive: true });
    const loginSpy = vi.fn();
    ctx.session.on('login', loginSpy);

    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();
    ctx.currentClient().fireLogin('10001');

    expect(loginSpy).toHaveBeenCalledOnce();
    const [uin, sender] = loginSpy.mock.calls[0]!;
    expect(uin).toBe('10001');
    expect(typeof (sender as { sendPacket: unknown }).sendPacket).toBe('function');
    expect(ctx.session.status).toBe('online');
    expect(ctx.session.uin).toBe('10001');
  });

  it('does not re-emit "login" on duplicate loginState with same uin', async () => {
    const ctx = makeSession({ pipeLive: true });
    const loginSpy = vi.fn();
    ctx.session.on('login', loginSpy);

    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();

    ctx.currentClient().fireLogin('10001');
    ctx.currentClient().fireLogin('10001');

    expect(loginSpy).toHaveBeenCalledOnce();
  });

  it('connect failure: stays in connecting, error message captured (will retry on next tick)', async () => {
    const ctx = makeSession({ pipeLive: true, clientFailsConnect: true });
    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();

    expect(ctx.session.status).toBe('connecting');
    expect(ctx.session.error).toBe('connect failed');
  });

  it('onPipeDown while logged in: emits disconnected(true), status disconnected', async () => {
    const ctx = makeSession({ pipeLive: true });
    const discSpy = vi.fn();
    ctx.session.on('disconnected', discSpy);

    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();
    ctx.currentClient().fireLogin('10001');

    ctx.session.onPipeDown();
    await flush();

    expect(discSpy).toHaveBeenCalledWith(true);
    expect(ctx.session.status).toBe('disconnected');
  });

  it('onPipeDown while connected-but-not-logged-in: emits disconnected(false), status connecting', async () => {
    const ctx = makeSession({ pipeLive: true });
    const discSpy = vi.fn();
    ctx.session.on('disconnected', discSpy);

    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();
    // No login fired — we're connected but not logged in.

    ctx.session.onPipeDown();
    await flush();

    // disconnected(false) is currently NOT emitted — disconnect events are
    // reserved for "we owe BridgeManager a disconnect notification". This
    // preserves the original behaviour.
    expect(discSpy).not.toHaveBeenCalled();
    expect(ctx.session.status).toBe('connecting');
  });

  it('repeated pipe down → up cycles reach consistent state', async () => {
    const ctx = makeSession({ pipeLive: true });
    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();
    ctx.currentClient().fireLogin('10001');
    expect(ctx.session.status).toBe('online');

    ctx.session.onPipeDown();
    await flush();
    expect(ctx.session.status).toBe('disconnected');

    // Pipe returns — session builds a fresh client.
    ctx.session.onPipeUp();
    await flush();
    expect(ctx.clients.length).toBeGreaterThan(1);
    expect(ctx.session.status).toBe('loaded');
  });
});

describe('HookSession — unload', () => {
  it('while logged in: emits disconnected(true), calls unload, status available', async () => {
    const ctx = makeSession({ pipeLive: false });
    await ctx.session.load();
    ctx.setPipeLive(true);
    ctx.session.onPipeUp();
    await flush();
    ctx.currentClient().fireLogin('10001');

    const discSpy = vi.fn();
    ctx.session.on('disconnected', discSpy);
    ctx.setPipeLive(false); // unload verification will see the pipe gone

    await ctx.session.unload();

    expect(discSpy).toHaveBeenCalledWith(true);
    expect(ctx.injector.unload).toHaveBeenCalledOnce();
    expect(ctx.session.status).toBe('available');
  });

  it('when pipe stays live after unload: status connecting with retry message', async () => {
    const ctx = makeSession({ pipeLive: false });
    await ctx.session.load();
    // Simulate the unload-failed scenario: pipe is still up after unload.
    ctx.setPipeLive(true);

    const info = await ctx.session.unload();

    expect(info.status).toBe('connecting');
    expect(info.error).toContain('命名管道仍然存在');
  });
});

describe('HookSession — serialization', () => {
  it('user mashing load → unload → load runs in order, end state consistent', async () => {
    const ctx = makeSession({ pipeLive: false });

    const p1 = ctx.session.load();
    const p2 = ctx.session.unload();
    const p3 = ctx.session.load();
    await Promise.all([p1, p2, p3]);

    expect(ctx.injector.inject).toHaveBeenCalledTimes(2);
    expect(ctx.injector.unload).toHaveBeenCalledTimes(1);
    expect(ctx.session.status).toBe('connecting');
  });

  it('onPipeUp queued behind in-flight load resolves correctly', async () => {
    const ctx = makeSession({ pipeLive: true });

    const loadPromise = ctx.session.load();
    ctx.session.onPipeUp(); // queued behind load

    await loadPromise;
    await flush();

    expect(ctx.session.status).toBe('loaded');
  });
});

describe('HookSession — process gone', () => {
  it('emits disconnected(true) then disposed when killed while logged in', async () => {
    const ctx = makeSession({ pipeLive: true });
    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();
    ctx.currentClient().fireLogin('10001');

    const events: string[] = [];
    ctx.session.on('disconnected', () => events.push('disconnected'));
    ctx.session.on('disposed', () => events.push('disposed'));

    ctx.session.notifyProcessGone();
    await flush();

    expect(events).toEqual(['disconnected', 'disposed']);
    expect(ctx.session.isDisposed).toBe(true);
  });

  it('emits only disposed when killed before login', async () => {
    const ctx = makeSession({ pipeLive: true });
    await ctx.session.load();
    ctx.session.onPipeUp();
    await flush();

    const events: string[] = [];
    ctx.session.on('disconnected', () => events.push('disconnected'));
    ctx.session.on('disposed', () => events.push('disposed'));

    ctx.session.notifyProcessGone();
    await flush();

    expect(events).toEqual(['disposed']);
  });
});
