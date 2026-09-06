'use strict';

const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let firstUser;
let secondUser;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;
  firstUser = await registerTestUser('_api_one');
  secondUser = await registerTestUser('_api_two');
});

function sessionRequest(method, path, token = firstUser.token) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

describe('v1 API authentication and PAT management', () => {
  it('returns RFC 9457 authentication errors without credentials', async () => {
    const response = await request(app).get('/api/v1/me');
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('auth_required');
  });

  it('returns session identity from /me', async () => {
    const response = await sessionRequest('get', '/api/v1/me');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: firstUser.userId,
      authenticationType: 'session',
      scopes: ['admin'],
    });
  });

  it("returns the caller's legacy transactions as integer minor units", async () => {
    const write = await sessionRequest('post', '/api/data/write/transactions').send([
      {
        id: 'tx_integration_1',
        account: 'Daily',
        amount: -12.5,
        date: '2026-09-06',
        time: '09:30',
        category: '@Food',
        comment: 'Shop',
      },
    ]);
    expect(write.status).toBe(200);

    const response = await sessionRequest('get', '/api/v1/transactions');
    expect(response.status).toBe(200);
    expect(response.body.transactions).toEqual([
      expect.objectContaining({ id: 'tx_integration_1', amountMinor: -1250, currency: 'EUR' }),
    ]);
  });

  it('rejects a PAT without transactions:r scope', async () => {
    const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'write-only-agent',
      scopes: ['transactions:w'],
    });
    const response = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${created.body.token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('scope_insufficient');
  });

  it('creates a PAT once and exposes its identity to /me', async () => {
    const create = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'integration-agent',
      scopes: ['transactions:r'],
    });
    expect(create.status).toBe(201);
    expect(create.body.token).toMatch(/^mmpat_/);

    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${create.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      userId: firstUser.userId,
      authenticationType: 'token',
      tokenName: 'integration-agent',
      scopes: ['transactions:r'],
    });
  });

  it('prevents a PAT from managing tokens', async () => {
    const create = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'restricted-agent',
      scopes: ['transactions:r'],
    });
    const response = await request(app)
      .get('/api/v1/auth/tokens')
      .set('Authorization', `Bearer ${create.body.token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('auth_session_required');
  });

  it('prevents a guest JWT from managing tokens', async () => {
    const guest = await request(app).post('/api/auth/guest').send();
    const token = guest.headers['set-cookie']
      .find((cookie) => cookie.startsWith('access_token='))
      .split(';')[0]
      .split('=')[1];
    const response = await request(app)
      .post('/api/v1/auth/tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'guest-agent', scopes: ['transactions:r'] });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('auth_session_required');
  });

  it('does not issue the admin scope through the API', async () => {
    const response = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'too-powerful',
      scopes: ['admin'],
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_invalid');
  });

  it('does not let a session revoke another user’s PAT', async () => {
    const created = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
      name: 'other-user-agent',
      scopes: ['transactions:r'],
    });
    const response = await sessionRequest('delete', `/api/v1/auth/tokens/${created.body.tokenId}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('not_found');
  });
});
