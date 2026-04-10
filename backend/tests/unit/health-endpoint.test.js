/**
 * Unit tests for the /health endpoint.
 * No database required — just validates the HTTP contract.
 */
process.env.JWT_SECRET = 'test-secret';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

// Mock DB so the server loads without CouchDB
jest.mock('../../config/db', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(),
  getAuthDb: () => ({ find: jest.fn(), insert: jest.fn() }),
  getUsersDb: () => ({ insert: jest.fn(), get: jest.fn() })
}));

const request = require('supertest');
const app = require('../../server');

describe('GET /health', () => {
  it('returns { status: "ok" } with 200', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes a timestamp in ISO format', async () => {
    const res = await request(app).get('/health');

    expect(res.body).toHaveProperty('timestamp');
    // Must be a valid ISO-8601 string
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});
