/**
 * Unit tests for backend/services/legacy-write-id-backfill.js. CouchDB is
 * mocked — no database required.
 */
'use strict';

const {
  backfillMissingIdsForWrite,
  ID_PREFIX_BY_PATH,
} = require('../../services/legacy-write-id-backfill');

function makeAuthDb(encryptionConfig = { key: 'default', encryptDatabase: false }) {
  return { get: jest.fn(async () => ({ encryptionConfig })) };
}

describe('backfillMissingIdsForWrite', () => {
  it('assigns an id to an entry missing one, prefixed by the path', async () => {
    const result = await backfillMissingIdsForWrite(makeAuthDb(), 'u1', 'transactions', [
      { account: 'Daily', amount: -500 },
    ]);
    expect(result[0].id).toEqual(expect.stringMatching(/^tx_[0-9a-f-]{36}$/));
  });

  it('leaves an entry that already has an id untouched', async () => {
    const result = await backfillMissingIdsForWrite(makeAuthDb(), 'u1', 'smile', [
      { id: 'smile_existing', title: 'Trip' },
    ]);
    expect(result[0]).toEqual({ id: 'smile_existing', title: 'Trip' });
  });

  it('only backfills entries that are missing an id, not the whole array', async () => {
    const result = await backfillMissingIdsForWrite(makeAuthDb(), 'u1', 'fire', [
      { id: 'fire_keep', title: 'A' },
      { title: 'B' },
    ]);
    expect(result[0].id).toBe('fire_keep');
    expect(result[1].id).toEqual(expect.stringMatching(/^fire_/));
  });

  it.each(Object.entries(ID_PREFIX_BY_PATH))(
    'uses the %s prefix for path %s',
    async (path, prefix) => {
      const result = await backfillMissingIdsForWrite(makeAuthDb(), 'u1', path, [{ tag: 'x' }]);
      expect(result[0].id.startsWith(`${prefix}_`)).toBe(true);
    },
  );

  it('is a no-op for a path with no id convention', async () => {
    const input = [{ tag: 'Coffee' }];
    const result = await backfillMissingIdsForWrite(
      makeAuthDb(),
      'u1',
      'income/expenses/daily',
      input,
    );
    expect(result).toBe(input);
    expect(result[0]).not.toHaveProperty('id');
  });

  it('is a no-op when data is not an array', async () => {
    const input = { some: 'object' };
    const result = await backfillMissingIdsForWrite(makeAuthDb(), 'u1', 'transactions', input);
    expect(result).toBe(input);
  });

  it('returns the same array reference when nothing needs backfilling (no unnecessary copy)', async () => {
    const input = [{ id: 'tx_already-there' }];
    const result = await backfillMissingIdsForWrite(makeAuthDb(), 'u1', 'transactions', input);
    expect(result).toBe(input);
  });

  it('encrypts the generated id when the account has database encryption enabled', async () => {
    const authDb = makeAuthDb({ key: 'secret-passphrase', encryptDatabase: true });
    const result = await backfillMissingIdsForWrite(authDb, 'u1', 'transactions', [
      { account: 'Daily' },
    ]);
    // A real encrypted value never matches the plaintext tx_<uuid> pattern.
    expect(result[0].id).not.toEqual(expect.stringMatching(/^tx_[0-9a-f-]{36}$/));
    expect(typeof result[0].id).toBe('string');
    expect(result[0].id.length).toBeGreaterThan(0);
  });

  it('never mutates the input entries in place', async () => {
    const entry = { account: 'Daily' };
    const input = [entry];
    await backfillMissingIdsForWrite(makeAuthDb(), 'u1', 'transactions', input);
    expect(entry).not.toHaveProperty('id');
  });
  describe('reusing stored ids by natural key', () => {
    it('gives an id-less entry the stored id of the entry with the same title', async () => {
      const result = await backfillMissingIdsForWrite(
        makeAuthDb(),
        'u1',
        'grow',
        [{ title: 'IOTA' }, { title: 'SOL' }, { title: 'New' }],
        [
          { id: 'grow_sol', title: 'SOL' },
          { id: 'grow_iota', title: 'IOTA' },
        ],
      );
      expect(result.map((g) => g.id)).toEqual([
        'grow_iota',
        'grow_sol',
        expect.stringMatching(/^grow_(?!sol|iota)/),
      ]);
    });

    it('matches transactions on every identifying field and hands each stored id out only once', async () => {
      const tx = {
        account: 'Daily',
        amount: -500,
        date: '2026-01-01',
        time: '09:00',
        category: '@Food',
        comment: '',
      };
      const result = await backfillMissingIdsForWrite(
        makeAuthDb(),
        'u1',
        'transactions',
        [{ ...tx }, { ...tx }, { ...tx, amount: -600 }],
        [{ id: 'tx_one', ...tx }],
      );
      expect(result[0].id).toBe('tx_one');
      expect(result[1].id).not.toBe('tx_one');
      expect(result[2].id).not.toBe('tx_one');
    });

    it('does not reuse a stored id the incoming write already assigns to another entry', async () => {
      const result = await backfillMissingIdsForWrite(
        makeAuthDb(),
        'u1',
        'smile',
        [{ id: 'smile_1', title: 'Renamed' }, { title: 'Trip' }],
        [{ id: 'smile_1', title: 'Trip' }],
      );
      expect(result[0].id).toBe('smile_1');
      expect(result[1].id).not.toBe('smile_1');
    });

    it('matches across encryption, where the same value encrypts differently every time', async () => {
      const { EncryptionSession } = require('@money/domain');
      const session = new EncryptionSession('secret-passphrase');
      const authDb = makeAuthDb({ key: 'secret-passphrase', encryptDatabase: true });
      const storedId = session.encrypt('grow_sol');
      const result = await backfillMissingIdsForWrite(
        authDb,
        'u1',
        'grow',
        [{ title: session.encrypt('SOL') }],
        [{ id: storedId, title: session.encrypt('SOL') }],
      );
      expect(result[0].id).toBe(storedId);
    });
  });
});
