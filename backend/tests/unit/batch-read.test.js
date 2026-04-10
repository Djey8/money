/**
 * Unit tests for the batch-read and updatedAt endpoints.
 * No database required — CouchDB is mocked.
 */
process.env.JWT_SECRET = 'test-secret';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

// Shared mock state
let mockUserDoc;

jest.mock('../../config/db', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(),
  getAuthDb: () => ({ find: jest.fn(), insert: jest.fn() }),
  getUsersDb: () => ({
    get: jest.fn().mockImplementation(() => {
      if (!mockUserDoc) {
        const err = new Error('not_found');
        err.statusCode = 404;
        return Promise.reject(err);
      }
      return Promise.resolve(mockUserDoc);
    }),
    insert: jest.fn()
  })
}));

const request = require('supertest');
const app = require('../../server');

function makeToken(userId = 'user_test_123', email = 'test@test.local') {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const token = makeToken();

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

// ── POST /api/data/read/batch ────────────────────────────────────────────────

describe('POST /api/data/read/batch', () => {
  beforeEach(() => {
    mockUserDoc = {
      _id: 'user_test_123',
      _rev: '1-abc',
      updatedAt: '2026-03-29T10:00:00.000Z',
      data: {
        transactions: [{ account: 'Daily', amount: 50 }],
        subscriptions: [{ title: 'Netflix', amount: 15 }],
        income: {
          revenue: {
            revenues: [{ tag: 'Salary', amount: 5000 }],
            interests: [{ tag: 'Bank', amount: 20 }],
            properties: []
          },
          expenses: {
            daily: [{ tag: 'Coffee', amount: 5 }],
            splurge: [],
            smile: [],
            fire: [],
            mojo: []
          }
        },
        smile: [{ title: 'Vacation', target: 1000, amount: 200 }],
        fire: [],
        mojo: { target: 500, amount: 100 },
        budget: [],
        grow: [],
        balance: {
          asset: { assets: [], shares: [], investments: [] },
          liabilities: []
        }
      }
    };
  });

  it('returns requested paths from a single document read', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions', 'subscriptions'] });

    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toEqual([{ account: 'Daily', amount: 50 }]);
    expect(res.body.data.subscriptions).toEqual([{ title: 'Netflix', amount: 15 }]);
    expect(res.body.updatedAt).toBe('2026-03-29T10:00:00.000Z');
  });

  it('returns nested paths correctly', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['income/revenue/revenues', 'income/expenses/daily', 'balance/asset/shares'] });

    expect(res.status).toBe(200);
    expect(res.body.data['income/revenue/revenues']).toEqual([{ tag: 'Salary', amount: 5000 }]);
    expect(res.body.data['income/expenses/daily']).toEqual([{ tag: 'Coffee', amount: 5 }]);
    expect(res.body.data['balance/asset/shares']).toEqual([]);
  });

  it('returns null for paths that do not exist', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions', 'nonexistent/path', 'also/missing'] });

    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toEqual([{ account: 'Daily', amount: 50 }]);
    expect(res.body.data['nonexistent/path']).toBeNull();
    expect(res.body.data['also/missing']).toBeNull();
  });

  it('returns all nulls when user document does not exist', async () => {
    mockUserDoc = null; // triggers 404

    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions', 'subscriptions'] });

    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toBeNull();
    expect(res.body.data.subscriptions).toBeNull();
    expect(res.body.updatedAt).toBeNull();
  });

  it('returns 400 when paths is not an array', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: 'transactions' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paths must be an array/);
  });

  it('returns 400 when paths array is empty', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paths array cannot be empty/);
  });

  it('returns 400 when too many paths are requested', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `path${i}`);
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: tooMany });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Too many paths/);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/data/read/batch')
      .send({ paths: ['transactions'] });

    expect(res.status).toBe(401);
  });

  it('skips non-string entries in paths array', async () => {
    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: ['transactions', 123, null, 'subscriptions'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('transactions');
    expect(res.body.data).toHaveProperty('subscriptions');
    // non-string entries are silently skipped
    expect(res.body.data).not.toHaveProperty('123');
  });

  it('handles all tier-1 paths in a single request', async () => {
    const tier1Paths = [
      'transactions',
      'subscriptions',
      'income/revenue/revenues',
      'income/revenue/interests',
      'income/revenue/properties',
      'income/expenses/daily',
      'income/expenses/splurge',
      'income/expenses/smile',
      'income/expenses/fire',
      'income/expenses/mojo'
    ];

    const res = await authed('post', '/api/data/read/batch')
      .send({ paths: tier1Paths });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toHaveLength(10);
    // Every path should be present in the response
    for (const p of tier1Paths) {
      expect(res.body.data).toHaveProperty(p);
    }
  });
});

// ── GET /api/data/updatedAt ─────────────────────────────────────────────────

describe('GET /api/data/updatedAt', () => {
  beforeEach(() => {
    mockUserDoc = {
      _id: 'user_test_123',
      _rev: '1-abc',
      updatedAt: '2026-03-29T10:00:00.000Z',
      data: {}
    };
  });

  it('returns the updatedAt timestamp', async () => {
    const res = await authed('get', '/api/data/updatedAt');

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBe('2026-03-29T10:00:00.000Z');
  });

  it('returns null when user document does not exist', async () => {
    mockUserDoc = null;

    const res = await authed('get', '/api/data/updatedAt');

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBeNull();
  });

  it('returns null when updatedAt field is missing', async () => {
    mockUserDoc = { _id: 'user_test_123', _rev: '1-abc', data: {} };

    const res = await authed('get', '/api/data/updatedAt');

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBeNull();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/data/updatedAt');

    expect(res.status).toBe(401);
  });
});

// ── ETag / If-None-Match caching ─────────────────────────────────────────────

describe('ETag caching', () => {
  beforeEach(() => {
    mockUserDoc = {
      _id: 'user_test_123',
      _rev: '3-etag123',
      updatedAt: '2026-03-29T12:00:00.000Z',
      data: {
        transactions: [{ account: 'Daily', amount: 100 }]
      }
    };
  });

  describe('POST /api/data/read/batch', () => {
    it('returns ETag header based on CouchDB _rev', async () => {
      const res = await authed('post', '/api/data/read/batch')
        .send({ paths: ['transactions'] });

      expect(res.status).toBe(200);
      expect(res.headers.etag).toBe('"3-etag123"');
    });

    it('returns 304 when If-None-Match matches current _rev', async () => {
      const res = await authed('post', '/api/data/read/batch')
        .set('If-None-Match', '"3-etag123"')
        .send({ paths: ['transactions'] });

      expect(res.status).toBe(304);
      expect(res.body).toEqual({});  // no body on 304
    });

    it('returns 200 with data when If-None-Match does not match', async () => {
      const res = await authed('post', '/api/data/read/batch')
        .set('If-None-Match', '"1-old-rev"')
        .send({ paths: ['transactions'] });

      expect(res.status).toBe(200);
      expect(res.body.data.transactions).toBeTruthy();
      expect(res.headers.etag).toBe('"3-etag123"');
    });

    it('still validates request body before checking ETag', async () => {
      const res = await authed('post', '/api/data/read/batch')
        .set('If-None-Match', '"3-etag123"')
        .send({ paths: 'not-an-array' });

      expect(res.status).toBe(400);
    });

    it('returns 200 without If-None-Match header (first request)', async () => {
      const res = await authed('post', '/api/data/read/batch')
        .send({ paths: ['transactions'] });

      expect(res.status).toBe(200);
      expect(res.headers.etag).toBeDefined();
    });
  });

  describe('GET /api/data/updatedAt', () => {
    it('returns ETag header', async () => {
      const res = await authed('get', '/api/data/updatedAt');

      expect(res.status).toBe(200);
      expect(res.headers.etag).toBe('"3-etag123"');
    });

    it('returns 304 when If-None-Match matches', async () => {
      const res = await authed('get', '/api/data/updatedAt')
        .set('If-None-Match', '"3-etag123"');

      expect(res.status).toBe(304);
    });

    it('returns 200 when If-None-Match is stale', async () => {
      const res = await authed('get', '/api/data/updatedAt')
        .set('If-None-Match', '"1-old"');

      expect(res.status).toBe(200);
      expect(res.body.updatedAt).toBe('2026-03-29T12:00:00.000Z');
    });
  });
});

// ── Performance: batch-read vs N individual reads ────────────────────────────

describe('Performance: batch-read vs individual reads', () => {
  const ALL_PATHS = [
    'transactions', 'subscriptions',
    'income/revenue/revenues', 'income/revenue/interests', 'income/revenue/properties',
    'income/expenses/daily', 'income/expenses/splurge', 'income/expenses/smile',
    'income/expenses/fire', 'income/expenses/mojo',
    'smile', 'fire', 'mojo', 'budget', 'grow',
    'balance/asset/assets', 'balance/asset/shares', 'balance/asset/investments',
    'balance/liabilities'
  ];

  beforeEach(() => {
    mockUserDoc = {
      _id: 'user_test_123',
      _rev: '1-abc',
      updatedAt: '2026-03-29T10:00:00.000Z',
      data: {
        transactions: Array.from({ length: 500 }, (_, i) => ({ id: i, account: 'Daily', amount: i * 10 })),
        subscriptions: [{ title: 'Netflix', amount: 15 }],
        income: {
          revenue: { revenues: [{ tag: 'Salary', amount: 5000 }], interests: [], properties: [] },
          expenses: { daily: [], splurge: [], smile: [], fire: [], mojo: [] }
        },
        smile: [], fire: [], mojo: { target: 500, amount: 100 }, budget: [], grow: [],
        balance: { asset: { assets: [], shares: [], investments: [] }, liabilities: [] }
      }
    };
  });

  it('batch-read is faster than 19 individual reads', async () => {
    // Batch: 1 request for all 19 paths
    const batchStart = Date.now();
    const batchRes = await authed('post', '/api/data/read/batch')
      .send({ paths: ALL_PATHS });
    const batchTime = Date.now() - batchStart;
    expect(batchRes.status).toBe(200);

    // Individual: 19 separate GET requests
    const individualStart = Date.now();
    for (const path of ALL_PATHS) {
      const res = await authed('get', `/api/data/read/${path}`);
      expect(res.status).toBe(200);
    }
    const individualTime = Date.now() - individualStart;

    // Batch should be significantly faster (fewer HTTP round-trips)
    expect(batchTime).toBeLessThan(individualTime);
    // Batch should complete in well under 200ms (mocked DB, no network)
    expect(batchTime).toBeLessThan(200);
  });

  it('batch-read returns same data as individual reads', async () => {
    const batchRes = await authed('post', '/api/data/read/batch')
      .send({ paths: ALL_PATHS });

    for (const path of ALL_PATHS) {
      const individualRes = await authed('get', `/api/data/read/${path}`);
      expect(batchRes.body.data[path]).toEqual(individualRes.body.data);
    }
  });
});
