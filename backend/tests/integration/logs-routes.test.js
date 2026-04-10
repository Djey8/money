/**
 * Integration tests for the frontend logging endpoint (/api/logs).
 * Requires a running CouchDB instance (for auth token generation).
 */
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let token;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  const user = await registerTestUser('_logs');
  token = user.token;
});

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

const skipIf = (cond, name, fn) => (cond ? it.skip : it)(name, fn);

describe('POST /api/logs/frontend', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping logs tests');
    }
    expect(true).toBe(true);
  });

  skipIf(!dbAvailable, 'accepts a valid batch of log entries', async () => {
    const res = await authed('post', '/api/logs/frontend')
      .send({
        logs: [
          {
            timestamp: new Date().toISOString(),
            action: 'page_view',
            level: 'info',
            username: 'alice',
            url: '/home',
            userAgent: 'Jest',
            mode: 'selfhosted',
            details: { page: 'home' }
          },
          {
            timestamp: new Date().toISOString(),
            action: 'button_click',
            level: 'info',
            username: 'alice',
            url: '/budget',
            userAgent: 'Jest',
            mode: 'selfhosted'
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('received', 2);
  });

  skipIf(!dbAvailable, 'routes error-level logs correctly', async () => {
    const res = await authed('post', '/api/logs/frontend')
      .send({
        logs: [
          {
            timestamp: new Date().toISOString(),
            action: 'unhandled_error',
            level: 'error',
            details: { message: 'something broke', stack: 'Error: ...' }
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
  });

  skipIf(!dbAvailable, 'routes warning-level logs correctly', async () => {
    const res = await authed('post', '/api/logs/frontend')
      .send({
        logs: [
          {
            timestamp: new Date().toISOString(),
            action: 'slow_network',
            level: 'warning',
            details: { latency: 5000 }
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
  });

  skipIf(!dbAvailable, 'accepts an empty log entry with defaults', async () => {
    const res = await authed('post', '/api/logs/frontend')
      .send({
        logs: [
          { timestamp: new Date().toISOString(), action: 'minimal' }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
  });

  skipIf(!dbAvailable, 'returns 400 when logs is not an array', async () => {
    const res = await authed('post', '/api/logs/frontend')
      .send({ logs: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'logs must be an array');
  });

  skipIf(!dbAvailable, 'returns 400 when logs key is missing', async () => {
    const res = await authed('post', '/api/logs/frontend')
      .send({ something: 'else' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'logs must be an array');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/logs/frontend')
      .send({ logs: [] });

    expect(res.status).toBe(401);
  });
});

// --- Logs health endpoint ----------------------------------------------------

describe('GET /api/logs/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/logs/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('endpoint', 'logs');
    expect(res.body).toHaveProperty('timestamp');
  });
});
