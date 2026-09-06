/**
 * Unit tests for `mm-admin token` (backend/cli/commands/token.js). CouchDB
 * is mocked — no database required.
 */
'use strict';

const {
  createToken,
  listTokens,
  revokeToken,
  verifyToken,
  validateScope,
  validateScopes,
} = require('../../cli/commands/token');

function makeMockAuthDb(existingDocs = []) {
  const docs = [...existingDocs];
  return {
    insert: jest.fn(async (doc) => {
      const idx = docs.findIndex((d) => d._id === doc._id);
      if (idx >= 0) docs[idx] = doc;
      else docs.push(doc);
      return { ok: true, id: doc._id, rev: '1-abc' };
    }),
    get: jest.fn(async (id) => {
      const doc = docs.find((d) => d._id === id);
      if (!doc) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      return { ...doc };
    }),
    find: jest.fn(async ({ selector }) => {
      let matches = docs;
      if (selector.type) matches = matches.filter((d) => d.type === selector.type);
      if (selector.userId) matches = matches.filter((d) => d.userId === selector.userId);
      if (selector.tokenHash) matches = matches.filter((d) => d.tokenHash === selector.tokenHash);
      return { docs: matches };
    }),
    _docs: docs,
  };
}

describe('validateScope / validateScopes', () => {
  it('accepts the admin scope', () => {
    expect(() => validateScope('admin')).not.toThrow();
  });

  it('accepts valid <resource>:<level> scopes', () => {
    for (const scope of [
      'transactions:r',
      'transactions:w',
      'transactions:rw',
      'subscriptions:bulk',
    ]) {
      expect(() => validateScope(scope)).not.toThrow();
    }
  });

  it('rejects a malformed scope string', () => {
    expect(() => validateScope('not-a-scope')).toThrow(/Invalid scope/);
    expect(() => validateScope('transactions')).toThrow(/Invalid scope/);
    expect(() => validateScope('transactions:x')).toThrow(/Invalid scope/);
  });

  it('rejects an unknown resource', () => {
    expect(() => validateScope('nonsense:r')).toThrow(/Unknown resource/);
  });

  it('rejects a :w or :rw scope on the read-only "reports" resource', () => {
    expect(() => validateScope('reports:w')).toThrow(/read-only/);
    expect(() => validateScope('reports:rw')).toThrow(/read-only/);
    expect(() => validateScope('reports:r')).not.toThrow();
  });

  it('rejects anything but :bulk on the "data" resource', () => {
    expect(() => validateScope('data:r')).toThrow(/only supports ':bulk'/);
    expect(() => validateScope('data:w')).toThrow(/only supports ':bulk'/);
    expect(() => validateScope('data:bulk')).not.toThrow();
  });

  it('requires at least one scope', () => {
    expect(() => validateScopes([])).toThrow(/At least one scope/);
    expect(() => validateScopes(undefined)).toThrow(/At least one scope/);
  });

  it('validates every scope in the array', () => {
    expect(() => validateScopes(['transactions:rw', 'bogus'])).toThrow(/Invalid scope/);
  });
});

describe('createToken', () => {
  it('creates a token, returning the plaintext value once', async () => {
    const authDb = makeMockAuthDb();
    const result = await createToken(
      { authDb },
      { userId: 'user_1', name: 'claude-code', scopes: ['transactions:rw', 'reports:r'] },
    );

    expect(result.token).toMatch(/^mmpat_[0-9a-f]{64}$/);
    expect(result.tokenId).toMatch(/^pat_[0-9a-f]{32}$/);
    expect(result.scopes).toEqual(['transactions:rw', 'reports:r']);
    expect(result.expiresAt).toBeNull();

    const stored = authDb._docs[0];
    expect(stored.type).toBe('pat');
    expect(stored.tokenHash).not.toBe(result.token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.revoked).toBe(false);
  });

  it('never stores the plaintext token anywhere in the document', async () => {
    const authDb = makeMockAuthDb();
    const result = await createToken(
      { authDb },
      { userId: 'u', name: 'n', scopes: ['transactions:r'] },
    );

    expect(JSON.stringify(authDb._docs[0])).not.toContain(result.token);
  });

  it('sets expiresAt when expiresInDays is given', async () => {
    const authDb = makeMockAuthDb();
    const before = Date.now();
    const result = await createToken(
      { authDb },
      { userId: 'u', name: 'n', scopes: ['transactions:r'], expiresInDays: 30 },
    );
    const expiresAtMs = new Date(result.expiresAt).getTime();

    expect(expiresAtMs).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    expect(expiresAtMs).toBeLessThan(before + 31 * 24 * 60 * 60 * 1000);
  });

  it('rejects missing userId, name, or scopes', async () => {
    const authDb = makeMockAuthDb();
    await expect(
      createToken({ authDb }, { name: 'n', scopes: ['transactions:r'] }),
    ).rejects.toThrow(/userId/);
    await expect(
      createToken({ authDb }, { userId: 'u', scopes: ['transactions:r'] }),
    ).rejects.toThrow(/name/);
    await expect(createToken({ authDb }, { userId: 'u', name: 'n', scopes: [] })).rejects.toThrow(
      /At least one scope/,
    );
  });

  it('rejects a non-positive expiresInDays', async () => {
    const authDb = makeMockAuthDb();
    await expect(
      createToken(
        { authDb },
        { userId: 'u', name: 'n', scopes: ['transactions:r'], expiresInDays: -5 },
      ),
    ).rejects.toThrow(/expiresInDays/);
  });
});

describe('listTokens', () => {
  it("returns a user's tokens without the tokenHash", async () => {
    const authDb = makeMockAuthDb([
      {
        _id: 'pat_1',
        type: 'pat',
        userId: 'user_1',
        name: 'agent-1',
        scopes: ['transactions:r'],
        tokenHash: 'secretHash',
        createdAt: 't1',
        expiresAt: null,
        revoked: false,
      },
      {
        _id: 'pat_2',
        type: 'pat',
        userId: 'user_2',
        name: 'other-user-token',
        scopes: ['transactions:r'],
      },
    ]);

    const result = await listTokens({ authDb }, { userId: 'user_1' });

    expect(result).toHaveLength(1);
    expect(result[0].tokenId).toBe('pat_1');
    expect(result[0].tokenHash).toBeUndefined();
  });

  it('requires a userId', async () => {
    await expect(listTokens({ authDb: makeMockAuthDb() }, {})).rejects.toThrow(/userId/);
  });
});

describe('revokeToken', () => {
  it('marks a token revoked without deleting it', async () => {
    const authDb = makeMockAuthDb([
      { _id: 'pat_1', type: 'pat', userId: 'user_1', name: 'n', scopes: [], revoked: false },
    ]);

    const result = await revokeToken({ authDb }, { tokenId: 'pat_1' });

    expect(result.revoked).toBe(true);
    expect(authDb._docs.find((d) => d._id === 'pat_1').revoked).toBe(true);
    expect(authDb._docs.find((d) => d._id === 'pat_1').revokedAt).toBeDefined();
  });

  it('refuses to revoke a non-PAT document', async () => {
    const authDb = makeMockAuthDb([{ _id: 'rt_1', type: 'refresh_token', userId: 'user_1' }]);
    await expect(revokeToken({ authDb }, { tokenId: 'rt_1' })).rejects.toThrow(/not a PAT/);
  });

  it('requires a tokenId', async () => {
    await expect(revokeToken({ authDb: makeMockAuthDb() }, {})).rejects.toThrow(/tokenId/);
  });
});

describe('verifyToken', () => {
  it('resolves a valid token to its owner and scopes', async () => {
    const authDb = makeMockAuthDb();
    const created = await createToken(
      { authDb },
      { userId: 'user_1', name: 'agent', scopes: ['transactions:rw'] },
    );

    const result = await verifyToken({ authDb }, created.token);

    expect(result).toEqual({
      tokenId: created.tokenId,
      userId: 'user_1',
      scopes: ['transactions:rw'],
      name: 'agent',
    });
  });

  it('returns null for an unknown token', async () => {
    const authDb = makeMockAuthDb();
    expect(await verifyToken({ authDb }, 'mmpat_doesnotexist')).toBeNull();
  });

  it('returns null for a revoked token', async () => {
    const authDb = makeMockAuthDb();
    const created = await createToken(
      { authDb },
      { userId: 'u', name: 'n', scopes: ['transactions:r'] },
    );
    await revokeToken({ authDb }, { tokenId: created.tokenId });

    expect(await verifyToken({ authDb }, created.token)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const authDb = makeMockAuthDb([
      {
        _id: 'pat_expired',
        type: 'pat',
        userId: 'u',
        name: 'n',
        scopes: ['transactions:r'],
        tokenHash: require('crypto')
          .createHash('sha256')
          .update('mmpat_expiredtoken')
          .digest('hex'),
        expiresAt: '2020-01-01T00:00:00.000Z',
        revoked: false,
      },
    ]);

    expect(await verifyToken({ authDb }, 'mmpat_expiredtoken')).toBeNull();
  });

  it('returns null for a non-string/empty token without querying the database', async () => {
    const authDb = makeMockAuthDb();
    expect(await verifyToken({ authDb }, '')).toBeNull();
    expect(await verifyToken({ authDb }, undefined)).toBeNull();
    expect(authDb.find).not.toHaveBeenCalled();
  });
});
