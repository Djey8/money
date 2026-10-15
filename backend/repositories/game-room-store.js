'use strict';

/**
 * Where multiplayer Cashflow tables live (docs/adr/0010, todo/cashflow-multiplayer.md slice S1): the `gamerooms` database.
 * Game data is public to the table by design, so it is stored in plain - nothing here comes from a personal account's books.
 *
 *  - `room:<roomId>`           the room: the table (settings, seats, books once play starts), the invite code, and the
 *                              fields the lobby list reads without opening the table (name, phase, seats, host name...).
 *  - `event:<roomId>:<seq>`    one table event, append-only, `seq` zero-padded so ids sort; what a reconnecting client
 *                              replays from (slice S2) and what a replay of the game is built from.
 *  - `snap:<roomId>:<slot>`    the table as it stood when a turn started, two slots used in turn (slice S4): what the
 *                              host's rewind puts back. Written after the room, replaced two turns later.
 *  - `seat:<userId>:<roomId>`  a marker that the account holds - or, once the table is over (`closed`), held - a seat: it
 *                              keeps the per-account limits and the "my tables" and "recent tables" lists cheap (a range read, no index). Markers are
 *                              advisory - the table is the truth - and the sweep removes stale ones.
 */

const ROOM_PREFIX = 'room:';
const EVENT_PREFIX = 'event:';
const SEAT_PREFIX = 'seat:';
const SNAPSHOT_PREFIX = 'snap:';
const HIGH = '￰';
const MAX_WRITE_RETRIES = 10;
/** CouchDB refuses documents above 8 MiB (`max_document_size`); a room stays well below that. */
const MAX_ROOM_BYTES = 6 * 1024 * 1024;

const roomId = (id) => `${ROOM_PREFIX}${id}`;
const eventId = (id, seq) => `${EVENT_PREFIX}${id}:${String(seq).padStart(8, '0')}`;
const seatId = (userId, id) => `${SEAT_PREFIX}${userId}:${id}`;
const snapshotId = (id, slot) => `${SNAPSHOT_PREFIX}${id}:${slot}`;

class RoomConflictError extends Error {
  constructor() {
    super('The room was changed by someone else at the same time.');
    this.name = 'RoomConflictError';
  }
}

class RoomTooLargeError extends Error {
  constructor(bytes) {
    super(`The room is ${bytes} bytes: too large to store.`);
    this.name = 'RoomTooLargeError';
  }
}

const notFound = (error) => error && error.statusCode === 404;

/** The room document, or null. */
async function getRoom(db, id) {
  try {
    return await db.get(roomId(id));
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/**
 * Writes a room document. With a `_rev` it must still be the newest one (else `RoomConflictError`: the caller reloads and
 * tries again); without, the room must be new.
 */
async function saveRoom(db, doc) {
  const bytes = Buffer.byteLength(JSON.stringify(doc));
  if (bytes > MAX_ROOM_BYTES) throw new RoomTooLargeError(bytes);
  try {
    const result = await db.insert({ ...doc, _id: roomId(doc.roomId) });
    return { ...doc, _id: roomId(doc.roomId), _rev: result.rev };
  } catch (error) {
    if (error.statusCode === 409) throw new RoomConflictError();
    throw error;
  }
}

/** The room with this invite code, or null. */
async function findByInviteCode(db, code) {
  const found = await db.find({ selector: { inviteCode: code, kind: 'room' }, limit: 1 });
  return found.docs[0] || null;
}

/** The public rooms in a phase, newest first (the lobby list). */
async function listPublicRooms(db, phase, limit) {
  const found = await db.find({
    selector: { kind: 'room', phase, visibility: 'public' },
    limit: Math.max(limit * 3, 100),
  });
  return found.docs
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

/** The rooms with these ids (missing ones are left out). */
async function getRooms(db, ids) {
  if (ids.length === 0) return [];
  const result = await db.fetch({ keys: ids.map(roomId) }, { include_docs: true });
  return result.rows.filter((row) => row.doc && !row.error).map((row) => row.doc);
}

/** Rooms nobody has touched since `cutoffIso`. */
async function findIdleRooms(db, cutoffIso, limit = 200) {
  const found = await db.find({
    selector: { kind: 'room', updatedAt: { $lt: cutoffIso } },
    limit,
  });
  return found.docs;
}

/** How many rooms are still open (lobby, picking or playing). */
async function countOpenRooms(db) {
  const found = await db.find({
    selector: { kind: 'room', phase: { $in: ['lobby', 'picking', 'playing'] } },
    fields: ['_id'],
    limit: 100000,
  });
  return found.docs.length;
}

// ── Events ─────────────────────────────────────────────────────────────────────────────────────────

/** Appends events with the sequence numbers `firstSeq...`; the room document's `eventSeq` says where the log ends. */
async function appendEvents(db, id, firstSeq, events) {
  if (events.length === 0) return;
  await db.bulk({
    docs: events.map((event, index) => ({
      _id: eventId(id, firstSeq + index),
      kind: 'event',
      roomId: id,
      seq: firstSeq + index,
      ...event,
    })),
  });
}

/** Events after `afterSeq`, oldest first. */
async function readEvents(db, id, afterSeq = 0, limit = 500) {
  const result = await db.list({
    startkey: eventId(id, afterSeq + 1),
    endkey: `${EVENT_PREFIX}${id}:${HIGH}`,
    include_docs: true,
    limit,
  });
  return result.rows.map((row) => row.doc);
}

// ── Turn snapshots ─────────────────────────────────────────────────────────────────────────────────

/** Keeps the table as it stood when turn number `turnSeq` started, in one of two slots (the older one is replaced). */
async function putSnapshot(db, id, turnSeq, table) {
  const doc = {
    _id: snapshotId(id, turnSeq % 2),
    kind: 'snapshot',
    roomId: id,
    turnSeq,
    version: table.version,
    table,
  };
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    let existing = null;
    try {
      existing = await db.get(doc._id);
    } catch (error) {
      if (!notFound(error)) throw error;
    }
    try {
      await db.insert({ ...doc, ...(existing ? { _rev: existing._rev } : {}) });
      return;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }
}

/** The snapshot of turn `turnSeq`, or null when it is gone (only the last two are kept). */
async function getSnapshot(db, id, turnSeq) {
  try {
    const doc = await db.get(snapshotId(id, turnSeq % 2));
    return doc.turnSeq === turnSeq ? doc : null;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/** The tables being played (to arm their clocks again after a restart). */
async function listPlayingRooms(db, limit = 1000) {
  const found = await db.find({ selector: { kind: 'room', phase: 'playing' }, limit });
  return found.docs;
}

// ── Seat markers ───────────────────────────────────────────────────────────────────────────────────

/** Every marker of an account: the rooms it holds a seat in, and whether it hosts them. */
async function seatMarkers(db, userId) {
  const result = await db.list({
    startkey: `${SEAT_PREFIX}${userId}:`,
    endkey: `${SEAT_PREFIX}${userId}:${HIGH}`,
    include_docs: true,
  });
  return result.rows.map((row) => row.doc);
}

/** Every marker of a room (to clear them when it goes). */
async function markersOfRoom(db, id) {
  const found = await db.find({ selector: { kind: 'seat', roomId: id }, limit: 1000 });
  return found.docs;
}

async function putMarker(db, userId, id, host, closed = false) {
  const marker = {
    _id: seatId(userId, id),
    kind: 'seat',
    userId,
    roomId: id,
    host,
    closed,
    updatedAt: new Date().toISOString(),
  };
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    try {
      let existing = null;
      try {
        existing = await db.get(marker._id);
      } catch (error) {
        if (!notFound(error)) throw error;
      }
      if (existing && existing.host === host && Boolean(existing.closed) === closed) return;
      await db.insert({ ...marker, ...(existing ? { _rev: existing._rev } : {}) });
      return;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }
}

async function dropMarker(db, userId, id) {
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    try {
      const existing = await db.get(seatId(userId, id));
      await db.destroy(existing._id, existing._rev);
      return;
    } catch (error) {
      if (notFound(error)) return;
      if (error.statusCode !== 409) throw error;
    }
  }
}

/**
 * Makes the markers of a room match who holds a seat now: `desired` maps account id -> hosts. Markers for accounts that no
 * longer hold one are removed.
 */
async function syncMarkers(db, id, desired) {
  const existing = await markersOfRoom(db, id);
  const have = new Set(existing.map((marker) => marker.userId));
  for (const [userId, entry] of desired) {
    // `true`/`false` (a seat at an open table: hosts or not) or `{ host, closed }`
    const { host, closed } = typeof entry === 'boolean' ? { host: entry, closed: false } : entry;
    await putMarker(db, userId, id, host, Boolean(closed));
  }
  for (const userId of have) if (!desired.has(userId)) await dropMarker(db, userId, id);
}

/** Deletes a room with its events and markers. */
async function deleteRoom(db, id) {
  const room = await getRoom(db, id);
  const docs = [];
  if (room) docs.push({ _id: room._id, _rev: room._rev, _deleted: true });
  for (let after = 0; ;) {
    const events = await readEvents(db, id, after, 500);
    if (events.length === 0) break;
    docs.push(...events.map((event) => ({ _id: event._id, _rev: event._rev, _deleted: true })));
    after = events[events.length - 1].seq;
    if (events.length < 500) break;
  }
  for (const marker of await markersOfRoom(db, id)) {
    docs.push({ _id: marker._id, _rev: marker._rev, _deleted: true });
  }
  const snapshots = await db.list({
    startkey: `${SNAPSHOT_PREFIX}${id}:`,
    endkey: `${SNAPSHOT_PREFIX}${id}:${HIGH}`,
  });
  for (const row of snapshots.rows) docs.push({ _id: row.id, _rev: row.value.rev, _deleted: true });
  if (docs.length > 0) await db.bulk({ docs });
  return docs.length;
}

module.exports = {
  MAX_ROOM_BYTES,
  RoomConflictError,
  RoomTooLargeError,
  getRoom,
  getRooms,
  saveRoom,
  findByInviteCode,
  listPublicRooms,
  findIdleRooms,
  countOpenRooms,
  appendEvents,
  readEvents,
  seatMarkers,
  syncMarkers,
  putSnapshot,
  getSnapshot,
  listPlayingRooms,
  deleteRoom,
};
