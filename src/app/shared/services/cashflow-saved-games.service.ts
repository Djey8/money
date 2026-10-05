import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  SAVED_GAME_SCHEMA,
  SAVED_GAME_SOFT_LIMIT,
  sortSavedGames,
  type SavedGameSummary,
  type SavedGamesIndex,
} from '@money/domain';
import { packSavedGame, unpackSavedGame } from '../saved-game-codec';
import { AppStateService } from './app-state.service';
import {
  CashflowGameService,
  type CashflowGameCallbacks,
  type CashflowGameSnapshot,
} from './cashflow-game.service';
import { CrypticService } from './cryptic.service';
import { DatabaseService } from './database.service';

/** One line of a saved game's own history - what happened, newest steps last. */
export interface SavedGameStepLog {
  number: number;
  kind: string;
  detail: string;
  at: string;
}

/** Everything one saved game consists of. */
export interface SavedGameBlob {
  schema: number;
  summary: SavedGameSummary;
  steps: SavedGameStepLog[];
  snapshot: CashflowGameSnapshot;
  /** Every earlier step, so Undo keeps working after the game is loaded (absent on games saved before). */
  undo?: unknown;
}

/** The file a game is exported to and imported from. */
interface SavedGameFile {
  kind: 'cashflow-game';
  schema: number;
  packed: string;
}

const INDEX_PATH = 'cashflowGames/index';
/** The summary of a game that is being played again. */
function withoutEnd(summary: SavedGameSummary): SavedGameSummary {
  const { endedAt: _ended, ...rest } = summary;
  return rest;
}

const gamePath = (id: string) => `cashflowGames/games/${id}`;

/**
 * Several Cashflow games on one account (JFK, 2026-10-04). The account's own data is always the
 * game being played; a saved game is a snapshot of it - the same unit Undo uses - kept compressed
 * under `cashflowGames/` in the user's own data next to a small list of summaries (which is all the
 * games list, and later statistics, read). Saving happens when a game is left (a new game, another
 * game loaded, a game ended) or when asked for; loading replaces the live data with the saved one.
 *
 * Deleting a game overwrites its snapshot with an empty marker instead of removing the path: a plain
 * write is guarded against stale data on the server, a delete is not.
 */
@Injectable({ providedIn: 'root' })
export class CashflowSavedGamesService {
  /** The saved games, most recently saved first. Filled by `refresh()`. */
  games: SavedGameSummary[] = [];
  loaded = false;

  constructor(
    private database: DatabaseService,
    private cryptic: CrypticService,
    private game: CashflowGameService,
    private translate: TranslateService,
  ) {}

  /** The slot of the game being played, once it has been saved. */
  get currentGameId(): string | undefined {
    return AppStateService.instance.cashflowGame.gameId;
  }

  /** More saved games than is comfortable for the one database document they all live in. */
  get tooMany(): boolean {
    return this.games.length > SAVED_GAME_SOFT_LIMIT;
  }

  // ---------------------------------------------------------------- reading

  async refresh(): Promise<void> {
    const index = await this.readJson<SavedGamesIndex>(INDEX_PATH);
    this.games = sortSavedGames(index?.games ?? []);
    this.loaded = true;
  }

  // ---------------------------------------------------------------- saving

  /**
   * Saves the game being played into its slot (the first save gives it one) and updates the list.
   * Returns the list entry, or null when no game is running.
   */
  async saveCurrent(options: { ended?: boolean } = {}): Promise<SavedGameSummary | null> {
    const state = AppStateService.instance;
    if (!state.cashflowGame.professionId) return null;
    if (!this.loaded) await this.refresh();

    const now = new Date().toISOString();
    let id = state.cashflowGame.gameId;
    let name = state.cashflowGame.gameName;
    if (!id || !name) {
      id = id ?? this.newGameId();
      name = name ?? this.defaultName();
      await this.run((callbacks) =>
        this.game.setGameIdentity(id as string, name as string, callbacks),
      );
    }
    const existing = this.games.find((candidate) => candidate.id === id);
    const summary: SavedGameSummary = {
      ...this.game.liveGameSummary(),
      id,
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      language: this.translate.currentLang,
      // Only "End game" marks a game ended; saving one that was continued makes it playing again.
      ...(options.ended ? { endedAt: now } : {}),
    };
    const blob: SavedGameBlob = {
      schema: SAVED_GAME_SCHEMA,
      summary,
      steps: this.stepLog(),
      snapshot: this.game.captureGameSnapshot(),
      undo: this.game.exportUndoChain(),
    };
    await this.writeJson(gamePath(id), blob);
    await this.writeIndex([...this.games.filter((candidate) => candidate.id !== id), summary]);
    return summary;
  }

  /** Leaves the game being played: saves it, then clears the account for the next one. */
  async startNewGame(options: { ended?: boolean } = {}): Promise<void> {
    await this.saveCurrent(options);
    await this.run((callbacks) => this.game.resetGame(callbacks));
  }

  /** Ends the game on purpose: saved with an "ended" mark, the account cleared. */
  async endGame(): Promise<void> {
    await this.startNewGame({ ended: true });
  }

  // ---------------------------------------------------------------- loading

  /**
   * Makes a saved game the live game. The target is read and checked first - if it cannot be
   * opened nothing changes; only then is the game being played saved and replaced.
   */
  async loadGame(id: string): Promise<void> {
    const blob = await this.readBlob(id);
    if (!blob) throw new Error('This saved game could not be found.');
    if (!this.game.isGameSnapshot(blob.snapshot)) throw new Error('This saved game is damaged.');

    const state = AppStateService.instance;
    if (state.cashflowGame.professionId && state.cashflowGame.gameId !== id) {
      await this.saveCurrent();
    }
    const listed = this.games.find((candidate) => candidate.id === id);
    const snapshot: CashflowGameSnapshot = {
      ...blob.snapshot,
      cashflowGame: {
        ...blob.snapshot.cashflowGame,
        gameId: id,
        gameName: listed?.name ?? blob.summary.name,
      },
    };
    await this.run((callbacks) => this.game.restoreGameSnapshot(snapshot, callbacks, blob.undo));
    await this.writeIndex([
      ...this.games.filter((candidate) => candidate.id !== id),
      // Continuing an ended game makes it a playing one again: its "ended" mark goes.
      { ...withoutEnd(listed ?? blob.summary), updatedAt: new Date().toISOString() },
    ]);
  }

  // ---------------------------------------------------------------- managing

  async renameGame(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!this.loaded) await this.refresh();
    await this.writeIndex(
      this.games.map((game) => (game.id === id ? { ...game, name: trimmed } : game)),
    );
    const state = AppStateService.instance;
    if (state.cashflowGame.gameId === id) {
      await this.run((callbacks) => this.game.setGameIdentity(id, trimmed, callbacks));
    }
  }

  async deleteGame(id: string): Promise<void> {
    if (!this.loaded) await this.refresh();
    await this.writeJson(gamePath(id), null);
    await this.writeIndex(this.games.filter((game) => game.id !== id));
    if (this.currentGameId === id) {
      await this.run((callbacks) => this.game.clearGameIdentity(callbacks));
    }
  }

  /** The game as a file's text, for a backup or another account. */
  async exportGame(id: string): Promise<{ fileName: string; text: string }> {
    const blob = await this.readBlob(id);
    if (!blob) throw new Error('This saved game could not be found.');
    const file: SavedGameFile = {
      kind: 'cashflow-game',
      schema: SAVED_GAME_SCHEMA,
      packed: await packSavedGame(blob),
    };
    const safeName = blob.summary.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    return { fileName: `cashflow-${safeName || 'game'}.json`, text: JSON.stringify(file) };
  }

  /** Adds an exported game to the list as a new game of its own. */
  async importGame(text: string): Promise<SavedGameSummary> {
    let file: SavedGameFile;
    try {
      file = JSON.parse(text) as SavedGameFile;
    } catch {
      throw new Error('This is not a saved game file.');
    }
    if (file?.kind !== 'cashflow-game' || typeof file.packed !== 'string') {
      throw new Error('This is not a saved game file.');
    }
    if (file.schema > SAVED_GAME_SCHEMA) throw new Error('This game was saved by a newer version.');
    const blob = await unpackSavedGame<SavedGameBlob>(file.packed);
    if (!this.game.isGameSnapshot(blob.snapshot)) throw new Error('This saved game is damaged.');

    if (!this.loaded) await this.refresh();
    const id = this.newGameId();
    const summary: SavedGameSummary = {
      ...blob.summary,
      id,
      name: blob.summary.name,
      updatedAt: new Date().toISOString(),
    };
    const imported: SavedGameBlob = {
      ...blob,
      summary,
      snapshot: {
        ...blob.snapshot,
        cashflowGame: { ...blob.snapshot.cashflowGame, gameId: id, gameName: summary.name },
      },
    };
    await this.writeJson(gamePath(id), imported);
    await this.writeIndex([...this.games, summary]);
    return summary;
  }

  // ---------------------------------------------------------------- helpers

  private newGameId(): string {
    return `game_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  /** "Janitor · 04.10.2026" - the profession and the day the game was first saved. */
  private defaultName(): string {
    const date = new Date();
    const day = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    return `${this.game.liveProfessionTitle() ?? 'Cashflow'} · ${day}`;
  }

  /** The game's own history as plain text, oldest step first. */
  private stepLog(): SavedGameStepLog[] {
    return this.game
      .historySteps()
      .slice()
      .reverse()
      .map((step) => ({ number: step.number, kind: step.kind, detail: step.detail, at: step.at }));
  }

  private async writeIndex(games: SavedGameSummary[]): Promise<void> {
    const sorted = sortSavedGames(games);
    const index: SavedGamesIndex = { schema: SAVED_GAME_SCHEMA, games: sorted };
    await this.writeJson(INDEX_PATH, index);
    this.games = sorted;
  }

  private async readBlob(id: string): Promise<SavedGameBlob | null> {
    const blob = await this.readJson<SavedGameBlob>(gamePath(id));
    if (!blob || !blob.snapshot) return null;
    if (blob.schema > SAVED_GAME_SCHEMA) throw new Error('This game was saved by a newer version.');
    return blob;
  }

  /** Packs the value, encrypts it like every other stored value and writes it. `null` leaves an empty marker. */
  private async writeJson(tag: string, value: unknown): Promise<void> {
    const payload = await packSavedGame(value);
    await firstValueFrom(this.database.writeObject(tag, { schema: SAVED_GAME_SCHEMA, payload }));
  }

  private async readJson<T>(tag: string): Promise<T | null> {
    const snapshot = await this.database.getData(tag);
    const raw = snapshot?.val?.();
    if (raw == null || raw.payload == null) return null;
    const payload = this.cryptic.decrypt(raw.payload, 'database');
    return await unpackSavedGame<T | null>(payload);
  }

  /** Turns the game service's callback style into a promise. */
  private run(action: (callbacks: CashflowGameCallbacks) => void): Promise<void> {
    return new Promise((resolve, reject) =>
      action({ onSuccess: () => resolve(), onError: (message) => reject(new Error(message)) }),
    );
  }
}
