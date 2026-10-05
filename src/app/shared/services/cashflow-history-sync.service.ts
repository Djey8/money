import { Injectable } from '@angular/core';
import { debounceTime, firstValueFrom } from 'rxjs';
import { LIVE_HISTORY_PATH, LIVE_HISTORY_SCHEMA } from '@money/domain';
import { packSavedGame, unpackSavedGame } from '../saved-game-codec';
import { CashflowGameService } from './cashflow-game.service';
import { CrypticService } from './cryptic.service';
import { DatabaseService } from './database.service';

/**
 * Keeps the running game's history in the account, next to the game itself (JFK, 2026-10-05), so an agent or another
 * device sees every step and can undo back to it. The books are written with each action; the history - a packed
 * document of its own - follows a moment later, in the background, so adding a transaction never waits for it. Packed
 * and encrypted exactly like a saved game (one string leaf at `cashflowGameHistory`).
 *
 * On load the account's copy replaces the browser's only when it is newer; a browser copy that is newer (the tab was
 * closed inside the delay) is written out instead.
 */
@Injectable({ providedIn: 'root' })
export class CashflowHistorySyncService {
  /** How long the history rests before it is written - a burst of steps becomes one write. */
  static writeDelayMs = 3000;

  constructor(
    private game: CashflowGameService,
    private database: DatabaseService,
    private cryptic: CrypticService,
  ) {
    this.game.historyChanged$
      .pipe(debounceTime(CashflowHistorySyncService.writeDelayMs))
      .subscribe(() => void this.write());
  }

  /** Brings the history in line with the account after the game data has been loaded. */
  async loadAndAdopt(): Promise<void> {
    try {
      const snapshot = await this.database.getData(LIVE_HISTORY_PATH);
      const raw = snapshot?.val?.();
      if (raw?.payload == null) {
        if (this.game.canUndo) void this.write();
        return;
      }
      const stored = await unpackSavedGame<unknown>(this.cryptic.decrypt(raw.payload, 'database'));
      if (!this.game.adoptAccountHistory(stored) && this.game.canUndo) {
        // The browser's copy is the newer one (or equal): make sure the account has it.
        const accountAt = (stored as { updatedAt?: string } | null)?.updatedAt;
        if (!accountAt || this.game.historyUpdatedAt !== accountAt) void this.write();
      }
    } catch {
      // The history is a convenience on top of the game: a failure here must never get in the way of loading it.
    }
  }

  private async write(): Promise<void> {
    try {
      const payload = await packSavedGame(this.game.liveHistory());
      await firstValueFrom(
        this.database.writeObject(LIVE_HISTORY_PATH, { schema: LIVE_HISTORY_SCHEMA, payload }),
      );
    } catch {
      // Best effort: the next step writes the whole history again.
    }
  }
}
