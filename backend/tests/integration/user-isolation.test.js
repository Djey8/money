/**
 * Integration tests for user data isolation.
 *
 * Converted from the manual test-user-isolation.js script.
 * Verifies that each user's data is stored in a separate CouchDB
 * document and JWT authentication prevents cross-user access.
 *
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let userA, userB;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  userA = await registerTestUser('_isoA');
  userB = await registerTestUser('_isoB');
});

function authedAs(user) {
  return (method, path) =>
    request(app)[method](path).set('Authorization', `Bearer ${user.token}`);
}

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('User data isolation', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping isolation tests');
    }
    expect(true).toBe(true);
  });

  // --- Setup: write data for both users --------------------------------------

  describe('Write data for each user', () => {
    skipIf(!dbAvailable, 'writes info for User A', async () => {
      const res = await authedAs(userA)('post', '/api/data/write/info')
        .send({ username: 'Alice', favoriteColor: 'blue' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    skipIf(!dbAvailable, 'writes info for User B', async () => {
      const res = await authedAs(userB)('post', '/api/data/write/info')
        .send({ username: 'Bob', favoriteColor: 'red' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --- Verify each user reads their own data ---------------------------------

  describe('Each user reads own data', () => {
    skipIf(!dbAvailable, 'User A reads own username = Alice', async () => {
      const res = await authedAs(userA)('get', '/api/data/read/info');

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('Alice');
      expect(res.body.data.favoriteColor).toBe('blue');
    });

    skipIf(!dbAvailable, 'User B reads own username = Bob', async () => {
      const res = await authedAs(userB)('get', '/api/data/read/info');

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('Bob');
      expect(res.body.data.favoriteColor).toBe('red');
    });
  });

  // --- Data isolation verification -------------------------------------------

  describe('Cross-user isolation', () => {
    skipIf(!dbAvailable, 'User A cannot see User B data (tokens are user-scoped)', async () => {
      // User A's token can only access User A's document
      const resA = await authedAs(userA)('get', '/api/data/read/info');
      const resB = await authedAs(userB)('get', '/api/data/read/info');

      expect(resA.body.data.username).not.toBe(resB.body.data.username);
      expect(resA.body.data.username).toBe('Alice');
      expect(resB.body.data.username).toBe('Bob');
    });

    skipIf(!dbAvailable, 'User A has a different userId than User B', () => {
      expect(userA.userId).not.toBe(userB.userId);
    });
  });

  // --- Full document structure ------------------------------------------------

  describe('Full document structure', () => {
    skipIf(!dbAvailable, 'User A document contains nested data.info', async () => {
      const res = await authedAs(userA)('get', '/api/data/document');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.info).toBeDefined();
      expect(res.body.data.info.username).toBe('Alice');
    });

    skipIf(!dbAvailable, 'User B document contains nested data.info', async () => {
      const res = await authedAs(userB)('get', '/api/data/document');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.info).toBeDefined();
      expect(res.body.data.info.username).toBe('Bob');
    });
  });

  // --- Additional isolation via write ----------------------------------------

  describe('Writes are isolated', () => {
    skipIf(!dbAvailable, 'User A writing does not affect User B', async () => {
      await authedAs(userA)('post', '/api/data/write/extra')
        .send({ secret: 'only-for-alice' });

      // User B should not see User A's new field
      const res = await authedAs(userB)('get', '/api/data/read/extra');
      expect(res.body.data).toBeNull();
    });
  });
});
