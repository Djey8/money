import { signal, type Type } from '@angular/core';
import type { BoardToken } from '../../main/cashflow-game/rat-race-board.component';

/**
 * A generic seam for a game whose moves are made somewhere else (todo/cashflow-multiplayer-solo-ui.md): while one is registered the
 * game screen sends its moves to it instead of working them out on this device, and shows the books it hydrates into the app's
 * state. Nothing in this file knows what the other end is - the shared code only asks, the self-hosted chunk answers.
 */

/** What a move came to: refused with the words to show, or accepted with what happened (events, in the server's own shape). */
export interface RemoteOutcome {
  ok: boolean;
  /** Why it was refused, for a toast. */
  message?: string;
  /** What the move did, oldest first: `rolled`, `card_drawn`... with their data. */
  events: { type: string; seat: number | null; data?: Record<string, unknown> }[];
}

/** One line of the game's history at a table: who did what, newest first (the shape of the solo game's own history lines). */
export interface RemoteHistoryLine {
  id: number;
  number: number;
  who: string;
  color: string;
  title: string;
  detail: string;
  at: string;
  /** The card this line is about, to be shown again from the history. */
  cardId?: string;
}

/** How a finished game at a table ended for the player, for the game screen's game-over panel. */
export interface RemoteOver {
  /** The player won (placed first): the panel is green, otherwise red. */
  won: boolean;
  headline: string;
  hint: string;
  /** Who placed where, best first. */
  ranking: { rank: number; name: string; me: boolean }[];
  /** The game has been filed in the player's own saved games. */
  saved: boolean;
  saveLabel: string;
  savedLabel: string;
  /** The way out of a game that is over: back to the app's home (nothing to give up any more). */
  leaveLabel: string;
  /** Whether the game counted for the leaderboard rating and what it did to the player's own: a line of words, or empty. */
  note: string;
}

/** One entry of the table's own menu (the owner's operations and the player's table settings). */
export interface RemoteMenuItem {
  id: string;
  label: string;
  /** Asked again before it runs. */
  confirm?: string;
  danger?: boolean;
}

/** The button that ends the player's part of a turn ("End turn") or lets it go on once they have sold what they wanted ("Continue"). */
export interface RemoteGate {
  label: string;
  /** Not yet: the last move of somebody else is still being told. */
  disabled: boolean;
}

export interface RemoteGame {
  /** Another player's books are on screen: read only, nothing of the game can be done from here. */
  viewOnly(): boolean;
  /** Whose turn it is when it is not the player's own (a name and a colour), else null. */
  turnBanner(): { text: string; color: string } | null;
  /** The table's own menu, shown as a page of the game screen next to History: its title and entries. */
  tableMenu(): { title: string; items: RemoteMenuItem[] } | null;
  runTableMenu(id: string): Promise<void>;
  /** Small switches shown on the game screen itself (a bell for the messages): an icon, its words and whether it is on. */
  quickToggles(): { id: string; icon: string; title: string; on: boolean }[];
  /** The game is over (finished or closed): how it ended for the player, else null. */
  over(): RemoteOver | null;
  /** The gate button for the player, or null when nothing waits for them. */
  gate(): RemoteGate | null;
  /** Press the gate button. */
  proceed(): Promise<RemoteOutcome>;
  /** Give up the seat and lose the game; the others play on. */
  resign(): Promise<RemoteOutcome>;
  /** The words of the resign button and of its question, and of the way back to the lobby, in the player's language. */
  resignWords(): { label: string; confirm: string; lobby: string };
  /** File the finished game in the player's own saved games (a game played with others). */
  saveGame(): Promise<RemoteOutcome>;
  /** Everything that happened, by everybody, newest first. */
  history(): RemoteHistoryLine[];
  /** Whether asking the table to go back one turn is possible now. */
  canAskUndo(): boolean;
  /** Ask the table to go back one turn; it happens when more than half of the people agree. */
  askUndo(): Promise<RemoteOutcome>;
  /** Whether the player may make a move of play right now (their turn, their own books on screen, nothing held). */
  canAct(): boolean;
  /** Say the turn that is held for you may go on (you are done selling). */
  done(): Promise<RemoteOutcome>;
  /** Roll one or two dice; the other end rolls them. */
  roll(dice: 1 | 2): Promise<RemoteOutcome>;
  /** Draw the card of the space the token is on. */
  draw(deck: 'dealSmall' | 'dealBig' | 'market' | 'doodad'): Promise<RemoteOutcome>;
  /** Buy the Deal card in hand (`quantity` for shares). */
  buy(cardId: string, quantity?: number): Promise<RemoteOutcome>;
  /** Plan the Deal card in hand as a Grow project (nothing is paid yet). */
  plan(cardId: string): Promise<RemoteOutcome>;
  /** Buy the project the card in hand became (Grow's Buy); `quantity` for shares. */
  buyPlanned(title: string, quantity?: number): Promise<RemoteOutcome>;
  /** Tick off the card that was played: the space is settled. */
  finish(): Promise<RemoteOutcome>;
  /** Sell a position into the buyer's offer that is open (Grow's Sell); the whole position unless `quantity` is given. */
  sellPosition(title: string, quantity?: number): Promise<RemoteOutcome>;
  /** Pay the Doodad in hand. */
  payDoodad(cardId: string): Promise<RemoteOutcome>;
  /** Pays the cost of the Market card in hand (a cost card applies only to the player who drew it). */
  payMarket(cardId: string): Promise<RemoteOutcome>;
  /** Leave the card in hand. */
  pass(): Promise<RemoteOutcome>;
  /** Roll the die of an open dice action. */
  rollDecision(title?: string): Promise<RemoteOutcome>;
  /** Offer the Deal card in hand to the other players at a price (minor units). */
  offerTrade(priceMinor: number): Promise<RemoteOutcome>;
  /** Borrow (positive) or repay (negative) from the bank, in minor units. */
  bankLoan(amountMinor: number): Promise<RemoteOutcome>;
}

/** The one game being played remotely, or null for a normal (solo) game. */
export class RemoteGameHook {
  static current: RemoteGame | null = null;
  /** A component the game screen shows on top while a remote game is played: who is on the move, the others, the clock. */
  static layer: Type<unknown> | null = null;
  private static readonly hold = signal(false);
  private static readonly rested = signal(false);
  /**
   * While true the screen keeps the books it shows (a roll is being animated); `resume` puts the latest ones on screen. Backed by a
   * signal: what depends on it (the history line, the books on screen) follows when it turns off.
   */
  static get holdUpdates(): boolean {
    return RemoteGameHook.hold();
  }
  static set holdUpdates(value: boolean) {
    RemoteGameHook.hold.set(value);
    if (!value) RemoteGameHook.rested.set(false);
  }
  /** During a held roll: the dice have come to rest (the history may say what was rolled, not yet where the token lands). */
  static get diceRested(): boolean {
    return RemoteGameHook.rested();
  }
  static set diceRested(value: boolean) {
    RemoteGameHook.rested.set(value);
  }
  /** A bar shown at the top of every page of the app (the app asks for it, the other end draws it), or null. */
  static banner: Type<unknown> | null = null;
  /** The dice of another player's roll while the screen tells it (the same dice as the player's own), or null. */
  static otherDice: (() => { faces: number[]; tumbling: boolean } | null) | null = null;
  /** Leaves the game screen for the lobby (after a resignation). */
  static leaveGame: (() => void) | null = null;
  /** Leaves the game for the app's home page (a game that is over, or a finished one that was only looked at). */
  static leaveHome: (() => void) | null = null;
  /** The box that tells what the others do: the game screen lays it in the middle of its wheel. */
  static stage: Type<unknown> | null = null;
  /** Whether the wheel is on screen to hold that box (else the table layer floats it at the top). */
  static ringVisible: (() => boolean) | null = null;
  static resume: (() => void) | null = null;
  /** Every player's token on the board; the argument is where the player's own token is drawn (it walks while the screen animates a roll). */
  static tokens: ((mine: number | null) => BoardToken[]) | null = null;
  /** Brings the game screen back (a page of the app that was visited meanwhile, e.g. Grow, sends the player back with it). */
  static reopen: (() => void) | null = null;
  /** Rebuilds the page on screen from the data now in memory (the books shown changed), stats and charts included. */
  static refreshPages: (() => void) | null = null;
  /** Asked when a menu entry is chosen: returns true if the remote game took it (the entry is then not navigated to). */
  static onMenuEntry: ((path: string) => boolean) | null = null;
}
