/**
 * Unit tests for the saved-game store (backend/repositories/game-save-store.js) and for `mm-admin
 * rotate-encryption-key` re-keying the saved games kept in it. CouchDB is faked in memory.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EncryptionSession } = require('@money/domain');
const store = require('../../repositories/game-save-store');
const { runRotateEncryptionKey } = require('../../cli/commands/rotate-encryption-key');

function makeDb(initial = []) {
  const docs = new Map(initial.map((doc) => [doc._id, { ...doc }]));
  let revision = 1;
  const clone = (doc) => JSON.parse(JSON.stringify(doc));
  const notFound = () => Object.assign(new Error('not_found'), { statusCode: 404 });
  return {
    get: jest.fn(async (id) => {
      if (!docs.has(id)) throw notFound();
      return clone(docs.get(id));
    }),
    insert: jest.fn(async (doc) => {
      const current = docs.get(doc._id);
      if (current && current._rev !== doc._rev) {
        throw Object.assign(new Error('conflict'), { statusCode: 409 });
      }
      revision += 1;
      docs.set(doc._id, { ...clone(doc), _rev: `${revision}-x` });
      return { ok: true, id: doc._id, rev: `${revision}-x` };
    }),
    destroy: jest.fn(async (id) => {
      if (!docs.delete(id)) throw notFound();
      return { ok: true };
    }),
    find: jest.fn(async ({ selector }) => ({
      docs: [...docs.values()]
        .filter((doc) => doc.userId === selector.userId)
        .map((doc) => clone(doc)),
    })),
    _all: () => [...docs.values()],
  };
}

describe('game save store', () => {
  it('stores a game under <userId>:<gameId> with its size, and reads, replaces and deletes it', async () => {
    const db = makeDb();
    const bytes = await store.writeStoredGame(db, 'u1', 'g1', {
      schema: 's',
      payload: 'p'.repeat(50),
    });
    expect(bytes).toBe(Buffer.byteLength(JSON.stringify({ schema: 's', payload: 'p'.repeat(50) })));
    expect(db._all()[0]).toMatchObject({ _id: 'u1:g1', userId: 'u1', gameId: 'g1', bytes });
    expect(await store.readStoredGame(db, 'u1', 'g1')).toEqual({
      schema: 's',
      payload: 'p'.repeat(50),
    });

    await store.writeStoredGame(db, 'u1', 'g1', { schema: 's', payload: 'q' });
    expect(db._all()).toHaveLength(1);
    expect((await store.readStoredGame(db, 'u1', 'g1')).payload).toBe('q');

    expect(await store.deleteStoredGame(db, 'u1', 'g1')).toBe(true);
    expect(await store.deleteStoredGame(db, 'u1', 'g1')).toBe(false);
    expect(await store.readStoredGame(db, 'u1', 'g1')).toBeNull();
  });

  it('keeps accounts apart when listing sizes and deleting everything', async () => {
    const db = makeDb();
    await store.writeStoredGame(db, 'u1', 'a', { schema: 's', payload: '1' });
    await store.writeStoredGame(db, 'u1', 'b', { schema: 's', payload: '22' });
    await store.writeStoredGame(db, 'u2', 'a', { schema: 's', payload: '3' });
    const sizes = await store.storedGameSizes(db, 'u1');
    expect(sizes.map((entry) => entry.id).sort()).toEqual(['a', 'b']);
    expect(await store.deleteAllStoredGames(db, 'u1')).toBe(2);
    expect(await store.readStoredGame(db, 'u2', 'a')).not.toBeNull();
  });

  it('recognises the data path of one saved game and nothing else', () => {
    expect(store.gamePathId('cashflowGames/games/game_1')).toBe('game_1');
    expect(store.gamePathId('cashflowGames/index')).toBeNull();
    expect(store.gamePathId('cashflowGames/games')).toBeNull();
    expect(store.gamePathId('cashflowGames/games/a/b')).toBeNull();
  });

  describe('moving games out of the user document', () => {
    const userDoc = () => ({
      _id: 'u1',
      _rev: '1-a',
      data: {
        cashflowGames: {
          index: { schema: 's', payload: 'i' },
          games: { g1: { schema: 's', payload: 'one' }, g2: { schema: 's', payload: 'two' } },
        },
        other: 1,
      },
    });

    it('copies each game, then drops the embedded copies and keeps the index', async () => {
      const usersDb = makeDb([userDoc()]);
      const savesDb = makeDb();
      const moved = await store.migrateEmbeddedGames({ usersDb, savesDb }, 'u1');
      expect(moved.sort()).toEqual(['g1', 'g2']);
      expect((await store.readStoredGame(savesDb, 'u1', 'g2')).payload).toBe('two');
      const after = await usersDb.get('u1');
      expect(after.data.cashflowGames).toEqual({ index: { schema: 's', payload: 'i' } });
      expect(after.data.other).toBe(1);
      expect(await store.migrateEmbeddedGames({ usersDb, savesDb }, 'u1')).toEqual([]);
    });

    it('never replaces a game that already has a document of its own with the embedded copy', async () => {
      const usersDb = makeDb([userDoc()]);
      const savesDb = makeDb();
      await store.writeStoredGame(savesDb, 'u1', 'g1', { schema: 's', payload: 'newer' });
      await store.migrateEmbeddedGames({ usersDb, savesDb }, 'u1');
      expect((await store.readStoredGame(savesDb, 'u1', 'g1')).payload).toBe('newer');
      expect(store.embeddedGameIds((await usersDb.get('u1')).data)).toEqual([]);
    });

    it('leaves the embedded copies in place when a copy does not read back the same', async () => {
      const usersDb = makeDb([userDoc()]);
      const savesDb = makeDb();
      const real = savesDb.get;
      savesDb.get = jest.fn(async (id) => {
        const doc = await real(id);
        return { ...doc, payload: 'corrupt' };
      });
      await expect(store.migrateEmbeddedGames({ usersDb, savesDb }, 'u1')).rejects.toThrow(
        /did not read back/,
      );
      expect(store.embeddedGameIds((await usersDb.get('u1')).data).sort()).toEqual(['g1', 'g2']);
    });
  });
});

describe('rotate-encryption-key and saved games', () => {
  const OLD_KEY = 'old-key';
  const NEW_KEY = 'new-key';
  let backupDir;
  beforeEach(() => {
    backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-admin-rotate-saves-'));
  });
  afterEach(() => {
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  function accounts(oldSession) {
    return {
      usersDb: makeDb([
        { _id: 'user1', _rev: '1-a', data: { smile: { target: oldSession.encrypt('1') } } },
      ]),
      authDb: makeDb([
        {
          _id: 'user1',
          _rev: '1-a',
          encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
        },
      ]),
      auditDb: makeDb(),
    };
  }

  async function storeGames(savesDb, oldSession) {
    await store.writeStoredGame(savesDb, 'user1', 'g1', {
      schema: oldSession.encrypt('1'),
      payload: oldSession.encrypt('first game'),
    });
    await store.writeStoredGame(savesDb, 'user1', 'g2', {
      schema: oldSession.encrypt('1'),
      payload: oldSession.encrypt('second game'),
    });
  }

  it('re-keys every saved game and reports how many', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const savesDb = makeDb();
    await storeGames(savesDb, oldSession);
    const result = await runRotateEncryptionKey(
      { ...accounts(oldSession), savesDb },
      { userId: 'user1', newKey: NEW_KEY, backupDir },
    );
    expect(result.status).toBe('rotated');
    expect(result.savedGamesReencrypted).toBe(2);
    const g1 = await store.readStoredGame(savesDb, 'user1', 'g1');
    expect(newSession.decrypt(g1.payload)).toBe('first game');
    expect(newSession.decrypt(g1.schema)).toBe('1');
  });

  it('reports the games in a dry run and changes nothing', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const savesDb = makeDb();
    await storeGames(savesDb, oldSession);
    const before = JSON.stringify(savesDb._all());
    const result = await runRotateEncryptionKey(
      { ...accounts(oldSession), savesDb },
      { userId: 'user1', newKey: NEW_KEY, dryRun: true, backupDir },
    );
    expect(result).toMatchObject({ status: 'dry-run', savedGamesReencrypted: 2 });
    expect(JSON.stringify(savesDb._all())).toBe(before);
  });

  it('rolls everything back, games included, when a game cannot be re-keyed', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const savesDb = makeDb();
    await storeGames(savesDb, oldSession);
    const before = JSON.stringify(
      savesDb._all().map(({ _id, schema, payload }) => ({ _id, schema, payload })),
    );
    // the second game fails to write
    const insert = savesDb.insert;
    let writes = 0;
    savesDb.insert = jest.fn(async (doc) => {
      writes += 1;
      if (writes === 2) throw new Error('disk full');
      return insert(doc);
    });
    await expect(
      runRotateEncryptionKey(
        { ...accounts(oldSession), savesDb },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(/saved game user1:g2 failed/);
    const after = JSON.stringify(
      savesDb._all().map(({ _id, schema, payload }) => ({ _id, schema, payload })),
    );
    expect(after).toBe(before);
  });
});
