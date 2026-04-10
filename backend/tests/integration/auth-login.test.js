/**
 * Integration tests for login, token verification, password verification,
 * and email update endpoints.
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, checkDb } = require('./setup');

let dbAvailable = false;
let testEmail, testPassword, testToken, testUserId;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  // Register a user for login tests
  testEmail = `login_${Date.now()}@test.local`;
  testPassword = 'LoginTestPass123!';

  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: testEmail, password: testPassword });

  testToken = res.body.token;
  testUserId = res.body.userId;
});

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

// --- Login -------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping auth-login tests');
    }
    expect(true).toBe(true);
  });

  skipIf(!dbAvailable, 'returns 200 with token for correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId', testUserId);
    expect(res.body).toHaveProperty('email', testEmail);
  });

  skipIf(!dbAvailable, 'returned JWT contains correct userId and email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(testUserId);
    expect(decoded.email).toBe(testEmail);
  });

  skipIf(!dbAvailable, 'returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  skipIf(!dbAvailable, 'returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody_exists@test.local', password: 'SomePass123!' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'SomePass123!' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.local' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Email and password are required');
  });
});

// --- Token Verification ------------------------------------------------------

describe('GET /api/auth/verify', () => {
  skipIf(!dbAvailable, 'returns valid:true for a valid token', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('valid', true);
    expect(res.body).toHaveProperty('userId', testUserId);
    expect(res.body).toHaveProperty('email', testEmail);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/verify');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'No token provided');
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer totally.invalid.token');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('valid', false);
  });

  it('returns 401 for an expired token', async () => {
    const expired = jwt.sign(
      { userId: 'u1', email: 'e@t.com' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );
    // Small delay to ensure expiry
    await new Promise(r => setTimeout(r, 50));

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('valid', false);
  });
});

// --- Password Verification ---------------------------------------------------

describe('POST /api/auth/verify-password', () => {
  skipIf(!dbAvailable, 'returns valid:true for correct password', async () => {
    const res = await request(app)
      .post('/api/auth/verify-password')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('valid', true);
  });

  skipIf(!dbAvailable, 'returns 401 for incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/verify-password')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid password');
  });

  skipIf(!dbAvailable, 'returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/verify-password')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Password is required');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/auth/verify-password')
      .send({ password: 'SomePass123!' });

    expect(res.status).toBe(401);
  });
});

// --- Email Update ------------------------------------------------------------

describe('PUT /api/auth/update-email', () => {
  skipIf(!dbAvailable, 'updates email and returns new token', async () => {
    // Register a disposable user for this test
    const email = `email_update_${Date.now()}@test.local`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'UpdatePass123!' });

    const newEmail = `updated_${Date.now()}@test.local`;
    const res = await request(app)
      .put('/api/auth/update-email')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ newEmail });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('email', newEmail);
    expect(res.body).toHaveProperty('token');

    // New token should contain updated email
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.email).toBe(newEmail);
  });

  skipIf(!dbAvailable, 'returns 400 when newEmail is missing', async () => {
    const res = await request(app)
      .put('/api/auth/update-email')
      .set('Authorization', `Bearer ${testToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'New email is required');
  });

  skipIf(!dbAvailable, 'returns 400 for invalid email format', async () => {
    const res = await request(app)
      .put('/api/auth/update-email')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ newEmail: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid email format');
  });

  skipIf(!dbAvailable, 'returns 409 when new email is already taken', async () => {
    // Register a second user
    const otherEmail = `email_taken_${Date.now()}@test.local`;
    await request(app)
      .post('/api/auth/register')
      .send({ email: otherEmail, password: 'TakenPass123!' });

    // Try to change testUser's email to otherUser's email
    const res = await request(app)
      .put('/api/auth/update-email')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ newEmail: otherEmail });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Email already in use by another account');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .put('/api/auth/update-email')
      .send({ newEmail: 'new@test.local' });

    expect(res.status).toBe(401);
  });
});
