/**
 * Shared test setup — creates a fresh test user and provides
 * an authenticated supertest agent for the Money backend.
 *
 * Requires CouchDB to be running. Tests are skipped automatically
 * when the database is unreachable.
 */
const request = require('supertest');

// Set minimal env vars so the server can initialise
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';
process.env.COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
process.env.COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
process.env.COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'password';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const app = require('../../server');
const { initializeDatabase } = require('../../config/db');

/**
 * Try to initialise the database. Returns `true` if CouchDB is
 * reachable and the DB was set up, `false` otherwise.
 */
async function checkDb() {
  try {
    await initializeDatabase();
    return true;
  } catch {
    return false;
  }
}

/**
 * Register a unique test user and return { token, userId, email }.
 * Extracts the access_token from the Set-Cookie header.
 */
async function registerTestUser(suffix = '') {
  const email = `jest_${Date.now()}${suffix}@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!' });

  expect(res.status).toBe(201);
  
  // Extract access_token from Set-Cookie header
  const cookies = res.headers['set-cookie'] || [];
  const accessCookie = cookies.find(c => c.startsWith('access_token='));
  const token = accessCookie ? accessCookie.split(';')[0].split('=')[1] : null;
  
  return { token, userId: res.body.userId, email };
}

module.exports = { app, checkDb, registerTestUser };
