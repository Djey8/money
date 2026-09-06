'use strict';

const { EncryptionSession } = require('@money/domain');
const { backfillTransactionIds } = require('../../cli/commands/backfill-transaction-ids');

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

describe('backfillTransactionIds', () => {
  it('adds stable IDs, creates a backup, and remains idempotent', async () => {
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: { transactions: [{ account: 'Daily', amount: -12.5 }] },
    });
    const backupDir = require('fs').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'mm-id-'),
    );
    const options = { userId: 'user_1', backupDir };
    const first = await backfillTransactionIds({ usersDb, authDb: makeAuthDb() }, options);
    expect(first.status).toBe('backfilled');
    expect(usersDb.current().data.transactions[0].id).toMatch(/^tx_/);
    expect(first.backupFile).toContain('transaction-ids');
    await expect(
      backfillTransactionIds({ usersDb, authDb: makeAuthDb() }, options),
    ).resolves.toMatchObject({ status: 'already-backfilled' });
    require('fs').rmSync(backupDir, { recursive: true, force: true });
  });

  it('encrypts new IDs when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const usersDb = makeUsersDb({
      _id: 'user_1',
      _rev: '1-test',
      createdAt: 't',
      updatedAt: 't',
      data: {
        transactions: [{ account: session.encrypt('Daily'), amount: session.encrypt('-12.5') }],
      },
    });
    const backupDir = require('fs').mkdtempSync(
      require('path').join(require('os').tmpdir(), 'mm-id-'),
    );
    await backfillTransactionIds(
      { usersDb, authDb: makeAuthDb({ key: 'secret', encryptDatabase: true }) },
      { userId: 'user_1', backupDir },
    );
    expect(session.decrypt(usersDb.current().data.transactions[0].id)).toMatch(/^tx_/);
    require('fs').rmSync(backupDir, { recursive: true, force: true });
  });
});
