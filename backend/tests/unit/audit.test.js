/**
 * Unit tests for the audit log helper (config/audit.js). The audit
 * database itself is mocked — no CouchDB required.
 */
'use strict';

const { recordAuditEntry, queryAuditEntries, generateAuditId } = require('../../config/audit');

function makeMockAuditDb(docs = []) {
  const inserted = [];
  return {
    insert: jest.fn(async (doc) => {
      inserted.push(doc);
      return { ok: true, id: doc._id, rev: '1-abc' };
    }),
    find: jest.fn(async () => ({ docs })),
    _inserted: inserted,
  };
}

describe('recordAuditEntry', () => {
  it('writes a minimal valid entry with a generated id and timestamp', async () => {
    const auditDb = makeMockAuditDb();
    const doc = await recordAuditEntry(auditDb, {
      userId: 'user1',
      actor: { type: 'session' },
      method: 'POST',
      path: '/api/v1/transactions',
      resource: 'transactions',
    });

    expect(doc._id).toMatch(/^audit_\d+_[0-9a-f]{12}$/);
    expect(doc.userId).toBe('user1');
    expect(doc.actor).toEqual({ type: 'session' });
    expect(typeof doc.timestamp).toBe('string');
    expect(new Date(doc.timestamp).toString()).not.toBe('Invalid Date');
    expect(doc.method).toBe('POST');
    expect(doc.path).toBe('/api/v1/transactions');
    expect(doc.resource).toBe('transactions');
    expect(doc.resourceId).toBeUndefined();
    expect(doc.payload).toBeUndefined();
    expect(auditDb.insert).toHaveBeenCalledWith(doc);
  });

  it('records a token actor with its tokenId', async () => {
    const auditDb = makeMockAuditDb();
    const doc = await recordAuditEntry(auditDb, {
      userId: 'user1',
      actor: { type: 'token', tokenId: 'pat_abc123' },
      method: 'DELETE',
      path: '/api/v1/transactions/tx1',
      resource: 'transactions',
      resourceId: 'tx1',
    });

    expect(doc.actor).toEqual({ type: 'token', tokenId: 'pat_abc123' });
    expect(doc.resourceId).toBe('tx1');
  });

  it('records itemCount for a bulk operation as one entry, not one per item', async () => {
    const auditDb = makeMockAuditDb();
    const doc = await recordAuditEntry(auditDb, {
      userId: 'user1',
      actor: { type: 'token', tokenId: 'pat_abc123' },
      method: 'POST',
      path: '/api/v1/transactions/batch',
      resource: 'transactions',
      itemCount: 50,
    });

    expect(doc.itemCount).toBe(50);
    expect(auditDb.insert).toHaveBeenCalledTimes(1);
  });

  it('serializes and encrypts the payload when encryptPayload is given', async () => {
    const auditDb = makeMockAuditDb();
    const encryptPayload = jest.fn((v) => `enc(${v})`);

    const doc = await recordAuditEntry(
      auditDb,
      {
        userId: 'user1',
        actor: { type: 'session' },
        method: 'PATCH',
        path: '/api/v1/transactions/tx1',
        resource: 'transactions',
        resourceId: 'tx1',
        payload: { amount: -1250 },
      },
      encryptPayload,
    );

    expect(encryptPayload).toHaveBeenCalledWith(JSON.stringify({ amount: -1250 }));
    expect(doc.payload).toBe(`enc(${JSON.stringify({ amount: -1250 })})`);
    expect(doc.payloadEncrypted).toBe(true);
  });

  it('stores the payload as plain JSON when no encryptPayload is given', async () => {
    const auditDb = makeMockAuditDb();
    const doc = await recordAuditEntry(auditDb, {
      userId: 'user1',
      actor: { type: 'session' },
      method: 'PATCH',
      path: '/api/v1/transactions/tx1',
      resource: 'transactions',
      payload: { amount: -1250 },
    });

    expect(doc.payload).toBe(JSON.stringify({ amount: -1250 }));
    expect(doc.payloadEncrypted).toBe(false);
  });

  it.each([
    [
      'userId',
      { actor: { type: 'session' }, method: 'POST', path: '/x', resource: 'transactions' },
    ],
    ['method', { userId: 'u', actor: { type: 'session' }, path: '/x', resource: 'transactions' }],
    ['path', { userId: 'u', actor: { type: 'session' }, method: 'POST', resource: 'transactions' }],
    ['resource', { userId: 'u', actor: { type: 'session' }, method: 'POST', path: '/x' }],
  ])('rejects an entry missing %s', async (_field, entry) => {
    const auditDb = makeMockAuditDb();
    await expect(recordAuditEntry(auditDb, entry)).rejects.toThrow();
    expect(auditDb.insert).not.toHaveBeenCalled();
  });

  it('rejects an entry with no actor', async () => {
    const auditDb = makeMockAuditDb();
    await expect(
      recordAuditEntry(auditDb, {
        userId: 'u',
        method: 'POST',
        path: '/x',
        resource: 'transactions',
      }),
    ).rejects.toThrow(/actor.type/);
  });

  it('rejects an invalid actor.type', async () => {
    const auditDb = makeMockAuditDb();
    await expect(
      recordAuditEntry(auditDb, {
        userId: 'u',
        actor: { type: 'robot' },
        method: 'POST',
        path: '/x',
        resource: 'transactions',
      }),
    ).rejects.toThrow(/must be 'session' or 'token'/);
  });

  it("rejects a 'token' actor with no tokenId", async () => {
    const auditDb = makeMockAuditDb();
    await expect(
      recordAuditEntry(auditDb, {
        userId: 'u',
        actor: { type: 'token' },
        method: 'POST',
        path: '/x',
        resource: 'transactions',
      }),
    ).rejects.toThrow(/tokenId is required/);
  });
});

describe('queryAuditEntries', () => {
  it('requires a userId', async () => {
    await expect(queryAuditEntries(makeMockAuditDb(), undefined)).rejects.toThrow(/userId/);
  });

  it('filters by userId via the selector', async () => {
    const auditDb = makeMockAuditDb([]);
    await queryAuditEntries(auditDb, 'user1');
    expect(auditDb.find).toHaveBeenCalledWith(
      expect.objectContaining({ selector: { userId: 'user1' } }),
    );
  });

  it('adds resource to the selector when given', async () => {
    const auditDb = makeMockAuditDb([]);
    await queryAuditEntries(auditDb, 'user1', { resource: 'transactions' });
    expect(auditDb.find).toHaveBeenCalledWith(
      expect.objectContaining({ selector: { userId: 'user1', resource: 'transactions' } }),
    );
  });

  it('returns entries sorted most-recent-first regardless of DB return order', async () => {
    const auditDb = makeMockAuditDb([
      { _id: 'a', userId: 'user1', timestamp: '2026-01-01T00:00:00.000Z' },
      { _id: 'b', userId: 'user1', timestamp: '2026-03-01T00:00:00.000Z' },
      { _id: 'c', userId: 'user1', timestamp: '2026-02-01T00:00:00.000Z' },
    ]);

    const result = await queryAuditEntries(auditDb, 'user1');
    expect(result.map((e) => e._id)).toEqual(['b', 'c', 'a']);
  });

  it('truncates to the requested limit after sorting', async () => {
    const auditDb = makeMockAuditDb([
      { _id: 'a', timestamp: '2026-01-01T00:00:00.000Z' },
      { _id: 'b', timestamp: '2026-03-01T00:00:00.000Z' },
      { _id: 'c', timestamp: '2026-02-01T00:00:00.000Z' },
    ]);

    const result = await queryAuditEntries(auditDb, 'user1', { limit: 2 });
    expect(result.map((e) => e._id)).toEqual(['b', 'c']);
  });
});

describe('generateAuditId', () => {
  it('produces unique, correctly-shaped ids', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateAuditId()));
    expect(ids.size).toBe(20);
    for (const id of ids) {
      expect(id).toMatch(/^audit_\d+_[0-9a-f]{12}$/);
    }
  });
});
