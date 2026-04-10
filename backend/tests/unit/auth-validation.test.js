/**
 * Unit tests for registration/login input validation and password hashing.
 * Tests the validation logic that exists in routes/auth.js without hitting
 * the database — uses supertest against the real Express app but with
 * mocked DB functions so no CouchDB is needed.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');

// -------- Mock the DB layer so CouchDB is never contacted --------
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

const { __mockAuthDb, __mockUsersDb } = require('../../config/db');

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// Registration input validation
// ============================================================
describe('POST /api/auth/register — input validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'StrongP@ss1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('returns 400 when both email and password are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 409 when user already exists', async () => {
    __mockAuthDb.find.mockResolvedValue({ docs: [{ _id: 'existing' }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'exists@test.com', password: 'Pass1234' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 201 with token for a valid registration', async () => {
    __mockAuthDb.find.mockResolvedValue({ docs: [] });
    __mockAuthDb.insert.mockResolvedValue({ id: 'user_1', rev: '1-abc' });
    __mockUsersDb.insert.mockResolvedValue({ id: 'user_1', rev: '1-abc' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'Pass1234' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    expect(res.body.email).toBe('new@test.com');
  });
});

// ============================================================
// Login input validation
// ============================================================
describe('POST /api/auth/login — input validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'p' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('returns 401 for non-existent user', async () => {
    __mockAuthDb.find.mockResolvedValue({ docs: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'x' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 401 for wrong password', async () => {
    const hashed = await bcrypt.hash('correct', 10);
    __mockAuthDb.find.mockResolvedValue({
      docs: [{ _id: 'u1', email: 'u@t.com', password: hashed }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@t.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('returns 200 with token for correct credentials', async () => {
    const hashed = await bcrypt.hash('correct', 10);
    __mockAuthDb.find.mockResolvedValue({
      docs: [{ _id: 'u1', email: 'u@t.com', password: hashed }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'u@t.com', password: 'correct' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.userId).toBe('u1');

    // Verify token contents
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('u@t.com');
  });
});

// ============================================================
// Password hashing properties
// ============================================================
describe('bcrypt hashing', () => {
  it('produces different hashes for the same plaintext (salted)', async () => {
    const hash1 = await bcrypt.hash('samePassword', 10);
    const hash2 = await bcrypt.hash('samePassword', 10);

    expect(hash1).not.toBe(hash2);
    // Both must still verify
    expect(await bcrypt.compare('samePassword', hash1)).toBe(true);
    expect(await bcrypt.compare('samePassword', hash2)).toBe(true);
  });

  it('wrong plaintext does not match hash', async () => {
    const hash = await bcrypt.hash('rightPassword', 10);
    expect(await bcrypt.compare('wrongPassword', hash)).toBe(false);
  });
});
