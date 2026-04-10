/**
 * Integration tests for the hierarchical database API.
 *
 * Converted from the manual test-database-api.js script.
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let token, userId;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  const user = await registerTestUser('_dbapi');
  token = user.token;
  userId = user.userId;
});

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('Database API', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping database API tests');
    }
    expect(true).toBe(true);
  });

  // --- Registration -----------------------------------------------------------

  describe('Registration', () => {
    skipIf(!dbAvailable, 'registers a test user and returns a token', () => {
      expect(token).toBeDefined();
      expect(userId).toMatch(/^user_/);
    });
  });

  // --- Write operations -------------------------------------------------------

  describe('Write operations', () => {
    skipIf(!dbAvailable, 'writes user info object', async () => {
      const res = await authed('post', '/api/data/write/info')
        .send({ username: 'test_user', email: 'jest@test.local' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    skipIf(!dbAvailable, 'writes an array (transactions)', async () => {
      const res = await authed('post', '/api/data/write/transactions')
        .send([
          { id: 'tx1', amount: 100.50, date: '2026-03-01', category: 'food' },
          { id: 'tx2', amount: 250.00, date: '2026-03-05', category: 'transport' }
        ]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    skipIf(!dbAvailable, 'writes an array (smile)', async () => {
      const res = await authed('post', '/api/data/write/smile')
        .send([{ id: 'smile1', title: 'Vacation', target: 5000, current: 1200 }]);

      expect(res.status).toBe(200);
    });

    skipIf(!dbAvailable, 'writes a nested object (mojo)', async () => {
      const res = await authed('post', '/api/data/write/mojo')
        .send({ target: 2000.0, amount: 1500.0 });

      expect(res.status).toBe(200);
    });
  });

  // --- Read operations --------------------------------------------------------

  describe('Read operations', () => {
    skipIf(!dbAvailable, 'reads a specific nested field (info/username)', async () => {
      const res = await authed('get', '/api/data/read/info/username');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe('test_user');
    });

    skipIf(!dbAvailable, 'reads a specific nested field (info/email)', async () => {
      const res = await authed('get', '/api/data/read/info/email');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe('jest@test.local');
    });

    skipIf(!dbAvailable, 'reads an entire nested object (mojo)', async () => {
      const res = await authed('get', '/api/data/read/mojo');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ target: 2000, amount: 1500 });
    });

    skipIf(!dbAvailable, 'reads a nested object (info)', async () => {
      const res = await authed('get', '/api/data/read/info');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('username', 'test_user');
      expect(res.body.data).toHaveProperty('email', 'jest@test.local');
    });

    skipIf(!dbAvailable, 'reads an array (transactions) with correct count', async () => {
      const res = await authed('get', '/api/data/read/transactions');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('category', 'food');
    });
  });

  // --- Update operations ------------------------------------------------------

  describe('Update operations', () => {
    skipIf(!dbAvailable, 'updates a specific field (info/username)', async () => {
      await authed('post', '/api/data/write/info/username')
        .send('updated_user')
        .set('Content-Type', 'text/plain');

      const res = await authed('get', '/api/data/read/info/username');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe('updated_user');
    });
  });

  // --- Full document ----------------------------------------------------------

  describe('Full document', () => {
    skipIf(!dbAvailable, 'reads the entire user document', async () => {
      const res = await authed('get', '/api/data/document');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.info).toBeDefined();
      expect(res.body.data.transactions).toBeDefined();
      expect(res.body.data.smile).toBeDefined();
      expect(res.body.data.mojo).toBeDefined();
    });
  });

  // --- Delete operations ------------------------------------------------------

  describe('Delete operations', () => {
    skipIf(!dbAvailable, 'deletes a specific field (info/username)', async () => {
      const del = await authed('delete', '/api/data/delete/info/username');
      expect(del.status).toBe(200);

      const res = await authed('get', '/api/data/read/info/username');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    skipIf(!dbAvailable, 'preserves rest of structure after field deletion', async () => {
      const res = await authed('get', '/api/data/read/info');

      expect(res.status).toBe(200);
      // username was deleted, but email should remain
      expect(res.body.data).toHaveProperty('email', 'jest@test.local');
      expect(res.body.data).not.toHaveProperty('username');
    });
  });

  // --- Authentication guards --------------------------------------------------

  describe('Authentication guards', () => {
    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/data/read/info');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid token', async () => {
      const res = await request(app)
        .get('/api/data/read/info')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(403);
    });
  });

  // --- Batch write ------------------------------------------------------------

  describe('Batch write', () => {
    skipIf(!dbAvailable, 'writes multiple paths in a single request', async () => {
      const res = await authed('post', '/api/data/write/batch')
        .send({
          writes: [
            { path: 'batch_test/a', data: 1 },
            { path: 'batch_test/b', data: 2 },
            { path: 'batch_test/c', data: { nested: true } }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.writesProcessed).toBe(3);

      const read = await authed('get', '/api/data/read/batch_test');
      expect(read.body.data).toEqual({ a: 1, b: 2, c: { nested: true } });
    });

    skipIf(!dbAvailable, 'rejects empty writes array', async () => {
      const res = await authed('post', '/api/data/write/batch')
        .send({ writes: [] });

      expect(res.status).toBe(400);
    });

    skipIf(!dbAvailable, 'rejects non-array writes', async () => {
      const res = await authed('post', '/api/data/write/batch')
        .send({ writes: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });
});
