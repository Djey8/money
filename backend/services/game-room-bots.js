'use strict';

/**
 * The bots of running tables (todo/cashflow-tournament-and-bots.md B2). After every change to a table that has bots, a short
 * timer (so people can follow what a bot does) asks the service to let the bots take their next move; that move is saved like any
 * other, which wakes this again - so a bot's whole turn plays out one visible step at a time, and a game of bots only goes on
 * for as long as there is someone to play with (the clock and the table's own end see to the rest).
 *
 * Like the clocks, the driver decides nothing: `runBots(roomId)` loads the table and lets the domain's `nextBotCommand` say
 * what, if anything, a bot may do. A doubled or late wake-up is harmless, and a restart loses the timers - `rearmAll` wakes the
 * tables again. Timers do not keep the process alive.
 */

const DEFAULT_DELAY_MS = 3500;
const PACE_DELAY_MS = { fast: 1500, normal: 3500, slow: 6000 };
const RETRY_MS = 5000;
const WAIT_MS = 4000;

function createBotDriver({
  run,
  delayMs = (table) => {
    const configured = Number(process.env.GAME_BOT_DELAY_MS);
    if (Number.isFinite(configured) && configured >= 0) return configured;
    // the table's own pace: how long people have to follow what a bot does between two steps
    return PACE_DELAY_MS[table && table.settings && table.settings.pace] ?? DEFAULT_DELAY_MS;
  },
  scheduler = { set: setTimeout, clear: clearTimeout },
  log = () => {},
}) {
  /** roomId -> timer handle */
  const timers = new Map();

  /** Whether any bot at this table could have something to do: it is being played and has bots in the game. */
  const hasBots = (table) =>
    table.phase === 'playing' && table.players.some((p) => p.bot && p.status === 'active');

  function wake(roomId, delay) {
    if (timers.has(roomId)) return;
    const handle = scheduler.set(async () => {
      timers.delete(roomId);
      try {
        const outcome = await run(roomId);
        // a bot waiting for the answer to its offer asks again after a moment: a quiet table brings no change to wake it
        if (outcome && outcome.waiting) wake(roomId, WAIT_MS);
      } catch (error) {
        log('game_room_bots_failed', { roomId, message: error.message });
        wake(roomId, RETRY_MS);
      }
    }, delay);
    if (handle && typeof handle.unref === 'function') handle.unref();
    timers.set(roomId, handle);
  }

  /** A table changed (or was loaded after a restart): if it has bots at play, let them move shortly. */
  function touch(roomId, table) {
    if (!hasBots(table)) {
      clear(roomId);
      return;
    }
    wake(roomId, delayMs(table));
  }

  function clear(roomId) {
    const handle = timers.get(roomId);
    if (handle === undefined) return;
    scheduler.clear(handle);
    timers.delete(roomId);
  }

  function clearAll() {
    for (const roomId of [...timers.keys()]) clear(roomId);
  }

  return { touch, clear, clearAll, size: () => timers.size };
}

module.exports = { createBotDriver };
