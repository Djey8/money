import { Injectable, NgZone, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { TableLegalAction, TableView } from '@money/domain';
import { environment } from '../../environments/environment';

/** One line of what happened at the table, as the stream and the log carry it. */
export interface TableEventLine {
  seq: number;
  version: number;
  at: string;
  type: string;
  seat: number | null;
  data?: Record<string, unknown>;
}

/** Who is connected right now (the stream's `presence` message). */
export interface TablePresence {
  seats: number[];
}

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

/** Merges an update's table into the one held: a player entry without `books` keeps the books it had. */
export function mergeTableView(previous: TableView | null, incoming: TableView): TableView {
  if (!previous) return incoming;
  return {
    ...incoming,
    players: incoming.players.map((player, seat) =>
      Object.prototype.hasOwnProperty.call(player, 'books')
        ? player
        : { ...player, books: previous.players[seat] ? previous.players[seat].books : null },
    ),
  };
}

function newCommandId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * One open table of the multiplayer Cashflow game (todo/cashflow-multiplayer.md phase U2): follows the server's stream
 * (snapshot, then updates; the browser's EventSource reconnects by itself and resumes with Last-Event-ID), holds the table
 * as the viewer may see it, and sends moves. The server decides everything - this keeps no rules, it shows what it is told
 * and sends only what `legalActions` lists. Self-hosted only (lazy tables chunk, docs/adr/0004); not providedIn root, one
 * per table screen.
 */
@Injectable()
export class TableSessionService {
  private readonly base = `${environment.selfhosted.apiUrl}/v1/game/rooms`;
  private source: EventSource | null = null;
  private roomId = '';

  readonly room = signal<{ id: string; inviteCode?: string } | null>(null);
  readonly view = signal<TableView | null>(null);
  readonly legalActions = signal<TableLegalAction[]>([]);
  readonly events = signal<TableEventLine[]>([]);
  readonly presence = signal<TablePresence>({ seats: [] });
  readonly connection = signal<ConnectionState>('connecting');
  /** The words of the last refused move or failed call, for the screen to show. */
  readonly problem = signal<string | null>(null);
  readonly busy = signal(false);

  constructor(
    private http: HttpClient,
    private zone: NgZone,
  ) {}

  /** Starts following a table. Closes any earlier one. */
  open(roomId: string): void {
    this.close();
    this.roomId = roomId;
    this.connection.set('connecting');
    const source = new EventSource(`${this.base}/${encodeURIComponent(roomId)}/events`, {
      withCredentials: true,
    });
    this.source = source;
    source.onopen = () => this.zone.run(() => this.connection.set('live'));
    source.onerror = () =>
      this.zone.run(() =>
        this.connection.set(source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting'),
      );
    this.listen(source, 'snapshot', (data) => {
      this.room.set(data.room ?? null);
      this.view.set(data.view);
      this.legalActions.set(data.legalActions ?? []);
    });
    this.listen(source, 'update', (data) => {
      // updates at or below the held version are replays after a reconnect
      const held = this.view();
      if (held && data.version <= held.version) return;
      this.view.set(mergeTableView(held, data.view));
      this.legalActions.set(data.legalActions ?? []);
      this.addEvents(data.events ?? []);
    });
    this.listen(source, 'log', (data) => this.addEvents([data]));
    this.listen(source, 'presence', (data) => this.presence.set(data));
  }

  close(): void {
    if (this.source) this.source.close();
    this.source = null;
    this.connection.set('closed');
  }

  /** The legal action ids, for enabling buttons. */
  can(action: string): boolean {
    return this.legalActions().some((entry) => entry.action === action);
  }

  /** One move of play; a retry of the same call is applied at most once (clientCommandId). */
  async play(command: Record<string, unknown>): Promise<boolean> {
    const view = this.view();
    return this.send('commands', 'post', {
      command,
      clientCommandId: newCommandId(),
      expectedVersion: view?.version,
    });
  }

  /** A lobby action: ready, start, profession, leave, kick, settings. */
  async lobby(
    path: 'leave' | 'ready' | 'kick' | 'settings' | 'start' | 'profession',
    body: Record<string, unknown> = {},
  ): Promise<boolean> {
    const method =
      path === 'ready' || path === 'settings' || path === 'profession' ? 'put' : 'post';
    return this.send(path, method, { ...body, clientCommandId: newCommandId() });
  }

  private async send(
    path: string,
    method: 'post' | 'put',
    body: Record<string, unknown>,
  ): Promise<boolean> {
    this.busy.set(true);
    this.problem.set(null);
    try {
      const url = `${this.base}/${encodeURIComponent(this.roomId)}/${path}`;
      await firstValueFrom(
        method === 'post' ? this.http.post(url, body) : this.http.put(url, body),
      );
      // the stream carries the change to everyone, this client included
      return true;
    } catch (error) {
      const e = error as { error?: { detail?: string }; message?: string };
      this.problem.set(e?.error?.detail ?? e?.message ?? 'The move did not go through.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private listen(source: EventSource, name: string, handler: (data: any) => void): void {
    source.addEventListener(name, (message) => {
      let data: unknown;
      try {
        data = JSON.parse((message as MessageEvent).data);
      } catch {
        return;
      }
      this.zone.run(() => handler(data));
    });
  }

  private addEvents(lines: TableEventLine[]): void {
    if (!lines.length) return;
    const known = new Set(this.events().map((line) => line.seq));
    const fresh = lines.filter((line) => !known.has(line.seq));
    if (fresh.length) this.events.set([...this.events(), ...fresh].sort((a, b) => a.seq - b.seq));
  }
}
