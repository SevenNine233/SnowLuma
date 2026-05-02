import { createLogger } from '../utils/logger';
import type { PacketInfo } from './types';

const log = createLogger('NTQQ');

export type CmdCallback = (pkt: PacketInfo) => void;

export interface HookPacketInput {
  seq: number;
  error: number;
  cmd: string;
  uin: string;
  body: Uint8Array;
}

export class NtqqHandler {
  private cmdHandlers = new Map<string, CmdCallback[]>();
  private cmdAllHandlers: CmdCallback[] = [];

  registerCmd(cmd: string, cb: CmdCallback): void {
    const arr = this.cmdHandlers.get(cmd) ?? [];
    arr.push(cb);
    this.cmdHandlers.set(cmd, arr);
  }
  registerCmdAll(cb: CmdCallback): void { this.cmdAllHandlers.push(cb); }

  onHookPacket(pid: number, packet: HookPacketInput): void {
    this.dispatchPacket({
      pid,
      uin: packet.uin,
      serviceCmd: packet.cmd,
      seqId: packet.seq,
      retCode: packet.error,
      fromClient: false,
      body: Buffer.from(packet.body),
    });
  }

  private dispatchPacket(pkt: PacketInfo): void {
    const specific = this.cmdHandlers.get(pkt.serviceCmd);
    if (specific) {
      for (const cb of specific) {
        try { cb(pkt); } catch (e) {
          log.error('dispatch error for %s: %s', pkt.serviceCmd, e instanceof Error ? (e.stack ?? e.message) : String(e));
        }
      }
    }
    for (const cb of this.cmdAllHandlers) {
      try { cb(pkt); } catch (e) {
        log.error('dispatch error for %s: %s', pkt.serviceCmd, e instanceof Error ? (e.stack ?? e.message) : String(e));
      }
    }
  }
}
