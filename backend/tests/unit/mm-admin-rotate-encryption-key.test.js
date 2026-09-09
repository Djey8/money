/**
 * Unit tests for `mm-admin rotate-encryption-key` (backend/cli/commands/rotate-encryption-key.js).
 * CouchDB is mocked — no database required. Uses the real @money/domain
 * package's EncryptionSession/rewriteEncryptedValues (their own crypto
 * correctness is covered by the domain package's own test suite); these
 * tests cover this CLI's orchestration: precondition checks, backup,
 * write, verify, rollback-on-mismatch, retry-on-conflict, and keeping
 * `usersDb`/`authDb`/`auditDb` in sync.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EncryptionSession } = require('@money/domain');
const {
  runRotateEncryptionKey,
  restoreFromBackup,
  RotationError,
} = require('../../cli/commands/rotate-encryption-key');

function makeDb(initialDoc) {
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

/** Fakes the subset of CouchDB's `find`/`get`/`insert` the CLI uses against the audit database. */
function makeAuditDb(initialEntries = []) {
  const entries = new Map(initialEntries.map((entry) => [entry._id, { ...entry }]));
  return {
    find: jest.fn(async ({ selector }) => {
      const docs = Array.from(entries.values()).filter((entry) => {
        if (selector.userId !== undefined && entry.userId !== selector.userId) return false;
        if (
          selector.payloadEncrypted !== undefined &&
          entry.payloadEncrypted !== selector.payloadEncrypted
        ) {
          return false;
        }
        return true;
      });
      return { docs: docs.map((doc) => JSON.parse(JSON.stringify(doc))) };
    }),
    get: jest.fn(async (id) => {
      const doc = entries.get(id);
      if (!doc) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      return JSON.parse(JSON.stringify(doc));
    }),
    insert: jest.fn(async (newDoc) => {
      const current = entries.get(newDoc._id);
      const rev = `${(parseInt((current && current._rev) || '1', 10) || 1) + 1}-mock`;
      entries.set(newDoc._id, { ...newDoc, _rev: rev });
      return { ok: true, id: newDoc._id, rev };
    }),
    _getCurrent: (id) => entries.get(id),
    _getAll: () => Array.from(entries.values()),
  };
}

describe('mm-admin rotate-encryption-key', () => {
  let backupDir;
  const OLD_KEY = 'old-key';
  const NEW_KEY = 'new-key';

  beforeEach(() => {
    backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-admin-rotate-test-'));
  });

  afterEach(() => {
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  function makeEncryptedUserDoc(session) {
    return {
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
        smile: { target: session.encrypt('1000') },
      },
    };
  }

  it('throws RotationError when --user is missing', async () => {
    await expect(
      runRotateEncryptionKey(
        { usersDb: makeDb({}), authDb: makeDb({}), auditDb: makeAuditDb() },
        { newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(RotationError);
  });

  it('throws RotationError when --new-key is missing', async () => {
    await expect(
      runRotateEncryptionKey(
        { usersDb: makeDb({}), authDb: makeDb({}), auditDb: makeAuditDb() },
        { userId: 'user1', backupDir },
      ),
    ).rejects.toThrow(RotationError);
  });

  it('rejects rotation for a user with no active key (nothing to re-encrypt)', async () => {
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: 'default', encryptLocal: true, encryptDatabase: false },
    });
    await expect(
      runRotateEncryptionKey(
        { usersDb: makeDb({}), authDb, auditDb: makeAuditDb() },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(RotationError);
  });

  it('rejects rotation for a user with a key set but encryptDatabase off', async () => {
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: false },
    });
    await expect(
      runRotateEncryptionKey(
        { usersDb: makeDb({}), authDb, auditDb: makeAuditDb() },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(RotationError);
  });

  it('is a no-op when --new-key equals the current active key', async () => {
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    const usersDb = makeDb({ _id: 'user1', _rev: '1-abc', data: {} });

    const result = await runRotateEncryptionKey(
      { usersDb, authDb, auditDb: makeAuditDb() },
      { userId: 'user1', newKey: OLD_KEY, backupDir },
    );

    expect(result.status).toBe('already-active');
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('--dry-run reports what would change without writing or backing up anything', async () => {
    const session = new EncryptionSession(OLD_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(session));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    const auditDb = makeAuditDb([
      { _id: 'audit_1', userId: 'user1', payloadEncrypted: true, payload: session.encrypt('{}') },
    ]);

    const result = await runRotateEncryptionKey(
      { usersDb, authDb, auditDb },
      { userId: 'user1', newKey: NEW_KEY, dryRun: true, backupDir },
    );

    expect(result.status).toBe('dry-run');
    expect(result.fieldsReencrypted).toBe(3);
    expect(result.auditEntriesReencrypted).toBe(1);
    expect(usersDb.insert).not.toHaveBeenCalled();
    expect(authDb.insert).not.toHaveBeenCalled();
    expect(auditDb.insert).not.toHaveBeenCalled();
    expect(fs.readdirSync(backupDir)).toHaveLength(0);
  });

  it('rotates the key: backs up, re-encrypts data + audit entries, writes, verifies, and updates authDb', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    const auditDb = makeAuditDb([
      {
        _id: 'audit_1',
        userId: 'user1',
        payloadEncrypted: true,
        payload: oldSession.encrypt('{"resource":"transactions"}'),
      },
      // Not selected for re-encryption: belongs to a different user, or was never encrypted.
      {
        _id: 'audit_2',
        userId: 'user2',
        payloadEncrypted: true,
        payload: oldSession.encrypt('{"resource":"transactions"}'),
      },
      { _id: 'audit_3', userId: 'user1', payloadEncrypted: false, payload: '{"plain":true}' },
    ]);

    const result = await runRotateEncryptionKey(
      { usersDb, authDb, auditDb },
      { userId: 'user1', newKey: NEW_KEY, backupDir },
    );

    expect(result.status).toBe('rotated');
    expect(result.fieldsReencrypted).toBe(3);
    expect(result.auditEntriesReencrypted).toBe(1);
    expect(fs.existsSync(result.backupFile)).toBe(true);

    const writtenTx = usersDb._getCurrent().data.transactions[0];
    expect(newSession.decrypt(writtenTx.amount)).toBe('-12.5');
    expect(newSession.decrypt(writtenTx.category)).toBe('@Food');
    expect(newSession.decrypt(usersDb._getCurrent().data.smile.target)).toBe('1000');
    expect(authDb._getCurrent().encryptionConfig.key).toBe(NEW_KEY);
    expect(authDb._getCurrent().encryptionConfig.encryptDatabase).toBe(true);

    // The user's encrypted audit entry was re-keyed...
    expect(newSession.decrypt(auditDb._getCurrent('audit_1').payload)).toBe(
      '{"resource":"transactions"}',
    );
    // ...but another user's entry, and this user's already-plaintext entry, were left untouched
    // (still decryptable with the OLD key, i.e. never re-keyed).
    expect(oldSession.decrypt(auditDb._getCurrent('audit_2').payload)).toBe(
      '{"resource":"transactions"}',
    );
    expect(auditDb._getCurrent('audit_3').payload).toBe('{"plain":true}');

    // Backup contains the pre-rotation data doc, auth doc, and audit entry.
    const backup = JSON.parse(fs.readFileSync(result.backupFile, 'utf8'));
    expect(oldSession.decrypt(backup.userDoc.data.transactions[0].amount)).toBe('-12.5');
    expect(backup.authDoc.encryptionConfig.key).toBe(OLD_KEY);
    expect(backup.auditEntries).toHaveLength(1);
    expect(backup.auditEntries[0]._id).toBe('audit_1');
  });

  it('automatically rolls back data, audit entries, and authDb if data verification detects a mismatch', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    const auditDb = makeAuditDb([
      {
        _id: 'audit_1',
        userId: 'user1',
        payloadEncrypted: true,
        payload: oldSession.encrypt('{"resource":"transactions"}'),
      },
    ]);

    // Corrupt the document on the post-write verification read (call #3:
    // #1 is the initial read, #2 is writeWithRetry's pre-write re-fetch,
    // #3 is the independent re-read after the write) — simulating a bug
    // that silently drops a field. Verification must catch this and roll
    // back rather than reporting success, and must not have touched the
    // audit entry yet (data verification happens first).
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

    await expect(
      runRotateEncryptionKey(
        { usersDb, authDb, auditDb },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(RotationError);

    // Rollback must have written the original pre-rotation data back, and
    // must NOT have advanced authDb's key or touched the audit entry.
    const restoredTx = usersDb._getCurrent().data.transactions[0];
    expect(oldSession.decrypt(restoredTx.amount)).toBe('-12.5');
    expect(authDb._getCurrent().encryptionConfig.key).toBe(OLD_KEY);
    expect(oldSession.decrypt(auditDb._getCurrent('audit_1').payload)).toBe(
      '{"resource":"transactions"}',
    );
  });

  it('rolls back data and audit entries if audit-entry verification detects a mismatch', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    const auditDb = makeAuditDb([
      {
        _id: 'audit_1',
        userId: 'user1',
        payloadEncrypted: true,
        payload: oldSession.encrypt('{"resource":"transactions"}'),
      },
    ]);

    // Corrupt the audit entry's payload on the post-write verification read,
    // simulating a bug that silently mangles it during re-encryption.
    const originalGet = auditDb.get;
    let getCount = 0;
    auditDb.get = jest.fn(async (id) => {
      getCount += 1;
      const doc = await originalGet(id);
      if (getCount === 2) {
        doc.payload = 'corrupted';
      }
      return doc;
    });

    await expect(
      runRotateEncryptionKey(
        { usersDb, authDb, auditDb },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(RotationError);

    // Both the data document and the audit entry must be rolled back, and
    // authDb must never have advanced.
    const restoredTx = usersDb._getCurrent().data.transactions[0];
    expect(oldSession.decrypt(restoredTx.amount)).toBe('-12.5');
    expect(authDb._getCurrent().encryptionConfig.key).toBe(OLD_KEY);
  });

  it('rolls back data and audit entries if updating authDb fails after a successful, verified rewrite', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    const auditDb = makeAuditDb([
      {
        _id: 'audit_1',
        userId: 'user1',
        payloadEncrypted: true,
        payload: oldSession.encrypt('{"resource":"transactions"}'),
      },
    ]);
    const originalAuthInsert = authDb.insert;
    let authInsertAttempts = 0;
    authDb.insert = jest.fn(async (doc) => {
      authInsertAttempts += 1;
      // Fails only on the forward rotation write; the rollback's own
      // restoring write (which sets the key back to OLD_KEY) must still
      // succeed, or this test couldn't tell "rolled back" apart from
      // "rollback itself is broken too".
      if (authInsertAttempts === 1) throw new Error('authDb write exploded');
      return originalAuthInsert(doc);
    });

    await expect(
      runRotateEncryptionKey(
        { usersDb, authDb, auditDb },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(RotationError);

    // usersDb and the audit entry must have been rolled back to the old key
    // so everything stays consistent with authDb, which never advanced.
    const restoredTx = usersDb._getCurrent().data.transactions[0];
    expect(oldSession.decrypt(restoredTx.amount)).toBe('-12.5');
    expect(authDb._getCurrent().encryptionConfig.key).toBe(OLD_KEY);
    expect(oldSession.decrypt(auditDb._getCurrent('audit_1').payload)).toBe(
      '{"resource":"transactions"}',
    );
  });

  it('reports both failures, including the backup file path, if the authDb write AND its own rollback both fail', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    // Every authDb.insert fails — both the forward rotation write and the
    // rollback's restoring write. The operator must still learn where the
    // backup file is, since it's their only remaining recovery path.
    authDb.insert = jest.fn(async () => {
      throw new Error('authDb is completely unreachable');
    });

    let caught;
    try {
      await runRotateEncryptionKey(
        { usersDb, authDb, auditDb: makeAuditDb() },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RotationError);
    expect(caught.message).toMatch(/recording the new active key failed/);
    expect(caught.message).toMatch(/ALSO FAILED/);
    expect(caught.message).toMatch(/authDb is completely unreachable/);
    expect(caught.message).toMatch(/\.json/);
  });

  it('throws RotationError instead of silently partial-rotating when there are too many encrypted audit entries', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });
    // AUDIT_OVERFETCH_LIMIT is 5000 — simulate hitting it without actually
    // constructing 5000 real ciphertexts, since `find`'s selector filtering
    // only needs enough matching docs to hit the limit, not valid payloads.
    const manyEntries = Array.from({ length: 5000 }, (_, i) => ({
      _id: `audit_${i}`,
      userId: 'user1',
      payloadEncrypted: true,
      payload: 'irrelevant-for-this-test',
    }));
    const auditDb = makeAuditDb(manyEntries);

    await expect(
      runRotateEncryptionKey(
        { usersDb, authDb, auditDb },
        { userId: 'user1', newKey: NEW_KEY, backupDir },
      ),
    ).rejects.toThrow(/at least 5000 encrypted audit entries/);
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('retries the data write on a CouchDB 409 conflict and succeeds', async () => {
    const oldSession = new EncryptionSession(OLD_KEY);
    const newSession = new EncryptionSession(NEW_KEY);
    const usersDb = makeDb(makeEncryptedUserDoc(oldSession));
    const authDb = makeDb({
      _id: 'user1',
      encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
    });

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

    const result = await runRotateEncryptionKey(
      { usersDb, authDb, auditDb: makeAuditDb() },
      { userId: 'user1', newKey: NEW_KEY, backupDir },
    );

    expect(result.status).toBe('rotated');
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(newSession.decrypt(usersDb._getCurrent().data.smile.target)).toBe('1000');
  });

  describe('explicit rollback', () => {
    it('restores all three (data, auth, audit) from a given backup file', async () => {
      const backupFile = path.join(backupDir, 'manual-backup.json');
      fs.writeFileSync(
        backupFile,
        JSON.stringify({
          userDoc: { _id: 'user1', data: { transactions: [{ amount: 'old-ciphertext' }] } },
          authDoc: {
            _id: 'user1',
            encryptionConfig: { key: OLD_KEY, encryptLocal: true, encryptDatabase: true },
          },
          auditEntries: [
            { _id: 'audit_1', payload: 'old-audit-ciphertext', payloadEncrypted: true },
          ],
        }),
      );
      const usersDb = makeDb({
        _id: 'user1',
        _rev: '5-current',
        data: { transactions: [{ amount: 'new-ciphertext' }] },
      });
      const authDb = makeDb({
        _id: 'user1',
        _rev: '5-current',
        encryptionConfig: { key: NEW_KEY, encryptLocal: true, encryptDatabase: true },
      });
      const auditDb = makeAuditDb([
        { _id: 'audit_1', payload: 'new-audit-ciphertext', payloadEncrypted: true },
      ]);

      const result = await restoreFromBackup(usersDb, authDb, auditDb, 'user1', backupFile);

      expect(result.status).toBe('rolled-back');
      expect(usersDb._getCurrent().data.transactions[0].amount).toBe('old-ciphertext');
      expect(authDb._getCurrent().encryptionConfig.key).toBe(OLD_KEY);
      expect(auditDb._getCurrent('audit_1').payload).toBe('old-audit-ciphertext');
    });

    it('runRotateEncryptionKey dispatches to restoreFromBackup when --rollback is given', async () => {
      const backupFile = path.join(backupDir, 'manual-backup.json');
      fs.writeFileSync(
        backupFile,
        JSON.stringify({
          userDoc: { _id: 'user1', data: {} },
          authDoc: { _id: 'user1', encryptionConfig: { key: OLD_KEY } },
          auditEntries: [],
        }),
      );
      const usersDb = makeDb({ _id: 'user1', _rev: '1-abc', data: {} });
      const authDb = makeDb({ _id: 'user1', _rev: '1-abc', encryptionConfig: {} });
      const auditDb = makeAuditDb();

      const result = await runRotateEncryptionKey(
        { usersDb, authDb, auditDb },
        { userId: 'user1', rollbackFile: backupFile, backupDir },
      );

      expect(result.status).toBe('rolled-back');
    });
  });
});
