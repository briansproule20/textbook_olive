import type { Action, Direction } from "../sprites/characterTextures";

export interface PlayerState {
  action: Action;
  facing: Direction;
  name: string;
  speed: number;
  x: number;
  y: number;
}

type JoinHandler = (id: string, state: PlayerState) => void;
type UpdateHandler = (id: string, state: PlayerState) => void;
type LeaveHandler = (id: string) => void;

const SEND_THROTTLE_MS = 50;

export class MultiplayerClient {
  private url: string | undefined;
  private joinHandlers: JoinHandler[] = [];
  private updateHandlers: UpdateHandler[] = [];
  private leaveHandlers: LeaveHandler[] = [];
  private lastSendAt = 0;
  private room: unknown | null = null;
  private connected = false;

  constructor(url?: string) {
    this.url = url;
  }

  get isOffline(): boolean {
    return !this.url;
  }

  async connect(roomName = "iso_world"): Promise<void> {
    if (!this.url) return;
    try {
      const mod = await import("colyseus.js");
      const ClientCtor = (mod as { Client: new (url: string) => unknown }).Client;
      const client = new ClientCtor(this.url) as {
        joinOrCreate: (name: string) => Promise<unknown>;
      };
      const room = (await client.joinOrCreate(roomName)) as {
        sessionId: string;
        state: { players: Map<string, PlayerState> & { onAdd?: Function; onRemove?: Function; onChange?: Function } };
        onMessage: (t: string, cb: (m: unknown) => void) => void;
        send: (t: string, payload: unknown) => void;
        leave: () => void;
      };
      this.room = room;
      this.connected = true;
      const players = room.state.players as unknown as {
        onAdd?: (cb: (player: PlayerState, key: string) => void) => void;
        onRemove?: (cb: (player: PlayerState, key: string) => void) => void;
      };
      players.onAdd?.((player, key) => {
        this.joinHandlers.forEach((h) => h(key, { ...player }));
        const p = player as unknown as { onChange?: (cb: () => void) => void };
        p.onChange?.(() => this.updateHandlers.forEach((h) => h(key, { ...player })));
      });
      players.onRemove?.((_p, key) => this.leaveHandlers.forEach((h) => h(key)));
    } catch (e) {
      console.warn("[mp] connect failed, going offline:", e);
      this.room = null;
      this.connected = false;
    }
  }

  sendUpdate(state: PlayerState): void {
    if (!this.connected || !this.room) return;
    const now = Date.now();
    if (now - this.lastSendAt < SEND_THROTTLE_MS) return;
    this.lastSendAt = now;
    const r = this.room as { send: (t: string, p: unknown) => void };
    r.send("update", state);
  }

  onPlayerJoin(handler: JoinHandler): void {
    this.joinHandlers.push(handler);
  }

  onPlayerUpdate(handler: UpdateHandler): void {
    this.updateHandlers.push(handler);
  }

  onPlayerLeave(handler: LeaveHandler): void {
    this.leaveHandlers.push(handler);
  }

  disconnect(): void {
    if (this.room) {
      const r = this.room as { leave?: () => void };
      try {
        r.leave?.();
      } catch {}
    }
    this.room = null;
    this.connected = false;
  }
}
