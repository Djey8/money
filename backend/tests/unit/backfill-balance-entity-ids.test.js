'use strict';

const { EncryptionSession } = require('@money/domain');
const { backfillBalanceEntityIds } = require('../../cli/commands/backfill-balance-entity-ids');
const fs = require('fs');
const path = require('path');
const os = require('os');

function makeUsersDb(doc) {
  let current = doc;
  return {
    get: jest.fn(async () => structuredClone(current)),
    insert: jest.fn(async (next) => {
      current = { ...next, _rev: '2-test' };
    }),
    current: () => current,
  };
}

function makeAuthDb(encryptionConfig) {
  return { get: jest.fn(async () => ({ encryptionConfig })) };
}

function tempBackupDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mm-balance-id-'));
}

describe('backfillBalanceEntityIds', () => {
  it('adds stable IDs to assets at their nested storage path, creates a backup, and remains idempotent', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: { balance: { asset: { assets: [{ tag: 'Car', amount: 8000 }] } } },
    });
    const backupDir = tempBackupDir();
    const options = { userId: 'user_1', collection: 'assets', backupDir };
    const first = await backfillBalanceEntityIds({ usersDb, authDb: makeAuthDb() }, options);
    expect(first.status).toBe('backfilled');
    expect(usersDb.current().data.balance.asset.assets[0].id).toMatch(/^assets_/);
    expect(first.backupFile).toContain('assets-ids');
    await expect(
      backfillBalanceEntityIds({ usersDb, authDb: makeAuthDb() }, options),
    ).resolves.toMatchObject({ status: 'already-backfilled' });
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it('leaves an already-ided entry untouched while backfilling the rest of the array', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: {
        balance: {
          asset: {
            assets: [
              { id: 'assets_existing', tag: 'Car', amount: 8000 },
              { tag: 'Boat', amount: 20000 },
            ],
          },
        },
      },
    });
    const backupDir = tempBackupDir();
    const result = await backfillBalanceEntityIds(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user_1', collection: 'assets', backupDir },
    );
    expect(result.status).toBe('backfilled');
    expect(result.idsAdded).toBe(1);
    expect(usersDb.current().data.balance.asset.assets[0].id).toBe('assets_existing');
    expect(usersDb.current().data.balance.asset.assets[1].id).toMatch(/^assets_/);
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it.each([
    ['shares', ['balance', 'asset', 'shares']],
    ['investments', ['balance', 'asset', 'investments']],
    ['liabilities', ['balance', 'liabilities']],
    ['grow', ['grow']],
  ])('backfills %s at its own storage path', async (collection, pathSegments) => {
    const leaf = { tag: 'Entry' };
    const data = {};
    let cursor = data;
    for (let i = 0; i < pathSegments.length - 1; i += 1) {
      cursor[pathSegments[i]] = {};
      cursor = cursor[pathSegments[i]];
    }
    cursor[pathSegments[pathSegments.length - 1]] = [leaf];

    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data,
    });
    const backupDir = tempBackupDir();
    const result = await backfillBalanceEntityIds(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user_1', collection, backupDir },
    );
    expect(result.status).toBe('backfilled');
    let stored = usersDb.current().data;
    for (const segment of pathSegments) stored = stored[segment];
    expect(stored[0].id.startsWith(`${collection}_`)).toBe(true);
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it('encrypts new IDs when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: { balance: { asset: { assets: [{ tag: session.encrypt('Car') }] } } },
    });
    const backupDir = tempBackupDir();
    await backfillBalanceEntityIds(
      { usersDb, authDb: makeAuthDb({ key: 'secret', encryptDatabase: true }) },
      { userId: 'user_1', collection: 'assets', backupDir },
    );
    expect(session.decrypt(usersDb.current().data.balance.asset.assets[0].id)).toMatch(/^assets_/);
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it('reports no-assets when the collection does not exist', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: {},
    });
    const result = await backfillBalanceEntityIds(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user_1', collection: 'assets' },
    );
    expect(result.status).toBe('no-assets');
  });

  it('rejects an unknown collection', async () => {
    const usersDb = makeUsersDb({ data: {} });
    await expect(
      backfillBalanceEntityIds(
        { usersDb, authDb: makeAuthDb() },
        { userId: 'user_1', collection: 'unknown' },
      ),
    ).rejects.toThrow('--collection must be one of');
  });

  it('requires a userId', async () => {
    const usersDb = makeUsersDb({ data: {} });
    await expect(
      backfillBalanceEntityIds({ usersDb, authDb: makeAuthDb() }, { collection: 'assets' }),
    ).rejects.toThrow('--user <id> is required');
  });
});
