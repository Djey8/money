/**
 * Unit tests for `mm-admin migrate` (backend/cli/commands/migrate.js).
 * CouchDB is mocked — no database required. Uses the real @money/domain
 * package (its own crypto/conversion correctness is covered by its own
 * test suite; these tests cover this CLI's orchestration: backup, write,
 * verify, rollback-on-mismatch, retry-on-conflict).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EncryptionSession } = require('@money/domain');
const { runMigration, rollback, MigrationError } = require('../../cli/commands/migrate');

function makeUsersDb(initialDoc) {
  let doc = initialDoc;
  return {
    get: jest.fn(async () => JSON.parse(JSON.stringify(doc))),
    insert: jest.fn(async (newDoc) => {
      doc = { ...newDoc, _rev: `${(parseInt(doc._rev, 10) || 1) + 1}-mock` };
      return { ok: true, id: doc._id, rev: doc._rev };
    }),
    _getCurrent: () => doc,
  };
}

function makeAuthDb(encryptionConfig) {
  return {
    get: jest.fn(async () => {
      if (!encryptionConfig) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      return { _id: 'user1', encryptionConfig };
    }),
  };
}

describe('mm-admin migrate', () => {
  let backupDir;

  beforeEach(() => {
    backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-admin-test-'));
  });

  afterEach(() => {
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it('is a no-op for a user already on schemaVersion 2', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: { meta: { schemaVersion: 2 }, transactions: [] },
    });
    const authDb = makeAuthDb();

    const result = await runMigration({ usersDb, authDb }, { userId: 'user1', backupDir });

    expect(result.status).toBe('already-migrated');
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('--dry-run reports what would change without writing or backing up anything', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: { transactions: [{ account: 'Daily', amount: -12.5 }] },
    });
    const authDb = makeAuthDb();

    const result = await runMigration(
      { usersDb, authDb },
      { userId: 'user1', dryRun: true, backupDir },
    );

    expect(result.status).toBe('dry-run');
    expect(result.fieldsConverted).toBe(1);
    expect(usersDb.insert).not.toHaveBeenCalled();
    expect(fs.readdirSync(backupDir)).toHaveLength(0);
  });

  it('migrates an unencrypted document: backs up, converts, writes, and verifies', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: {
        transactions: [
          { account: 'Daily', amount: -12.5 },
          { account: 'Income', amount: 3000 },
        ],
      },
    });
    const authDb = makeAuthDb();

    const result = await runMigration({ usersDb, authDb }, { userId: 'user1', backupDir });

    expect(result.status).toBe('migrated');
    expect(result.fieldsConverted).toBe(2);
    expect(fs.existsSync(result.backupFile)).toBe(true);

    const written = usersDb._getCurrent();
    expect(written.data.meta.schemaVersion).toBe(2);
    expect(written.data.meta.currency).toBe('EUR');
    expect(written.data.transactions[0].amount).toBe(-1250);
    expect(written.data.transactions[1].amount).toBe(300000);

    // Backup file contains the exact pre-migration document.
    const backup = JSON.parse(fs.readFileSync(result.backupFile, 'utf8'));
    expect(backup.data.transactions[0].amount).toBe(-12.5);
    expect(backup.data.meta).toBeUndefined();
  });

  it('accepts a custom --currency', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: { transactions: [{ amount: 10 }] },
    });
    const result = await runMigration(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user1', backupDir, currency: 'USD' },
    );
    expect(usersDb._getCurrent().data.meta.currency).toBe('USD');
    expect(result.status).toBe('migrated');
  });

  it('migrates an encrypted document, decrypting and re-encrypting only money fields', async () => {
    const session = new EncryptionSession('user-key');
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: {
        transactions: [
          {
            account: 'Daily',
            amount: session.encrypt('-12.5'),
            category: session.encrypt('@Food'),
          },
        ],
      },
    });
    const authDb = makeAuthDb({ key: 'user-key', encryptLocal: true, encryptDatabase: true });

    const result = await runMigration({ usersDb, authDb }, { userId: 'user1', backupDir });

    expect(result.status).toBe('migrated');
    const writtenTx = usersDb._getCurrent().data.transactions[0];
    expect(session.decrypt(writtenTx.amount)).toBe('-1250');
  });

  it('automatically rolls back if post-write verification detects a mismatch', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: { transactions: [{ amount: -12.5 }] },
    });
    const authDb = makeAuthDb();

    // Corrupt the document on the post-write verification read (call #3:
    // #1 is the initial read, #2 is writeWithRetry's pre-write re-fetch,
    // #3 is runMigration's independent re-read after the write) —
    // simulating a bug that silently drops a transaction. Verification
    // must catch this and roll back rather than reporting success.
    const originalGet = usersDb.get;
    let callCount = 0;
    usersDb.get = jest.fn(async () => {
      callCount += 1;
      const doc = await originalGet();
      if (callCount === 3) {
        doc.data.transactions = [];
      }
      return doc;
    });

    await expect(runMigration({ usersDb, authDb }, { userId: 'user1', backupDir })).rejects.toThrow(
      MigrationError,
    );

    // Rollback must have written the original pre-migration data back.
    const finalState = usersDb._getCurrent();
    expect(finalState.data.transactions[0].amount).toBe(-12.5);
  });

  it('retries on a CouchDB 409 conflict and succeeds', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: { transactions: [{ amount: 5 }] },
    });
    const authDb = makeAuthDb();

    const originalInsert = usersDb.insert;
    let attempts = 0;
    usersDb.insert = jest.fn(async (doc) => {
      attempts += 1;
      if (attempts === 1) {
        const err = new Error('conflict');
        err.statusCode = 409;
        throw err;
      }
      return originalInsert(doc);
    });

    const result = await runMigration({ usersDb, authDb }, { userId: 'user1', backupDir });
    expect(result.status).toBe('migrated');
    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  it('throws MigrationError when --user is missing', async () => {
    await expect(
      runMigration({ usersDb: makeUsersDb({}), authDb: makeAuthDb() }, { backupDir }),
    ).rejects.toThrow(MigrationError);
  });

  it('flags non-cleanly-representable values in dry-run without rounding silently', async () => {
    const usersDb = makeUsersDb({
      _id: 'user1',
      _rev: '1-abc',
      data: { transactions: [{ amount: 10.333 }] },
    });
    const result = await runMigration(
      { usersDb, authDb: makeAuthDb() },
      { userId: 'user1', dryRun: true, backupDir },
    );
    expect(result.nonRepresentable).toHaveLength(1);
    expect(result.nonRepresentable[0].from).toBe(10.333);
  });

  describe('explicit rollback', () => {
    it('restores a document from a given backup file', async () => {
      const backupFile = path.join(backupDir, 'manual-backup.json');
      fs.writeFileSync(
        backupFile,
        JSON.stringify({ _id: 'user1', data: { transactions: [{ amount: -12.5 }] } }),
      );
      const usersDb = makeUsersDb({
        _id: 'user1',
        _rev: '5-current',
        data: { transactions: [{ amount: -1250 }], meta: { schemaVersion: 2 } },
      });

      const result = await rollback(usersDb, 'user1', backupFile);

      expect(result.status).toBe('rolled-back');
      expect(usersDb._getCurrent().data.transactions[0].amount).toBe(-12.5);
      expect(usersDb._getCurrent().data.meta).toBeUndefined();
    });

    it('runMigration dispatches to rollback when --rollback is given', async () => {
      const backupFile = path.join(backupDir, 'manual-backup.json');
      fs.writeFileSync(backupFile, JSON.stringify({ _id: 'user1', data: { transactions: [] } }));
      const usersDb = makeUsersDb({ _id: 'user1', _rev: '1-abc', data: {} });

      const result = await runMigration(
        { usersDb, authDb: makeAuthDb() },
        { userId: 'user1', rollbackFile: backupFile, backupDir },
      );

      expect(result.status).toBe('rolled-back');
    });
  });
});
