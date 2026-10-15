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
}

export interface CreateTableInput {
  nickname: string;
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

  list(scope: 'open' | 'mine' | 'recent' = 'open'): Observable<{ items: TableSummary[] }> {
    return this.http.get<{ items: TableSummary[] }>(`${this.base}?scope=${scope}`);
  }

  create(input: CreateTableInput): Observable<{ id: string; inviteCode?: string }> {
    return this.http.post<{ id: string; inviteCode?: string }>(this.base, input);
  }

  join(target: { roomId?: string; code?: string }, nickname: string): Observable<{ id?: string }> {
    return this.http.post<{ id?: string }>(`${this.base}/join`, { ...target, nickname });
  }
}
