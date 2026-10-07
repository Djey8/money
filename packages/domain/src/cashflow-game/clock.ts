/**
 * The two ports that keep the game engine free of the browser and of ambient state
 * (todo/cashflow-game-pro-inventory.md, F1/F2/F8): a clock, and the text the game writes into the account.
 */

/**
 * "Now", injected. The game dates its one-off transactions on the real current month (not the game calendar) and
 * stamps notes and history steps with a time; both read the clock instead of `new Date()`, so a test or the API
 * decides what day it is.
 */
export interface Clock {
  /** Today's calendar date, `YYYY-MM-DD`, in the same local time the app shows. */
  todayIso(): string;
  /** The current moment as an ISO timestamp. */
  nowIso(): string;
}

export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The real clock. */
export const systemClock: Clock = {
  todayIso: () => formatLocalIsoDate(new Date()),
  nowIso: () => new Date().toISOString(),
};

/** A clock that always says the same thing - for tests and for replaying a game. */
export function fixedClock(todayIso: string, nowIso = `${todayIso}T12:00:00.000Z`): Clock {
  return { todayIso: () => todayIso, nowIso: () => nowIso };
}
