/**
 * Unit tests for the multiplayer room store (backend/repositories/game-room-store.js) and the service's error mapping
 * (backend/services/game-rooms.js). CouchDB is faked in memory.
 */
'use strict';

const { TableCommandError } = require('@money/domain');
const store = require('../../repositories/game-room-store');
const { problemFor, RoomError, createGameRoomService } = require('../../services/game-rooms');

const clone = (doc) => JSON.parse(JSON.stringify(doc));

function matches(doc, selector) {
  return Object.entries(selector).every(([field, expected]) => {
    const value = doc[field];
    if (expected && typeof expected === 'object') {
      if ('$lt' in expected) return String(value) < String(expected.$lt);
      if ('$in' in expected) return expected.$in.includes(value);
    }
    return value === expected;
  });
}

function makeDb(initial = []) {
  const docs = new Map(initial.map((doc) => [doc._id, { ...doc }]));
  let revision = 1;
  const notFound = () => Object.assign(new Error('not_found'), { statusCode: 404 });
  const write = (doc) => {
    const current = docs.get(doc._id);
    if (current && current._rev !== doc._rev) {
      throw Object.assign(new Error('conflict'), { statusCode: 409 });
    }
    if (!current && doc._rev) throw Object.assign(new Error('conflict'), { statusCode: 409 });
    revision += 1;
    if (doc._deleted) docs.delete(doc._id);
    else docs.set(doc._id, { ...clone(doc), _rev: `${revision}-x` });
    return { ok: true, id: doc._id, rev: `${revision}-x` };
  };
  return {
    docs,
    get: jest.fn(async (id) => {
      if (!docs.has(id)) throw notFound();
      return clone(docs.get(id));
    }),
    insert: jest.fn(async (doc) => write(doc)),
    destroy: jest.fn(async (id, rev) => write({ _id: id, _rev: rev, _deleted: true })),
    bulk: jest.fn(async ({ docs: batch }) => batch.map((doc) => write(doc))),
    find: jest.fn(async ({ selector, limit }) => ({
      docs: [...docs.values()]
        .filter((doc) => matches(doc, selector))
        .slice(0, limit ?? 25)
        .map(clone),
    })),
    list: jest.fn(async ({ startkey, endkey, limit }) => ({
      rows: [...docs.values()]
        .filter((doc) => doc._id >= startkey && doc._id <= endkey)
        .sort((a, b) => a._id.localeCompare(b._id))
        .slice(0, limit ?? 1000)
        .map((doc) => ({ id: doc._id, doc: clone(doc) })),
    })),
    fetch: jest.fn(async ({ keys }) => ({
      rows: keys.map((key) =>
        docs.has(key) ? { id: key, doc: clone(docs.get(key)) } : { key, error: 'not_found' },
      ),
    })),
  };
}

const room = (roomId, extra = {}) => ({ kind: 'room', roomId, phase: 'lobby', ...extra });

describe('rooms', () => {
  it('saves a new room and refuses to overwrite a newer one', async () => {
    const db = makeDb();
    const saved = await store.saveRoom(db, room('a', { name: 'First' }));
    expect(saved._id).toBe('room:a');
    expect((await store.getRoom(db, 'a')).name).toBe('First');
    expect(await store.getRoom(db, 'missing')).toBeNull();

    // someone else saves first: the stale revision is a conflict, the caller reloads
    await store.saveRoom(db, { ...saved, name: 'Second' });
    await expect(store.saveRoom(db, { ...saved, name: 'Stale' })).rejects.toBeInstanceOf(
      store.RoomConflictError,
    );
    expect((await store.getRoom(db, 'a')).name).toBe('Second');
  });

  it('refuses a document above the size a database holds', async () => {
    const db = makeDb();
    const big = room('big', { blob: 'x'.repeat(store.MAX_ROOM_BYTES) });
    await expect(store.saveRoom(db, big)).rejects.toBeInstanceOf(store.RoomTooLargeError);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('lists the public rooms of a phase, newest first, and finds one by invite code', async () => {
    const db = makeDb();
    await store.saveRoom(
      db,
      room('old', {
        visibility: 'public',
        createdAt: '2026-10-01T00:00:00Z',
        inviteCode: 'AAAAAAAA',
      }),
    );
    await store.saveRoom(
      db,
      room('new', {
        visibility: 'public',
        createdAt: '2026-10-02T00:00:00Z',
        inviteCode: 'BBBBBBBB',
      }),
    );
    await store.saveRoom(
      db,
      room('hidden', {
        visibility: 'private',
        createdAt: '2026-10-03T00:00:00Z',
        inviteCode: 'CCCCCCCC',
      }),
    );
    await store.saveRoom(
      db,
      room('playing', {
        phase: 'playing',
        visibility: 'public',
        createdAt: '2026-10-04T00:00:00Z',
      }),
    );
    expect((await store.listPublicRooms(db, 'lobby', 10)).map((r) => r.roomId)).toEqual([
      'new',
      'old',
    ]);
    expect((await store.listPublicRooms(db, 'lobby', 1)).map((r) => r.roomId)).toEqual(['new']);
    expect((await store.findByInviteCode(db, 'CCCCCCCC')).roomId).toBe('hidden');
    expect(await store.findByInviteCode(db, 'ZZZZZZZZ')).toBeNull();
    expect((await store.getRooms(db, ['old', 'ghost', 'new'])).map((r) => r.roomId)).toEqual([
      'old',
      'new',
    ]);
    expect(await store.getRooms(db, [])).toEqual([]);
  });
});

describe('events', () => {
  it('appends in order and reads from a point', async () => {
    const db = makeDb();
    await store.appendEvents(db, 'a', 1, [
      { version: 1, type: 'table_created' },
      { version: 2, type: 'player_joined' },
      { version: 3, type: 'ready_changed' },
    ]);
    await store.appendEvents(db, 'a', 4, [{ version: 4, type: 'player_left' }]);
    await store.appendEvents(db, 'other', 1, [{ version: 1, type: 'table_created' }]);
    await store.appendEvents(db, 'a', 5, []);
    expect((await store.readEvents(db, 'a')).map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect((await store.readEvents(db, 'a', 2)).map((e) => e.type)).toEqual([
      'ready_changed',
      'player_left',
    ]);
    expect((await store.readEvents(db, 'a', 0, 2)).map((e) => e.seq)).toEqual([1, 2]);
    // sequence numbers sort as numbers even past 9 and 99
    await store.appendEvents(
      db,
      'b',
      8,
      Array.from({ length: 5 }, (_, i) => ({ version: i })),
    );
    expect((await store.readEvents(db, 'b')).map((e) => e.seq)).toEqual([8, 9, 10, 11, 12]);
  });
});

describe('seat markers', () => {
  it('keeps one marker per seat, drops the ones that are gone, and reads them per account', async () => {
    const db = makeDb();
    await store.syncMarkers(
      db,
      'r1',
      new Map([
        ['u1', true],
        ['u2', false],
      ]),
    );
    await store.syncMarkers(db, 'r2', new Map([['u2', true]]));
    expect((await store.seatMarkers(db, 'u1')).map((m) => [m.roomId, m.host])).toEqual([
      ['r1', true],
    ]);
    expect((await store.seatMarkers(db, 'u2')).map((m) => [m.roomId, m.host])).toEqual([
      ['r1', false],
      ['r2', true],
    ]);
    // u2 leaves r1; u1 stays
    await store.syncMarkers(db, 'r1', new Map([['u1', true]]));
    expect((await store.seatMarkers(db, 'u2')).map((m) => m.roomId)).toEqual(['r2']);
    // a change of host rewrites the marker, an unchanged one is left alone
    const writes = db.insert.mock.calls.length;
    await store.syncMarkers(db, 'r1', new Map([['u1', true]]));
    expect(db.insert.mock.calls.length).toBe(writes);
    await store.syncMarkers(db, 'r1', new Map([['u1', false]]));
    expect((await store.seatMarkers(db, 'u1'))[0].host).toBe(false);
    // a closed room holds no seats
    await store.syncMarkers(db, 'r1', new Map());
    expect(await store.seatMarkers(db, 'u1')).toEqual([]);
  });
});

describe('markers of a table that is over', () => {
  it('can be kept as closed, change from open to closed, and read back with the flag', async () => {
    const db = makeDb();
    await store.syncMarkers(
      db,
      'r1',
      new Map([
        ['u1', { host: true, closed: false }],
        ['u2', false],
      ]),
    );
    expect((await store.seatMarkers(db, 'u1'))[0]).toMatchObject({ host: true, closed: false });
    expect((await store.seatMarkers(db, 'u2'))[0]).toMatchObject({ host: false, closed: false });
    // the table ends: everyone who sat keeps a closed marker
    await store.syncMarkers(
      db,
      'r1',
      new Map([
        ['u1', { host: true, closed: true }],
        ['u2', { host: false, closed: true }],
      ]),
    );
    expect((await store.seatMarkers(db, 'u1'))[0].closed).toBe(true);
    expect((await store.seatMarkers(db, 'u2'))[0].closed).toBe(true);
    // an unchanged marker is not written again
    const writes = db.insert.mock.calls.length;
    await store.syncMarkers(
      db,
      'r1',
      new Map([
        ['u1', { host: true, closed: true }],
        ['u2', { host: false, closed: true }],
      ]),
    );
    expect(db.insert.mock.calls.length).toBe(writes);
    // deleting the room takes them with it
    await store.saveRoom(db, room('r1'));
    await store.deleteRoom(db, 'r1');
    expect(await store.seatMarkers(db, 'u1')).toEqual([]);
  });
});

describe('deleting a room', () => {
  it('removes the room, its events and its markers - and nothing else', async () => {
    const db = makeDb();
    await store.saveRoom(db, room('a'));
    await store.saveRoom(db, room('b'));
    await store.appendEvents(db, 'a', 1, [{ version: 1 }, { version: 2 }]);
    await store.appendEvents(db, 'b', 1, [{ version: 1 }]);
    await store.syncMarkers(db, 'a', new Map([['u1', true]]));
    await store.syncMarkers(db, 'b', new Map([['u1', false]]));
    expect(await store.deleteRoom(db, 'a')).toBe(4);
    expect(await store.getRoom(db, 'a')).toBeNull();
    expect(await store.readEvents(db, 'a')).toEqual([]);
    expect((await store.seatMarkers(db, 'u1')).map((m) => m.roomId)).toEqual(['b']);
    expect(await store.getRoom(db, 'b')).not.toBeNull();
    expect(await store.readEvents(db, 'b')).toHaveLength(1);
    expect(await store.deleteRoom(db, 'nothing')).toBe(0);
  });
});

describe('how refusals read over HTTP', () => {
  it('maps a table rule to a status and a table_* code', () => {
    const cases = [
      ['NOT_HOST', 403],
      ['NOT_A_MEMBER', 403],
      ['INVALID_SETTINGS', 400],
      ['INVALID_NAME', 400],
      ['UNKNOWN_PLAYER', 404],
      ['NAME_TAKEN', 409],
      ['TABLE_FULL', 409],
      ['WRONG_PHASE', 409],
      ['NOT_READY', 409],
    ];
    for (const [code, status] of cases) {
      expect(problemFor(new TableCommandError(code, 'no'))).toEqual({
        status,
        code: `table_${code.toLowerCase()}`,
        title: 'Table request refused',
        detail: 'no',
      });
    }
  });

  it("maps the service's own refusals and the storage ones, and ignores anything else", () => {
    expect(problemFor(new RoomError('room_limit', 429, 'too many'))).toMatchObject({
      status: 429,
      code: 'room_limit',
    });
    expect(problemFor(new store.RoomTooLargeError(9))).toMatchObject({
      status: 413,
      code: 'room_too_large',
    });
    expect(problemFor(new Error('boom'))).toBeNull();
  });
});

describe('the service over a fake database', () => {
  it('creates a room, shows it to its host only with the code, and cleans up after the sweep', async () => {
    const db = makeDb();
    let now = Date.parse('2026-10-15T09:00:00Z');
    const clock = { nowIso: () => new Date(now).toISOString(), todayIso: () => '2026-10-15' };
    const service = createGameRoomService({ db, clock });
    const view = await service.createRoom('u1', { nickname: 'Anna', settings: { name: 'Table' } });
    expect(view.inviteCode).toHaveLength(8);
    expect(view.table.youSeat).toBe(0);
    expect(JSON.stringify(view)).not.toContain('u1');
    const stranger = await service.getRoom('u2', view.id);
    expect(stranger.inviteCode).toBeUndefined();
    expect(stranger.table.youSeat).toBeNull();
    expect(await service.listRooms('u2')).toHaveLength(1);
    expect(await service.listRooms('u1', { scope: 'mine' })).toHaveLength(1);

    now += 2 * 24 * 60 * 60 * 1000;
    expect(await service.sweep()).toEqual({ closed: 1, deleted: 0 });
    expect(await service.listRooms('u2')).toEqual([]);
    now += 91 * 24 * 60 * 60 * 1000; // a finished table is kept for three months
    expect(await service.sweep()).toEqual({ closed: 0, deleted: 1 });
    await expect(service.getRoom('u1', view.id)).rejects.toMatchObject({ code: 'room_not_found' });
  });
});
