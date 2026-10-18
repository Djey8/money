'use strict';

const { RoomError } = require('./game-room-errors');
const { projectUpdate } = require('./game-room-stream');

/**
 * The live connections of the multiplayer tables (todo/cashflow-multiplayer.md slice S2, docs/adr/0010), in this process.
 * One backend replica serves the tables today, so an in-process registry is enough; the persisted event log is what a second
 * replica (CouchDB `_changes`) would publish from later, and what a reconnecting client replays from now. Nothing runs here
 * unless someone is connected: no timers, no polling.
 *
 * A connection is `subscribe`d first and `attach`ed later: updates that arrive between "the table was read for the snapshot"
 * and "the snapshot was sent" are held and delivered after it, skipping any the snapshot already contains, so a connecting
 * client never misses a change and never applies one twice.
 */

const MAX_HELD_UPDATES = 500;

const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const limits = () => ({
  perUser: number('GAME_ROOMS_MAX_STREAMS', 5),
  total: number('GAME_ROOMS_MAX_STREAMS_TOTAL', 500),
});

function createGameRoomHub() {
  /** roomId -> Set of subscriptions */
  const rooms = new Map();
  let total = 0;

  const seatOf = (table, userId) => {
    const seat = table.players.findIndex((p) => p.id === userId);
    return seat >= 0 ? seat : null;
  };

  const presenceOf = (subs) => ({
    seats: [...new Set([...subs].map((s) => s.seat).filter((seat) => seat !== null))].sort(
      (a, b) => a - b,
    ),
  });

  function broadcastPresence(roomId) {
    const subs = rooms.get(roomId);
    if (!subs) return;
    const message = presenceOf(subs);
    for (const sub of subs) if (sub.sink) sub.sink.send('presence', undefined, message);
  }

  function userCount(userId) {
    let count = 0;
    for (const subs of rooms.values())
      for (const sub of subs) if (sub.userId === userId) count += 1;
    return count;
  }

  /**
   * Registers a connection of `userId` (sitting at `seat`, or null for someone only looking) to a room. Throws
   * `RoomError('stream_limit')` when the account or the server has too many open. Returns `{ attach, close }`.
   */
  function subscribe(roomId, userId, seat) {
    const cap = limits();
    if (userCount(userId) >= cap.perUser) {
      throw new RoomError(
        'stream_limit',
        429,
        `You already have ${cap.perUser} live connections open: close one first.`,
      );
    }
    if (total >= cap.total) {
      throw new RoomError(
        'stream_limit',
        429,
        'The server has no room for another live connection right now.',
      );
    }
    const sub = {
      roomId,
      userId,
      seat,
      sink: null,
      held: [],
      snapshotVersion: 0,
      closed: false,
      dropped: false,
    };
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(sub);
    total += 1;

    const close = () => {
      if (sub.closed) return;
      sub.closed = true;
      total -= 1;
      const subs = rooms.get(roomId);
      if (subs) {
        subs.delete(sub);
        if (subs.size === 0) rooms.delete(roomId);
      }
      broadcastPresence(roomId);
    };

    /** Starts delivery: `sink.send(name, id, data)` gets everything after the snapshot of version `snapshotVersion`. */
    const attach = (sink, snapshotVersion) => {
      if (sub.dropped) {
        sink.end();
        return;
      }
      sub.sink = sink;
      sub.snapshotVersion = snapshotVersion;
      sub.held.forEach((update) => {
        if (update.message.version > snapshotVersion) {
          sink.send('update', update.lastSeq, update.message);
        }
      });
      sub.held = [];
      broadcastPresence(roomId);
    };

    return { attach, close };
  }

  /** roomId -> Set of functions to call when the table next changes (a read that waits for its turn, see `waitForChange`). */
  const waiters = new Map();

  function wake(roomId) {
    const set = waiters.get(roomId);
    if (!set) return;
    waiters.delete(roomId);
    for (const resolve of set) resolve(true);
  }

  /** Resolves true when the room changes, false after `ms` - no connection is registered, so nothing shows as present. */
  function waitForChange(roomId, ms) {
    return new Promise((resolve) => {
      let set = waiters.get(roomId);
      if (!set) waiters.set(roomId, (set = new Set()));
      const done = (changed) => {
        clearTimeout(timer);
        set.delete(done);
        if (set.size === 0 && waiters.get(roomId) === set) waiters.delete(roomId);
        resolve(changed);
      };
      const timer = setTimeout(() => done(false), ms);
      set.add(done);
    });
  }

  /**
   * A table changed: every connection to it gets the change as its own viewer may see it. `events` are `{ seq, event }`;
   * `previous` is the table before the change.
   */
  function publish(roomId, { previous, table, events }) {
    wake(roomId);
    const subs = rooms.get(roomId);
    if (!subs) return 0;
    const lastSeq = events.length > 0 ? events[events.length - 1].seq : undefined;
    let moved = false;
    for (const sub of [...subs]) {
      const seat = seatOf(table, sub.userId);
      if (seat !== sub.seat) {
        sub.seat = seat;
        moved = true;
      }
      const message = projectUpdate(previous, table, events, sub.userId);
      if (sub.sink) {
        // A client that connected between a change being saved and being announced already has it in its snapshot.
        if (message.version > sub.snapshotVersion) sub.sink.send('update', lastSeq, message);
      } else if (sub.held.length >= MAX_HELD_UPDATES) {
        // A connection that never attaches (or attaches very late): it is ended when it does, the client reconnects.
        sub.dropped = true;
        sub.held = [];
      } else {
        sub.held.push({ lastSeq, message });
      }
    }
    if (moved) broadcastPresence(roomId);
    return subs.size;
  }

  /** The accounts connected to a room. */
  function connectedUsers(roomId) {
    return new Set([...(rooms.get(roomId) || [])].map((sub) => sub.userId));
  }

  return {
    subscribe,
    publish,
    connectedUsers,
    waitForChange,
    size: () => total,
    presence: (roomId) => presenceOf(rooms.get(roomId) || []),
    seatOf,
  };
}

module.exports = { createGameRoomHub };
