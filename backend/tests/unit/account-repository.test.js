'use strict';

const bcrypt = require('bcryptjs');
const {
  getAccount,
  updateAccountEmail,
  verifyAccountPassword,
  deleteAccount,
  AccountError,
} = require('../../repositories/account-repository');

function makeDb(initialDocs = {}) {
  const docs = new Map(Object.entries(initialDocs));
  return {
    get: jest.fn(async (id) => {
      const doc = docs.get(id);
      if (!doc) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      return JSON.parse(JSON.stringify(doc));
    }),
    insert: jest.fn(async (doc) => {
      docs.set(doc._id, { ...doc, _rev: `${docs.has(doc._id) ? 2 : 1}-mock` });
      return { ok: true, id: doc._id };
    }),
    destroy: jest.fn(async (id) => {
      docs.delete(id);
      return { ok: true };
    }),
    find: jest.fn(async () => ({ docs: [] })),
    _getCurrent: (id) => docs.get(id),
    _has: (id) => docs.has(id),
  };
}

describe('getAccount', () => {
  it('returns the account email and createdAt', async () => {
    const authDb = makeDb({
      user_1: { _id: 'user_1', email: 'a@test.local', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const result = await getAccount({ authDb }, 'user_1');
    expect(result).toEqual({ email: 'a@test.local', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it('returns createdAt: null when the field is absent', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', email: 'a@test.local' } });
    const result = await getAccount({ authDb }, 'user_1');
    expect(result.createdAt).toBeNull();
  });

  it('throws a clean ACCOUNT_NOT_FOUND error rather than a raw 404 for a deleted account', async () => {
    // Reachable via a still-unexpired session JWT surviving account
    // deletion — session tokens are stateless, so this can't be prevented,
    // only reported cleanly.
    const authDb = makeDb();
    await expect(getAccount({ authDb }, 'user_1')).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });
});

describe('updateAccountEmail', () => {
  it('rejects a missing or malformed email', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', email: 'old@test.local' } });
    const usersDb = makeDb();
    await expect(updateAccountEmail({ usersDb, authDb }, 'user_1', '')).rejects.toThrow(
      AccountError,
    );
    await expect(updateAccountEmail({ usersDb, authDb }, 'user_1', 'not-an-email')).rejects.toThrow(
      AccountError,
    );
  });

  it('rejects an email already used by another account', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', email: 'old@test.local' } });
    authDb.find = jest.fn(async () => ({ docs: [{ _id: 'user_2', email: 'taken@test.local' }] }));
    const usersDb = makeDb();
    await expect(
      updateAccountEmail({ usersDb, authDb }, 'user_1', 'taken@test.local'),
    ).rejects.toMatchObject({ code: 'ACCOUNT_EMAIL_TAKEN' });
  });

  it('allows resubmitting the same email as the current account (uniqueness check excludes self)', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', email: 'me@test.local' } });
    authDb.find = jest.fn(async () => ({ docs: [{ _id: 'user_1', email: 'me@test.local' }] }));
    const usersDb = makeDb({ user_1: { _id: 'user_1', data: {} } });
    const result = await updateAccountEmail({ usersDb, authDb }, 'user_1', 'me@test.local');
    expect(result).toEqual({ email: 'me@test.local' });
  });

  it('updates authDb.email and usersDb.data.info.email together', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', email: 'old@test.local' } });
    const usersDb = makeDb({
      user_1: { _id: 'user_1', data: { info: { email: 'old@test.local', username: 'me' } } },
    });
    await updateAccountEmail({ usersDb, authDb }, 'user_1', 'new@test.local');
    expect(authDb._getCurrent('user_1').email).toBe('new@test.local');
    expect(usersDb._getCurrent('user_1').data.info).toEqual({
      email: 'new@test.local',
      username: 'me',
    });
  });

  it('creates a usersDb document if none exists yet', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', email: 'old@test.local' } });
    const usersDb = makeDb();
    await updateAccountEmail({ usersDb, authDb }, 'user_1', 'new@test.local');
    expect(usersDb._getCurrent('user_1').data.info.email).toBe('new@test.local');
  });
});

describe('verifyAccountPassword', () => {
  it('returns true for the correct password', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    const authDb = makeDb({ user_1: { _id: 'user_1', password: hashed } });
    expect(await verifyAccountPassword({ authDb }, 'user_1', 'correct-password')).toBe(true);
  });

  it('returns false for an incorrect password', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    const authDb = makeDb({ user_1: { _id: 'user_1', password: hashed } });
    expect(await verifyAccountPassword({ authDb }, 'user_1', 'wrong-password')).toBe(false);
  });

  it('returns false rather than throwing for a user with no auth document', async () => {
    const authDb = makeDb();
    expect(await verifyAccountPassword({ authDb }, 'user_1', 'anything')).toBe(false);
  });

  it('rejects a missing password with a clear error', async () => {
    const authDb = makeDb({ user_1: { _id: 'user_1', password: 'x' } });
    await expect(verifyAccountPassword({ authDb }, 'user_1', '')).rejects.toThrow(AccountError);
  });
});

describe('deleteAccount', () => {
  it('destroys both the usersDb and authDb documents', async () => {
    const usersDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', data: {} } });
    const authDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' } });
    authDb.find = jest.fn(async () => ({ docs: [] }));

    await deleteAccount({ usersDb, authDb }, 'user_1');

    expect(usersDb._has('user_1')).toBe(false);
    expect(authDb._has('user_1')).toBe(false);
  });

  it('deletes every PAT belonging to the user', async () => {
    const usersDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', data: {} } });
    const authDb = makeDb({
      user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' },
      pat_1: { _id: 'pat_1', _rev: '1-a', type: 'pat', userId: 'user_1' },
      pat_2: { _id: 'pat_2', _rev: '1-a', type: 'pat', userId: 'user_1' },
    });
    authDb.find = jest.fn(async () => ({
      docs: [
        { _id: 'pat_1', _rev: '1-a', type: 'pat', userId: 'user_1' },
        { _id: 'pat_2', _rev: '1-a', type: 'pat', userId: 'user_1' },
      ],
    }));

    const result = await deleteAccount({ usersDb, authDb }, 'user_1');

    expect(result.deletedTokenCount).toBe(2);
    expect(authDb._has('pat_1')).toBe(false);
    expect(authDb._has('pat_2')).toBe(false);
  });

  it("does not delete another user's PATs", async () => {
    const usersDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', data: {} } });
    const authDb = makeDb({
      user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' },
      pat_other: { _id: 'pat_other', _rev: '1-a', type: 'pat', userId: 'user_2' },
    });
    // The fake find() must actually filter by userId, matching the real
    // authDb.find({selector: {type: 'pat', userId}}) contract.
    authDb.find = jest.fn(async ({ selector }) => {
      const all = [{ _id: 'pat_other', _rev: '1-a', type: 'pat', userId: 'user_2' }];
      return { docs: all.filter((d) => d.userId === selector.userId) };
    });

    await deleteAccount({ usersDb, authDb }, 'user_1');

    expect(authDb._has('pat_other')).toBe(true);
  });

  it('succeeds even if the usersDb document never existed', async () => {
    const usersDb = makeDb();
    const authDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' } });
    authDb.find = jest.fn(async () => ({ docs: [] }));

    const result = await deleteAccount({ usersDb, authDb }, 'user_1');
    expect(result.deletedTokenCount).toBe(0);
    expect(authDb._has('user_1')).toBe(false);
  });

  it('refuses to delete rather than risk leaving PATs behind when the count hits the overfetch limit', async () => {
    const usersDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', data: {} } });
    const authDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' } });
    const manyPats = Array.from({ length: 1000 }, (_, i) => ({
      _id: `pat_${i}`,
      _rev: '1-a',
      type: 'pat',
      userId: 'user_1',
    }));
    authDb.find = jest.fn(async () => ({ docs: manyPats }));

    await expect(deleteAccount({ usersDb, authDb }, 'user_1')).rejects.toThrow(AccountError);
    // Nothing was destroyed — the check runs before any destructive write.
    expect(usersDb._has('user_1')).toBe(true);
    expect(authDb._has('user_1')).toBe(true);
  });

  it('leaves the account fully intact and retryable if a PAT fails to delete, rather than destroying the account with a stray PAT left alive', async () => {
    // The exact failure mode this ordering exists to prevent: if PATs were
    // destroyed *after* the account documents, a mid-loop failure here
    // would leave the account gone forever with a still-live credential.
    // Destroying PATs first means this failure instead leaves the account
    // (and every OTHER PAT) fully intact, so the whole operation is safe
    // to simply retry.
    const usersDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', data: {} } });
    const authDb = makeDb({
      user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' },
      pat_1: { _id: 'pat_1', _rev: '1-a', type: 'pat', userId: 'user_1' },
      pat_2: { _id: 'pat_2', _rev: '1-a', type: 'pat', userId: 'user_1' },
    });
    authDb.find = jest.fn(async () => ({
      docs: [
        { _id: 'pat_1', _rev: '1-a', type: 'pat', userId: 'user_1' },
        { _id: 'pat_2', _rev: '1-a', type: 'pat', userId: 'user_1' },
      ],
    }));
    const originalDestroy = authDb.destroy;
    authDb.destroy = jest.fn(async (id, rev) => {
      if (id === 'pat_2') throw new Error('transient CouchDB error');
      return originalDestroy(id, rev);
    });

    await expect(deleteAccount({ usersDb, authDb }, 'user_1')).rejects.toThrow(
      'transient CouchDB error',
    );

    // pat_1 (processed before the failure) is gone, but the account itself
    // and the not-yet-reached pat_2 are still fully intact.
    expect(authDb._has('pat_1')).toBe(false);
    expect(authDb._has('pat_2')).toBe(true);
    expect(usersDb._has('user_1')).toBe(true);
    expect(authDb._has('user_1')).toBe(true);
  });

  it('retries a PAT destroy once on a 409 conflict, then succeeds', async () => {
    const usersDb = makeDb({ user_1: { _id: 'user_1', _rev: '1-a', data: {} } });
    const authDb = makeDb({
      user_1: { _id: 'user_1', _rev: '1-a', email: 'a@test.local' },
      pat_1: { _id: 'pat_1', _rev: '1-a', type: 'pat', userId: 'user_1' },
    });
    authDb.find = jest.fn(async () => ({
      docs: [{ _id: 'pat_1', _rev: '1-a', type: 'pat', userId: 'user_1' }],
    }));
    let destroyAttempts = 0;
    const originalDestroy = authDb.destroy;
    authDb.destroy = jest.fn(async (id, rev) => {
      if (id === 'pat_1') {
        destroyAttempts += 1;
        if (destroyAttempts === 1) {
          const err = new Error('conflict');
          err.statusCode = 409;
          throw err;
        }
      }
      return originalDestroy(id, rev);
    });

    const result = await deleteAccount({ usersDb, authDb }, 'user_1');

    expect(result.deletedTokenCount).toBe(1);
    expect(destroyAttempts).toBe(2);
    expect(authDb._has('pat_1')).toBe(false);
    expect(authDb._has('user_1')).toBe(false);
  });
});
