/**
 * Stress / edge-case tests for the batch write endpoint.
 *
 * Covers:
 *  - 50+ writes in a single batch
 *  - Concurrent batch writes from the same user
 *  - Batch with missing path fields
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

  const user = await registerTestUser('_batchstress');
  token = user.token;
});

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('Batch write stress tests', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping batch-write-stress tests');
    }
    expect(true).toBe(true);
  });

  // --- Large batch -----------------------------------------------------------

  skipIf(!dbAvailable, 'handles 50+ writes in a single batch', async () => {
    const writes = Array.from({ length: 60 }, (_, i) => ({
      path: `stress/item_${i}`,
      data: { index: i, ts: Date.now() }
    }));

    const res = await authed('post', '/api/data/write/batch').send({ writes });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.writesProcessed).toBe(60);

    // Spot-check a few values
    const r0 = await authed('get', '/api/data/read/stress/item_0');
    expect(r0.body.data).toHaveProperty('index', 0);

    const r59 = await authed('get', '/api/data/read/stress/item_59');
    expect(r59.body.data).toHaveProperty('index', 59);
  }, 30000);

  // --- Concurrent batches ----------------------------------------------------

  skipIf(!dbAvailable, 'handles concurrent batch writes from the same user', async () => {
    const batch1 = authed('post', '/api/data/write/batch')
      .send({
        writes: Array.from({ length: 10 }, (_, i) => ({
          path: `concurrent/a_${i}`,
          data: `batch1_${i}`
        }))
      });

    const batch2 = authed('post', '/api/data/write/batch')
      .send({
        writes: Array.from({ length: 10 }, (_, i) => ({
          path: `concurrent/b_${i}`,
          data: `batch2_${i}`
        }))
      });

    const [res1, res2] = await Promise.all([batch1, batch2]);

    // Both should succeed (server has conflict-retry logic)
    expect(res1.status).toBeLessThan(500);
    expect(res2.status).toBeLessThan(500);

    // At least one should have fully succeeded
    const succeeded = [res1, res2].filter(r => r.status === 200);
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  // --- Invalid batch writes --------------------------------------------------

  skipIf(!dbAvailable, 'rejects batch where a write has no path', async () => {
    const res = await authed('post', '/api/data/write/batch')
      .send({
        writes: [
          { path: 'valid/path', data: 1 },
          { data: 'missing-path' }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Each write must have a path');
  });

  skipIf(!dbAvailable, 'rejects batch with writes as a string', async () => {
    const res = await authed('post', '/api/data/write/batch')
      .send({ writes: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'writes must be an array');
  });

  skipIf(!dbAvailable, 'rejects empty writes array', async () => {
    const res = await authed('post', '/api/data/write/batch')
      .send({ writes: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'writes array cannot be empty');
  });
});
