/**
 * Integration tests for batch-read and updatedAt endpoints.
 * Requires a running CouchDB instance (docker-compose.test.yml).
 *
 * Validates that:
 *  - Batch read returns the same data as individual reads
 *  - updatedAt is set on writes and returned correctly
 *  - Batch read + individual read consistency after writes
 */
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let token;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  const user = await registerTestUser('_batchread');
  token = user.token;
});

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('Batch read integration', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping batch-read integration tests');
    }
    expect(true).toBe(true);
  });

  // Seed test data
  skipIf(!dbAvailable, 'seeds test data for batch-read tests', async () => {
    const transactions = [
      { account: 'Daily', amount: 42, date: '2026-03-29', time: '10:00', category: 'Food', comment: 'Lunch' },
      { account: 'Income', amount: 3000, date: '2026-03-01', time: '09:00', category: 'Salary', comment: '' }
    ];
    const subscriptions = [
      { title: 'Netflix', account: 'Splurge', amount: 15, startDate: '2026-01-01', endDate: '', category: 'Entertainment', comment: '' }
    ];
    const revenues = [{ tag: 'Salary', amount: 3000 }];
    const interests = [{ tag: 'Savings', amount: 10 }];
    const daily = [{ tag: 'Food', amount: 42 }];
    const smile = [{ title: 'Vacation', target: 2000, amount: 500 }];
    const grow = [{ title: 'Stocks', sub: 'ETF', status: 'active', amount: 1000 }];

    // Write all data using batch write
    const res = await authed('post', '/api/data/write/batch').send({
      writes: [
        { path: 'transactions', data: transactions },
        { path: 'subscriptions', data: subscriptions },
        { path: 'income/revenue/revenues', data: revenues },
        { path: 'income/revenue/interests', data: interests },
        { path: 'income/revenue/properties', data: [] },
        { path: 'income/expenses/daily', data: daily },
        { path: 'income/expenses/splurge', data: [] },
        { path: 'income/expenses/smile', data: [] },
        { path: 'income/expenses/fire', data: [] },
        { path: 'income/expenses/mojo', data: [] },
        { path: 'smile', data: smile },
        { path: 'fire', data: [] },
        { path: 'mojo', data: { target: 500, amount: 100 } },
        { path: 'budget', data: [] },
        { path: 'grow', data: grow },
        { path: 'balance/asset/assets', data: [] },
        { path: 'balance/asset/shares', data: [] },
        { path: 'balance/asset/investments', data: [] },
        { path: 'balance/liabilities', data: [] }
      ]
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Core: batch read returns same data as individual reads ──────────────

  skipIf(!dbAvailable, 'batch read returns same data as individual reads', async () => {
    const paths = [
      'transactions',
      'subscriptions',
      'income/revenue/revenues',
      'income/revenue/interests',
      'income/expenses/daily',
      'smile',
      'grow'
    ];

    // Batch read
    const batchRes = await authed('post', '/api/data/read/batch').send({ paths });
    expect(batchRes.status).toBe(200);

    // Individual reads
    for (const path of paths) {
      const singleRes = await authed('get', `/api/data/read/${path}`);
      expect(singleRes.status).toBe(200);
      expect(batchRes.body.data[path]).toEqual(singleRes.body.data);
    }
  });

  // ── All 19 paths in a single batch read ─────────────────────────────────

  skipIf(!dbAvailable, 'reads all 19 original paths in one batch request', async () => {
    const allPaths = [
      'transactions', 'subscriptions',
      'income/revenue/revenues', 'income/revenue/interests', 'income/revenue/properties',
      'income/expenses/daily', 'income/expenses/splurge', 'income/expenses/smile',
      'income/expenses/fire', 'income/expenses/mojo',
      'balance/asset/assets', 'balance/asset/shares', 'balance/asset/investments',
      'balance/liabilities',
      'smile', 'fire', 'mojo', 'budget', 'grow'
    ];

    const res = await authed('post', '/api/data/read/batch').send({ paths: allPaths });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toHaveLength(19);

    // Verify data integrity for known values
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.subscriptions).toHaveLength(1);
    expect(res.body.data['income/revenue/revenues']).toEqual([{ tag: 'Salary', amount: 3000 }]);
    expect(res.body.data.smile).toEqual([{ title: 'Vacation', target: 2000, amount: 500 }]);
    expect(res.body.data.mojo).toEqual({ target: 500, amount: 100 });
  });

  // ── Missing paths return null ───────────────────────────────────────────

  skipIf(!dbAvailable, 'returns null for non-existent paths in batch', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions', 'does/not/exist'] });

    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data['does/not/exist']).toBeNull();
  });

  // ── updatedAt is included and reflects writes ───────────────────────────

  skipIf(!dbAvailable, 'updatedAt is present in batch-read response', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions'] });

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBeTruthy();
    // Should be a valid ISO date
    expect(new Date(res.body.updatedAt).toISOString()).toBe(res.body.updatedAt);
  });

  skipIf(!dbAvailable, 'updatedAt changes after a write', async () => {
    // Get current updatedAt
    const before = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions'] });
    const tsBefore = before.body.updatedAt;

    // Small delay to ensure timestamp differs
    await new Promise(r => setTimeout(r, 50));

    // Write something
    await authed('post', '/api/data/write/budget').send([{ tag: 'Test', amount: 100, date: '2026-03' }]);

    // Get new updatedAt
    const after = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions'] });
    const tsAfter = after.body.updatedAt;

    expect(new Date(tsAfter).getTime()).toBeGreaterThan(new Date(tsBefore).getTime());
  });
});

// ── GET /api/data/updatedAt ─────────────────────────────────────────────────

describe('updatedAt endpoint integration', () => {
  skipIf(!dbAvailable, 'returns the updatedAt timestamp', async () => {
    const res = await authed('get', '/api/data/updatedAt');

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBeTruthy();
    expect(new Date(res.body.updatedAt).toISOString()).toBe(res.body.updatedAt);
  });

  skipIf(!dbAvailable, 'updatedAt matches batch-read updatedAt', async () => {
    const [endpointRes, batchRes] = await Promise.all([
      authed('get', '/api/data/updatedAt'),
      authed('post', '/api/data/read/batch').send({ paths: ['transactions'] })
    ]);

    expect(endpointRes.body.updatedAt).toBe(batchRes.body.updatedAt);
  });

  skipIf(!dbAvailable, 'updatedAt does NOT change on read-only operations', async () => {
    const before = await authed('get', '/api/data/updatedAt');

    // Do several reads
    await authed('get', '/api/data/read/transactions');
    await authed('post', '/api/data/read/batch').send({ paths: ['subscriptions'] });

    const after = await authed('get', '/api/data/updatedAt');

    expect(after.body.updatedAt).toBe(before.body.updatedAt);
  });
});
