import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** One row of the lobby list (backend/services/game-rooms.js roomSummary). */
export interface TableSummary {
  id: string;
  name: string;
  hostName: string;
  phase: 'lobby' | 'picking' | 'playing' | 'paused' | 'finished' | 'closed';
  visibility: 'public' | 'private';
  seatsTaken: number;
  maxSeats: number;
  gameSetId: string;
  professions: 'duplicates' | 'unique' | 'random';
  turnOrder: 'random' | 'seat';
  clock: { mode: 'none' | 'per-move' | 'bank' | 'daily'; [key: string]: unknown };
  endCondition: 'first-escape' | 'all-done' | 'round-limit';
  language: string;
  joined: boolean;
  /** The game may count for the leaderboard rating. */
  ranked?: boolean;
  /** People (not bots) still playing at the table. */
  humans?: number;
  /** The viewer opened this table. */
  hosting?: boolean;
  /** When the table was opened (ISO time). */
  createdAt?: string;
  /** Who sits at the table (the lists carry it, so a player sees who is there before joining). */
  seats?: TableSeat[];
}

/** One seat of a table with the public side of the person or bot who sits there (GET /game/rooms/{id}/seats, and `seats` of a list row). */
export interface TableSeat {
  seat: number;
  name: string;
  bot: boolean;
  /** On the leaderboard (a bot always is); an unlisted person shows only the rating. */
  listed: boolean;
  rating: number;
  ratedGames: number;
  provisional?: boolean;
  level?: BotLevel;
  /** The leaderboard player: opens the stats panel (absent for a person who has none yet). */
  playerId?: string;
  pictureVersion?: number;
  color?: string;
  type?: 'human' | 'bot';
  peakRating?: number;
  baseRating?: number;
  games?: number;
  wins?: number;
  losses?: number;
  gaveUp?: number;
  bankruptcies?: number;
  escaped?: number;
  winRate?: number;
  avgPlace?: number | null;
  bestPlace?: number | null;
}

/** A player of the leaderboard (GET /v1/game/leaderboard): a human who opted in, or a bot persona at a level. */
export interface GamePlayer {
  place?: number;
  playerId: string;
  name: string;
  type: 'human' | 'bot';
  level?: BotLevel;
  visible?: boolean;
  /** A person's profile picture is at `pictureUrl(player)`; absent when there is none. */
  pictureVersion?: number;
  rating: number;
  peakRating: number;
  /** What the rating is counted from (a person's 1500, a bot's measured start); the games played are added on top of it. */
  baseRating?: number;
  /** When that base was set (ISO time). */
  baseSince?: string;
  ratedGames: number;
  provisional: boolean;
  games: number;
  wins: number;
  losses: number;
  gaveUp: number;
  bankruptcies: number;
  escaped: number;
  winRate: number;
  avgPlace: number | null;
  bestPlace: number | null;
  recent?: {
    /** The table the game was played at: it opens from the list while it is still kept. */
    tableId?: string;
    table: string;
    endedAt: string;
    players: number;
    place: number;
    outcome: string;
    ranked: boolean;
    notRankedBecause?: string;
    ratingChange: number;
    ratingAfter: number;
  }[];
}

export type BotLevel = 'master' | 'strong' | 'casual' | 'beginner';

/** One bot a host can seat (GET /game/rooms/bots). */
export interface BotInfo {
  id: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'champion';
  description: string;
  /** What the bot is rated now at each skill level (the leaderboard's rating, or the measured start). */
  ratings?: Partial<Record<BotLevel, number>>;
  /** The leaderboard player of each level: opens the bot's stats. */
  playerIds?: Partial<Record<BotLevel, string>>;
}

export interface CreateTableInput {
  nickname: string;
  /** The letters on the player's token (up to two); absent: the first two letters of the name. */
  initials?: string;
  settings: {
    name: string;
    visibility: 'public' | 'private';
    maxSeats: number;
    professions: 'duplicates' | 'unique' | 'random';
    clock:
      | { mode: 'none' }
      | { mode: 'per-move'; secondsPerMove: number }
      | {
          mode: 'bank';
          bankSeconds: number;
          incrementSeconds: number;
        };
    endCondition: 'first-escape' | 'all-done' | 'round-limit';
    roundLimit?: number;
    spectators: boolean;
    /** Whether the table may vote to undo the last turn (more than half must agree). */
    allowRewind?: boolean;
    /** Whether the table waits for everybody to say Continue after each turn. */
    turnGate?: boolean;
    /** How fast the bots play and how long each move is told. */
    pace?: 'fast' | 'normal' | 'slow';
    /** Whether everybody's progress towards escaping (a percentage) is shown. */
    showProgress?: boolean;
    /** Paying the bank back at any time, not only in one's own turn (default on). */
    repayOffTurn?: boolean;
    leaveFreeRounds?: number;
    /** The game may count for the leaderboard rating (default on; fixed once it starts). */
    ranked?: boolean;
    /** Rule overrides: how many of a player's turns a buyer's offer stays open. */
    rules?: { sellOfferRolls?: number };
  };
  language?: string;
}

/**
 * The multiplayer tables API (docs/api/openapi.yaml, /v1/game/rooms). Its own service file, only ever imported from the
 * lazy tables chunk behind app.routes.selfhosted.ts, so none of it reaches the Firebase build (docs/adr/0004). The session
 * cookie authenticates; the backend refuses everything but a game account.
 */
@Injectable({ providedIn: 'root' })
export class TablesApiService {
  private readonly base = `${environment.selfhosted.apiUrl}/v1/game/rooms`;

  constructor(private http: HttpClient) {}

  /** The profile picture of a person on the leaderboard (the browser keeps it until the picture changes), or null. */
  pictureUrl(
    player: { playerId?: string; pictureVersion?: number },
    tableId?: string,
  ): string | null {
    return player.playerId && player.pictureVersion
      ? `${environment.selfhosted.apiUrl}/v1/game/players/${encodeURIComponent(player.playerId)}/picture?v=${player.pictureVersion}` +
          // a person who is not listed has their picture seen by the table they sit at
          (tableId ? `&table=${encodeURIComponent(tableId)}` : '')
      : null;
  }

  list(scope: 'open' | 'mine' | 'recent' = 'open'): Observable<{ items: TableSummary[] }> {
    return this.http.get<{ items: TableSummary[] }>(`${this.base}?scope=${scope}`);
  }

  bots(): Observable<{ items: BotInfo[]; levels?: { id: BotLevel; mistakes: number }[] }> {
    return this.http.get<{ items: BotInfo[]; levels?: { id: BotLevel; mistakes: number }[] }>(
      `${this.base}/bots`,
    );
  }

  /** Who sits at a table, with their rating and picture. */
  seats(roomId: string): Observable<{ seats: TableSeat[] }> {
    return this.http.get<{ seats: TableSeat[] }>(
      `${this.base}/${encodeURIComponent(roomId)}/seats`,
    );
  }

  create(input: CreateTableInput): Observable<{ id: string; inviteCode?: string }> {
    return this.http.post<{ id: string; inviteCode?: string }>(this.base, input);
  }

  /** The host removes the table altogether: it is closed for everyone, then deleted. */
  remove(roomId: string): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(
      `${this.base}/${encodeURIComponent(roomId)}?confirm=true&remove=true`,
    );
  }

  /** Leaves the game (a seat in the lobby, or a resign in a running game). */
  leave(roomId: string): Observable<unknown> {
    return this.http.post(`${this.base}/${encodeURIComponent(roomId)}/leave`, {
      clientCommandId: `leave-${Date.now()}`,
    });
  }

  /** Takes a table off my lists (one I left, or that is over). */
  forget(roomId: string): Observable<unknown> {
    return this.http.post(`${this.base}/${encodeURIComponent(roomId)}/forget`, {});
  }

  leaderboard(
    type: 'all' | 'human' | 'bot',
    after?: string,
  ): Observable<{ items: GamePlayer[]; next: string | null }> {
    const query = `type=${type}&limit=25${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    return this.http.get<{ items: GamePlayer[]; next: string | null }>(
      `${environment.selfhosted.apiUrl}/v1/game/leaderboard?${query}`,
    );
  }

  player(playerId: string): Observable<GamePlayer> {
    return this.http.get<GamePlayer>(
      `${environment.selfhosted.apiUrl}/v1/game/players/${encodeURIComponent(playerId)}`,
    );
  }

  me(): Observable<GamePlayer> {
    return this.http.get<GamePlayer>(`${environment.selfhosted.apiUrl}/v1/game/players/me`);
  }

  setVisible(visible: boolean): Observable<GamePlayer> {
    return this.http.put<GamePlayer>(`${environment.selfhosted.apiUrl}/v1/game/players/me`, {
      visible,
    });
  }

  join(
    target: { roomId?: string; code?: string },
    nickname: string,
    initials = '',
  ): Observable<{ id?: string; language?: string }> {
    return this.http.post<{ id?: string; language?: string }>(`${this.base}/join`, {
      ...target,
      nickname,
      ...(initials ? { initials } : {}),
    });
  }
}
