import { Injectable, NgZone, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { problemText } from './problem.texts';
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

/** Whether a finished game counted for the rating, and the change it made to each seat. */
export interface TableRating {
  ranked: boolean;
  why?: string;
  changes: { seat: number; before: number; after: number; delta: number }[];
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

/** What the server answers to a move: the events it made and the version the table is at after it. */
export interface TableMoveResult {
  events?: TableEventLine[];
  appliedVersion?: number;
  version?: number;
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
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly base = `${environment.selfhosted.apiUrl}/v1/game/rooms`;
  private source: EventSource | null = null;
  private roomId = '';

  readonly room = signal<{ id: string; inviteCode?: string; language?: string } | null>(null);
  readonly view = signal<TableView | null>(null);
  readonly legalActions = signal<TableLegalAction[]>([]);
  readonly events = signal<TableEventLine[]>([]);
  readonly presence = signal<TablePresence>({ seats: [] });
  readonly connection = signal<ConnectionState>('connecting');
  /** The line has been live at least once: only after that does losing it mean something to tell. */
  readonly everLive = signal(false);
  /** The browser says there is no network (or a read just failed): the screen shows "connection lost". */
  readonly offline = signal(false);
  /** The words of the last refused move or failed call, for the screen to show. */
  readonly problem = signal<string | null>(null);
  readonly busy = signal(false);
  /** What the finished game did to the ratings (null until the leaderboard has recorded it). */
  readonly rating = signal<TableRating | null>(null);
  private ratingTries = 0;
  /** My finished game has been filed in my saved games. */
  readonly saved = signal(false);
  /** Called with the events of an update before its table is shown (the game screen tells the other players' moves from them). */
  onEvents: ((lines: TableEventLine[], view: TableView) => void) | null = null;

  constructor(
    protected http: HttpClient,
    protected zone: NgZone,
  ) {}

  /** A table of another game (the Dreamfund) is brought into the shape the table screens read; the classic table is as it is. */
  protected adaptView(view: TableView): TableView {
    return view;
  }

  /** The same for the moves the server lists. */
  protected adaptLegal(actions: unknown[] | undefined): TableLegalAction[] {
    return (actions ?? []) as TableLegalAction[];
  }

  /** The table being followed ('' when none). */
  get tableId(): string {
    return this.roomId;
  }

  /** Starts following a table. Closes any earlier one. */
  open(roomId: string): void {
    this.close();
    this.roomId = roomId;
    this.rating.set(null);
    this.ratingTries = 0;
    this.connection.set('connecting');
    const source = new EventSource(`${this.base}/${encodeURIComponent(roomId)}/events`, {
      withCredentials: true,
    });
    this.source = source;
    this.lastSeen = Date.now();
    this.watch();
    source.onopen = () =>
      this.zone.run(() => {
        this.connection.set('live');
        this.everLive.set(true);
      });
    source.onerror = () =>
      this.zone.run(() =>
        this.connection.set(source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting'),
      );
    this.listen(source, 'snapshot', (data) => {
      this.room.set(data.room ?? null);
      const shown = this.adaptView(data.view);
      this.view.set(shown);
      this.legalActions.set(this.adaptLegal(data.legalActions));
      this.watchRating(roomId, shown);
    });
    this.listen(source, 'update', (data) => {
      // updates at or below the held version are replays after a reconnect
      const held = this.view();
      if (held && data.version <= held.version) return;
      // told first, so a screen that shows the moves can hold the tokens where they were before the books move them
      const shown = this.adaptView(data.view);
      this.onEvents?.(data.events ?? [], shown);
      this.view.set(mergeTableView(held, shown));
      this.legalActions.set(this.adaptLegal(data.legalActions));
      this.addEvents(data.events ?? []);
      this.watchRating(roomId, shown);
    });
    this.listen(source, 'log', (data) => this.addEvents([data]));
    this.listen(source, 'ping', () => undefined);
    this.listen(source, 'presence', (data) => this.presence.set(data));
    // the stream only brings what happens from now on: the record of the table so far is read from its log
    void this.loadLog(roomId);
  }

  /**
   * Whether the finished game counted for the rating, and what it did to each seat. The leaderboard records a game just after it
   * ends, so it is asked for a few times (1, 2, 4, 8 seconds) until it is there.
   */
  private watchRating(roomId: string, view: TableView): void {
    if (view.phase !== 'finished' || this.rating() || this.ratingTries > 0) return;
    this.ratingTries = 1;
    const ask = (delay: number, left: number) => {
      setTimeout(async () => {
        if (this.roomId !== roomId || this.rating()) return;
        try {
          const answer = (await firstValueFrom(
            this.http.get(`${this.base}/${encodeURIComponent(roomId)}`),
          )) as { rating?: TableRating };
          if (answer.rating) {
            this.rating.set(answer.rating);
            return;
          }
        } catch {
          // asked again below
        }
        if (left > 0) ask(delay * 2, left - 1);
      }, delay);
    };
    ask(1000, 4);
  }

  /** Reads the table's whole log (every move of everybody since the game began) into the events held, page by page. */
  private async loadLog(roomId: string): Promise<void> {
    try {
      let after = 0;
      for (let page = 0; page < 200; page += 1) {
        const url = `${this.base}/${encodeURIComponent(roomId)}/log?after=${after}&limit=1000`;
        const answer = (await firstValueFrom(this.http.get(url))) as {
          events?: TableEventLine[];
          next?: number;
          end?: boolean;
        };
        if (this.roomId !== roomId) return; // another table was opened meanwhile
        this.addEvents(answer.events ?? []);
        if (answer.end || !answer.events?.length) return;
        after = answer.next ?? after;
      }
    } catch {
      // the history is a convenience: the live stream carries on without it
    }
  }

  close(): void {
    this.unwatch();
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
    return (await this.playForResult(command)) !== null;
  }

  /** A move of play, answered with what the server says it did (events, the version it made); null when it was refused. */
  async playForResult(command: Record<string, unknown>): Promise<TableMoveResult | null> {
    const done = await this.send('commands', 'post', {
      command,
      clientCommandId: newCommandId(),
      // No expected version: the server puts every move in a line per table and judges it against the table as it is when its turn
      // comes (a move of somebody else a moment earlier must not make mine fail) - the rules say if it is not legal any more.
    });
    return done === null ? null : (done as TableMoveResult);
  }

  /** Resolves once the stream has brought the table up to the given version (or after `timeoutMs`). */
  async untilVersion(version: number, timeoutMs = 4000): Promise<void> {
    const started = Date.now();
    while ((this.view()?.version ?? 0) < version && Date.now() - started < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /** Files my own final books as a saved game of my account (once; a repeat answers `alreadyFiled`). */
  async save(): Promise<boolean> {
    const ok = (await this.send('save', 'post', {})) !== null;
    if (ok) this.saved.set(true);
    return ok;
  }

  /** A lobby action: ready, start, profession, leave, kick, settings. */
  async lobby(
    path: 'leave' | 'ready' | 'kick' | 'settings' | 'start' | 'profession' | 'bots',
    body: Record<string, unknown> = {},
  ): Promise<boolean> {
    const method =
      path === 'ready' || path === 'settings' || path === 'profession' ? 'put' : 'post';
    return (await this.send(path, method, { ...body, clientCommandId: newCommandId() })) !== null;
  }

  private async send(
    path: string,
    method: 'post' | 'put',
    body: Record<string, unknown>,
  ): Promise<unknown | null> {
    this.busy.set(true);
    this.problem.set(null);
    try {
      const url = `${this.base}/${encodeURIComponent(this.roomId)}/${path}`;
      const answer = await firstValueFrom(
        method === 'post' ? this.http.post(url, body) : this.http.put(url, body),
      );
      // the stream carries the change to everyone, this client included
      return answer ?? {};
    } catch (error) {
      const e = error as {
        status?: number;
        error?: { detail?: string; code?: string };
        message?: string;
      };
      // the table had moved on without this screen (a stale version): get it afresh and carry on, nothing to tell the player
      if (e?.status === 409 && e?.error?.code === 'room_conflict') {
        void this.resync();
        return null;
      }
      // a refusal a player meets is told in their language; a rule's own explanation stays as the server worded it
      const lang = this.translate?.currentLang || this.translate?.defaultLang || 'en';
      this.problem.set(
        problemText(lang, e?.error?.code, e?.error?.detail) ??
          e?.message ??
          'The move did not go through.',
      );
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * The table is out of step with the stream (a tab that slept, a connection that dropped silently, a move refused because the table
   * had moved on): read it afresh, put it on screen, and start the stream again if it is gone. The player never has to refresh.
   */
  async resync(): Promise<void> {
    const roomId = this.roomId;
    if (!roomId || this.resyncing) return;
    this.resyncing = true;
    try {
      const answer = (await firstValueFrom(
        this.http.get(`${this.base}/${encodeURIComponent(roomId)}`),
      )) as {
        table?: TableView;
        legalActions?: TableLegalAction[];
        id?: string;
        language?: string;
      };
      if (this.roomId !== roomId || !answer.table) return;
      this.lastSeen = Date.now();
      this.offline.set(false);
      const held = this.view();
      if (!held || answer.table.version !== held.version) {
        this.view.set(this.adaptView(answer.table));
        this.legalActions.set(this.adaptLegal(answer.legalActions));
        void this.loadLog(roomId);
      }
      if (this.source && this.source.readyState !== EventSource.OPEN) this.open(roomId);
    } catch {
      // no connection: the bar says so, and the next try comes with the connection
      this.offline.set(true);
    } finally {
      this.resyncing = false;
    }
  }

  private resyncing = false;
  private lastSeen = Date.now();
  private watcher: ReturnType<typeof setInterval> | null = null;
  private readonly wake = () => {
    if (document.visibilityState === 'visible') void this.resync();
  };
  private readonly online = () => {
    this.offline.set(false);
    void this.resync();
  };
  private readonly gone = () => this.zone.run(() => this.offline.set(true));

  /** What keeps the table true: the stream is silent for too long, the tab comes back, the network comes back. */
  private watch(): void {
    this.unwatch();
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.online);
    window.addEventListener('offline', this.gone);
    this.watcher = setInterval(() => {
      // the server's ping comes every 25 seconds: a minute of nothing means the line is dead
      if (Date.now() - this.lastSeen > 60_000) void this.resync();
    }, 10_000);
  }

  private unwatch(): void {
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.online);
    window.removeEventListener('offline', this.gone);
    if (this.watcher) clearInterval(this.watcher);
    this.watcher = null;
  }

  private listen(source: EventSource, name: string, handler: (data: any) => void): void {
    source.addEventListener(name, (message) => {
      this.lastSeen = Date.now();
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
