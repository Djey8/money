/**
 * Integration tests for CORS configuration and Helmet security headers.
 *
 * These tests verify the HTTP-level security middleware applied by server.js.
 * They do NOT require CouchDB — they only inspect response headers.
 */
const request = require('supertest');

// We need a fresh app import so env can be manipulated if needed.
// The shared setup already sets SKIP_RATE_LIMIT=true and NODE_ENV=test.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci';
process.env.SKIP_RATE_LIMIT = 'true';
process.env.NODE_ENV = 'test';

const app = require('../../server');

// --- CORS --------------------------------------------------------------------

describe('CORS configuration', () => {
  it('includes CORS headers for allowed origin', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:4200');

    // The server should respond with Access-Control-Allow-Origin
    expect(res.headers).toHaveProperty('access-control-allow-origin');
  });

  it('reflects the configured origin in the response', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:4200');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });

  it('returns CORS headers on preflight with correct methods', async () => {
    const res = await request(app)
      .options('/api/data/read/test')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'GET');

    // Should return 204 or 200 for preflight
    expect(res.status).toBeLessThanOrEqual(204);
    expect(res.headers).toHaveProperty('access-control-allow-origin');
  });
});

// --- Helmet security headers -------------------------------------------------

describe('Helmet security headers', () => {
  let res;

  beforeAll(async () => {
    res = await request(app).get('/health');
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options', () => {
    // Helmet defaults: SAMEORIGIN
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('removes X-Powered-By header', () => {
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('sets Strict-Transport-Security header', () => {
    // Helmet includes HSTS by default
    expect(res.headers).toHaveProperty('strict-transport-security');
  });

  it('sets X-DNS-Prefetch-Control header', () => {
    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
  });

  it('sets X-Download-Options header', () => {
    expect(res.headers).toHaveProperty('x-download-options');
  });

  it('sets Content-Security-Policy or Cross-Origin headers', () => {
    // Helmet v4+ sets various CSP-related headers
    const hasCSP = 'content-security-policy' in res.headers;
    const hasCOOP = 'cross-origin-opener-policy' in res.headers;
    const hasCOEP = 'cross-origin-embedder-policy' in res.headers;

    expect(hasCSP || hasCOOP || hasCOEP).toBe(true);
  });
});
