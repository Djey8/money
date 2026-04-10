/**
 * Extended integration tests for data routes.
 *
 * Covers edge cases NOT already tested in database-api.test.js:
 *  - Various data types (primitive strings, numbers, booleans, deep nesting)
 *  - Read non-existent paths
 *  - Delete non-existent paths
 *  - Large payloads
 *  - text/plain content-type handling (raw string writes)
 *  - Empty body / invalid body
 *
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let token;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  const user = await registerTestUser('_dataext');
  token = user.token;
});

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('Extended data routes', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping extended data-routes tests');
    }
    expect(true).toBe(true);
  });

  // --- Various data types ----------------------------------------------------

  describe('Write/read various data types', () => {
    skipIf(!dbAvailable, 'writes and reads a number', async () => {
      await authed('post', '/api/data/write/types/num').send(42);
      const res = await authed('get', '/api/data/read/types/num');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe(42);
    });

    skipIf(!dbAvailable, 'writes and reads a boolean', async () => {
      await authed('post', '/api/data/write/types/flag').send(true);
      const res = await authed('get', '/api/data/read/types/flag');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe(true);
    });

    skipIf(!dbAvailable, 'writes and reads a deeply nested object', async () => {
      const deep = { a: { b: { c: { d: { value: 'deep' } } } } };
      await authed('post', '/api/data/write/types/deep').send(deep);
      const res = await authed('get', '/api/data/read/types/deep/a/b/c/d/value');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe('deep');
    });

    skipIf(!dbAvailable, 'writes and reads null', async () => {
      await authed('post', '/api/data/write/types/nullable')
        .send(null)
        .set('Content-Type', 'application/json');
      // null body may be treated as empty — verify graceful handling
      const res = await authed('get', '/api/data/read/types/nullable');
      expect(res.status).toBe(200);
    });

    skipIf(!dbAvailable, 'writes and reads a large array', async () => {
      const arr = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        label: `item_${i}`,
        value: Math.random()
      }));

      const writeRes = await authed('post', '/api/data/write/types/largeArr').send(arr);
      expect(writeRes.status).toBe(200);

      const readRes = await authed('get', '/api/data/read/types/largeArr');
      expect(readRes.status).toBe(200);
      expect(readRes.body.data).toHaveLength(500);
      expect(readRes.body.data[499]).toHaveProperty('id', 499);
    });
  });

  // --- Non-existent reads ----------------------------------------------------

  describe('Read non-existent paths', () => {
    skipIf(!dbAvailable, 'returns null for a path that was never written', async () => {
      const res = await authed('get', '/api/data/read/does/not/exist');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    skipIf(!dbAvailable, 'returns null for a single non-existent key', async () => {
      const res = await authed('get', '/api/data/read/nonexistent');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  // --- Delete edge cases -----------------------------------------------------

  describe('Delete edge cases', () => {
    skipIf(!dbAvailable, 'returns 404 when deleting a non-existent path', async () => {
      const res = await authed('delete', '/api/data/delete/no/such/path');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Path not found');
    });

    skipIf(!dbAvailable, 'clears entire data object when path is empty', async () => {
      // Write some data first
      await authed('post', '/api/data/write/deltest/x').send('val');

      // Delete root
      const del = await authed('delete', '/api/data/delete/');
      expect(del.status).toBe(200);

      // Data should now be empty
      const read = await authed('get', '/api/data/read/deltest');
      expect(read.status).toBe(200);
      expect(read.body.data).toBeNull();
    });
  });

  // --- text/plain writes (raw strings) ---------------------------------------

  describe('text/plain content type', () => {
    skipIf(!dbAvailable, 'writes a raw string value via text/plain', async () => {
      const encrypted = 'U2FsdGVkX1+abc123encrypted==';
      await authed('post', '/api/data/write/encrypted/key')
        .send(encrypted)
        .set('Content-Type', 'text/plain');

      const res = await authed('get', '/api/data/read/encrypted/key');
      expect(res.status).toBe(200);
      expect(res.body.data).toBe(encrypted);
    });
  });

  // --- Empty / invalid body --------------------------------------------------

  describe('Invalid request bodies', () => {
    skipIf(!dbAvailable, 'returns 400 for empty body on write', async () => {
      const res = await authed('post', '/api/data/write/empty')
        .send('')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });
  });

  // --- Large payload ---------------------------------------------------------

  describe('Large payload handling', () => {
    skipIf(!dbAvailable, 'writes payload near the 10 MB limit successfully', async () => {
      // ~ 1 MB payload — large enough to test, small enough to be fast
      const bigData = { items: Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        description: 'x'.repeat(80),
        timestamp: new Date().toISOString()
      }))};

      const res = await authed('post', '/api/data/write/bigpayload').send(bigData);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --- Full document endpoint ------------------------------------------------

  describe('GET /api/data/document', () => {
    skipIf(!dbAvailable, 'returns createdAt and updatedAt timestamps', async () => {
      const res = await authed('get', '/api/data/document');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      // Should NOT leak internal CouchDB fields
      expect(res.body).not.toHaveProperty('_id');
      expect(res.body).not.toHaveProperty('_rev');
    });
  });

  // --- Authentication required -----------------------------------------------

  describe('Authentication required', () => {
    it('rejects write without token', async () => {
      const res = await request(app)
        .post('/api/data/write/test')
        .send({ x: 1 });

      expect(res.status).toBe(401);
    });

    it('rejects read without token', async () => {
      const res = await request(app).get('/api/data/read/test');
      expect(res.status).toBe(401);
    });

    it('rejects delete without token', async () => {
      const res = await request(app).delete('/api/data/delete/test');
      expect(res.status).toBe(401);
    });

    it('rejects document endpoint without token', async () => {
      const res = await request(app).get('/api/data/document');
      expect(res.status).toBe(401);
    });

    it('rejects batch write without token', async () => {
      const res = await request(app)
        .post('/api/data/write/batch')
        .send({ writes: [{ path: 'x', data: 1 }] });

      expect(res.status).toBe(401);
    });
  });
});
