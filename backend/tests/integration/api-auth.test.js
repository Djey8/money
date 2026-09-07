'use strict';

const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { queryAuditEntries } = require('../../config/audit');
const { getAuditDb, getAuthDb, getUsersDb } = require('../../config/db');

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

    const individual = await sessionRequest('get', '/api/v1/transactions/tx_integration_1');
    expect(individual.status).toBe(200);
    expect(individual.body).toMatchObject({ id: 'tx_integration_1', amountMinor: -1250 });

    const missing = await sessionRequest('get', '/api/v1/transactions/not_found');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('not_found');
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

  it('creates a transaction and its derived ledger with transactions:w scope', async () => {
    const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'writer-agent',
      scopes: ['transactions:w', 'transactions:r'],
    });
    const response = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${created.body.token}`)
      .send({
        account: 'Income',
        amountMinor: 5000,
        date: '2026-09-06',
        time: '10:00',
        category: '@Side job',
        comment: '',
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: expect.stringMatching(/^tx_/), amountMinor: 5000 });
    const ledger = await sessionRequest('get', '/api/data/read/income/revenue/revenues');
    expect(ledger.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ tag: 'Side job', amount: 50 })]),
    );
    const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
      resource: 'transactions',
    });
    expect(auditEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: { type: 'token', tokenId: created.body.tokenId },
          method: 'POST',
        }),
      ]),
    );
  });

  it('caps a Smile transaction and persists matching bucket state', async () => {
    const projects = [
      {
        title: 'Holiday',
        buckets: [{ id: 'flight', title: 'Flights', target: 100, amount: 0 }],
      },
    ];
    await sessionRequest('post', '/api/data/write/smile').send(projects);
    const response = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Smile',
      amountMinor: -12000,
      date: '2026-09-06',
      time: '11:00',
      category: '@Holiday',
      comment: 'Fund #bucket:Flights:120',
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      amountMinor: -10000,
      comment: 'Fund\n#bucket:Flights:100.00',
    });
    const smile = await sessionRequest('get', '/api/data/read/smile');
    expect(smile.body.data[0].buckets[0].amount).toBe(100);
  });

  it('keeps a transaction write isolated to the authenticated user document', async () => {
    const created = await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
      account: 'Daily',
      amountMinor: -777,
      date: '2026-09-06',
      time: '12:00',
      category: '@Second user',
      comment: '',
    });
    expect(created.status).toBe(201);
    const firstTransactions = await sessionRequest('get', '/api/v1/transactions');
    const secondTransactions = await sessionRequest(
      'get',
      '/api/v1/transactions',
      secondUser.token,
    );
    expect(firstTransactions.body.transactions.map((transaction) => transaction.id)).not.toContain(
      created.body.id,
    );
    expect(secondTransactions.body.transactions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
    );
  });

  it('writes and subsequently reads encrypted transaction data through the API', async () => {
    const authDb = getAuthDb();
    const authDoc = await authDb.get(secondUser.userId);
    authDoc.encryptionConfig = {
      key: 'integration-secret',
      encryptLocal: true,
      encryptDatabase: true,
    };
    await authDb.insert(authDoc);
    const response = await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
      account: 'Daily',
      amountMinor: -1234,
      date: '2026-09-06',
      time: '12:01',
      category: '@Encrypted',
      comment: 'Secret',
    });
    expect(response.status).toBe(201);
    const stored = await getUsersDb().get(secondUser.userId);
    expect(
      stored.data.transactions.some(
        (transaction) =>
          typeof transaction.amount === 'string' && transaction.amount.startsWith('v2:'),
      ),
    ).toBe(true);
    const read = await sessionRequest(
      'get',
      `/api/v1/transactions/${response.body.id}`,
      secondUser.token,
    );
    expect(read.body).toMatchObject({
      id: response.body.id,
      amountMinor: -1234,
      comment: 'Secret',
    });
  });

  it('rejects a zero-value transaction without writing it', async () => {
    const before = await sessionRequest('get', '/api/v1/transactions');
    const response = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Daily',
      amountMinor: 0,
      date: '2026-09-06',
      time: '12:02',
      category: '@Nothing',
      comment: '',
    });
    const after = await sessionRequest('get', '/api/v1/transactions');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_invalid');
    expect(after.body.transactions).toHaveLength(before.body.transactions.length);
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
