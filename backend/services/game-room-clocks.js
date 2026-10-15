'use strict';

/**
 * The timers of running tables (todo/cashflow-multiplayer.md slice S4, docs/adr/0010). A table with a clock has one deadline at a
 * time - the moment the player on the move runs out of time - and this keeps one timer per such table. When it fires,
 * `onDue(roomId)` loads the table and lets the domain decide: if the deadline really has passed the passive turn is played,
 * otherwise (the player moved, the game was paused, the timer fired a hair early) the table just arms again for the deadline it
 * now has. So a timer never decides anything by itself, and a missed or doubled firing is harmless.
 *
 * Timers exist only for tables that are being played with a clock. They do not keep the process alive, and a restart loses
 * them all - `rearmAll` in services/game-rooms.js builds them again from the stored tables.
 */

/** setTimeout cannot wait longer than this; a longer deadline fires early and arms again. */
const MAX_DELAY_MS = 2 ** 31 - 1;
/** A timer fires a little after the deadline, never before it, so the domain finds the time up. */
const SLACK_MS = 25;
/** After a failed attempt (the database was away) try again in a few seconds. */
const RETRY_MS = 5000;

function createRoomClocks({
  onDue,
  now = () => Date.now(),
  scheduler = { set: setTimeout, clear: clearTimeout },
  log = () => {},
}) {
  /** roomId -> { handle, deadlineAt } */
  const timers = new Map();

  function disarm(roomId) {
    const timer = timers.get(roomId);
    if (!timer) return;
    scheduler.clear(timer.handle);
    timers.delete(roomId);
  }

  function schedule(roomId, deadlineAt, delay) {
    const handle = scheduler.set(async () => {
      timers.delete(roomId);
      try {
        await onDue(roomId);
      } catch (error) {
        log('game_room_timeout_failed', { roomId, message: error.message });
        // arm again unless a newer arm has happened meanwhile
        if (!timers.has(roomId)) schedule(roomId, now() + RETRY_MS, RETRY_MS);
      }
    }, delay);
    if (handle && typeof handle.unref === 'function') handle.unref();
    timers.set(roomId, { handle, deadlineAt });
  }

  /** Arms the table's timer for `deadlineAt` (epoch ms), replacing any earlier one; null removes it. */
  function arm(roomId, deadlineAt) {
    const existing = timers.get(roomId);
    if (deadlineAt === null || deadlineAt === undefined) {
      disarm(roomId);
      return;
    }
    if (existing && existing.deadlineAt === deadlineAt) return;
    disarm(roomId);
    schedule(
      roomId,
      deadlineAt,
      Math.min(MAX_DELAY_MS, Math.max(0, deadlineAt - now()) + SLACK_MS),
    );
  }

  return {
    arm,
    disarm,
    /** The deadline a room is armed for, or null. */
    deadlineOf: (roomId) => (timers.has(roomId) ? timers.get(roomId).deadlineAt : null),
    count: () => timers.size,
    clearAll: () => [...timers.keys()].forEach(disarm),
  };
}

module.exports = { createRoomClocks, MAX_DELAY_MS, SLACK_MS, RETRY_MS };
