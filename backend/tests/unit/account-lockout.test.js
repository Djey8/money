/**
 * Unit tests for account lockout after repeated failed login attempts (H5).
 * Verifies progressive lockout behavior without hitting the database.
 */
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');

jest.mock('../../config/db', () => {
  const mockAuthDb = {
    find: jest.fn(),
    insert: jest.fn(),
    get: jest.fn()
  };
  const mockUsersDb = {
    insert: jest.fn(),
    get: jest.fn()
  };
  return {
    initializeDatabase: jest.fn().mockResolvedValue(),
    getAuthDb: () => mockAuthDb,
    getUsersDb: () => mockUsersDb,
    __mockAuthDb: mockAuthDb,
    __mockUsersDb: mockUsersDb
  };
});

const { __mockAuthDb } = require('../../config/db');

// Access the failedAttempts map to reset between tests
const authModule = require('../../routes/auth');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Account Lockout (H5)', () => {
  const testEmail = 'lockout@test.com';
  const hashedPassword = bcrypt.hashSync('CorrectPass1', 10);

  beforeEach(() => {
    // Clear lockout state between tests by sending a successful login
    // We'll reset via the exported map if available, or just use unique emails
  });

  it('allows login after fewer than 10 failed attempts', async () => {
    const email = `lockout_allow_${Date.now()}@test.com`;

    // Fail 9 times
    __mockAuthDb.find.mockResolvedValue({ docs: [] });
    for (let i = 0; i < 9; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });
    }

    // 10th attempt with correct credentials should succeed
    __mockAuthDb.find.mockResolvedValue({
      docs: [{ _id: 'u1', email, password: hashedPassword }]
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'CorrectPass1' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
  });

  it('locks account after 10 consecutive failed attempts', async () => {
    const email = `lockout_lock_${Date.now()}@test.com`;

    __mockAuthDb.find.mockResolvedValue({
      docs: [{ _id: 'u2', email, password: hashedPassword }]
    });

    // Fail 10 times with wrong password
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword1' });
    }

    // 11th attempt should be locked (even with correct password)
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'CorrectPass1' });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/locked/i);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('returns Retry-After header when locked', async () => {
    const email = `lockout_retry_${Date.now()}@test.com`;

    __mockAuthDb.find.mockResolvedValue({
      docs: [{ _id: 'u3', email, password: hashedPassword }]
    });

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword1' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'CorrectPass1' });

    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers['retry-after'], 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(900); // 15 minutes max
  });

  it('clears failed attempts on successful login', async () => {
    const email = `lockout_clear_${Date.now()}@test.com`;

    // Fail 5 times
    __mockAuthDb.find.mockResolvedValue({
      docs: [{ _id: 'u4', email, password: hashedPassword }]
    });
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword1' });
    }

    // Succeed
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'CorrectPass1' });
    expect(res.status).toBe(200);

    // Fail 9 more times — should NOT lock (counter was reset)
    for (let i = 0; i < 9; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword1' });
    }

    // Should still be able to login (9 < 10)
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'CorrectPass1' });
    expect(res2.status).toBe(200);
  });

  it('locks account even for non-existent users (prevents enumeration)', async () => {
    const email = `lockout_nouser_${Date.now()}@test.com`;

    __mockAuthDb.find.mockResolvedValue({ docs: [] });

    // Fail 10 times with non-existent user
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'anything' });
    }

    // 11th attempt should be locked
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'anything' });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/locked/i);
  });
});
