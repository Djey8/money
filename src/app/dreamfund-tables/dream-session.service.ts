import { Injectable, NgZone, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../environments/environment';
import { problemText } from '../tables/problem.texts';

/**
 * The Dreamfund tables API (docs/api/openapi.yaml, /v1/game/rooms with `kind: dreamfund`) and the live view of one table. Its own files,
 * only ever imported from the lazy Dreamfund chunk behind app.routes.selfhosted.ts, so none of it reaches the Firebase build
 * (docs/adr/0004). The server decides everything: this keeps no rules, it shows what it is told and sends only what `legalActions` lists.
 */

export interface DreamLifeSummary {
  months: number;
  cashMinor: number;
  reserveMinor: number;
  reserveTargetMinor: number;
  passiveMinor: number;
  expensesMinor: number;
  livingMinor: number;
  cashflowMinor: number;
  netWorthMinor: number;
  bankLoanMinor: number;
  dreamTargetMinor: number;
  dreamSavedMinor: number;
  dreamPoints: number;
  goals: { reserve: number; debts: number; dream: number; independence: number };
  debts: { tag: string; amountMinor: number }[];
  holdings: {
    title: string;
    cardId: string;
    units?: number;
    monthlyMinor: number;
    paidMinor: number;
  }[];
  plans: { kind: string; id: string; perMinor: number; leftMinor: number }[];
  smile: { cardId: string; totalMinor: number; savedMinor: number; points: number }[];
  career: string | null;
}

export type DreamPending =
  | { kind: 'emergency'; cardId: string }
  | { kind: 'life'; cardId: string }
  | { kind: 'career_branch'; options: string[] }
  | { kind: 'dream'; offers: string[] }
  | { kind: 'opportunity_pile' }
  | { kind: 'opportunity'; pile: string; offers: string[] };

export interface DreamPendingInfo {
  emergency?: {
    payMinor: number | null;
    mustPayNow: boolean;
    choices: { id: string }[];
    plans: { months: number; perMinor: number; totalMinor: number }[];
  };
  offers?: {
    id: string;
    costMinor: number;
    monthlyMinor: number;
    ok: boolean;
    reason?: string;
  }[];
  dreams?: { id: string; totalMinor: number; points: number }[];
}

export interface DreamHarvestOpen {
  sellable: string[];
  sales: { holding: string; grossMinor: number; costsMinor: number; owedMinor: number }[];
  ladders: { holding: string }[];
}

export interface DreamPlayerView {
  seat: number;
  name: string;
  color: string;
  initials?: string;
  ready: boolean;
  pick: string | null;
  professionId: string | null;
  status: 'active' | 'left';
  away: boolean;
  bot: { policyId: string } | null;
  summary: DreamLifeSummary | null;
  pending: DreamPending | { kind: string } | null;
  pendingInfo: DreamPendingInfo | null;
  harvest: DreamHarvestOpen | null;
  paydayDue: boolean;
  reached: Record<string, number | undefined>;
  you: boolean;
}

export interface DreamTableSettings {
  name: string;
  visibility: 'public' | 'private';
  maxSeats: number;
  difficulty: 'easy' | 'medium' | 'hard';
  shape: string;
  size: string;
  mode: 'guided' | 'strict';
  professions: 'duplicates' | 'unique' | 'random';
  turnOrder: 'random' | 'seat';
  clock: { mode: string; [key: string]: unknown };
  endCondition: 'first-win' | 'all-done' | 'round-limit';
  roundLimit?: number;
  spectators: boolean;
  pace: 'fast' | 'normal' | 'slow';
  ranked: boolean;
  [key: string]: unknown;
}

export interface DreamStandingView {
  seat: number;
  rank: number;
  outcome: 'won' | 'playing' | 'bankrupt' | 'left';
  goals: { reserve: number; debts: number; dream: number; independence: number };
  goalsMet: number;
  dreamPoints: number;
  score: number;
  netWorthMinor: number;
  wonRound?: number;
}

export interface DreamTableView {
  kind: 'dreamfund';
  id: string;
  version: number;
  phase: 'lobby' | 'picking' | 'playing' | 'finished' | 'abandoned';
  settings: DreamTableSettings;
  hostSeat: number;
  you: number | null;
  order: number[];
  activeSeat: number | null;
  tableRound: number;
  turnRolled: boolean;
  finishers: { seat: number; outcome: 'won' | 'bankrupt' }[];
  result: { reason: string; winnerSeat: number | null; ranking: DreamStandingView[] } | null;
  clock: { deadlineAt: number | null; pausedAt: number | null };
  markets: Record<string, number>;
  trade: {
    sellerSeat: number;
    holding: string;
    cardId: string;
    toSeat: number | null;
    priceMinor: number;
    counters: { seat: number; priceMinor: number }[];
    declinedSeats: number[];
  } | null;
  players: DreamPlayerView[];
}

export interface DreamLegalAction {
  type: string;
  hint?: Record<string, unknown>;
}

export interface DreamEventLine {
  seq: number;
  version: number;
  at: string;
  type: string;
  seat: number | null;
  data?: Record<string, unknown>;
}

export interface DreamTableSummary {
  id: string;
  name: string;
  hostName: string;
  phase: string;
  visibility: 'public' | 'private';
  seatsTaken: number;
  maxSeats: number;
  kind: 'dreamfund';
  difficulty: string;
  shape: string;
  size: string;
  mode: string;
  professions: string;
  endCondition: string;
  clock: { mode: string };
  language: string;
  joined: boolean;
  hosting?: boolean;
  humans?: number;
  ranked?: boolean;
  createdAt?: string;
}

export interface DreamBotCatalog {
  items: { id: string; name: string }[];
  levels: { id: 'master' | 'strong' | 'casual' | 'beginner'; mistakes: number }[];
}

export interface DreamCreateInput {
  kind: 'dreamfund';
  nickname: string;
  initials?: string;
  language?: string;
  settings: Record<string, unknown>;
}

const newCommandId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** The lobby side: find, open, join and leave Dreamfund tables. */
@Injectable({ providedIn: 'root' })
export class DreamApiService {
  private readonly base = `${environment.selfhosted.apiUrl}/v1/game/rooms`;
  constructor(private http: HttpClient) {}

  list(scope: 'open' | 'mine' | 'recent'): Observable<{ items: DreamTableSummary[] }> {
    return this.http.get<{ items: DreamTableSummary[] }>(
      `${this.base}?scope=${scope}&kind=dreamfund`,
    );
  }

  bots(): Observable<DreamBotCatalog> {
    return this.http.get<DreamBotCatalog>(`${this.base}/bots?kind=dreamfund`);
  }

  create(input: DreamCreateInput): Observable<{ id: string; inviteCode?: string }> {
    return this.http.post<{ id: string; inviteCode?: string }>(this.base, input);
  }

  join(
    target: { roomId?: string; code?: string },
    nickname: string,
  ): Observable<{ id?: string; language?: string }> {
    return this.http.post<{ id?: string; language?: string }>(`${this.base}/join`, {
      ...target,
      nickname,
    });
  }

  remove(roomId: string): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(
      `${this.base}/${encodeURIComponent(roomId)}?confirm=true&remove=true`,
    );
  }

  forget(roomId: string): Observable<unknown> {
    return this.http.post(`${this.base}/${encodeURIComponent(roomId)}/forget`, {});
  }
}

/** One open table: the stream, the view and the moves. Not providedIn root - one per table screen. */
@Injectable()
export class DreamSessionService {
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly base = `${environment.selfhosted.apiUrl}/v1/game/rooms`;
  private source: EventSource | null = null;
  private roomId = '';

  readonly room = signal<{ id: string; inviteCode?: string; language?: string } | null>(null);
  readonly view = signal<DreamTableView | null>(null);
  readonly legalActions = signal<DreamLegalAction[]>([]);
  readonly events = signal<DreamEventLine[]>([]);
  readonly connection = signal<'connecting' | 'live' | 'reconnecting' | 'closed'>('connecting');
  readonly problem = signal<string | null>(null);
  readonly busy = signal(false);

  constructor(
    private http: HttpClient,
    private zone: NgZone,
  ) {}

  get tableId(): string {
    return this.roomId;
  }

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
      const held = this.view();
      if (held && data.version <= held.version) return;
      this.view.set(data.view);
      this.legalActions.set(data.legalActions ?? []);
      this.addEvents(data.events ?? []);
    });
    this.listen(source, 'log', (data) => this.addEvents([data]));
    this.listen(source, 'ping', () => undefined);
    void this.loadLog(roomId);
  }

  close(): void {
    if (this.source) this.source.close();
    this.source = null;
    this.connection.set('closed');
  }

  can(type: string): boolean {
    return this.legalActions().some((action) => action.type === type);
  }

  hint(type: string): Record<string, unknown> | undefined {
    return this.legalActions().find((action) => action.type === type)?.hint;
  }

  /** One move of play; a retry of the same call is applied at most once (clientCommandId). */
  async play(command: Record<string, unknown>): Promise<boolean> {
    return (
      (await this.send('commands', 'post', { command, clientCommandId: newCommandId() })) !== null
    );
  }

  /** A lobby action: ready, start, profession, leave, kick, settings, bots. */
  async lobby(
    path: 'leave' | 'ready' | 'kick' | 'settings' | 'start' | 'profession' | 'bots',
    body: Record<string, unknown> = {},
  ): Promise<boolean> {
    const method =
      path === 'ready' || path === 'settings' || path === 'profession' ? 'put' : 'post';
    return (await this.send(path, method, { ...body, clientCommandId: newCommandId() })) !== null;
  }

  async resync(): Promise<void> {
    const roomId = this.roomId;
    if (!roomId) return;
    try {
      const answer = (await firstValueFrom(
        this.http.get(`${this.base}/${encodeURIComponent(roomId)}`),
      )) as { table?: DreamTableView; legalActions?: DreamLegalAction[] };
      if (this.roomId !== roomId || !answer.table) return;
      this.view.set(answer.table);
      this.legalActions.set(answer.legalActions ?? []);
    } catch {
      // the next try comes with the connection
    }
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
      return answer ?? {};
    } catch (error) {
      const e = error as {
        status?: number;
        error?: { detail?: string; code?: string };
        message?: string;
      };
      if (e?.status === 409 && e?.error?.code === 'room_conflict') {
        void this.resync();
        return null;
      }
      const lang = this.translate?.currentLang || this.translate?.defaultLang || 'en';
      this.problem.set(
        problemText(lang, e?.error?.code, e?.error?.detail) ??
          e?.error?.detail ??
          e?.message ??
          'The move did not go through.',
      );
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private async loadLog(roomId: string): Promise<void> {
    try {
      const url = `${this.base}/${encodeURIComponent(roomId)}/log?after=0&limit=1000`;
      const answer = (await firstValueFrom(this.http.get(url))) as { events?: DreamEventLine[] };
      if (this.roomId === roomId) this.addEvents(answer.events ?? []);
    } catch {
      // the history is a convenience: the live stream carries on without it
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

  private addEvents(lines: DreamEventLine[]): void {
    if (!lines.length) return;
    const known = new Set(this.events().map((line) => line.seq));
    const fresh = lines.filter((line) => !known.has(line.seq));
    if (fresh.length) this.events.set([...this.events(), ...fresh].sort((a, b) => a.seq - b.seq));
  }
}
