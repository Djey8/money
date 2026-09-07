'use strict';

const { EncryptionSession } = require('@money/domain');
const { backfillFundProjectIds } = require('../../cli/commands/backfill-fund-project-ids');

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

describe('backfillFundProjectIds', () => {
  it('adds stable IDs to Smile projects, creates a backup, and remains idempotent', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: { smile: [{ title: 'Vacation', phase: 'saving', buckets: [] }] },
    });
    const backupDir = require('fs').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'mm-fund-id-'),
    );
    const options = { userId: 'user_1', collection: 'smile', backupDir };
    const first = await backfillFundProjectIds({ usersDb, authDb: makeAuthDb() }, options);
    expect(first.status).toBe('backfilled');
    expect(usersDb.current().data.smile[0].id).toMatch(/^smile_/);
    expect(first.backupFile).toContain('smile-ids');
    await expect(
      backfillFundProjectIds({ usersDb, authDb: makeAuthDb() }, options),
    ).resolves.toMatchObject({ status: 'already-backfilled' });
    require('fs').rmSync(backupDir, { recursive: true, force: true });
  });

  it('leaves an already-ided project untouched while backfilling the rest of the array', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: {
        smile: [
          { id: 'smile_existing', title: 'Vacation', phase: 'saving', buckets: [] },
          { title: 'New Car', phase: 'planning', buckets: [] },
        ],
      },
    });
    const backupDir = require('fs').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'mm-fund-id-'),
    );
    const result = await backfillFundProjectIds(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user_1', collection: 'smile', backupDir },
    );
    expect(result.status).toBe('backfilled');
    expect(result.idsAdded).toBe(1);
    expect(usersDb.current().data.smile[0].id).toBe('smile_existing');
    expect(usersDb.current().data.smile[1].id).toMatch(/^smile_/);
    require('fs').rmSync(backupDir, { recursive: true, force: true });
  });

  it('adds stable IDs to Fire projects independently of Smile', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: { fire: [{ title: 'Emergency Fund', phase: 'planning', buckets: [] }] },
    });
    const backupDir = require('fs').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'mm-fund-id-'),
    );
    const result = await backfillFundProjectIds(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user_1', collection: 'fire', backupDir },
    );
    expect(result.status).toBe('backfilled');
    expect(usersDb.current().data.fire[0].id).toMatch(/^fire_/);
    require('fs').rmSync(backupDir, { recursive: true, force: true });
  });

  it('encrypts new IDs when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: { smile: [{ title: session.encrypt('Vacation'), phase: session.encrypt('saving') }] },
    });
    const backupDir = require('fs').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'mm-fund-id-'),
    );
    await backfillFundProjectIds(
      { usersDb, authDb: makeAuthDb({ key: 'secret', encryptDatabase: true }) },
      { userId: 'user_1', collection: 'smile', backupDir },
    );
    expect(session.decrypt(usersDb.current().data.smile[0].id)).toMatch(/^smile_/);
    require('fs').rmSync(backupDir, { recursive: true, force: true });
  });

  it('reports no-smile when the collection does not exist', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: {},
    });
    const result = await backfillFundProjectIds(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user_1', collection: 'smile' },
    );
    expect(result.status).toBe('no-smile');
  });

  it('rejects an unknown collection', async () => {
    const usersDb = makeUsersDb({ data: {} });
    await expect(
      backfillFundProjectIds(
        { usersDb, authDb: makeAuthDb() },
        { userId: 'user_1', collection: 'grow' },
      ),
    ).rejects.toThrow('--collection must be one of');
  });
});
