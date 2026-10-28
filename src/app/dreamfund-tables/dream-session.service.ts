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

/** The card a player dealt with this turn and what came of it (their own, in full; the others' only its kind). */
export type DreamResolvedView =
  | {
      kind: 'emergency';
      cardId: string;
      choiceId?: string;
      rolls?: Record<string, number>;
      payMinor: number;
      how: 'now' | 3 | 6 | 12;
    }
  | { kind: 'life'; cardId: string; decision: string; outcome?: unknown }
  | { kind: 'career'; result: unknown; reached?: string }
  | { kind: 'dream'; offers?: string[]; taken?: string; declined?: boolean; moment?: string }
  | {
      kind: 'opportunity';
      pile?: string;
      offers?: string[];
      taken?: string;
      told?: string[];
      passed?: boolean;
    }
  | { kind: string };

export type DreamPending =
  | {
      kind: 'emergency';
      cardId: string;
      choiceId?: string;
      rolls?: Record<string, number>;
      rerolled?: boolean;
    }
  | { kind: 'life'; cardId: string }
  | { kind: 'career_branch'; options: string[]; roll?: number }
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
  cardId?: string;
  told?: string[];
  window?: string[] | 'ALL';
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

export interface DreamBoardRow {
  place?: number;
  playerId: string;
  /** Where the picture of a person is kept (the account's picture), when they have one. */
  pictureId?: string;
  pictureVersion?: number;
  name: string;
  type: 'human' | 'bot';
  level?: 'master' | 'strong' | 'casual' | 'beginner';
  difficulty: 'easy' | 'medium' | 'hard';
  rating: number;
  peakRating: number;
  ratedGames: number;
  provisional: boolean;
  games: number;
  wins: number;
  won: number;
  bankruptcies: number;
  avgPlace: number | null;
  avgGoals: number | null;
}

export interface DreamMyPlayer {
  playerId: string;
  pictureId?: string;
  pictureVersion?: number;
  name: string;
  visible: boolean;
  ratings: Record<'easy' | 'medium' | 'hard', DreamBoardRow>;
  recent: {
    tableId: string;
    name: string;
    difficulty: string;
    endedAt: string;
    counted: boolean;
    place?: number;
    ratingChange?: number;
  }[];
}

export interface DreamBotCatalog {
  items: {
    id: string;
    name: string;
    /** What the bot is rated at the table's difficulty, at each skill level. */
    ratings?: Partial<Record<'master' | 'strong' | 'casual' | 'beginner', number>>;
  }[];
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

  bots(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Observable<DreamBotCatalog> {
    return this.http.get<DreamBotCatalog>(
      `${this.base}/bots?kind=dreamfund&difficulty=${difficulty}`,
    );
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

  leaderboard(
    difficulty: 'easy' | 'medium' | 'hard',
    type: 'all' | 'human' | 'bot',
    after?: string,
  ): Observable<{ items: DreamBoardRow[]; next: string | null }> {
    const query = `difficulty=${difficulty}&type=${type}&limit=25${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    return this.http.get<{ items: DreamBoardRow[]; next: string | null }>(
      `${environment.selfhosted.apiUrl}/v1/game/dreamfund/leaderboard?${query}`,
    );
  }

  me(): Observable<DreamMyPlayer> {
    return this.http.get<DreamMyPlayer>(
      `${environment.selfhosted.apiUrl}/v1/game/dreamfund/players/me`,
    );
  }

  setVisible(visible: boolean): Observable<DreamMyPlayer> {
    return this.http.put<DreamMyPlayer>(
      `${environment.selfhosted.apiUrl}/v1/game/dreamfund/players/me`,
      { visible },
    );
  }

  forget(roomId: string): Observable<unknown> {
    return this.http.post(`${this.base}/${encodeURIComponent(roomId)}/forget`, {});
  }
}
