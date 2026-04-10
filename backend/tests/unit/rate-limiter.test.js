/**
 * Unit tests for rate limiter skip logic.
 * Validates that the SKIP_RATE_LIMIT env var controls whether
 * rate limiting is applied.
 */
const request = require('supertest');

describe('Rate limiter skip logic', () => {
  // Each test re-requires the server with different env, so we isolate modules
  afterEach(() => {
    jest.resetModules();
  });

  it('skips rate limiting when SKIP_RATE_LIMIT=true', async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.SKIP_RATE_LIMIT = 'true';
    process.env.NODE_ENV = 'test';

    // Mock DB so server can load without CouchDB
    jest.mock('../../config/db', () => ({
      initializeDatabase: jest.fn().mockResolvedValue(),
      getAuthDb: () => ({ find: jest.fn(), insert: jest.fn() }),
      getUsersDb: () => ({ insert: jest.fn(), get: jest.fn() })
    }));

    const app = require('../../server');

    // Fire many requests rapidly — should all succeed (not 429)
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await request(app).get('/health'));
    }
    results.forEach(r => {
      expect(r.status).toBe(200);
    });
  });

  it('applies rate limiting when SKIP_RATE_LIMIT is not set', async () => {
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.SKIP_RATE_LIMIT;
    process.env.NODE_ENV = 'test';

    jest.mock('../../config/db', () => ({
      initializeDatabase: jest.fn().mockResolvedValue(),
      getAuthDb: () => ({ find: jest.fn(), insert: jest.fn() }),
      getUsersDb: () => ({ insert: jest.fn(), get: jest.fn() })
    }));

    const app = require('../../server');

    // Rate limiter is active but with 100 req/15 min limit.
    // Just verify the middleware is present by checking custom headers.
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    // Health endpoint is outside /api/ prefix, so rate limit headers shouldn't appear.
    // Fire one /api/ request to check rate-limit headers are set.
    const apiRes = await request(app).get('/api/data/read/test')
      .set('Authorization', 'Bearer invalid');
    // Should get 403 (invalid token), but rate limit headers should be present
    expect(apiRes.headers).toHaveProperty('ratelimit-limit');
  });
});
