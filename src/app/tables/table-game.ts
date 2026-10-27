/** The two games a table can be for: the classic Cashflow, or the Dreamfund (the app's own game). */
export type TableGame = 'classic' | 'dreamfund';

const GAME_KEY = 'mm.tables.game';

/** The game the person looked at last (kept on this device; the lobby and the leaderboard share it). */
export function savedGame(): TableGame {
  try {
    return localStorage.getItem(GAME_KEY) === 'dreamfund' ? 'dreamfund' : 'classic';
  } catch {
    return 'classic';
  }
}

export function keepGame(game: TableGame): void {
  try {
    localStorage.setItem(GAME_KEY, game);
  } catch {
    // no storage here: the choice lasts as long as the page
  }
}

/** The game of the table that is being opened: set by the table route once the table has said what it is, read when the session is made. */
export class OpenTableGame {
  static current: TableGame = 'classic';
}
