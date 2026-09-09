/**
 * Unit tests for `mm-admin user` (backend/cli/commands/user.js). CouchDB
 * is mocked — no database required.
 */
'use strict';

const {
  createUser,
  listUsers,
  validateEmail,
  validatePassword,
} = require('../../cli/commands/user');

function makeMockAuthDb(existingDocs = []) {
  const docs = [...existingDocs];
  return {
    insert: jest.fn(async (doc) => {
      docs.push(doc);
      return { ok: true, id: doc._id, rev: '1-abc' };
    }),
    find: jest.fn(async ({ selector }) => {
      if (selector.email !== undefined) {
        return { docs: docs.filter((d) => d.email === selector.email) };
      }
      if (selector.password && selector.password.$exists) {
        return { docs: docs.filter((d) => d.password !== undefined) };
      }
      return { docs: [] };
    }),
    _docs: docs,
  };
}

function makeMockUsersDb() {
  const docs = [];
  return {
    insert: jest.fn(async (doc) => {
      docs.push(doc);
      return { ok: true, id: doc._id, rev: '1-abc' };
    }),
    _docs: docs,
  };
}

describe('createUser', () => {
  it('creates an auth doc and a users doc with matching ids', async () => {
    const authDb = makeMockAuthDb();
    const usersDb = makeMockUsersDb();

    const result = await createUser(
      { authDb, usersDb },
      { email: 'jfk@example.com', password: 'Sup3rSecret' },
    );

    expect(result.email).toBe('jfk@example.com');
    expect(result.userId).toMatch(/^user_\d+_[0-9a-f]{9}$/);

    expect(authDb._docs).toHaveLength(1);
    expect(authDb._docs[0]._id).toBe(result.userId);
    expect(authDb._docs[0].email).toBe('jfk@example.com');
    expect(authDb._docs[0].password).not.toBe('Sup3rSecret'); // hashed, not plaintext
    expect(authDb._docs[0].password.length).toBeGreaterThan(20);

    expect(usersDb._docs).toHaveLength(1);
    expect(usersDb._docs[0]._id).toBe(result.userId);
    expect(usersDb._docs[0].data.info.email).toBe('jfk@example.com');
  });

  it('rejects a duplicate email', async () => {
    const authDb = makeMockAuthDb([{ _id: 'user_1', email: 'jfk@example.com', password: 'x' }]);
    const usersDb = makeMockUsersDb();

    await expect(
      createUser({ authDb, usersDb }, { email: 'jfk@example.com', password: 'Sup3rSecret' }),
    ).rejects.toThrow(/already exists/);
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['not-an-email', 'Sup3rSecret', /Invalid email/],
    ['jfk@example.com', 'short1A', /at least 8 characters/],
    ['jfk@example.com', 'alllowercase1', /uppercase, lowercase, and a number/],
    ['jfk@example.com', 'ALLUPPERCASE1', /uppercase, lowercase, and a number/],
    ['jfk@example.com', 'NoNumbersHere', /uppercase, lowercase, and a number/],
  ])('rejects email=%s password=%s', async (email, password, errorPattern) => {
    const authDb = makeMockAuthDb();
    const usersDb = makeMockUsersDb();
    await expect(createUser({ authDb, usersDb }, { email, password })).rejects.toThrow(
      errorPattern,
    );
    expect(authDb.insert).not.toHaveBeenCalled();
  });
});

describe('listUsers', () => {
  it('returns only real user accounts, not refresh-token or PAT docs sharing the auth db', async () => {
    const authDb = makeMockAuthDb([
      { _id: 'user_1', email: 'a@example.com', password: 'hash1', createdAt: 't1' },
      { _id: 'user_2', email: 'b@example.com', password: 'hash2', createdAt: 't2' },
      { _id: 'rt_abc', type: 'refresh_token', userId: 'user_1' },
      { _id: 'pat_xyz', type: 'pat', userId: 'user_1' },
    ]);

    const result = await listUsers({ authDb });

    expect(result).toEqual([
      { userId: 'user_1', email: 'a@example.com', createdAt: 't1' },
      { userId: 'user_2', email: 'b@example.com', createdAt: 't2' },
    ]);
  });
});

describe('validateEmail / validatePassword', () => {
  it('accepts valid inputs without throwing', () => {
    expect(() => validateEmail('a@b.com')).not.toThrow();
    expect(() => validatePassword('Valid123')).not.toThrow();
  });
});
