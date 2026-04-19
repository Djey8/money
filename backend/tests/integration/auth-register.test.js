/**
 * Integration tests for the registration endpoint (/api/auth/register).
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, checkDb } = require('./setup');

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await checkDb();
});

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('POST /api/auth/register', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping auth-register tests');
    }
    expect(true).toBe(true);
  });

  // --- Successful registration -----------------------------------------------

  skipIf(!dbAvailable, 'returns 201 with userId and sets auth cookies on success', async () => {
    const email = `reg_success_${Date.now()}@test.local`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('email', email);
    expect(res.body.userId).toMatch(/^user_/);
    // Auth cookies should be set
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('refresh_token='))).toBe(true);
  });

  skipIf(!dbAvailable, 'access token cookie contains correct userId and email claims', async () => {
    const email = `reg_jwt_${Date.now()}@test.local`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' });

    expect(res.status).toBe(201);

    const cookies = res.headers['set-cookie'] || [];
    const accessCookie = cookies.find(c => c.startsWith('access_token='));
    const token = accessCookie.split(';')[0].split('=')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(res.body.userId);
    expect(decoded.email).toBe(email);
    expect(decoded).toHaveProperty('exp');
    expect(decoded).toHaveProperty('iat');
  });

  skipIf(!dbAvailable, 'creates user data document with default username', async () => {
    const email = `reg_data_${Date.now()}@test.local`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' });

    expect(res.status).toBe(201);

    // Extract token from cookie for data read
    const cookies = res.headers['set-cookie'] || [];
    const accessCookie = cookies.find(c => c.startsWith('access_token='));
    const token = accessCookie.split(';')[0].split('=')[1];

    // Read the user data document to verify it was created
    const dataRes = await request(app)
      .get('/api/data/read/info')
      .set('Authorization', `Bearer ${token}`);

    expect(dataRes.status).toBe(200);
    expect(dataRes.body.data).toHaveProperty('email', email);
    // Default username is email prefix
    expect(dataRes.body.data).toHaveProperty('username', email.split('@')[0]);
  });

  skipIf(!dbAvailable, 'uses provided username instead of email prefix', async () => {
    const email = `reg_user_${Date.now()}@test.local`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!', username: 'CustomName' });

    expect(res.status).toBe(201);

    const cookies = res.headers['set-cookie'] || [];
    const accessCookie = cookies.find(c => c.startsWith('access_token='));
    const token = accessCookie.split(';')[0].split('=')[1];

    const dataRes = await request(app)
      .get('/api/data/read/info')
      .set('Authorization', `Bearer ${token}`);

    expect(dataRes.status).toBe(200);
    expect(dataRes.body.data).toHaveProperty('username', 'CustomName');
  });

  // --- Duplicate email -------------------------------------------------------

  skipIf(!dbAvailable, 'returns 409 for duplicate email', async () => {
    const email = `reg_dup_${Date.now()}@test.local`;

    // First registration — should succeed
    const first = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'StrongPass123!' });
    expect(first.status).toBe(201);

    // Second registration with same email — should fail
    const second = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'DifferentPass456!' });
    expect(second.status).toBe(409);
    expect(second.body).toHaveProperty('error', 'Registration failed');
  });

  // --- Missing fields --------------------------------------------------------

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'StrongPass123!' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nopass@test.local' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('returns 400 when both email and password are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send();

    expect(res.status).toBe(400);
  });
});
