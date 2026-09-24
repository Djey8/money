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

  it('lists a legacy transaction with an empty time (e.g. subscription-generated) instead of 500ing', async () => {
    const write = await sessionRequest('post', '/api/data/write/transactions').send([
      {
        id: 'tx_integration_empty_time',
        account: 'Daily',
        amount: -9.99,
        date: '2026-09-06',
        time: '',
        category: '@music',
        comment: 'Spotify + Paypal',
      },
    ]);
    expect(write.status).toBe(200);

    const response = await sessionRequest('get', '/api/v1/transactions');
    expect(response.status).toBe(200);
    expect(response.body.transactions).toEqual([
      expect.objectContaining({ id: 'tx_integration_empty_time', time: '00:00' }),
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
        id: 'smile_fixture_holiday',
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

  it('edits a transaction and rebuilds its derived ledger', async () => {
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Income',
      amountMinor: 20000,
      date: '2026-09-06',
      time: '13:00',
      category: '@Freelance',
      comment: '',
    });
    const response = await sessionRequest('patch', `/api/v1/transactions/${created.body.id}`).send({
      amountMinor: 30000,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.body.id, amountMinor: 30000 });
    const ledger = await sessionRequest('get', '/api/data/read/income/revenue/revenues');
    expect(ledger.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ tag: 'Freelance', amount: 300 })]),
    );
  });

  it('rejects an amountMinor-only edit that would revert to a stale bucket allocation tag', async () => {
    const projects = [
      {
        id: 'smile_fixture_bucket_edit_test',
        title: 'Bucket Edit Test',
        buckets: [{ id: 'goal', title: 'Goal', target: 100, amount: 0 }],
      },
    ];
    await sessionRequest('post', '/api/data/write/smile').send(projects);
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Smile',
      amountMinor: -5000,
      date: '2026-09-06',
      time: '13:00',
      category: '@Bucket Edit Test',
      comment: '#bucket:Goal:50.00',
    });
    const amountOnly = await sessionRequest(
      'patch',
      `/api/v1/transactions/${created.body.id}`,
    ).send({ amountMinor: -7000 });
    expect(amountOnly.status).toBe(400);
    expect(amountOnly.body.code).toBe('validation_invalid');

    const commentOnly = await sessionRequest(
      'patch',
      `/api/v1/transactions/${created.body.id}`,
    ).send({ comment: 'no tags anymore' });
    expect(commentOnly.status).toBe(400);
    expect(commentOnly.body.code).toBe('validation_invalid');

    const together = await sessionRequest('patch', `/api/v1/transactions/${created.body.id}`).send({
      amountMinor: -7000,
      comment: '#bucket:Goal:70.00',
    });
    expect(together.status).toBe(200);
    expect(together.body.amountMinor).toBe(-7000);
  });

  it('rejects an edit to a non-editable field', async () => {
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Daily',
      amountMinor: -100,
      date: '2026-09-06',
      time: '13:01',
      category: '@Edit test',
      comment: '',
    });
    const response = await sessionRequest('patch', `/api/v1/transactions/${created.body.id}`).send({
      id: 'tx_hijacked',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_invalid');
  });

  it('returns 404 editing or deleting a transaction id that does not exist', async () => {
    const patchResponse = await sessionRequest('patch', '/api/v1/transactions/tx_missing').send({
      comment: 'x',
    });
    expect(patchResponse.status).toBe(404);
    const deleteResponse = await sessionRequest('delete', '/api/v1/transactions/tx_missing');
    expect(deleteResponse.status).toBe(404);
  });

  it('does not let a session edit or delete another user’s transaction', async () => {
    const created = await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
      account: 'Daily',
      amountMinor: -500,
      date: '2026-09-06',
      time: '13:02',
      category: '@Owned by second user',
      comment: '',
    });
    const patchResponse = await sessionRequest(
      'patch',
      `/api/v1/transactions/${created.body.id}`,
    ).send({ comment: 'hijacked' });
    expect(patchResponse.status).toBe(404);
    const deleteResponse = await sessionRequest(
      'delete',
      `/api/v1/transactions/${created.body.id}`,
    );
    expect(deleteResponse.status).toBe(404);
    const stillThere = await sessionRequest(
      'get',
      `/api/v1/transactions/${created.body.id}`,
      secondUser.token,
    );
    expect(stillThere.status).toBe(200);
  });

  it('deletes a transaction and removes it from the derived ledger', async () => {
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Income',
      amountMinor: 40000,
      date: '2026-09-06',
      time: '13:03',
      category: '@ToDelete',
      comment: '',
    });
    const response = await sessionRequest('delete', `/api/v1/transactions/${created.body.id}`);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.body.id);
    expect(response.body.effects.incomeStatement).toEqual([
      { section: 'revenues', tag: 'ToDelete', beforeMinor: 40000, afterMinor: 0 },
    ]);
    const missing = await sessionRequest('get', `/api/v1/transactions/${created.body.id}`);
    expect(missing.status).toBe(404);
    const ledger = await sessionRequest('get', '/api/data/read/income/revenue/revenues');
    expect(ledger.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ tag: 'ToDelete' })]),
    );
  });

  it('copies a transaction with a new id, defaulting date/time to now', async () => {
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Daily',
      amountMinor: -333,
      date: '2020-01-01',
      time: '08:00',
      category: '@Copy source',
      comment: 'Original',
    });
    const response = await sessionRequest(
      'post',
      `/api/v1/transactions/${created.body.id}/copy`,
    ).send({});
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      account: 'Daily',
      amountMinor: -333,
      category: '@Copy source',
      comment: 'Original',
    });
    expect(response.body.id).not.toBe(created.body.id);
    expect(response.body.date).not.toBe('2020-01-01');
  });

  it('applies overrides when copying and rejects a coupled bucket-tag override', async () => {
    const projects = [
      {
        id: 'smile_fixture_copy_bucket_test',
        title: 'Copy Bucket Test',
        buckets: [{ id: 'goal', title: 'Goal', target: 300, amount: 0 }],
      },
    ];
    await sessionRequest('post', '/api/data/write/smile').send(projects);
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Smile',
      amountMinor: -5000,
      date: '2026-09-06',
      time: '13:05',
      category: '@Copy Bucket Test',
      comment: '#bucket:Goal:50.00',
    });
    const rejected = await sessionRequest(
      'post',
      `/api/v1/transactions/${created.body.id}/copy`,
    ).send({ amountMinor: -7000 });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe('validation_invalid');

    const copied = await sessionRequest(
      'post',
      `/api/v1/transactions/${created.body.id}/copy`,
    ).send({ amountMinor: -7000, comment: '#bucket:Goal:70.00' });
    expect(copied.status).toBe(201);
    expect(copied.body.amountMinor).toBe(-7000);
  });

  it('returns 404 copying a transaction id that does not exist or belongs to another user', async () => {
    const missing = await sessionRequest('post', '/api/v1/transactions/tx_missing/copy').send({});
    expect(missing.status).toBe(404);

    const secondUserTransaction = await sessionRequest(
      'post',
      '/api/v1/transactions',
      secondUser.token,
    ).send({
      account: 'Daily',
      amountMinor: -444,
      date: '2026-09-06',
      time: '13:06',
      category: '@Not yours',
      comment: '',
    });
    const crossUser = await sessionRequest(
      'post',
      `/api/v1/transactions/${secondUserTransaction.body.id}/copy`,
    ).send({});
    expect(crossUser.status).toBe(404);
  });

  it('rejects transaction writes without transactions:w scope', async () => {
    const readOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'read-only-agent',
      scopes: ['transactions:r'],
    });
    const created = await sessionRequest('post', '/api/v1/transactions').send({
      account: 'Daily',
      amountMinor: -100,
      date: '2026-09-06',
      time: '13:04',
      category: '@Scope test',
      comment: '',
    });
    const patchResponse = await request(app)
      .patch(`/api/v1/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${readOnly.body.token}`)
      .send({ comment: 'nope' });
    expect(patchResponse.status).toBe(403);
    expect(patchResponse.body.code).toBe('scope_insufficient');
    const deleteResponse = await request(app)
      .delete(`/api/v1/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${readOnly.body.token}`);
    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.body.code).toBe('scope_insufficient');
    const copyResponse = await request(app)
      .post(`/api/v1/transactions/${created.body.id}/copy`)
      .set('Authorization', `Bearer ${readOnly.body.token}`)
      .send({});
    expect(copyResponse.status).toBe(403);
    expect(copyResponse.body.code).toBe('scope_insufficient');
    const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'write-not-bulk-agent',
      scopes: ['transactions:w'],
    });
    const batchResponse = await request(app)
      .post('/api/v1/transactions/batch')
      .set('Authorization', `Bearer ${writeOnly.body.token}`)
      .set('Idempotency-Key', 'scope-test-key')
      .send({ operations: [{ op: 'delete', id: created.body.id }] });
    expect(batchResponse.status).toBe(403);
    expect(batchResponse.body.code).toBe('scope_insufficient');
    const readWrite = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'rw-not-bulk-agent',
      scopes: ['transactions:rw'],
    });
    const rwBatchResponse = await request(app)
      .post('/api/v1/transactions/batch')
      .set('Authorization', `Bearer ${readWrite.body.token}`)
      .set('Idempotency-Key', 'scope-test-key-rw')
      .send({ operations: [{ op: 'delete', id: created.body.id }] });
    expect(rwBatchResponse.status).toBe(403);
    expect(rwBatchResponse.body.code).toBe('scope_insufficient');
  });

  describe('POST /transactions/batch', () => {
    async function bulkToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `bulk-agent-${Date.now()}-${Math.random()}`,
        scopes: ['transactions:bulk'],
      });
      return created.body.token;
    }

    it('creates, updates, and reports a failing delete in one non-atomic batch', async () => {
      const token = await bulkToken();
      const existing = await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -100,
        date: '2026-09-06',
        time: '14:00',
        category: '@Batch existing',
        comment: '',
      });
      const response = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `batch-${Date.now()}-1`)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Income',
              amountMinor: 5000,
              date: '2026-09-06',
              time: '14:01',
              category: '@Batch salary',
              comment: '',
            },
            { op: 'update', id: existing.body.id, amountMinor: -200 },
            { op: 'delete', id: 'tx_does_not_exist' },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.atomic).toBe(false);
      expect(response.body.results[0]).toMatchObject({ op: 'create', status: 'created' });
      expect(response.body.results[1]).toMatchObject({
        op: 'update',
        status: 'updated',
        id: existing.body.id,
      });
      expect(response.body.results[1].transaction.amountMinor).toBe(-200);
      expect(response.body.results[2]).toMatchObject({ op: 'delete', status: 'error' });
    });

    it('rolls back the whole batch atomically when one operation fails', async () => {
      const token = await bulkToken();
      const existing = await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -300,
        date: '2026-09-06',
        time: '14:02',
        category: '@Batch atomic',
        comment: '',
      });
      const response = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `batch-${Date.now()}-2`)
        .send({
          atomic: true,
          operations: [
            { op: 'delete', id: existing.body.id },
            { op: 'delete', id: 'tx_does_not_exist' },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.results[0]).toMatchObject({ status: 'not_applied' });
      expect(response.body.results[1]).toMatchObject({ status: 'error' });
      const stillThere = await sessionRequest('get', `/api/v1/transactions/${existing.body.id}`);
      expect(stillThere.status).toBe(200);
    });

    it('replays the same result for a repeated Idempotency-Key without reapplying the write', async () => {
      const token = await bulkToken();
      const key = `batch-${Date.now()}-3`;
      const body = {
        operations: [
          {
            op: 'create',
            account: 'Daily',
            amountMinor: -400,
            date: '2026-09-06',
            time: '14:03',
            category: '@Batch idempotent',
            comment: '',
          },
        ],
      };
      const first = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);
      expect(first.status).toBe(200);
      const createdId = first.body.results[0].id;

      const replay = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);

      const list = await sessionRequest('get', '/api/v1/transactions');
      expect(
        list.body.transactions.filter((transaction) => transaction.id === createdId),
      ).toHaveLength(1);
    });

    it('rejects a reused Idempotency-Key sent with a different body', async () => {
      const token = await bulkToken();
      const key = `batch-${Date.now()}-4`;
      await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -1,
              date: '2026-09-06',
              time: '14:04',
              category: '@A',
              comment: '',
            },
          ],
        });

      const mismatched = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -2,
              date: '2026-09-06',
              time: '14:05',
              category: '@B',
              comment: '',
            },
          ],
        });
      expect(mismatched.status).toBe(409);
      expect(mismatched.body.code).toBe('conflict_idempotency_mismatch');
    });

    it('requires an Idempotency-Key header', async () => {
      const token = await bulkToken();
      const response = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ operations: [{ op: 'delete', id: 'tx_x' }] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects more than 100 operations', async () => {
      const token = await bulkToken();
      const response = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `batch-${Date.now()}-5`)
        .send({ operations: Array.from({ length: 101 }, () => ({ op: 'delete', id: 'tx_x' })) });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('keeps batch operations isolated to the authenticated user document', async () => {
      const token = await bulkToken();
      const other = await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
        account: 'Daily',
        amountMinor: -50,
        date: '2026-09-06',
        time: '14:06',
        category: '@Not yours',
        comment: '',
      });
      const response = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `batch-${Date.now()}-6`)
        .send({ operations: [{ op: 'delete', id: other.body.id }] });
      expect(response.status).toBe(200);
      expect(response.body.results[0]).toMatchObject({ status: 'error' });
      const stillThere = await sessionRequest(
        'get',
        `/api/v1/transactions/${other.body.id}`,
        secondUser.token,
      );
      expect(stillThere.status).toBe(200);
    });

    it('does not let two different users collide on the same literal Idempotency-Key', async () => {
      const firstToken = await bulkToken();
      const secondTokenCreate = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `bulk-agent-second-${Date.now()}`,
        scopes: ['transactions:bulk'],
      });
      const secondToken = secondTokenCreate.body.token;
      const sharedKey = 'shared-idempotency-key-across-users';

      const firstResponse = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${firstToken}`)
        .set('Idempotency-Key', sharedKey)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -111,
              date: '2026-09-06',
              time: '14:07',
              category: '@First user shared key',
              comment: '',
            },
          ],
        });
      const secondResponse = await request(app)
        .post('/api/v1/transactions/batch')
        .set('Authorization', `Bearer ${secondToken}`)
        .set('Idempotency-Key', sharedKey)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -222,
              date: '2026-09-06',
              time: '14:08',
              category: '@Second user shared key',
              comment: '',
            },
          ],
        });
      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstResponse.body.results[0].transaction.amountMinor).toBe(-111);
      expect(secondResponse.body.results[0].transaction.amountMinor).toBe(-222);
    });
  });

  describe('GET /transactions/export and POST /transactions/import', () => {
    async function bulkToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `bulk-agent-${Date.now()}-${Math.random()}`,
        scopes: ['transactions:bulk'],
      });
      return created.body.token;
    }

    it('exports transactions as newline-delimited JSON', async () => {
      const token = await bulkToken();
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -321,
        date: '2026-09-06',
        time: '15:00',
        category: '@Export test',
        comment: '',
      });
      const response = await request(app)
        .get('/api/v1/transactions/export')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/x-ndjson');
      const lines = response.text.split('\n').filter((line) => line.length > 0);
      const parsed = lines.map((line) => JSON.parse(line));
      expect(parsed).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: '@Export test' })]),
      );
    });

    it('rejects export without the transactions:bulk scope', async () => {
      const readOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `read-only-not-bulk-${Date.now()}`,
        scopes: ['transactions:r'],
      });
      const response = await request(app)
        .get('/api/v1/transactions/export')
        .set('Authorization', `Bearer ${readOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('imports newline-delimited JSON transactions', async () => {
      const token = await bulkToken();
      const ndjson = [
        JSON.stringify({
          account: 'Daily',
          amountMinor: -400,
          date: '2026-09-06',
          time: '15:01',
          category: '@Import A',
          comment: '',
        }),
        JSON.stringify({
          account: 'Income',
          amountMinor: 50000,
          date: '2026-09-06',
          time: '15:02',
          category: '@Import B',
          comment: '',
        }),
      ].join('\n');
      const response = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `import-${Date.now()}-1`)
        .send(ndjson);
      expect(response.status).toBe(200);
      expect(response.body.itemCount).toBe(2);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results.every((result) => result.status === 'created')).toBe(true);
    });

    it('reports a per-line error for an invalid line without failing the whole import', async () => {
      const token = await bulkToken();
      const ndjson = [
        JSON.stringify({
          account: 'Daily',
          amountMinor: -50,
          date: '2026-09-06',
          time: '15:03',
          category: '@Valid import line',
          comment: '',
        }),
        'not valid json',
      ].join('\n');
      const response = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `import-${Date.now()}-2`)
        .send(ndjson);
      expect(response.status).toBe(200);
      expect(response.body.results[0]).toMatchObject({ status: 'created' });
      expect(response.body.results[1]).toMatchObject({ status: 'error' });
    });

    it('rolls back the whole import atomically when any line fails and atomic=true', async () => {
      const token = await bulkToken();
      const ndjson = [
        JSON.stringify({
          account: 'Daily',
          amountMinor: -60,
          date: '2026-09-06',
          time: '15:04',
          category: '@Atomic import valid',
          comment: '',
        }),
        JSON.stringify({ account: 'Daily' }),
      ].join('\n');
      const response = await request(app)
        .post('/api/v1/transactions/import?atomic=true')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `import-${Date.now()}-3`)
        .send(ndjson);
      expect(response.status).toBe(200);
      expect(response.body.atomic).toBe(true);
      expect(response.body.results[0]).toMatchObject({ status: 'not_applied' });
      expect(response.body.results[1]).toMatchObject({ status: 'error' });
    });

    it('replays the same import result for a repeated Idempotency-Key without reapplying', async () => {
      const token = await bulkToken();
      const ndjson = JSON.stringify({
        account: 'Daily',
        amountMinor: -70,
        date: '2026-09-06',
        time: '15:05',
        category: '@Idempotent import',
        comment: '',
      });
      const key = `import-${Date.now()}-4`;
      const first = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', key)
        .send(ndjson);
      const replay = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', key)
        .send(ndjson);
      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);
      const list = await sessionRequest('get', '/api/v1/transactions');
      expect(
        list.body.transactions.filter((transaction) => transaction.id === first.body.results[0].id),
      ).toHaveLength(1);
    });

    it('requires the Idempotency-Key header and rejects an empty body', async () => {
      const token = await bulkToken();
      const missingKey = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .send(
          JSON.stringify({
            account: 'Daily',
            amountMinor: -1,
            date: '2026-09-06',
            time: '15:06',
            category: '@No key',
            comment: '',
          }),
        );
      expect(missingKey.status).toBe(400);

      const emptyBody = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `import-${Date.now()}-5`)
        .send('');
      expect(emptyBody.status).toBe(400);
      expect(emptyBody.body.code).toBe('validation_invalid');
    });

    it('rejects import without the transactions:bulk scope', async () => {
      const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `write-not-bulk-import-${Date.now()}`,
        scopes: ['transactions:w'],
      });
      const response = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${writeOnly.body.token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `import-${Date.now()}-6`)
        .send(
          JSON.stringify({
            account: 'Daily',
            amountMinor: -1,
            date: '2026-09-06',
            time: '15:07',
            category: '@Scope test',
            comment: '',
          }),
        );
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps export and import isolated to the authenticated user document', async () => {
      const firstToken = await bulkToken();
      const secondTokenCreate = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `bulk-agent-isolation-${Date.now()}`,
        scopes: ['transactions:bulk'],
      });
      const secondToken = secondTokenCreate.body.token;

      await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
        account: 'Daily',
        amountMinor: -999,
        date: '2026-09-06',
        time: '15:08',
        category: '@Second user export',
        comment: '',
      });
      const firstExport = await request(app)
        .get('/api/v1/transactions/export')
        .set('Authorization', `Bearer ${firstToken}`);
      expect(firstExport.text).not.toContain('@Second user export');

      const importResponse = await request(app)
        .post('/api/v1/transactions/import')
        .set('Authorization', `Bearer ${secondToken}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `import-isolation-${Date.now()}`)
        .send(
          JSON.stringify({
            account: 'Daily',
            amountMinor: -1,
            date: '2026-09-06',
            time: '15:09',
            category: '@Second user import',
            comment: '',
          }),
        );
      expect(importResponse.status).toBe(200);
      const firstListAfter = await sessionRequest('get', '/api/v1/transactions');
      expect(
        firstListAfter.body.transactions.some(
          (transaction) => transaction.category === '@Second user import',
        ),
      ).toBe(false);
    });
  });

  describe('GET /reports/income-statement', () => {
    async function reportsToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `reports-agent-${Date.now()}-${Math.random()}`,
        scopes: ['reports:r'],
      });
      return created.body.token;
    }

    it('computes revenues, expenses, and net result for the requested period', async () => {
      const token = await reportsToken();
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Income',
        amountMinor: 200000,
        date: '2026-09-05',
        time: '09:00',
        category: '@Report salary',
        comment: '',
      });
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -50000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Report groceries',
        comment: '',
      });
      const response = await request(app)
        .get('/api/v1/reports/income-statement?period=month&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.revenues.current).toBeGreaterThanOrEqual(200000);
      expect(response.body.expensesByAccount.Daily.current).toBeGreaterThanOrEqual(50000);
      expect(response.body.period.label).toMatch(/\d{4}$/);
    });

    it('excludes inter-account transfers from the computed totals', async () => {
      const token = await reportsToken();
      const before = await request(app)
        .get('/api/v1/reports/income-statement?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Income',
        amountMinor: 30000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Smile',
        comment: '',
      });
      const after = await request(app)
        .get('/api/v1/reports/income-statement?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.totalIncome.current).toBe(before.body.totalIncome.current);
    });

    it('rejects an invalid period value', async () => {
      const token = await reportsToken();
      const response = await request(app)
        .get('/api/v1/reports/income-statement?period=fortnight')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a non-integer offset', async () => {
      const token = await reportsToken();
      const response = await request(app)
        .get('/api/v1/reports/income-statement?offset=abc')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the reports:r scope', async () => {
      const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `write-not-reports-${Date.now()}`,
        scopes: ['transactions:w'],
      });
      const response = await request(app)
        .get('/api/v1/reports/income-statement')
        .set('Authorization', `Bearer ${writeOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps report totals isolated to the authenticated user document', async () => {
      const token = await reportsToken();
      await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
        account: 'Income',
        amountMinor: 999900,
        date: '2026-09-06',
        time: '09:00',
        category: '@Only second user',
        comment: '',
      });
      const response = await request(app)
        .get('/api/v1/reports/income-statement?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.revenues.current).toBeLessThan(999900);
    });
  });

  describe('GET /reports/cashflow', () => {
    async function reportsToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `reports-agent-${Date.now()}-${Math.random()}`,
        scopes: ['reports:r'],
      });
      return created.body.token;
    }

    it('computes operating cashflow from ordinary Income and expense-account activity', async () => {
      const token = await reportsToken();
      const before = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Income',
        amountMinor: 200000,
        date: '2026-09-05',
        time: '09:00',
        category: '@Cashflow salary',
        comment: '',
      });
      const after = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(200);
      expect(after.body.operating.current).toBe(before.body.operating.current + 200000);
    });

    it('classifies a transfer from Income into Fire as investing, not operating', async () => {
      const token = await reportsToken();
      const before = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Income',
        amountMinor: -30000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Fire',
        comment: '',
      });
      const after = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.investing.current).toBe(before.body.investing.current + 30000);
      expect(after.body.operating.current).toBe(before.body.operating.current);
    });

    it('classifies a "payback liabilitie" comment as financing regardless of account', async () => {
      const token = await reportsToken();
      const before = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -15000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Loan',
        comment: 'Payback Liabilitie Mortgage;',
      });
      const after = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.financing.current).toBe(before.body.financing.current + 15000);
    });

    it('rejects an invalid period value', async () => {
      const token = await reportsToken();
      const response = await request(app)
        .get('/api/v1/reports/cashflow?period=fortnight')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the reports:r scope', async () => {
      const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `write-not-reports-cashflow-${Date.now()}`,
        scopes: ['transactions:w'],
      });
      const response = await request(app)
        .get('/api/v1/reports/cashflow')
        .set('Authorization', `Bearer ${writeOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps cashflow totals isolated to the authenticated user document', async () => {
      const token = await reportsToken();
      await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
        account: 'Income',
        amountMinor: 999900,
        date: '2026-09-06',
        time: '09:00',
        category: '@Only second user cashflow',
        comment: '',
      });
      const response = await request(app)
        .get('/api/v1/reports/cashflow?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.operating.current).toBeLessThan(999900);
    });
  });

  describe('GET /reports/balance-sheet', () => {
    async function reportsToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `reports-agent-${Date.now()}-${Math.random()}`,
        scopes: ['reports:r'],
      });
      return created.body.token;
    }

    async function setBalanceSheetData(userId, balance, incomeRevenue) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.balance = balance;
      doc.data.income = {
        ...doc.data.income,
        revenue: { ...doc.data.income?.revenue, ...incomeRevenue },
      };
      await usersDb.insert(doc);
    }

    it('aggregates assets, shares, investments, properties, and liabilities into one current snapshot', async () => {
      const token = await reportsToken();
      await setBalanceSheetData(
        firstUser.userId,
        {
          asset: {
            assets: [{ id: 'assets_fixture_car', tag: 'Car', amount: 8000 }],
            shares: [{ id: 'shares_fixture_msft', tag: 'MSFT', quantity: 10, price: 415 }],
            investments: [
              {
                id: 'investments_fixture_rental_unit_a',
                tag: 'Rental Unit A',
                amount: 180000,
                deposit: 30000,
              },
            ],
          },
          liabilities: [{ id: 'liabilities_fixture_mortgage', tag: 'Mortgage', amount: 150000 }],
        },
        { properties: [{ tag: 'Rental Unit A', amount: 800 }] },
      );
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.assets.cash).toBe(800000);
      expect(response.body.assets.shares).toBe(415000);
      expect(response.body.assets.investments).toBe(21000000);
      expect(response.body.assets.properties).toBe(80000);
      expect(response.body.liabilities.debts).toBe(15000000);
      expect(response.body.assets.total).toBe(22295000);
      expect(response.body.equity).toBe(7295000);
      expect(response.body.netWorth).toBe(7295000);
    });

    it('rejects requests without the reports:r scope', async () => {
      const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `write-not-reports-balance-${Date.now()}`,
        scopes: ['transactions:w'],
      });
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${writeOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps balance-sheet totals isolated to the authenticated user document', async () => {
      const token = await reportsToken();
      await setBalanceSheetData(
        firstUser.userId,
        { asset: { assets: [{ id: 'assets_fixture_own', tag: 'Own asset', amount: 1000 }] } },
        {},
      );
      await setBalanceSheetData(
        secondUser.userId,
        {
          asset: {
            assets: [{ id: 'assets_fixture_other', tag: 'Only second user asset', amount: 999900 }],
          },
        },
        {},
      );
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.assets.cash).toBe(100000);
    });
  });

  describe('GET /reports/kpis', () => {
    async function reportsToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `reports-agent-${Date.now()}-${Math.random()}`,
        scopes: ['reports:r'],
      });
      return created.body.token;
    }

    async function setSubscriptions(userId, subscriptions) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.subscriptions = subscriptions;
      await usersDb.insert(doc);
    }

    it('computes savings-rate and fixed-cost ratios plus top categories for the requested period', async () => {
      const token = await reportsToken();
      await setSubscriptions(firstUser.userId, [
        {
          id: `subscriptions_kpi_fixture_${Date.now()}`,
          title: 'Netflix',
          category: '@KpiNetflix',
          amount: -1000000,
        },
      ]);
      const before = await request(app)
        .get('/api/v1/reports/kpis?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Income',
        amountMinor: 20000000,
        date: '2026-09-05',
        time: '09:00',
        category: '@Kpi salary',
        comment: '',
      });
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -1000000,
        date: '2026-09-06',
        time: '09:00',
        category: '@KpiNetflix',
        comment: '',
      });
      const after = await request(app)
        .get('/api/v1/reports/kpis?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(200);
      expect(after.body.ratios.savingsRatePercent).not.toBe(before.body.ratios.savingsRatePercent);
      // Amounts here are deliberately much larger than any other test's fixture data in this
      // file (which shares firstUser's account and period=year spans it all), so this
      // transaction is guaranteed to rank in the top-5-by-amount cap regardless of test order.
      expect(after.body.topExpenses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'KpiNetflix', amountMinor: 1000000 }),
        ]),
      );
      expect(after.body.topIncomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: 'Kpi salary', amountMinor: 20000000 }),
        ]),
      );
    });

    it('diverges the dashboard savings rate from the statement savings rate on a Mojo-tagged expense', async () => {
      const token = await reportsToken();
      await sessionRequest('post', '/api/v1/transactions').send({
        account: 'Daily',
        amountMinor: -5000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Mojo',
        comment: '',
      });
      const response = await request(app)
        .get('/api/v1/reports/kpis?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.dashboardSavingsRatePercent).not.toBe(
        response.body.ratios.savingsRatePercent,
      );
    });

    it('rejects an invalid period value', async () => {
      const token = await reportsToken();
      const response = await request(app)
        .get('/api/v1/reports/kpis?period=fortnight')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the reports:r scope', async () => {
      const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `write-not-reports-kpis-${Date.now()}`,
        scopes: ['transactions:w'],
      });
      const response = await request(app)
        .get('/api/v1/reports/kpis')
        .set('Authorization', `Bearer ${writeOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps kpi totals isolated to the authenticated user document', async () => {
      const token = await reportsToken();
      await sessionRequest('post', '/api/v1/transactions', secondUser.token).send({
        account: 'Income',
        amountMinor: 999900,
        date: '2026-09-06',
        time: '09:00',
        category: '@Only second user kpi',
        comment: '',
      });
      const response = await request(app)
        .get('/api/v1/reports/kpis?period=year&offset=0')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.topIncomes).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ category: 'Only second user kpi' })]),
      );
    });
  });

  describe('GET /reports/fire-coverage', () => {
    // A dedicated, freshly-registered user per test (rather than firstUser/secondUser) — this
    // report averages over ALL historical months with no period/offset scoping, so it's uniquely
    // sensitive to fixture pollution from every other describe block in this file that posts
    // Daily/Splurge/Smile/Fire-account transactions against firstUser/secondUser.
    async function freshReportsUser() {
      const user = await registerTestUser(`_fire_coverage_${Date.now()}_${Math.random()}`);
      const created = await request(app)
        .post('/api/v1/auth/tokens')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          name: `fire-coverage-agent-${Date.now()}-${Math.random()}`,
          scopes: ['reports:r'],
        });
      return { ...user, patToken: created.body.token };
    }

    async function setMojoAmount(userId, amountMinor) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.mojo = { ...(doc.data.mojo || {}), amount: amountMinor / 100 };
      await usersDb.insert(doc);
    }

    function monthsAgoDate(months, day = 15) {
      const d = new Date();
      d.setDate(1); // avoid month-end rollover (e.g. day 31 -> a shorter month)
      d.setMonth(d.getMonth() - months);
      d.setDate(day);
      return d.toISOString().slice(0, 10);
    }

    it('divides the Mojo reserve by the average of historical months with expense-account spending, excluding the current month', async () => {
      const user = await freshReportsUser();
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Daily',
          amountMinor: -10000,
          date: monthsAgoDate(1),
          time: '09:00',
          category: '@Food',
          comment: '',
        });
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Splurge',
          amountMinor: -20000,
          date: monthsAgoDate(2),
          time: '09:00',
          category: '@Hobby',
          comment: '',
        });
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Daily',
          amountMinor: -99999,
          date: monthsAgoDate(0),
          time: '09:00',
          category: '@Food',
          comment: '',
        });
      // Set after every transaction write — `data.mojo.amount` is fully derived from
      // transaction history on each POST (transaction-derived-state.js), so setting it
      // beforehand would just get overwritten back to 0 (no @Mojo-tagged transactions here).
      await setMojoAmount(user.userId, 45000);
      const response = await request(app)
        .get('/api/v1/reports/fire-coverage')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        coverageRatio: 3,
        mojoAmountMinor: 45000,
        averageMonthlyExpensesMinor: 15000,
        monthsConsidered: 2,
      });
    });

    it('excludes an inter-account transfer, unlike the original UI gauge', async () => {
      const user = await freshReportsUser();
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Daily',
          amountMinor: -10000,
          date: monthsAgoDate(1),
          time: '09:00',
          category: '@Food',
          comment: '',
        });
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Smile',
          amountMinor: -20000,
          date: monthsAgoDate(1),
          time: '09:00',
          category: 'Smile',
          comment: '',
        });
      await setMojoAmount(user.userId, 10000);
      const response = await request(app)
        .get('/api/v1/reports/fire-coverage')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.status).toBe(200);
      expect(response.body.averageMonthlyExpensesMinor).toBe(10000);
    });

    it('returns a null coverageRatio, not a fabricated ratio, for a user with no expense history', async () => {
      const user = await freshReportsUser();
      await setMojoAmount(user.userId, 50000);
      const response = await request(app)
        .get('/api/v1/reports/fire-coverage')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        coverageRatio: null,
        mojoAmountMinor: 50000,
        averageMonthlyExpensesMinor: 0,
        monthsConsidered: 0,
      });
    });

    it('rejects requests without the reports:r scope', async () => {
      const user = await freshReportsUser();
      const writeOnly = await request(app)
        .post('/api/v1/auth/tokens')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          name: `write-not-reports-fire-coverage-${Date.now()}`,
          scopes: ['transactions:w'],
        });
      const response = await request(app)
        .get('/api/v1/reports/fire-coverage')
        .set('Authorization', `Bearer ${writeOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps fire-coverage figures isolated to the authenticated user document', async () => {
      const user = await freshReportsUser();
      const other = await freshReportsUser();
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${other.token}`)
        .send({
          account: 'Daily',
          amountMinor: -50000,
          date: monthsAgoDate(1),
          time: '09:00',
          category: '@Only other user expense',
          comment: '',
        });
      await setMojoAmount(user.userId, 10000);
      await setMojoAmount(other.userId, 999900);
      const response = await request(app)
        .get('/api/v1/reports/fire-coverage')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.status).toBe(200);
      expect(response.body.mojoAmountMinor).toBe(10000);
      expect(response.body.monthsConsidered).toBe(0);
    });
  });

  describe('GET/PUT /mojo', () => {
    async function mojoToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `mojo-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function setMojo(userId, mojo) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.mojo = mojo;
      await usersDb.insert(doc);
    }

    it('computes status from the stored Mojo balance', async () => {
      const { token } = await mojoToken(['mojo:r']);
      await setMojo(firstUser.userId, { amount: 1500, target: 2000 });
      const response = await request(app)
        .get('/api/v1/mojo')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        amountMinor: 150000,
        targetMinor: 200000,
        remainingMinor: 50000,
        percentFilled: 75,
      });
    });

    it('updates the target, rebuilds the balance from transactions, reports effects, and audit logs the write', async () => {
      const { token, tokenId } = await mojoToken(['mojo:r', 'mojo:w']);
      await setMojo(firstUser.userId, { amount: 1500, target: 2000 });
      const response = await request(app)
        .put('/api/v1/mojo')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMinor: 300000 });
      expect(response.status).toBe(200);
      expect(response.body.targetMinor).toBe(300000);
      expect(response.body.amountMinor).toBeLessThanOrEqual(300000);
      expect(response.body.effects).toHaveProperty('mojo');
      const reread = await request(app).get('/api/v1/mojo').set('Authorization', `Bearer ${token}`);
      expect(reread.body.amountMinor).toBe(response.body.amountMinor);
      const stored = await getUsersDb().get(firstUser.userId);
      expect(stored.data.mojo.target).toBe(3000);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'mojo',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'PUT' }),
        ]),
      );
    });

    it('rejects a non-positive or non-integer targetMinor', async () => {
      const { token } = await mojoToken(['mojo:w']);
      for (const targetMinor of [0, -100, 1.5, 'a lot']) {
        const response = await request(app)
          .put('/api/v1/mojo')
          .set('Authorization', `Bearer ${token}`)
          .send({ targetMinor });
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('validation_invalid');
      }
    });

    it('rejects GET without mojo:r and PUT without mojo:w', async () => {
      const { token: readOnly } = await mojoToken(['mojo:r']);
      const putResponse = await request(app)
        .put('/api/v1/mojo')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ targetMinor: 100000 });
      expect(putResponse.status).toBe(403);
      expect(putResponse.body.code).toBe('scope_insufficient');

      const { token: writeOnly } = await mojoToken(['mojo:w']);
      const getResponse = await request(app)
        .get('/api/v1/mojo')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps Mojo status isolated to the authenticated user document', async () => {
      const { token } = await mojoToken(['mojo:r']);
      await setMojo(firstUser.userId, { amount: 1000, target: 2000 });
      await setMojo(secondUser.userId, { amount: 999900, target: 999900 });
      const response = await request(app)
        .get('/api/v1/mojo')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.amountMinor).toBe(100000);
    });
  });

  describe('GET/POST /smile', () => {
    async function smileToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `smile-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    // Appends rather than overwrites data.smile, so this stays safe to call
    // from more than one test in this block regardless of execution order —
    // it never clobbers a project another test already created via POST.
    async function addSmileProjects(userId, projects) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.smile = [...(doc.data.smile || []), ...projects];
      await usersDb.insert(doc);
    }

    it('lists Smile projects with computed bucket totals', async () => {
      const { token } = await smileToken(['smile:r']);
      await addSmileProjects(firstUser.userId, [
        {
          id: 'smile_list_1',
          title: 'Vacation',
          sub: '',
          phase: 'saving',
          description: '',
          buckets: [{ id: 'b1', title: 'Flights', target: 1500, amount: 200 }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const response = await request(app)
        .get('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      const project = response.body.projects.find((p) => p.id === 'smile_list_1');
      expect(project.buckets[0]).toMatchObject({ targetMinor: 150000, amountMinor: 20000 });
      expect(project.totals).toMatchObject({ targetMinor: 150000, amountMinor: 20000 });
    });

    it('creates a project with a default bucket from targetMinor and audit logs the write', async () => {
      const { token, tokenId } = await smileToken(['smile:w']);
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Integration Vacation ${Date.now()}`, targetMinor: 150000 });
      expect(response.status).toBe(201);
      expect(response.body.buckets).toHaveLength(1);
      expect(response.body.totals.targetMinor).toBe(150000);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'smile',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: response.body.id,
          }),
        ]),
      );
    });

    it('creates a project with custom buckets, links, action items, and notes', async () => {
      const { token } = await smileToken(['smile:w']);
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Integration Custom ${Date.now()}`,
          buckets: [
            { title: 'Flights', targetMinor: 150000 },
            { title: 'Hotel', targetMinor: 80000 },
          ],
          links: [{ label: 'Trip site', url: 'https://example.com' }],
          actionItems: [{ text: 'Book flights', priority: 'high' }],
          notes: [{ text: 'Remember passports' }],
        });
      expect(response.status).toBe(201);
      expect(response.body.buckets.map((b) => b.title)).toEqual(['Flights', 'Hotel']);
      expect(response.body.totals.targetMinor).toBe(230000);
      expect(response.body.links).toEqual([{ label: 'Trip site', url: 'https://example.com' }]);
      expect(response.body.actionItems).toEqual([
        { text: 'Book flights', done: false, priority: 'high' },
      ]);
      expect(response.body.notes).toEqual([
        { text: 'Remember passports', createdAt: expect.any(String) },
      ]);
    });

    it('rejects a project with neither targetMinor nor buckets', async () => {
      const { token } = await smileToken(['smile:w']);
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Integration No Target ${Date.now()}` });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a bucket whose title collides with the default target bucket', async () => {
      const { token } = await smileToken(['smile:w']);
      const title = `Integration Collision ${Date.now()}`;
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, targetMinor: 100000, buckets: [{ title, targetMinor: 50000 }] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects two explicit buckets sharing a title (case-insensitively)', async () => {
      const { token } = await smileToken(['smile:w']);
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Integration Bucket Collision ${Date.now()}`,
          buckets: [
            { title: 'Flights', targetMinor: 50000 },
            { title: 'FLIGHTS', targetMinor: 30000 },
          ],
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a title that exactly matches an existing project', async () => {
      const { token } = await smileToken(['smile:w']);
      const title = `Integration Dup ${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, targetMinor: 100000 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, targetMinor: 50000 });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('rejects GET without smile:r and POST without smile:w', async () => {
      const { token: readOnly } = await smileToken(['smile:r']);
      const postResponse = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ title: 'Should be rejected', targetMinor: 1000 });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');

      const { token: writeOnly } = await smileToken(['smile:w']);
      const getResponse = await request(app)
        .get('/api/v1/smile')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps Smile projects isolated to the authenticated user document', async () => {
      const { token } = await smileToken(['smile:r']);
      await addSmileProjects(secondUser.userId, [
        {
          id: 'smile_second_user',
          title: 'Only second user project',
          sub: '',
          phase: 'idea',
          description: '',
          buckets: [{ id: 'b1', title: 'Goal', target: 999900, amount: 0 }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const response = await request(app)
        .get('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.projects).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'smile_second_user' })]),
      );
    });
  });

  describe('GET/PATCH/DELETE /smile/:id', () => {
    async function smileToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `smile-id-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function createProject(token, overrides = {}) {
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Smile Id Test ${Date.now()}-${Math.random()}`,
          targetMinor: 100000,
          ...overrides,
        });
      expect(response.status).toBe(201);
      return response.body;
    }

    it('gets a single project by id', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .get(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.id);
    });

    it('returns 404 for an id that does not exist', async () => {
      const { token } = await smileToken(['smile:r']);
      const response = await request(app)
        .get('/api/v1/smile/smile_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('updates only the fields provided and audit logs the write', async () => {
      const { token, tokenId } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'ready' });
      expect(response.status).toBe(200);
      expect(response.body.phase).toBe('ready');
      expect(response.body.title).toBe(created.title);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'smile',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.id,
          }),
        ]),
      );
    });

    it('edits buckets by id and guards removing or deleting money', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token, { title: `Smile Guard ${Date.now()}` });
      const bucket = created.buckets[0];
      await request(app)
        .post(`/api/v1/smile/${created.id}/contribute`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 1000 })
        .expect(201);

      const edited = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          bucketsUpdate: [{ id: bucket.id, notes: 'Main pot' }],
          bucketsAdd: [{ title: 'Extra', targetMinor: 5000 }],
        });
      expect(edited.status).toBe(200);
      expect(edited.body.buckets[0]).toMatchObject({ notes: 'Main pot', amountMinor: 1000 });

      const setAmount = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bucketsUpdate: [{ id: bucket.id, amountMinor: 5 }] });
      expect(setAmount.status).toBe(400);

      const removeFunded = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bucketsRemove: [bucket.id] });
      expect(removeFunded.status).toBe(400);

      const deleteFunded = await request(app)
        .delete(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteFunded.status).toBe(400);
      const forced = await request(app)
        .delete(`/api/v1/smile/${created.id}?force=true`)
        .set('Authorization', `Bearer ${token}`);
      expect(forced.status).toBe(200);
    });

    it('contributes through a typed action, capped and reported, and lists the project transactions', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token, { title: `Smile Contribute ${Date.now()}` });
      const bucket = created.buckets[0];

      const contributed = await request(app)
        .post(`/api/v1/smile/${created.id}/contribute`)
        .set('Authorization', `Bearer ${token}`)
        .send({ buckets: [{ bucketId: bucket.id, amountMinor: bucket.targetMinor + 500 }] });
      expect(contributed.status).toBe(201);
      expect(contributed.body.appliedMinor).toBe(bucket.targetMinor);
      expect(contributed.body.project.buckets[0].amountMinor).toBe(bucket.targetMinor);
      expect(contributed.body.effects.smile).toHaveLength(1);

      const listed = await request(app)
        .get(`/api/v1/smile/${created.id}/transactions`)
        .set('Authorization', `Bearer ${token}`);
      expect(listed.body.transactions.map((t) => t.id)).toEqual([contributed.body.transaction.id]);

      const full = await request(app)
        .post(`/api/v1/smile/${created.id}/contribute`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 100 });
      expect(full.status).toBe(400);

      const handTagged = await request(app)
        .post(`/api/v1/smile/${created.id}/contribute`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 100, comment: '#bucket:X:1.00' });
      expect(handTagged.status).toBe(400);
    });

    it('replaces buckets wholesale, preserving an echoed-back id and minting one for a new bucket', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token, { title: `Smile Bucket Patch ${Date.now()}` });
      const existingBucketId = created.buckets[0].id;
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          buckets: [
            {
              id: existingBucketId,
              title: created.buckets[0].title,
              targetMinor: 200000,
            },
            { title: 'New Bucket', targetMinor: 30000 },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.buckets[0]).toMatchObject({
        id: existingBucketId,
        targetMinor: 200000,
        amountMinor: 0,
      });
      expect(response.body.buckets[1].id).not.toBe(existingBucketId);
      expect(response.body.totals.targetMinor).toBe(230000);

      const withAmount = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ buckets: [{ title: 'X', targetMinor: 100, amountMinor: 50 }] });
      expect(withAmount.status).toBe(400);
    });

    it('rejects an unrecognized field', async () => {
      const { token } = await smileToken(['smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notAField: true });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a title change that collides with another existing project', async () => {
      const { token } = await smileToken(['smile:w']);
      const first = await createProject(token, { title: `Smile Collision A ${Date.now()}` });
      const second = await createProject(token, { title: `Smile Collision B ${Date.now()}` });
      const response = await request(app)
        .patch(`/api/v1/smile/${second.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: first.title });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a bucket patch with two buckets sharing a title', async () => {
      const { token } = await smileToken(['smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          buckets: [
            { title: 'Flights', targetMinor: 100000 },
            { title: 'FLIGHTS', targetMinor: 50000 },
          ],
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects an actionItems patch where an item omits done', async () => {
      const { token } = await smileToken(['smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actionItems: [{ text: 'Book flights' }] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a bucket patch requesting the same existing id twice', async () => {
      const { token } = await smileToken(['smile:w']);
      const created = await createProject(token);
      const existingBucketId = created.buckets[0].id;
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          buckets: [
            { id: existingBucketId, title: 'Flights', targetMinor: 100000 },
            { id: existingBucketId, title: 'Other', targetMinor: 50000 },
          ],
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('stamps a completion date when a patch moves phase to completed without one already set', async () => {
      const { token } = await smileToken(['smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'completed' });
      expect(response.status).toBe(200);
      expect(response.body.completionDate).toEqual(expect.any(String));
    });

    it('returns 404 when patching an id that does not exist', async () => {
      const { token } = await smileToken(['smile:w']);
      const response = await request(app)
        .patch('/api/v1/smile/smile_does_not_exist')
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'ready' });
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('deletes a project and subsequently 404s on it, audit logging the write', async () => {
      const { token, tokenId } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const deleteResponse = await request(app)
        .delete(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toEqual({ id: created.id });
      const getResponse = await request(app)
        .get(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'smile',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.id,
          }),
        ]),
      );
    });

    it('returns 404 when deleting an id that does not exist', async () => {
      const { token } = await smileToken(['smile:w']);
      const response = await request(app)
        .delete('/api/v1/smile/smile_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('rejects GET without smile:r, PATCH/DELETE without smile:w', async () => {
      const { token: writeOnly } = await smileToken(['smile:w']);
      const created = await createProject(writeOnly);

      const { token: readOnly } = await smileToken(['smile:r']);
      const getResponse = await request(app)
        .get(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${readOnly}`);
      expect(getResponse.status).toBe(200);

      const patchResponse = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ phase: 'ready' });
      expect(patchResponse.status).toBe(403);
      expect(patchResponse.body.code).toBe('scope_insufficient');

      const deleteResponse = await request(app)
        .delete(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${readOnly}`);
      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.code).toBe('scope_insufficient');
    });

    it("does not let one user read, patch, or delete another user's Smile project", async () => {
      const { token: ownerToken } = await smileToken(['smile:w']);
      const created = await createProject(ownerToken);

      const otherUserSmileToken = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `smile-cross-user-${Date.now()}`,
        scopes: ['smile:r', 'smile:w'],
      });
      const otherToken = otherUserSmileToken.body.token;

      const getResponse = await request(app)
        .get(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(getResponse.status).toBe(404);

      const patchResponse = await request(app)
        .patch(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ phase: 'ready' });
      expect(patchResponse.status).toBe(404);

      const deleteResponse = await request(app)
        .delete(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(deleteResponse.status).toBe(404);
    });
  });

  describe('POST /smile/:id/payment-plan', () => {
    async function smileToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `smile-plan-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function createProject(token, overrides = {}) {
      const response = await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Smile Plan Test ${Date.now()}-${Math.random()}`,
          targetMinor: 300000,
          ...overrides,
        });
      expect(response.status).toBe(201);
      return response.body;
    }

    const planBody = {
      planTitle: 'Flight Fund',
      startDate: '2026-01-01',
      targetDate: '2026-04-01',
      frequency: 'monthly',
      account: 'Daily',
    };

    it('calculates and persists a new payment plan, and audit logs the write', async () => {
      const { token, tokenId } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send(planBody);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'planned',
        projectType: 'smile',
        projectTitle: created.title,
        amountMinor: 100000, // 300000 missing / 3 monthly periods
        category: `@${created.title}`,
      });
      expect(response.body.id).toMatch(/^plan_/);

      const project = await request(app)
        .get(`/api/v1/smile/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(project.body.plannedSubscriptions).toHaveLength(1);
      expect(project.body.plannedSubscriptions[0].id).toBe(response.body.id);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'smile',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.id,
          }),
        ]),
      );
    });

    it('uses the manual amount when provided', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, manualAmountMinor: 50000 });
      expect(response.status).toBe(201);
      expect(response.body.amountMinor).toBe(50000);
      expect(response.body.manuallyAdjusted).toBe(true);
    });

    it('returns 404 for a project that does not exist', async () => {
      const { token } = await smileToken(['smile:w']);
      const response = await request(app)
        .post('/api/v1/smile/smile_does_not_exist/payment-plan')
        .set('Authorization', `Bearer ${token}`)
        .send(planBody);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('rejects a plan whose target date is not after its start date', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, startDate: '2026-04-01', targetDate: '2026-01-01' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a selectedBucketIds entry that does not match any bucket on the project', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, selectedBucketIds: ['not-a-real-bucket'] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects an invalid frequency', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, frequency: 'daily' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the smile:w scope', async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const { token: readOnly } = await smileToken(['smile:r']);
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${readOnly}`)
        .send(planBody);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it("keeps payment plan creation isolated to the caller's own project", async () => {
      const { token } = await smileToken(['smile:r', 'smile:w']);
      const created = await createProject(token);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `smile-plan-other-${Date.now()}`,
        scopes: ['smile:w'],
      });
      const response = await request(app)
        .post(`/api/v1/smile/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send(planBody);
      expect(response.status).toBe(404);
    });
  });

  describe('GET/POST /fire', () => {
    async function fireToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `fire-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    // Appends rather than overwrites data.fire, so this stays safe to call
    // from more than one test in this block regardless of execution order —
    // it never clobbers a project another test already created via POST.
    async function addFireProjects(userId, projects) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.fire = [...(doc.data.fire || []), ...projects];
      await usersDb.insert(doc);
    }

    it('lists Fire projects with computed bucket totals', async () => {
      const { token } = await fireToken(['fire:r']);
      await addFireProjects(firstUser.userId, [
        {
          id: 'fire_list_1',
          title: 'Vacation',
          sub: '',
          phase: 'saving',
          description: '',
          buckets: [{ id: 'b1', title: 'Flights', target: 1500, amount: 200 }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const response = await request(app)
        .get('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      const project = response.body.projects.find((p) => p.id === 'fire_list_1');
      expect(project.buckets[0]).toMatchObject({ targetMinor: 150000, amountMinor: 20000 });
      expect(project.totals).toMatchObject({ targetMinor: 150000, amountMinor: 20000 });
    });

    it('creates a project with a default bucket from targetMinor and audit logs the write', async () => {
      const { token, tokenId } = await fireToken(['fire:w']);
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Integration Vacation ${Date.now()}`, targetMinor: 150000 });
      expect(response.status).toBe(201);
      expect(response.body.buckets).toHaveLength(1);
      expect(response.body.totals.targetMinor).toBe(150000);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'fire',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: response.body.id,
          }),
        ]),
      );
    });

    it('creates a project with custom buckets, links, action items, and notes', async () => {
      const { token } = await fireToken(['fire:w']);
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Integration Custom ${Date.now()}`,
          buckets: [
            { title: 'Flights', targetMinor: 150000 },
            { title: 'Hotel', targetMinor: 80000 },
          ],
          links: [{ label: 'Trip site', url: 'https://example.com' }],
          actionItems: [{ text: 'Book flights', priority: 'high' }],
          notes: [{ text: 'Remember passports' }],
        });
      expect(response.status).toBe(201);
      expect(response.body.buckets.map((b) => b.title)).toEqual(['Flights', 'Hotel']);
      expect(response.body.totals.targetMinor).toBe(230000);
      expect(response.body.links).toEqual([{ label: 'Trip site', url: 'https://example.com' }]);
      expect(response.body.actionItems).toEqual([
        { text: 'Book flights', done: false, priority: 'high' },
      ]);
      expect(response.body.notes).toEqual([
        { text: 'Remember passports', createdAt: expect.any(String) },
      ]);
    });

    it('rejects a project with neither targetMinor nor buckets', async () => {
      const { token } = await fireToken(['fire:w']);
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Integration No Target ${Date.now()}` });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a bucket whose title collides with the default target bucket', async () => {
      const { token } = await fireToken(['fire:w']);
      const title = `Integration Collision ${Date.now()}`;
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, targetMinor: 100000, buckets: [{ title, targetMinor: 50000 }] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects two explicit buckets sharing a title (case-insensitively)', async () => {
      const { token } = await fireToken(['fire:w']);
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Integration Bucket Collision ${Date.now()}`,
          buckets: [
            { title: 'Flights', targetMinor: 50000 },
            { title: 'FLIGHTS', targetMinor: 30000 },
          ],
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a title that exactly matches an existing project', async () => {
      const { token } = await fireToken(['fire:w']);
      const title = `Integration Dup ${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, targetMinor: 100000 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, targetMinor: 50000 });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('rejects GET without fire:r and POST without fire:w', async () => {
      const { token: readOnly } = await fireToken(['fire:r']);
      const postResponse = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ title: 'Should be rejected', targetMinor: 1000 });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');

      const { token: writeOnly } = await fireToken(['fire:w']);
      const getResponse = await request(app)
        .get('/api/v1/fire')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps Fire projects isolated to the authenticated user document', async () => {
      const { token } = await fireToken(['fire:r']);
      await addFireProjects(secondUser.userId, [
        {
          id: 'fire_second_user',
          title: 'Only second user project',
          sub: '',
          phase: 'idea',
          description: '',
          buckets: [{ id: 'b1', title: 'Goal', target: 999900, amount: 0 }],
          links: [],
          actionItems: [],
          notes: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      const response = await request(app)
        .get('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.projects).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'fire_second_user' })]),
      );
    });
  });

  describe('GET/PATCH/DELETE /fire/:id', () => {
    async function fireToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `fire-id-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function createProject(token, overrides = {}) {
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Fire Id Test ${Date.now()}-${Math.random()}`,
          targetMinor: 100000,
          ...overrides,
        });
      expect(response.status).toBe(201);
      return response.body;
    }

    it('gets a single project by id', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .get(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.id);
    });

    it('returns 404 for an id that does not exist', async () => {
      const { token } = await fireToken(['fire:r']);
      const response = await request(app)
        .get('/api/v1/fire/fire_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('updates only the fields provided and audit logs the write', async () => {
      const { token, tokenId } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'ready' });
      expect(response.status).toBe(200);
      expect(response.body.phase).toBe('ready');
      expect(response.body.title).toBe(created.title);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'fire',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.id,
          }),
        ]),
      );
    });

    it('replaces buckets wholesale, preserving an echoed-back id and minting one for a new bucket', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token, { title: `Fire Bucket Patch ${Date.now()}` });
      const existingBucketId = created.buckets[0].id;
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          buckets: [
            {
              id: existingBucketId,
              title: created.buckets[0].title,
              targetMinor: 200000,
            },
            { title: 'New Bucket', targetMinor: 30000 },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.buckets[0]).toMatchObject({
        id: existingBucketId,
        targetMinor: 200000,
        amountMinor: 0,
      });
      expect(response.body.buckets[1].id).not.toBe(existingBucketId);
      expect(response.body.totals.targetMinor).toBe(230000);

      const withAmount = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ buckets: [{ title: 'X', targetMinor: 100, amountMinor: 50 }] });
      expect(withAmount.status).toBe(400);
    });

    it('rejects an unrecognized field', async () => {
      const { token } = await fireToken(['fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notAField: true });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a title change that collides with another existing project', async () => {
      const { token } = await fireToken(['fire:w']);
      const first = await createProject(token, { title: `Fire Collision A ${Date.now()}` });
      const second = await createProject(token, { title: `Fire Collision B ${Date.now()}` });
      const response = await request(app)
        .patch(`/api/v1/fire/${second.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: first.title });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a bucket patch with two buckets sharing a title', async () => {
      const { token } = await fireToken(['fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          buckets: [
            { title: 'Flights', targetMinor: 100000 },
            { title: 'FLIGHTS', targetMinor: 50000 },
          ],
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects an actionItems patch where an item omits done', async () => {
      const { token } = await fireToken(['fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actionItems: [{ text: 'Book flights' }] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a bucket patch requesting the same existing id twice', async () => {
      const { token } = await fireToken(['fire:w']);
      const created = await createProject(token);
      const existingBucketId = created.buckets[0].id;
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          buckets: [
            { id: existingBucketId, title: 'Flights', targetMinor: 100000 },
            { id: existingBucketId, title: 'Other', targetMinor: 50000 },
          ],
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('stamps a completion date when a patch moves phase to completed without one already set', async () => {
      const { token } = await fireToken(['fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'completed' });
      expect(response.status).toBe(200);
      expect(response.body.completionDate).toEqual(expect.any(String));
    });

    it('returns 404 when patching an id that does not exist', async () => {
      const { token } = await fireToken(['fire:w']);
      const response = await request(app)
        .patch('/api/v1/fire/fire_does_not_exist')
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'ready' });
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('deletes a project and subsequently 404s on it, audit logging the write', async () => {
      const { token, tokenId } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const deleteResponse = await request(app)
        .delete(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toEqual({ id: created.id });
      const getResponse = await request(app)
        .get(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'fire',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.id,
          }),
        ]),
      );
    });

    it('returns 404 when deleting an id that does not exist', async () => {
      const { token } = await fireToken(['fire:w']);
      const response = await request(app)
        .delete('/api/v1/fire/fire_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('rejects GET without fire:r, PATCH/DELETE without fire:w', async () => {
      const { token: writeOnly } = await fireToken(['fire:w']);
      const created = await createProject(writeOnly);

      const { token: readOnly } = await fireToken(['fire:r']);
      const getResponse = await request(app)
        .get(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${readOnly}`);
      expect(getResponse.status).toBe(200);

      const patchResponse = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ phase: 'ready' });
      expect(patchResponse.status).toBe(403);
      expect(patchResponse.body.code).toBe('scope_insufficient');

      const deleteResponse = await request(app)
        .delete(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${readOnly}`);
      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.code).toBe('scope_insufficient');
    });

    it("does not let one user read, patch, or delete another user's Fire project", async () => {
      const { token: ownerToken } = await fireToken(['fire:w']);
      const created = await createProject(ownerToken);

      const otherUserFireToken = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `fire-cross-user-${Date.now()}`,
        scopes: ['fire:r', 'fire:w'],
      });
      const otherToken = otherUserFireToken.body.token;

      const getResponse = await request(app)
        .get(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(getResponse.status).toBe(404);

      const patchResponse = await request(app)
        .patch(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ phase: 'ready' });
      expect(patchResponse.status).toBe(404);

      const deleteResponse = await request(app)
        .delete(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(deleteResponse.status).toBe(404);
    });
  });

  describe('POST /fire/:id/payment-plan', () => {
    async function fireToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `fire-plan-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function createProject(token, overrides = {}) {
      const response = await request(app)
        .post('/api/v1/fire')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Fire Plan Test ${Date.now()}-${Math.random()}`,
          targetMinor: 300000,
          ...overrides,
        });
      expect(response.status).toBe(201);
      return response.body;
    }

    const planBody = {
      planTitle: 'Flight Fund',
      startDate: '2026-01-01',
      targetDate: '2026-04-01',
      frequency: 'monthly',
      account: 'Daily',
    };

    it('calculates and persists a new payment plan, and audit logs the write', async () => {
      const { token, tokenId } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send(planBody);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: 'planned',
        projectType: 'fire',
        projectTitle: created.title,
        amountMinor: 100000, // 300000 missing / 3 monthly periods
        category: `@${created.title}`,
      });
      expect(response.body.id).toMatch(/^plan_/);

      const project = await request(app)
        .get(`/api/v1/fire/${created.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(project.body.plannedSubscriptions).toHaveLength(1);
      expect(project.body.plannedSubscriptions[0].id).toBe(response.body.id);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'fire',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.id,
          }),
        ]),
      );
    });

    it('uses the manual amount when provided', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, manualAmountMinor: 50000 });
      expect(response.status).toBe(201);
      expect(response.body.amountMinor).toBe(50000);
      expect(response.body.manuallyAdjusted).toBe(true);
    });

    it('returns 404 for a project that does not exist', async () => {
      const { token } = await fireToken(['fire:w']);
      const response = await request(app)
        .post('/api/v1/fire/fire_does_not_exist/payment-plan')
        .set('Authorization', `Bearer ${token}`)
        .send(planBody);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('rejects a plan whose target date is not after its start date', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, startDate: '2026-04-01', targetDate: '2026-01-01' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a selectedBucketIds entry that does not match any bucket on the project', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, selectedBucketIds: ['not-a-real-bucket'] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects an invalid frequency', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...planBody, frequency: 'daily' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the fire:w scope', async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const { token: readOnly } = await fireToken(['fire:r']);
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${readOnly}`)
        .send(planBody);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it("keeps payment plan creation isolated to the caller's own project", async () => {
      const { token } = await fireToken(['fire:r', 'fire:w']);
      const created = await createProject(token);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `fire-plan-other-${Date.now()}`,
        scopes: ['fire:w'],
      });
      const response = await request(app)
        .post(`/api/v1/fire/${created.id}/payment-plan`)
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send(planBody);
      expect(response.status).toBe(404);
    });
  });

  describe('GET/POST /balance/assets and GET/PATCH/DELETE /balance/assets/:id', () => {
    async function balanceToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `balance-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function seedShare(userId, share) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.balance = doc.data.balance || {};
      doc.data.balance.asset = doc.data.balance.asset || {};
      doc.data.balance.asset.shares = [...(doc.data.balance.asset.shares || []), share];
      await usersDb.insert(doc);
    }

    it('creates an asset and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Car ${Date.now()}`, amountMinor: 800000 });
      expect(created.status).toBe(201);
      expect(created.body.amountMinor).toBe(800000);
      expect(created.body.id).toMatch(/^assets_/);

      const list = await request(app)
        .get('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.assets).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_assets',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('defaults amountMinor to 0 when omitted', async () => {
      const { token } = await balanceToken(['balance:w']);
      const response = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `No Amount ${Date.now()}` });
      expect(response.status).toBe(201);
      expect(response.body.amountMinor).toBe(0);
    });

    it('gets a single asset by id and returns 404 for one that does not exist', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Get Test ${Date.now()}`, amountMinor: 100 });
      const found = await request(app)
        .get(`/api/v1/balance/assets/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/balance/assets/assets_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('updates only the fields provided and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Patch Test ${Date.now()}`, amountMinor: 100 });
      const response = await request(app)
        .patch(`/api/v1/balance/assets/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 500 });
      expect(response.status).toBe(200);
      expect(response.body.amountMinor).toBe(500);
      expect(response.body.tag).toBe(created.body.tag);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_assets',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('deletes an asset, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Delete Test ${Date.now()}`, amountMinor: 100 });
      const response = await request(app)
        .delete(`/api/v1/balance/assets/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const getResponse = await request(app)
        .get(`/api/v1/balance/assets/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_assets',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects a tag that collides with an existing asset', async () => {
      const { token } = await balanceToken(['balance:w']);
      const tag = `Duplicate ${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 200 });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('rejects a tag that collides with an existing share', async () => {
      const { token } = await balanceToken(['balance:w']);
      const tag = `Shared Tag ${Date.now()}`;
      await seedShare(firstUser.userId, {
        id: `shares_fixture_${Date.now()}`,
        tag,
        quantity: 10,
        price: 415,
      });
      const response = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the balance:r/balance:w scopes', async () => {
      const { token: writeOnly } = await balanceToken(['balance:w']);
      const getResponse = await request(app)
        .get('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await balanceToken(['balance:r']);
      const postResponse = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ tag: 'Should Not Save', amountMinor: 1 });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps assets isolated to the authenticated user document', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `balance-other-${Date.now()}`,
        scopes: ['balance:w'],
      });
      const otherAsset = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ tag: `Only Other User Asset ${Date.now()}`, amountMinor: 999900 });
      expect(otherAsset.status).toBe(201);

      const list = await request(app)
        .get('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.assets).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherAsset.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/balance/assets/${otherAsset.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET/POST /balance/liabilities and GET/PATCH/DELETE /balance/liabilities/:id', () => {
    async function balanceToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `balance-liability-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    it('creates a liability and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tag: `Mortgage ${Date.now()}`,
          amountMinor: 15000000,
          investment: true,
          creditMinor: 5000000,
        });
      expect(created.status).toBe(201);
      expect(created.body.amountMinor).toBe(15000000);
      expect(created.body.investment).toBe(true);
      expect(created.body.creditMinor).toBe(5000000);
      expect(created.body.id).toMatch(/^liabilities_/);

      const list = await request(app)
        .get('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.liabilities).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_liabilities',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('defaults amountMinor/creditMinor to 0 and investment to false when omitted', async () => {
      const { token } = await balanceToken(['balance:w']);
      const response = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `No Amount ${Date.now()}` });
      expect(response.status).toBe(201);
      expect(response.body.amountMinor).toBe(0);
      expect(response.body.creditMinor).toBe(0);
      expect(response.body.investment).toBe(false);
    });

    it('gets a single liability by id and returns 404 for one that does not exist', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Get Test ${Date.now()}`, amountMinor: 100 });
      const found = await request(app)
        .get(`/api/v1/balance/liabilities/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/balance/liabilities/liabilities_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('updates only the fields provided and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Patch Test ${Date.now()}`, amountMinor: 100, creditMinor: 50 });
      const response = await request(app)
        .patch(`/api/v1/balance/liabilities/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ creditMinor: 25 });
      expect(response.status).toBe(200);
      expect(response.body.creditMinor).toBe(25);
      expect(response.body.amountMinor).toBe(100);
      expect(response.body.tag).toBe(created.body.tag);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_liabilities',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('deletes a liability, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Delete Test ${Date.now()}`, amountMinor: 100 });
      const response = await request(app)
        .delete(`/api/v1/balance/liabilities/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const getResponse = await request(app)
        .get(`/api/v1/balance/liabilities/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_liabilities',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects a tag that collides with an existing liability', async () => {
      const { token } = await balanceToken(['balance:w']);
      const tag = `Duplicate ${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 200 });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('does not reject a tag that collides with an Asset tag (separate namespace)', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const tag = `Shared With Asset ${Date.now()}`;
      const asset = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(asset.status).toBe(201);
      const liability = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 200 });
      expect(liability.status).toBe(201);
    });

    it('rejects requests without the balance:r/balance:w scopes', async () => {
      const { token: writeOnly } = await balanceToken(['balance:w']);
      const getResponse = await request(app)
        .get('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await balanceToken(['balance:r']);
      const postResponse = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ tag: 'Should Not Save', amountMinor: 1 });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps liabilities isolated to the authenticated user document', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `balance-liability-other-${Date.now()}`,
        scopes: ['balance:w'],
      });
      const otherLiability = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ tag: `Only Other User Liability ${Date.now()}`, amountMinor: 999900 });
      expect(otherLiability.status).toBe(201);

      const list = await request(app)
        .get('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.liabilities).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherLiability.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/balance/liabilities/${otherLiability.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET/POST /balance/investments and GET/PATCH/DELETE /balance/investments/:id', () => {
    async function balanceToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `balance-investment-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function seedProperty(userId, property) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.income = doc.data.income || {};
      doc.data.income.revenue = doc.data.income.revenue || {};
      doc.data.income.revenue.properties = [
        ...(doc.data.income.revenue.properties || []),
        property,
      ];
      await usersDb.insert(doc);
    }

    it('creates an investment and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Rental Unit ${Date.now()}`, amountMinor: 18000000, depositMinor: 3000000 });
      expect(created.status).toBe(201);
      expect(created.body.amountMinor).toBe(18000000);
      expect(created.body.depositMinor).toBe(3000000);
      expect(created.body.id).toMatch(/^investments_/);

      const list = await request(app)
        .get('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.investments).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_investments',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('defaults amountMinor/depositMinor to 0 when omitted', async () => {
      const { token } = await balanceToken(['balance:w']);
      const response = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `No Amount ${Date.now()}` });
      expect(response.status).toBe(201);
      expect(response.body.amountMinor).toBe(0);
      expect(response.body.depositMinor).toBe(0);
    });

    it('gets a single investment by id and returns 404 for one that does not exist', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Get Test ${Date.now()}`, amountMinor: 100 });
      const found = await request(app)
        .get(`/api/v1/balance/investments/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/balance/investments/investments_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('updates only the fields provided and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Patch Test ${Date.now()}`, amountMinor: 100, depositMinor: 50 });
      const response = await request(app)
        .patch(`/api/v1/balance/investments/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ depositMinor: 25 });
      expect(response.status).toBe(200);
      expect(response.body.depositMinor).toBe(25);
      expect(response.body.amountMinor).toBe(100);
      expect(response.body.tag).toBe(created.body.tag);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_investments',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('cascades a tag rename into matching income.revenue.properties entries atomically', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const originalTag = `Rental Unit ${Date.now()}-${Math.random()}`;
      // A unique amount, not a fixed one like 800 — this suite runs against a persistent,
      // never-reset test database, so a fixed amount could collide with a leftover property
      // from an earlier run and make .find() below return the wrong entry.
      const uniqueAmount = Date.now() + Math.random();
      const created = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: originalTag, amountMinor: 18000000 });
      await seedProperty(firstUser.userId, { tag: originalTag, amount: uniqueAmount });

      const newTag = `${originalTag} Renamed`;
      const response = await request(app)
        .patch(`/api/v1/balance/investments/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: newTag });
      expect(response.status).toBe(200);
      expect(response.body.tag).toBe(newTag);

      const doc = await getUsersDb().get(firstUser.userId);
      const property = doc.data.income.revenue.properties.find((p) => p.amount === uniqueAmount);
      expect(property.tag).toBe(newTag);
    });

    it('deletes an investment, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `Delete Test ${Date.now()}`, amountMinor: 100 });
      const response = await request(app)
        .delete(`/api/v1/balance/investments/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const getResponse = await request(app)
        .get(`/api/v1/balance/investments/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_investments',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects a tag that collides with an existing investment', async () => {
      const { token } = await balanceToken(['balance:w']);
      const tag = `Duplicate ${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 200 });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('rejects a tag that collides with an existing asset', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const tag = `Shared With Asset ${Date.now()}`;
      const asset = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(asset.status).toBe(201);
      const investment = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 200 });
      expect(investment.status).toBe(400);
      expect(investment.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the balance:r/balance:w scopes', async () => {
      const { token: writeOnly } = await balanceToken(['balance:w']);
      const getResponse = await request(app)
        .get('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await balanceToken(['balance:r']);
      const postResponse = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ tag: 'Should Not Save', amountMinor: 1 });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps investments isolated to the authenticated user document', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `balance-investment-other-${Date.now()}`,
        scopes: ['balance:w'],
      });
      const otherInvestment = await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ tag: `Only Other User Investment ${Date.now()}`, amountMinor: 999900 });
      expect(otherInvestment.status).toBe(201);

      const list = await request(app)
        .get('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.investments).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherInvestment.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/balance/investments/${otherInvestment.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET/POST /balance/shares and GET/PATCH/DELETE /balance/shares/:id', () => {
    async function balanceToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `balance-share-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function seedInterest(userId, interest) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.income = doc.data.income || {};
      doc.data.income.revenue = doc.data.income.revenue || {};
      doc.data.income.revenue.interests = [...(doc.data.income.revenue.interests || []), interest];
      await usersDb.insert(doc);
    }

    async function seedGrowProject(userId, growProject) {
      const usersDb = getUsersDb();
      const doc = await usersDb.get(userId);
      doc.data = doc.data || {};
      doc.data.grow = [...(doc.data.grow || []), growProject];
      await usersDb.insert(doc);
    }

    it('creates a share and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `MSFT${Date.now()}`, quantity: 10, priceMinor: 41500 });
      expect(created.status).toBe(201);
      expect(created.body.quantity).toBe(10);
      expect(created.body.priceMinor).toBe(41500);
      expect(created.body.id).toMatch(/^shares_/);

      const list = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.shares).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_shares',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('defaults quantity/priceMinor to 0 when omitted', async () => {
      const { token } = await balanceToken(['balance:w']);
      const response = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `NoAmount${Date.now()}` });
      expect(response.status).toBe(201);
      expect(response.body.quantity).toBe(0);
      expect(response.body.priceMinor).toBe(0);
    });

    it('strips every space from the tag on create', async () => {
      const { token } = await balanceToken(['balance:w']);
      const response = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `  Rental Property Fund ${Date.now()}  ` });
      expect(response.status).toBe(201);
      expect(response.body.tag).not.toMatch(/\s/);
    });

    it('gets a single share by id and returns 404 for one that does not exist', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `GetTest${Date.now()}`, quantity: 1 });
      const found = await request(app)
        .get(`/api/v1/balance/shares/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/balance/shares/shares_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('updates only the fields provided and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `PatchTest${Date.now()}`, quantity: 10, priceMinor: 100 });
      const response = await request(app)
        .patch(`/api/v1/balance/shares/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 20 });
      expect(response.status).toBe(200);
      expect(response.body.quantity).toBe(20);
      expect(response.body.priceMinor).toBe(100);
      expect(response.body.tag).toBe(created.body.tag);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_shares',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('cascades a tag rename into matching income.revenue.interests entries atomically', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const originalTag = `MSFT${Date.now()}${Math.random()}`;
      const uniqueAmount = Date.now() + Math.random();
      const created = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: originalTag, quantity: 10 });
      await seedInterest(firstUser.userId, { tag: originalTag, amount: uniqueAmount });

      const newTag = `${originalTag}Renamed`;
      const response = await request(app)
        .patch(`/api/v1/balance/shares/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: newTag });
      expect(response.status).toBe(200);
      expect(response.body.tag).toBe(newTag);

      const doc = await getUsersDb().get(firstUser.userId);
      const interest = doc.data.income.revenue.interests.find((i) => i.amount === uniqueAmount);
      expect(interest.tag).toBe(newTag);
    });

    it("syncs quantity/price into a Grow project whose title matches the share's tag", async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const tag = `MSFT${Date.now()}${Math.random()}`;
      const created = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, quantity: 10, priceMinor: 41500 });
      await seedGrowProject(firstUser.userId, {
        id: `grow_fixture_${Date.now()}_${Math.random()}`,
        title: tag,
        isAsset: true,
        share: { tag, quantity: 10, price: 415 },
      });

      const response = await request(app)
        .patch(`/api/v1/balance/shares/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 25, priceMinor: 50000 });
      expect(response.status).toBe(200);

      const doc = await getUsersDb().get(firstUser.userId);
      const growProject = doc.data.grow.find((g) => g.title === tag);
      expect(growProject.share.quantity).toBe(25);
      expect(growProject.share.price).toBe(500);
    });

    it('deletes a share, and audit logs the write', async () => {
      const { token, tokenId } = await balanceToken(['balance:r', 'balance:w']);
      const created = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: `DeleteTest${Date.now()}`, quantity: 1 });
      const response = await request(app)
        .delete(`/api/v1/balance/shares/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const getResponse = await request(app)
        .get(`/api/v1/balance/shares/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_shares',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects a tag that collides with an existing share', async () => {
      const { token } = await balanceToken(['balance:w']);
      const tag = `Duplicate${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, quantity: 1 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, quantity: 2 });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('rejects a tag that collides with an existing asset', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const tag = `SharedWithAsset${Date.now()}`;
      const asset = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, amountMinor: 100 });
      expect(asset.status).toBe(201);
      const share = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag, quantity: 1 });
      expect(share.status).toBe(400);
      expect(share.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the balance:r/balance:w scopes', async () => {
      const { token: writeOnly } = await balanceToken(['balance:w']);
      const getResponse = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await balanceToken(['balance:r']);
      const postResponse = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ tag: 'ShouldNotSave', quantity: 1 });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps shares isolated to the authenticated user document', async () => {
      const { token } = await balanceToken(['balance:r', 'balance:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `balance-share-other-${Date.now()}`,
        scopes: ['balance:w'],
      });
      const otherShare = await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ tag: `OnlyOtherUserShare${Date.now()}`, quantity: 1 });
      expect(otherShare.status).toBe(201);

      const list = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.shares).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherShare.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/balance/shares/${otherShare.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET/POST /grow and GET/PATCH/DELETE /grow/:id', () => {
    async function growToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `grow-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    it('creates a share-kind grow project and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await growToken(['grow:r', 'grow:w']);
      const title = `MSFT${Date.now()}${Math.random()}`;
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, share: true, phase: 'plan' });
      expect(created.status).toBe(201);
      expect(created.body.id).toMatch(/^grow_/);
      expect(created.body.share).toEqual({ tag: title, quantity: 0, priceMinor: 0 });
      expect(created.body.amountMinor).toBe(0);

      const list = await request(app).get('/api/v1/grow').set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.grow).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'grow',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('gets a single grow project by id and returns 404 for one that does not exist', async () => {
      const { token } = await growToken(['grow:r', 'grow:w']);
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `GetTest${Date.now()}`, isAsset: true });
      const found = await request(app)
        .get(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/grow/grow_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('updates only the metadata fields provided, and audit logs the write', async () => {
      const { token, tokenId } = await growToken(['grow:r', 'grow:w']);
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `PatchTest${Date.now()}`, isAsset: true, phase: 'idea' });
      const response = await request(app)
        .patch(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ phase: 'monitor', riskScore: 4 });
      expect(response.status).toBe(200);
      expect(response.body.phase).toBe('monitor');
      expect(response.body.riskScore).toBe(4);
      expect(response.body.title).toBe(created.body.title);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'grow',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('PATCHes plan fields, and rejects a share plan on a non-share project or an unknown field', async () => {
      const { token } = await growToken(['grow:r', 'grow:w']);
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `PlanPatch${Date.now()}`, isAsset: true });
      const planned = await request(app)
        .patch(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 100, cashflowMinor: 20 });
      expect(planned.status).toBe(200);
      expect(planned.body).toMatchObject({ amountMinor: 100, cashflowMinor: 20 });

      const wrongKind = await request(app)
        .patch(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ share: { quantity: 1 } });
      expect(wrongKind.status).toBe(400);
      expect(wrongKind.body.code).toBe('validation_invalid');

      const unknown = await request(app)
        .patch(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentAmountMinor: 100 });
      expect(unknown.status).toBe(400);
    });

    it('edits single action items and notes, and guards whole-list replacement', async () => {
      const { token } = await growToken(['grow:r', 'grow:w']);
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Lists${Date.now()}`, actionItems: [{ text: 'First' }] });
      const id = created.body.id;

      const edited = await request(app)
        .patch(`/api/v1/grow/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actionItemsUpdate: [{ index: 0, done: true }], notesAdd: [{ text: 'Note' }] });
      expect(edited.status).toBe(200);
      expect(edited.body.actionItems).toEqual([{ text: 'First', done: true, priority: 'medium' }]);
      expect(edited.body.notes[0].text).toBe('Note');

      const mixed = await request(app)
        .patch(`/api/v1/grow/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: [], notesAdd: [{ text: 'x' }] });
      expect(mixed.status).toBe(400);

      const withoutDone = await request(app)
        .patch(`/api/v1/grow/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actionItems: [{ text: 'First' }] });
      expect(withoutDone.status).toBe(400);

      const outOfRange = await request(app)
        .patch(`/api/v1/grow/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notesRemove: [7] });
      expect(outOfRange.status).toBe(400);
    });

    it('rejects a riskScore outside the 0-5 range the app displays', async () => {
      const { token } = await growToken(['grow:w']);
      const response = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Risky${Date.now()}`, riskScore: 8 });
      expect(response.status).toBe(400);
    });

    it('rejects an unknown field on create instead of silently dropping it', async () => {
      const { token } = await growToken(['grow:w']);
      const response = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `UnknownField${Date.now()}`, currentAmountMinor: 100 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a title that collides with an existing grow project', async () => {
      const { token } = await growToken(['grow:w']);
      const title = `Duplicate${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, isAsset: true });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, isAsset: true });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('validation_invalid');
    });

    it('rejects more than one of isAsset/share/investment set to true', async () => {
      const { token } = await growToken(['grow:w']);
      const response = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `MultiKind${Date.now()}`, isAsset: true, share: true });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('deletes a grow project, and audit logs the write', async () => {
      const { token, tokenId } = await growToken(['grow:r', 'grow:w']);
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `DeleteTest${Date.now()}`, isAsset: true });
      const response = await request(app)
        .delete(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const getResponse = await request(app)
        .get(`/api/v1/grow/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'grow',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects requests without the grow:r/grow:w scopes', async () => {
      const { token: writeOnly } = await growToken(['grow:w']);
      const getResponse = await request(app)
        .get('/api/v1/grow')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await growToken(['grow:r']);
      const postResponse = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ title: 'ShouldNotSave', isAsset: true });
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps grow projects isolated to the authenticated user document', async () => {
      const { token } = await growToken(['grow:r', 'grow:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `grow-other-${Date.now()}`,
        scopes: ['grow:w'],
      });
      const otherProject = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ title: `OnlyOtherUserGrow${Date.now()}`, isAsset: true });
      expect(otherProject.status).toBe(201);

      const list = await request(app).get('/api/v1/grow').set('Authorization', `Bearer ${token}`);
      expect(list.body.grow).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherProject.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/grow/${otherProject.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET/POST /subscriptions and GET/PATCH/DELETE /subscriptions/:id', () => {
    async function subscriptionToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `subscription-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    function subscriptionBody(overrides = {}) {
      return {
        title: 'Spotify',
        account: 'Daily',
        amountMinor: -1000,
        startDate: '2026-01-01',
        category: '@Streaming',
        ...overrides,
      };
    }

    it('creates a subscription and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await subscriptionToken(['subscriptions:r', 'subscriptions:w']);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      expect(created.status).toBe(201);
      expect(created.body.id).toMatch(/^subscriptions_/);
      expect(created.body.frequency).toBe('monthly');
      expect(created.body.endDate).toBeNull();

      const list = await request(app)
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.subscriptions).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'subscriptions',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('gets a single subscription by id and returns 404 for one that does not exist', async () => {
      const { token } = await subscriptionToken(['subscriptions:r', 'subscriptions:w']);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      const found = await request(app)
        .get(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/subscriptions/subscriptions_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('rejects invalid create input', async () => {
      const { token } = await subscriptionToken(['subscriptions:w']);
      const response = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody({ category: '@' }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('updates fields without triggering transaction cleanup when nothing identifying changed, and audit logs the write', async () => {
      const { token, tokenId } = await subscriptionToken(['subscriptions:r', 'subscriptions:w']);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      const response = await request(app)
        .patch(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ endDate: '2026-12-31' });
      expect(response.status).toBe(200);
      expect(response.body.endDate).toBe('2026-12-31');
      expect(response.body.title).toBe(created.body.title);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'subscriptions',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects an unknown field on PATCH', async () => {
      const { token } = await subscriptionToken(['subscriptions:r', 'subscriptions:w']);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      const response = await request(app)
        .patch(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ changeHistory: [] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('cascades deletion of matching transactions when an identifying field changes on PATCH, using the tighter 4-field match', async () => {
      const { token } = await subscriptionToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
        'transactions:w',
      ]);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      const matching = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          date: '2026-01-01',
          time: '09:00',
          category: '@Streaming',
          comment: 'Spotify',
        });
      expect(matching.status).toBe(201);
      const unrelated = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -500,
          date: '2026-02-01',
          time: '09:00',
          category: '@Groceries',
          comment: 'unrelated',
        });
      expect(unrelated.status).toBe(201);
      // Matches on account+amount+category alone (the original app's 3-field match) but not on
      // comment — proves the API's tighter 4-field match doesn't delete it.
      const coincidental = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          date: '2026-03-01',
          time: '09:00',
          category: '@Streaming',
          comment: 'A manually entered note',
        });
      expect(coincidental.status).toBe(201);

      const response = await request(app)
        .patch(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: -1500 });
      expect(response.status).toBe(200);

      const remaining = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);
      const remainingIds = remaining.body.transactions.map((t) => t.id);
      expect(remainingIds).not.toContain(matching.body.id);
      expect(remainingIds).toContain(unrelated.body.id);
      expect(remainingIds).toContain(coincidental.body.id);
    });

    it('deletes a subscription, leaving transactions untouched by default, and audit logs the write', async () => {
      const { token, tokenId } = await subscriptionToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
        'transactions:w',
      ]);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      const transaction = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          date: '2026-01-01',
          time: '09:00',
          category: '@Streaming',
          comment: 'Spotify',
        });
      expect(transaction.status).toBe(201);

      const response = await request(app)
        .delete(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const remaining = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);
      expect(remaining.body.transactions.map((t) => t.id)).toContain(transaction.body.id);

      const getResponse = await request(app)
        .get(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'subscriptions',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('deletes a subscription and its matching transactions when deleteTransactions=true', async () => {
      const { token } = await subscriptionToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
        'transactions:w',
      ]);
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody());
      const transaction = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          date: '2026-01-01',
          time: '09:00',
          category: '@Streaming',
          comment: 'Spotify',
        });
      expect(transaction.status).toBe(201);
      // Matches on account+amount+category alone (the original app's 3-field match) but not on
      // comment — proves the API's tighter 4-field match doesn't delete it.
      const coincidental = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          date: '2026-02-01',
          time: '09:00',
          category: '@Streaming',
          comment: 'A manually entered note',
        });
      expect(coincidental.status).toBe(201);

      const response = await request(app)
        .delete(`/api/v1/subscriptions/${created.body.id}?deleteTransactions=true`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      const remaining = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);
      const remainingIds = remaining.body.transactions.map((t) => t.id);
      expect(remainingIds).not.toContain(transaction.body.id);
      expect(remainingIds).toContain(coincidental.body.id);
    });

    it('rejects requests without the subscriptions:r/subscriptions:w scopes', async () => {
      const { token: writeOnly } = await subscriptionToken(['subscriptions:w']);
      const getResponse = await request(app)
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await subscriptionToken(['subscriptions:r']);
      const postResponse = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${readOnly}`)
        .send(subscriptionBody());
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps subscriptions isolated to the authenticated user document', async () => {
      const { token } = await subscriptionToken(['subscriptions:r', 'subscriptions:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `subscription-other-${Date.now()}`,
        scopes: ['subscriptions:w'],
      });
      const otherSubscription = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send(subscriptionBody({ title: `OnlyOtherUser${Date.now()}` }));
      expect(otherSubscription.status).toBe(201);

      const list = await request(app)
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.subscriptions).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherSubscription.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/subscriptions/${otherSubscription.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const patchResponse = await request(app)
        .patch(`/api/v1/subscriptions/${otherSubscription.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'ShouldNotApply' });
      expect(patchResponse.status).toBe(404);

      const deleteResponse = await request(app)
        .delete(`/api/v1/subscriptions/${otherSubscription.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteResponse.status).toBe(404);
    });
  });

  describe('POST /subscriptions/refresh', () => {
    // Each test registers its own user so `subscriptionsProcessed`/`transactionsCreated` counts
    // aren't polluted by subscriptions other tests left on a shared account.
    async function refreshToken(scopes) {
      const user = await registerTestUser(`_subscription_refresh_${Date.now()}_${Math.random()}`);
      const created = await sessionRequest('post', '/api/v1/auth/tokens', user.token).send({
        name: `subscription-refresh-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    function subscriptionBody(overrides = {}) {
      return {
        title: 'Spotify',
        account: 'Daily',
        amountMinor: -1000,
        startDate: '2026-01-01',
        category: '@Streaming',
        ...overrides,
      };
    }

    it('generates due transactions for an active subscription and reports counts', async () => {
      const { token } = await refreshToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
      ]);
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(
          subscriptionBody({
            category: `@RefreshRun${Date.now()}`,
            startDate: '2026-01-01',
            endDate: '2026-01-01',
          }),
        );

      const response = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactionsCreated: 1, subscriptionsProcessed: 1 });

      const transactions = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);
      expect(transactions.body.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ date: '2026-01-01', amountMinor: -1000 }),
        ]),
      );
    });

    it('does not regenerate an already-generated occurrence, but does regenerate it under a new identity after a PATCH', async () => {
      const { token } = await refreshToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
        'transactions:w',
      ]);
      const category = `@RefreshDup${Date.now()}`;
      const created = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionBody({ category, startDate: '2026-02-01', endDate: '2026-02-01' }));

      const first = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${token}`);
      expect(first.body).toEqual({ transactionsCreated: 1, subscriptionsProcessed: 1 });

      const second = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${token}`);
      expect(second.body).toEqual({ transactionsCreated: 0, subscriptionsProcessed: 1 });

      // Changing the amount changes the subscription's identity, so its PATCH cascade
      // deletes the old-identity transaction — a subsequent refresh should regenerate
      // exactly one transaction under the new identity, not zero and not two.
      await request(app)
        .patch(`/api/v1/subscriptions/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: -2000 });

      const third = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${token}`);
      expect(third.body).toEqual({ transactionsCreated: 1, subscriptionsProcessed: 1 });

      const transactions = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);
      const matching = transactions.body.transactions.filter((t) => t.category === category);
      expect(matching).toHaveLength(1);
      expect(matching[0].amountMinor).toBe(-2000);
    });

    it("stops generating once a Smile project reaches its target, even when it is not the first project (proves the fix for the original app's index-0-only cap bug)", async () => {
      const { token } = await refreshToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
        'smile:r',
        'smile:w',
      ]);
      await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `RefreshCapFirst${Date.now()}`, targetMinor: 100000 });
      const secondProjectTitle = `RefreshCapSecond${Date.now()}`;
      await request(app)
        .post('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: secondProjectTitle, targetMinor: 6000 });

      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send(
          subscriptionBody({
            category: `@${secondProjectTitle}`,
            amountMinor: -3000,
            startDate: '2026-01-01',
            endDate: '2026-02-01',
            frequency: 'weekly',
          }),
        );

      const response = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      // 5 weekly occurrences fall in the window, but the second occurrence already fills the
      // 6000-minor target exactly (3000 + 3000) — every later occurrence must be skipped.
      expect(response.body.transactionsCreated).toBe(2);

      const project = await request(app)
        .get('/api/v1/smile')
        .set('Authorization', `Bearer ${token}`);
      const bucket = project.body.projects.find((p) => p.title === secondProjectTitle).buckets[0];
      expect(bucket.amountMinor).toBe(6000);
    });

    it('rejects requests without the subscriptions:w scope', async () => {
      const { token } = await refreshToken(['subscriptions:r']);
      const response = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it("only generates transactions from the caller's own subscriptions, not another user's", async () => {
      const { token: tokenA } = await refreshToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
      ]);
      const { token: tokenB } = await refreshToken([
        'subscriptions:r',
        'subscriptions:w',
        'transactions:r',
      ]);
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${tokenB}`)
        .send(
          subscriptionBody({ category: `@RefreshIsolation${Date.now()}`, endDate: '2026-01-01' }),
        );

      // User A has no subscriptions of their own — refreshing must not see or apply user B's.
      const refreshA = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(refreshA.body).toEqual({ transactionsCreated: 0, subscriptionsProcessed: 0 });
      const transactionsA = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(transactionsA.body.transactions).toEqual([]);

      // User B's own subscription is untouched by A's refresh call and still generates normally.
      const refreshB = await request(app)
        .post('/api/v1/subscriptions/refresh')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(refreshB.body).toEqual({ transactionsCreated: 1, subscriptionsProcessed: 1 });
    });
  });

  describe('GET/POST /budget and GET/PATCH/DELETE /budget/:id', () => {
    async function budgetToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `budget-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    function budgetBody(overrides = {}) {
      return {
        date: '2026-01',
        tag: `@BudgetTest${Date.now()}${Math.random()}`,
        amountMinor: 30000,
        ...overrides,
      };
    }

    it('creates a budget row and lists it, and audit logs the write', async () => {
      const { token, tokenId } = await budgetToken(['budget:r', 'budget:w']);
      const body = budgetBody();
      const created = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      expect(created.status).toBe(201);
      expect(created.body.id).toMatch(/^budget_/);
      expect(created.body.amountMinor).toBe(30000);

      const list = await request(app).get('/api/v1/budget').set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.budget).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'budget',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'POST',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('upserts by (date, tag): a second POST for the same month/tag overwrites the amount and keeps the id', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      const body = budgetBody();
      const first = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      const second = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...body, amountMinor: 50000 });
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.amountMinor).toBe(50000);

      const list = await request(app).get('/api/v1/budget').set('Authorization', `Bearer ${token}`);
      expect(list.body.budget.filter((row) => row.id === first.body.id)).toHaveLength(1);
    });

    it('filters GET /budget by month', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      const tag = `@MonthFilter${Date.now()}`;
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody({ date: '2026-03', tag }));
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody({ date: '2026-04', tag }));

      const response = await request(app)
        .get('/api/v1/budget?month=2026-03')
        .set('Authorization', `Bearer ${token}`);
      expect(response.body.budget).toEqual(
        expect.arrayContaining([expect.objectContaining({ date: '2026-03', tag })]),
      );
      expect(response.body.budget.some((row) => row.date === '2026-04')).toBe(false);
    });

    it('gets a single budget row by id and returns 404 for one that does not exist', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      const created = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody());
      const found = await request(app)
        .get(`/api/v1/budget/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(created.body.id);

      const missing = await request(app)
        .get('/api/v1/budget/budget_does_not_exist')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('not_found');
    });

    it('updates a budget row, and audit logs the write', async () => {
      const { token, tokenId } = await budgetToken(['budget:r', 'budget:w']);
      const created = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody());
      const response = await request(app)
        .patch(`/api/v1/budget/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 45000 });
      expect(response.status).toBe(200);
      expect(response.body.amountMinor).toBe(45000);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'budget',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'PATCH',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects a PATCH that would collide with another row on (date, tag)', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      const tag = `@CollisionTarget${Date.now()}`;
      const target = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody({ date: '2026-05', tag }));
      const other = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody({ date: '2026-06', tag: `@CollisionOther${Date.now()}` }));
      const response = await request(app)
        .patch(`/api/v1/budget/${other.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-05', tag });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
      expect(target.status).toBe(201);
    });

    it('rejects invalid create input', async () => {
      const { token } = await budgetToken(['budget:w']);
      const response = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody({ date: '2026-13' }));
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('deletes a budget row, and audit logs the write', async () => {
      const { token, tokenId } = await budgetToken(['budget:r', 'budget:w']);
      const created = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetBody());
      const response = await request(app)
        .delete(`/api/v1/budget/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: created.body.id });

      const getResponse = await request(app)
        .get(`/api/v1/budget/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'budget',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: { type: 'token', tokenId },
            method: 'DELETE',
            resourceId: created.body.id,
          }),
        ]),
      );
    });

    it('rejects requests without the budget:r/budget:w scopes', async () => {
      const { token: writeOnly } = await budgetToken(['budget:w']);
      const getResponse = await request(app)
        .get('/api/v1/budget')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await budgetToken(['budget:r']);
      const postResponse = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${readOnly}`)
        .send(budgetBody());
      expect(postResponse.status).toBe(403);
      expect(postResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps budget rows isolated to the authenticated user document', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `budget-other-${Date.now()}`,
        scopes: ['budget:w'],
      });
      const otherRow = await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send(budgetBody({ tag: `@OnlyOtherUser${Date.now()}` }));
      expect(otherRow.status).toBe(201);

      const list = await request(app).get('/api/v1/budget').set('Authorization', `Bearer ${token}`);
      expect(list.body.budget).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: otherRow.body.id })]),
      );

      const getResponse = await request(app)
        .get(`/api/v1/budget/${otherRow.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(404);

      const patchResponse = await request(app)
        .patch(`/api/v1/budget/${otherRow.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 1 });
      expect(patchResponse.status).toBe(404);

      const deleteResponse = await request(app)
        .delete(`/api/v1/budget/${otherRow.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteResponse.status).toBe(404);
    });
  });

  describe('POST /budget/fill-forward, POST /budget/copy, and DELETE /budget?month=', () => {
    // Each test registers its own user — fill-forward's backward search would otherwise pick up
    // unrelated budget rows other tests in this file leave on a shared account.
    async function budgetToken(scopes) {
      const user = await registerTestUser(`_budget_bulk_${Date.now()}_${Math.random()}`);
      const created = await sessionRequest('post', '/api/v1/auth/tokens', user.token).send({
        name: `budget-bulk-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    it('chain-fills forward from the nearest prior populated month, add-only', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Groceries', amountMinor: 30000 });

      const response = await request(app)
        .post('/api/v1/budget/fill-forward')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMonth: '2026-04' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ targetMonth: '2026-04', rowsAdded: 3 });

      const list = await request(app).get('/api/v1/budget').set('Authorization', `Bearer ${token}`);
      const months = list.body.budget.map((row) => row.date).sort();
      expect(months).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    });

    it('does not overwrite an existing row for (date, tag) in an intermediate month', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Groceries', amountMinor: 30000 });
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-02', tag: '@Groceries', amountMinor: 99900 });

      await request(app)
        .post('/api/v1/budget/fill-forward')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMonth: '2026-03' });

      const list = await request(app).get('/api/v1/budget').set('Authorization', `Bearer ${token}`);
      const february = list.body.budget.find((row) => row.date === '2026-02');
      const march = list.body.budget.find((row) => row.date === '2026-03');
      expect(february.amountMinor).toBe(99900);
      expect(march.amountMinor).toBe(99900);
    });

    it('does nothing when no prior month within 120 months has any row', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      const response = await request(app)
        .post('/api/v1/budget/fill-forward')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMonth: '2026-04' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ targetMonth: '2026-04', rowsAdded: 0 });
    });

    it('rejects an invalid targetMonth', async () => {
      const { token } = await budgetToken(['budget:w']);
      const response = await request(app)
        .post('/api/v1/budget/fill-forward')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMonth: '2026-13' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('copies every row from the source month, overwriting an existing target row and creating new ones', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Groceries', amountMinor: 30000 });
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Rent', amountMinor: 120000 });
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-02', tag: '@Groceries', amountMinor: 99900 });

      const response = await request(app)
        .post('/api/v1/budget/copy')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromMonth: '2026-01', toMonth: '2026-02' });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ fromMonth: '2026-01', toMonth: '2026-02', rowsCopied: 2 });

      const list = await request(app)
        .get('/api/v1/budget?month=2026-02')
        .set('Authorization', `Bearer ${token}`);
      const groceries = list.body.budget.find((row) => row.tag === '@Groceries');
      const rent = list.body.budget.find((row) => row.tag === '@Rent');
      expect(groceries.amountMinor).toBe(30000);
      expect(rent.amountMinor).toBe(120000);
    });

    it('rejects invalid copy input', async () => {
      const { token } = await budgetToken(['budget:w']);
      const response = await request(app)
        .post('/api/v1/budget/copy')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromMonth: '2026-01', toMonth: 'not-a-month' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('deletes every row for a month via DELETE /budget?month=', async () => {
      const { token } = await budgetToken(['budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Groceries', amountMinor: 30000 });
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Rent', amountMinor: 120000 });
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-02', tag: '@Rent', amountMinor: 120000 });

      const response = await request(app)
        .delete('/api/v1/budget?month=2026-01')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ month: '2026-01', deletedCount: 2 });

      const list = await request(app).get('/api/v1/budget').set('Authorization', `Bearer ${token}`);
      expect(list.body.budget).toHaveLength(1);
      expect(list.body.budget[0].date).toBe('2026-02');
    });

    it('rejects a DELETE /budget without a valid month query parameter', async () => {
      const { token } = await budgetToken(['budget:w']);
      const response = await request(app)
        .delete('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the budget:w scope', async () => {
      const { token } = await budgetToken(['budget:r']);
      const fillForward = await request(app)
        .post('/api/v1/budget/fill-forward')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMonth: '2026-04' });
      expect(fillForward.status).toBe(403);

      const copy = await request(app)
        .post('/api/v1/budget/copy')
        .set('Authorization', `Bearer ${token}`)
        .send({ fromMonth: '2026-01', toMonth: '2026-02' });
      expect(copy.status).toBe(403);

      const deleteMonth = await request(app)
        .delete('/api/v1/budget?month=2026-01')
        .set('Authorization', `Bearer ${token}`);
      expect(deleteMonth.status).toBe(403);
    });

    it('keeps fill-forward/copy/delete-month isolated to the authenticated user document', async () => {
      const { token: tokenA } = await budgetToken(['budget:r', 'budget:w']);
      const { token: tokenB } = await budgetToken(['budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ date: '2026-01', tag: '@OnlyB', amountMinor: 1000 });

      const fillForward = await request(app)
        .post('/api/v1/budget/fill-forward')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ targetMonth: '2026-04' });
      expect(fillForward.body).toEqual({ targetMonth: '2026-04', rowsAdded: 0 });

      const copy = await request(app)
        .post('/api/v1/budget/copy')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ fromMonth: '2026-01', toMonth: '2026-02' });
      expect(copy.body).toEqual({ fromMonth: '2026-01', toMonth: '2026-02', rowsCopied: 0 });

      const deleteMonth = await request(app)
        .delete('/api/v1/budget?month=2026-01')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(deleteMonth.body).toEqual({ month: '2026-01', deletedCount: 0 });

      const listA = await request(app)
        .get('/api/v1/budget')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(listA.body.budget).toEqual([]);

      const listB = await request(app)
        .get('/api/v1/budget')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(listB.body.budget).toHaveLength(1);
    });
  });

  describe('GET/PATCH /settings', () => {
    // Fresh user per test — settings is a singleton per account, so a shared account would leak
    // one test's patch into another test's "defaults" assertions.
    async function settingsToken(scopes) {
      const user = await registerTestUser(`_settings_${Date.now()}_${Math.random()}`);
      const created = await sessionRequest('post', '/api/v1/auth/tokens', user.token).send({
        name: `settings-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return { ...created.body, userId: user.userId };
    }

    it('returns the confirmed original defaults when nothing has been saved yet', async () => {
      const { token } = await settingsToken(['settings:r']);
      const response = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        username: '',
        currency: '€',
        theme: 'light',
        language: 'en',
        dateFormat: 'dd.MM.yyyy',
        isEuropeanFormat: true,
        allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
      });
    });

    it('applies a partial patch, leaving every other field at its current value, and audit logs the write', async () => {
      const { token, tokenId, userId } = await settingsToken(['settings:r', 'settings:w']);
      const response = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ currency: '$', theme: 'dark' });
      expect(response.status).toBe(200);
      expect(response.body.currency).toBe('$');
      expect(response.body.theme).toBe('dark');
      expect(response.body.language).toBe('en');

      const get = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`);
      expect(get.body.currency).toBe('$');
      expect(get.body.theme).toBe('dark');

      const auditEntries = await queryAuditEntries(getAuditDb(), userId, { resource: 'settings' });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'PATCH' }),
        ]),
      );
    });

    it('replaces allocation as a whole unit and rejects one that does not sum to 100', async () => {
      const { token } = await settingsToken(['settings:r', 'settings:w']);
      const good = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ allocation: { daily: 40, splurge: 20, smile: 20, fire: 20 } });
      expect(good.status).toBe(200);
      expect(good.body.allocation).toEqual({ daily: 40, splurge: 20, smile: 20, fire: 20 });

      const bad = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ allocation: { daily: 40, splurge: 20, smile: 20, fire: 10 } });
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('validation_invalid');
    });

    it('rejects an invalid theme/language/dateFormat', async () => {
      const { token } = await settingsToken(['settings:w']);
      const response = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ theme: 'purple' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects an unknown field, including email (owned by /account, not /settings)', async () => {
      const { token } = await settingsToken(['settings:w']);
      const response = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@example.com' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects requests without the settings:r/settings:w scopes', async () => {
      const { token: writeOnly } = await settingsToken(['settings:w']);
      const getResponse = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');

      const { token: readOnly } = await settingsToken(['settings:r']);
      const patchResponse = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ theme: 'dark' });
      expect(patchResponse.status).toBe(403);
      expect(patchResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps settings isolated to the authenticated user document', async () => {
      const { token: tokenA } = await settingsToken(['settings:r']);
      const { token: tokenB } = await settingsToken(['settings:r', 'settings:w']);
      await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ username: 'onlyB' });

      const getA = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getA.body.username).toBe('');
    });
  });

  describe('GET/PUT /encryption-config', () => {
    // Fresh user per test — encryption config is a per-account singleton, same reasoning as
    // /settings above.
    async function encryptionUser() {
      return registerTestUser(`_encryption_${Date.now()}_${Math.random()}`);
    }

    async function encryptionToken(sessionToken, scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens', sessionToken).send({
        name: `encryption-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body.token;
    }

    it('returns the default config for an account that has never configured encryption', async () => {
      const user = await encryptionUser();
      const token = await encryptionToken(user.token, ['encryption:r']);
      const response = await request(app)
        .get('/api/v1/encryption-config')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        encryptLocal: true,
        encryptDatabase: false,
        keyConfigured: false,
      });
    });

    it('never returns the raw key', async () => {
      const user = await encryptionUser();
      await sessionRequest('put', '/api/auth/encryption-config', user.token).send({
        key: 'a-real-secret-key',
        encryptLocal: true,
        encryptDatabase: true,
      });
      const token = await encryptionToken(user.token, ['encryption:r']);
      const response = await request(app)
        .get('/api/v1/encryption-config')
        .set('Authorization', `Bearer ${token}`);
      expect(response.body).toEqual({
        encryptLocal: true,
        encryptDatabase: true,
        keyConfigured: true,
      });
      expect(response.body.key).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('a-real-secret-key');
    });

    it('sets an initial key via a session and reports it as configured', async () => {
      const user = await encryptionUser();
      const response = await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        key: 'first-key',
        encryptDatabase: true,
      });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        encryptLocal: true,
        encryptDatabase: true,
        keyConfigured: true,
      });
    });

    it('toggles encryptLocal/encryptDatabase via a session without touching an already-active key', async () => {
      const user = await encryptionUser();
      await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        key: 'active-key',
        encryptDatabase: true,
      });
      const response = await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        encryptDatabase: false,
      });
      expect(response.status).toBe(200);
      expect(response.body.encryptDatabase).toBe(false);
      expect(response.body.keyConfigured).toBe(true);
    });

    it('rejects changing an already-active key to a different value, pointing at mm-admin', async () => {
      const user = await encryptionUser();
      await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        key: 'active-key',
        encryptDatabase: true,
      });
      const response = await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        key: 'a-different-key',
      });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
      expect(response.body.detail).toContain('mm-admin rotate-encryption-key');
    });

    it('rejects a PAT from calling PUT /encryption-config, regardless of scope', async () => {
      const user = await encryptionUser();
      const token = await encryptionToken(user.token, ['encryption:r', 'encryption:w']);
      const response = await request(app)
        .put('/api/v1/encryption-config')
        .set('Authorization', `Bearer ${token}`)
        .send({ encryptDatabase: true });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('auth_session_required');
    });

    it('rejects GET without the encryption:r scope', async () => {
      const user = await encryptionUser();
      const token = await encryptionToken(user.token, ['settings:r']);
      const response = await request(app)
        .get('/api/v1/encryption-config')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('rejects an unrecognized field', async () => {
      const user = await encryptionUser();
      const response = await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        isLocal: true,
      });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('keeps encryption config isolated to the authenticated user document', async () => {
      const userA = await encryptionUser();
      const userB = await encryptionUser();
      await sessionRequest('put', '/api/v1/encryption-config', userB.token).send({
        key: 'user-b-key',
        encryptDatabase: true,
      });

      const tokenA = await encryptionToken(userA.token, ['encryption:r']);
      const getA = await request(app)
        .get('/api/v1/encryption-config')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getA.body).toEqual({
        encryptLocal: true,
        encryptDatabase: false,
        keyConfigured: false,
      });
    });
  });

  describe('GET /data/export', () => {
    // Fresh user per test — this endpoint dumps the whole account, so a
    // shared account would leak other tests' data into the export.
    async function exportUser() {
      return registerTestUser(`_export_${Date.now()}_${Math.random()}`);
    }

    async function exportToken(sessionToken, scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens', sessionToken).send({
        name: `export-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body.token;
    }

    it('exports the full account document, decrypted', async () => {
      const user = await exportUser();
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Income',
        amountMinor: 500000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Salary',
        comment: '',
      });

      const token = await exportToken(user.token, ['data:bulk']);
      const response = await request(app)
        .get('/api/v1/data/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.transactions[0]).toMatchObject({
        account: 'Income',
        category: '@Salary',
      });
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(response.body.updatedAt).toEqual(expect.any(String));
    });

    it('returns a document with no transactions for a brand-new account', async () => {
      const user = await exportUser();
      const token = await exportToken(user.token, ['data:bulk']);
      const response = await request(app)
        .get('/api/v1/data/export')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      // Registration itself writes data.info.{username,email} — only
      // transactions (and everything else this test doesn't set up) starts
      // genuinely empty.
      expect(response.body.data.transactions).toBeUndefined();
      expect(response.body.createdAt).toEqual(expect.any(String));
    });

    it('decrypts encrypted fields and never exposes the raw encryption key', async () => {
      const user = await exportUser();
      await sessionRequest('put', '/api/v1/encryption-config', user.token).send({
        key: 'export-test-secret-key',
        encryptDatabase: true,
      });
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Daily',
        amountMinor: -4200,
        date: '2026-09-06',
        time: '10:00',
        category: '@Groceries',
        comment: 'Weekly shop',
      });

      const token = await exportToken(user.token, ['data:bulk']);
      const response = await request(app)
        .get('/api/v1/data/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions[0]).toMatchObject({
        account: 'Daily',
        category: '@Groceries',
        comment: 'Weekly shop',
      });
      // Money fields must come back as real numbers, not the stringified form
      // encryption stores them as internally.
      expect(response.body.data.transactions[0].amount).toBe(-42);
      expect(typeof response.body.data.transactions[0].amount).toBe('number');
      expect(JSON.stringify(response.body)).not.toContain('export-test-secret-key');
    });

    it('requires the data:bulk scope', async () => {
      const user = await exportUser();
      const token = await exportToken(user.token, ['transactions:r']);
      const response = await request(app)
        .get('/api/v1/data/export')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps the export isolated to the authenticated user document', async () => {
      const userA = await exportUser();
      const userB = await exportUser();
      await sessionRequest('post', '/api/v1/transactions', userB.token).send({
        account: 'Income',
        amountMinor: 999900,
        date: '2026-09-06',
        time: '09:00',
        category: '@UserB salary',
        comment: '',
      });

      const tokenA = await exportToken(userA.token, ['data:bulk']);
      const response = await request(app)
        .get('/api/v1/data/export')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('UserB salary');
    });
  });

  describe('POST /data/import', () => {
    // Fresh user per test — this endpoint replaces the entire account, so a
    // shared account would corrupt other tests' data.
    async function importUser() {
      return registerTestUser(`_import_${Date.now()}_${Math.random()}`);
    }

    async function importToken(sessionToken, scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens', sessionToken).send({
        name: `import-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body.token;
    }

    it('round-trips a real export into a fresh account via import', async () => {
      const sourceUser = await importUser();
      await sessionRequest('post', '/api/v1/transactions', sourceUser.token).send({
        account: 'Income',
        amountMinor: 500000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Salary',
        comment: '',
      });
      await sessionRequest('patch', '/api/v1/settings', sourceUser.token).send({
        theme: 'dark',
      });
      const sourceToken = await importToken(sourceUser.token, ['data:bulk']);
      const exported = await request(app)
        .get('/api/v1/data/export')
        .set('Authorization', `Bearer ${sourceToken}`);
      expect(exported.status).toBe(200);

      const destUser = await importUser();
      const destToken = await importToken(destUser.token, ['data:bulk']);
      const importResponse = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${destToken}`)
        .set('Idempotency-Key', `import-${Date.now()}-1`)
        .send({ confirm: true, data: exported.body.data });

      expect(importResponse.status).toBe(200);
      expect(importResponse.body.transactionCount).toBe(1);

      const destListed = await sessionRequest('get', '/api/v1/transactions', destUser.token);
      expect(destListed.body.transactions).toHaveLength(1);
      expect(destListed.body.transactions[0]).toMatchObject({
        account: 'Income',
        amountMinor: 500000,
        category: '@Salary',
      });
      const destSettings = await sessionRequest('get', '/api/v1/settings', destUser.token);
      expect(destSettings.body.theme).toBe('dark');
    });

    it('requires confirm: true', async () => {
      const user = await importUser();
      const token = await importToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `import-${Date.now()}-2`)
        .send({ data: { meta: { schemaVersion: 1 }, transactions: [] } });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects a schema-version mismatch against the current account', async () => {
      const user = await importUser();
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Daily',
        amountMinor: -100,
        date: '2026-09-06',
        time: '10:00',
        category: '@Groceries',
        comment: '',
      });
      const token = await importToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `import-${Date.now()}-3`)
        .send({ confirm: true, data: { meta: { schemaVersion: 2 }, transactions: [] } });
      expect(response.status).toBe(400);
      expect(response.body.detail).toContain('schema version');
    });

    it('refuses to import a zero-amount transaction rather than silently dropping it', async () => {
      const user = await importUser();
      const token = await importToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `import-${Date.now()}-4`)
        .send({
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [
              {
                id: 'tx_zero',
                account: 'Daily',
                amount: 0,
                date: '2026-09-06',
                time: '08:00',
                category: '@Log',
                comment: '',
              },
            ],
          },
        });
      expect(response.status).toBe(400);
      expect(response.body.detail).toContain('zero amount');
    });

    it('requires the data:bulk scope', async () => {
      const user = await importUser();
      const token = await importToken(user.token, ['transactions:rw']);
      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `import-${Date.now()}-5`)
        .send({ confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('requires an Idempotency-Key header', async () => {
      const user = await importUser();
      const token = await importToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('replays the same result for a repeated Idempotency-Key without reapplying', async () => {
      const user = await importUser();
      const token = await importToken(user.token, ['data:bulk']);
      const key = `import-${Date.now()}-6`;
      const body = {
        confirm: true,
        data: {
          meta: { schemaVersion: 1 },
          transactions: [
            {
              id: 'tx_1',
              account: 'Income',
              amount: 100,
              date: '2026-09-06',
              time: '09:00',
              category: '@Gift',
              comment: '',
            },
          ],
        },
      };

      const first = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);
      const second = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    });

    it('keeps import isolated to the authenticated user document', async () => {
      const userA = await importUser();
      const userB = await importUser();
      await sessionRequest('post', '/api/v1/transactions', userB.token).send({
        account: 'Income',
        amountMinor: 999900,
        date: '2026-09-06',
        time: '09:00',
        category: '@UserB salary',
        comment: '',
      });

      const tokenA = await importToken(userA.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', `import-${Date.now()}-7`)
        .send({ confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } });
      expect(response.status).toBe(200);

      // User B's data must be completely untouched.
      const stillThere = await sessionRequest('get', '/api/v1/transactions', userB.token);
      expect(stillThere.body.transactions).toHaveLength(1);
      expect(stillThere.body.transactions[0].category).toBe('@UserB salary');
    });

    it('overwrites an existing account entirely, replacing prior transactions', async () => {
      const user = await importUser();
      const created = await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Daily',
        amountMinor: -100,
        date: '2026-09-06',
        time: '08:00',
        category: '@OldData',
        comment: '',
      });
      expect(created.status).toBe(201);
      const token = await importToken(user.token, ['data:bulk']);

      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `import-${Date.now()}-8`)
        .send({
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [
              {
                id: 'tx_new',
                account: 'Daily',
                amount: -55,
                date: '2026-09-07',
                time: '11:00',
                category: '@NewData',
                comment: '',
              },
            ],
          },
        });
      expect(response.status).toBe(200);

      const listed = await sessionRequest('get', '/api/v1/transactions', user.token);
      expect(listed.body.transactions).toHaveLength(1);
      expect(listed.body.transactions[0].category).toBe('@NewData');
    });

    it('wipes a collection present in the current account but absent from the import payload', async () => {
      const user = await importUser();
      const createdGrow = await sessionRequest('post', '/api/v1/grow', user.token).send({
        title: 'Old Rental',
      });
      expect(createdGrow.status).toBe(201);
      const token = await importToken(user.token, ['data:bulk']);

      const response = await request(app)
        .post('/api/v1/data/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `import-${Date.now()}-9`)
        .send({ confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } });
      expect(response.status).toBe(200);

      const growList = await sessionRequest('get', '/api/v1/grow', user.token);
      expect(growList.body.grow).toEqual([]);
    });
  });

  describe('POST /data/recalculate', () => {
    // Fresh user per test — this endpoint recalculates every derived
    // aggregate on the account, so a shared account would leak other tests'
    // transactions/income totals into the computed result.
    async function recalculateUser() {
      return registerTestUser(`_recalc_${Date.now()}_${Math.random()}`);
    }

    async function recalculateToken(sessionToken, scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens', sessionToken).send({
        name: `recalculate-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body.token;
    }

    it('recalculates derived state and reports the transaction count', async () => {
      const user = await recalculateUser();
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Income',
        amountMinor: 500000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Salary',
        comment: '',
      });
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Daily',
        amountMinor: -1250,
        date: '2026-09-06',
        time: '10:00',
        category: '@Groceries',
        comment: '',
      });

      const token = await recalculateToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `recalc-${Date.now()}-1`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactionCount: 2 });

      // Recalculation must not have changed the stored transactions themselves.
      const listed = await sessionRequest('get', '/api/v1/transactions', user.token);
      expect(listed.body.transactions).toHaveLength(2);

      const statement = await sessionRequest('get', '/api/v1/reports/income-statement', user.token);
      expect(statement.status).toBe(200);
    });

    it('returns a zero count for an account with no transactions yet', async () => {
      const user = await recalculateUser();
      const token = await recalculateToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `recalc-${Date.now()}-2`)
        .send({});
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactionCount: 0 });
    });

    it('requires the data:bulk scope — rw on a related resource is not enough', async () => {
      const user = await recalculateUser();
      const token = await recalculateToken(user.token, ['transactions:rw']);
      const response = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `recalc-${Date.now()}-3`)
        .send({});
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('requires an Idempotency-Key header', async () => {
      const user = await recalculateUser();
      const token = await recalculateToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('replays the same result for a repeated Idempotency-Key without reapplying', async () => {
      const user = await recalculateUser();
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Income',
        amountMinor: 100000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Salary',
        comment: '',
      });
      const token = await recalculateToken(user.token, ['data:bulk']);
      const key = `recalc-${Date.now()}-4`;

      const first = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({});
      const second = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({});

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    });

    it('refuses to recalculate rather than silently dropping a zero-amount transaction', async () => {
      // A zero-amount transaction can never be created through this API (both POST and PATCH
      // reject amountMinor: 0), but can exist in legacy-origin data — seed one directly, the same
      // way other tests here seed edge-case stored shapes the API itself won't produce.
      const user = await recalculateUser();
      await sessionRequest('post', '/api/v1/transactions', user.token).send({
        account: 'Income',
        amountMinor: 100000,
        date: '2026-09-06',
        time: '09:00',
        category: '@Salary',
        comment: '',
      });
      const usersDb = getUsersDb();
      const doc = await usersDb.get(user.userId);
      doc.data.transactions.push({
        id: 'tx_legacy_zero',
        account: 'Daily',
        amount: 0,
        date: '2026-09-06',
        time: '10:00',
        category: '@Log',
        comment: 'legacy zero-amount entry',
      });
      await usersDb.insert(doc);

      const token = await recalculateToken(user.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `recalc-${Date.now()}-6`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
      expect(response.body.detail).toContain('zero amount');

      // Nothing was dropped — the zero-amount transaction is still there.
      const stillThere = await usersDb.get(user.userId);
      expect(stillThere.data.transactions).toHaveLength(2);
    });

    it('keeps recalculation isolated to the authenticated user document', async () => {
      const userA = await recalculateUser();
      const userB = await recalculateUser();
      await sessionRequest('post', '/api/v1/transactions', userB.token).send({
        account: 'Income',
        amountMinor: 999900,
        date: '2026-09-06',
        time: '09:00',
        category: '@UserB salary',
        comment: '',
      });

      const tokenA = await recalculateToken(userA.token, ['data:bulk']);
      const response = await request(app)
        .post('/api/v1/data/recalculate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', `recalc-${Date.now()}-5`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ transactionCount: 0 });
    });
  });

  describe('POST /budget/from-subscriptions', () => {
    // Fresh user per test — this endpoint reads every subscription on the account, so a shared
    // account would leak other tests' subscriptions into the computed budget rows.
    async function budgetFromSubsToken(scopes) {
      const user = await registerTestUser(`_budget_from_subs_${Date.now()}_${Math.random()}`);
      const created = await sessionRequest('post', '/api/v1/auth/tokens', user.token).send({
        name: `budget-from-subs-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return { ...created.body, sessionToken: user.token };
    }

    it('populates a budget row using the monthly-equivalent amount for a quarterly subscription', async () => {
      const { token } = await budgetFromSubsToken(['subscriptions:w', 'budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -30000,
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          category: '@Insurance',
          frequency: 'quarterly',
        });

      const response = await request(app)
        .post('/api/v1/budget/from-subscriptions')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ rowsWritten: 1 });

      const list = await request(app)
        .get('/api/v1/budget?month=2026-01')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.budget).toEqual([
        expect.objectContaining({ date: '2026-01', tag: '@Insurance', amountMinor: 10000 }),
      ]);
    });

    it('unconditionally overwrites an existing row for the computed (date, tag) pair', async () => {
      const { token } = await budgetFromSubsToken(['subscriptions:w', 'budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/budget')
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-01', tag: '@Streaming', amountMinor: 1 });
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          category: '@Streaming',
          frequency: 'monthly',
        });

      await request(app)
        .post('/api/v1/budget/from-subscriptions')
        .set('Authorization', `Bearer ${token}`);

      const list = await request(app)
        .get('/api/v1/budget?month=2026-01')
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.budget).toHaveLength(1);
      expect(list.body.budget[0].amountMinor).toBe(1000);
    });

    it('skips a subscription on the Income account', async () => {
      const { token } = await budgetFromSubsToken(['subscriptions:w', 'budget:r', 'budget:w']);
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Income',
          amountMinor: 500000,
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          category: '@Salary',
          frequency: 'monthly',
        });

      const response = await request(app)
        .post('/api/v1/budget/from-subscriptions')
        .set('Authorization', `Bearer ${token}`);
      expect(response.body).toEqual({ rowsWritten: 0 });
    });

    it('rejects requests without the budget:w scope', async () => {
      const { token } = await budgetFromSubsToken(['budget:r']);
      const response = await request(app)
        .post('/api/v1/budget/from-subscriptions')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it("reads and applies the caller's real subscriptions with a budget:w-only token (no subscriptions:r/w grant)", async () => {
      const { token, sessionToken } = await budgetFromSubsToken(['budget:w']);
      await sessionRequest('post', '/api/v1/subscriptions', sessionToken).send({
        account: 'Daily',
        amountMinor: -1200,
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        category: '@Domain',
        frequency: 'yearly',
      });

      const response = await request(app)
        .post('/api/v1/budget/from-subscriptions')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ rowsWritten: 1 });

      const list = await sessionRequest('get', '/api/v1/budget?month=2026-01', sessionToken);
      expect(list.body.budget).toEqual([
        expect.objectContaining({ date: '2026-01', tag: '@Domain', amountMinor: 100 }),
      ]);
    });

    it("only uses the caller's own subscriptions, not another user's", async () => {
      const { token: tokenA } = await budgetFromSubsToken(['budget:r', 'budget:w']);
      const { token: tokenB } = await budgetFromSubsToken(['subscriptions:w']);
      await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          account: 'Daily',
          amountMinor: -1000,
          startDate: '2026-01-01',
          endDate: '2026-01-01',
          category: '@OnlyB',
          frequency: 'monthly',
        });

      const response = await request(app)
        .post('/api/v1/budget/from-subscriptions')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(response.body).toEqual({ rowsWritten: 0 });
    });
  });

  describe('POST /subscriptions/batch', () => {
    async function bulkToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `subscription-bulk-agent-${Date.now()}-${Math.random()}`,
        scopes: ['subscriptions:bulk'],
      });
      return created.body.token;
    }

    it('creates, updates, and reports a failing delete in one non-atomic batch', async () => {
      const token = await bulkToken();
      const existing = await sessionRequest('post', '/api/v1/subscriptions').send({
        account: 'Daily',
        amountMinor: -100,
        startDate: '2026-01-01',
        category: '@Batch existing',
      });
      const response = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `sub-batch-${Date.now()}-1`)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -2500,
              startDate: '2026-01-01',
              category: '@Batch salary',
            },
            { op: 'update', id: existing.body.id, amountMinor: -200 },
            { op: 'delete', id: 'subscriptions_does_not_exist' },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.atomic).toBe(false);
      expect(response.body.results[0]).toMatchObject({ op: 'create', status: 'created' });
      expect(response.body.results[1]).toMatchObject({
        op: 'update',
        status: 'updated',
        id: existing.body.id,
      });
      expect(response.body.results[1].subscription.amountMinor).toBe(-200);
      expect(response.body.results[2]).toMatchObject({ op: 'delete', status: 'error' });
    });

    it('rolls back the whole batch atomically when one operation fails', async () => {
      const token = await bulkToken();
      const existing = await sessionRequest('post', '/api/v1/subscriptions').send({
        account: 'Daily',
        amountMinor: -300,
        startDate: '2026-01-01',
        category: '@Batch atomic',
      });
      const response = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `sub-batch-${Date.now()}-2`)
        .send({
          atomic: true,
          operations: [
            { op: 'delete', id: existing.body.id },
            { op: 'delete', id: 'subscriptions_does_not_exist' },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.results[0]).toMatchObject({ status: 'not_applied' });
      expect(response.body.results[1]).toMatchObject({ status: 'error' });
      const stillThere = await sessionRequest('get', `/api/v1/subscriptions/${existing.body.id}`);
      expect(stillThere.status).toBe(200);
    });

    it('replays the same result for a repeated Idempotency-Key without reapplying the write', async () => {
      const token = await bulkToken();
      const key = `sub-batch-${Date.now()}-3`;
      const body = {
        operations: [
          {
            op: 'create',
            account: 'Daily',
            amountMinor: -400,
            startDate: '2026-01-01',
            category: '@Batch idempotent',
          },
        ],
      };
      const first = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);
      expect(first.status).toBe(200);
      const createdId = first.body.results[0].id;

      const replay = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);

      const list = await sessionRequest('get', '/api/v1/subscriptions');
      expect(
        list.body.subscriptions.filter((subscription) => subscription.id === createdId),
      ).toHaveLength(1);
    });

    it('rejects a reused Idempotency-Key sent with a different body', async () => {
      const token = await bulkToken();
      const key = `sub-batch-${Date.now()}-4`;
      await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -1,
              startDate: '2026-01-01',
              category: '@A',
            },
          ],
        });

      const mismatched = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({
          operations: [
            {
              op: 'create',
              account: 'Daily',
              amountMinor: -2,
              startDate: '2026-01-01',
              category: '@B',
            },
          ],
        });
      expect(mismatched.status).toBe(409);
      expect(mismatched.body.code).toBe('conflict_idempotency_mismatch');
    });

    it('requires an Idempotency-Key header', async () => {
      const token = await bulkToken();
      const response = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ operations: [{ op: 'delete', id: 'subscriptions_x' }] });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects more than 100 operations', async () => {
      const token = await bulkToken();
      const response = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `sub-batch-${Date.now()}-5`)
        .send({
          operations: Array.from({ length: 101 }, () => ({ op: 'delete', id: 'subscriptions_x' })),
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('keeps batch operations isolated to the authenticated user document', async () => {
      const token = await bulkToken();
      const other = await sessionRequest('post', '/api/v1/subscriptions', secondUser.token).send({
        account: 'Daily',
        amountMinor: -50,
        startDate: '2026-01-01',
        category: '@Not yours',
      });
      const response = await request(app)
        .post('/api/v1/subscriptions/batch')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `sub-batch-${Date.now()}-6`)
        .send({ operations: [{ op: 'delete', id: other.body.id }] });
      expect(response.status).toBe(200);
      expect(response.body.results[0]).toMatchObject({ status: 'error' });
      const stillThere = await sessionRequest(
        'get',
        `/api/v1/subscriptions/${other.body.id}`,
        secondUser.token,
      );
      expect(stillThere.status).toBe(200);
    });
  });

  describe('GET /subscriptions/export and POST /subscriptions/import', () => {
    async function bulkToken() {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `subscription-bulk-agent-${Date.now()}-${Math.random()}`,
        scopes: ['subscriptions:bulk'],
      });
      return created.body.token;
    }

    it('exports subscriptions as newline-delimited JSON', async () => {
      const token = await bulkToken();
      await sessionRequest('post', '/api/v1/subscriptions').send({
        account: 'Daily',
        amountMinor: -321,
        startDate: '2026-01-01',
        category: '@Export test',
      });
      const response = await request(app)
        .get('/api/v1/subscriptions/export')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/x-ndjson');
      const lines = response.text.split('\n').filter((line) => line.length > 0);
      const parsed = lines.map((line) => JSON.parse(line));
      expect(parsed).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: '@Export test' })]),
      );
    });

    it('rejects export without the subscriptions:bulk scope', async () => {
      const readOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `subscription-read-only-not-bulk-${Date.now()}`,
        scopes: ['subscriptions:r'],
      });
      const response = await request(app)
        .get('/api/v1/subscriptions/export')
        .set('Authorization', `Bearer ${readOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('imports newline-delimited JSON subscriptions', async () => {
      const token = await bulkToken();
      const ndjson = [
        JSON.stringify({
          account: 'Daily',
          amountMinor: -400,
          startDate: '2026-01-01',
          category: '@Import A',
        }),
        JSON.stringify({
          account: 'Income',
          amountMinor: 50000,
          startDate: '2026-01-01',
          category: '@Import B',
        }),
      ].join('\n');
      const response = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `sub-import-${Date.now()}-1`)
        .send(ndjson);
      expect(response.status).toBe(200);
      expect(response.body.itemCount).toBe(2);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results.every((result) => result.status === 'created')).toBe(true);
    });

    it('reports a per-line error for an invalid line without failing the whole import', async () => {
      const token = await bulkToken();
      const ndjson = [
        JSON.stringify({
          account: 'Daily',
          amountMinor: -50,
          startDate: '2026-01-01',
          category: '@Valid import line',
        }),
        'not valid json',
      ].join('\n');
      const response = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `sub-import-${Date.now()}-2`)
        .send(ndjson);
      expect(response.status).toBe(200);
      expect(response.body.results[0]).toMatchObject({ status: 'created' });
      expect(response.body.results[1]).toMatchObject({ status: 'error' });
    });

    it('rolls back the whole import atomically when any line fails and atomic=true', async () => {
      const token = await bulkToken();
      const ndjson = [
        JSON.stringify({
          account: 'Daily',
          amountMinor: -60,
          startDate: '2026-01-01',
          category: '@Atomic import valid',
        }),
        JSON.stringify({ account: 'Daily' }),
      ].join('\n');
      const response = await request(app)
        .post('/api/v1/subscriptions/import?atomic=true')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `sub-import-${Date.now()}-3`)
        .send(ndjson);
      expect(response.status).toBe(200);
      expect(response.body.atomic).toBe(true);
      expect(response.body.results[0]).toMatchObject({ status: 'not_applied' });
      expect(response.body.results[1]).toMatchObject({ status: 'error' });
    });

    it('replays the same import result for a repeated Idempotency-Key without reapplying', async () => {
      const token = await bulkToken();
      const ndjson = JSON.stringify({
        account: 'Daily',
        amountMinor: -70,
        startDate: '2026-01-01',
        category: '@Idempotent import',
      });
      const key = `sub-import-${Date.now()}-4`;
      const first = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', key)
        .send(ndjson);
      const replay = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', key)
        .send(ndjson);
      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);
      const list = await sessionRequest('get', '/api/v1/subscriptions');
      expect(
        list.body.subscriptions.filter(
          (subscription) => subscription.id === first.body.results[0].id,
        ),
      ).toHaveLength(1);
    });

    it('requires the Idempotency-Key header and rejects an empty body', async () => {
      const token = await bulkToken();
      const missingKey = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .send(
          JSON.stringify({
            account: 'Daily',
            amountMinor: -1,
            startDate: '2026-01-01',
            category: '@No key',
          }),
        );
      expect(missingKey.status).toBe(400);

      const emptyBody = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `sub-import-${Date.now()}-5`)
        .send('');
      expect(emptyBody.status).toBe(400);
      expect(emptyBody.body.code).toBe('validation_invalid');
    });

    it('rejects import without the subscriptions:bulk scope', async () => {
      const writeOnly = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `subscription-write-not-bulk-import-${Date.now()}`,
        scopes: ['subscriptions:w'],
      });
      const response = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${writeOnly.body.token}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `sub-import-${Date.now()}-6`)
        .send(
          JSON.stringify({
            account: 'Daily',
            amountMinor: -1,
            startDate: '2026-01-01',
            category: '@Scope test',
          }),
        );
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps export and import isolated to the authenticated user document', async () => {
      const firstToken = await bulkToken();
      const secondTokenCreate = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({
        name: `subscription-bulk-agent-isolation-${Date.now()}`,
        scopes: ['subscriptions:bulk'],
      });
      const secondToken = secondTokenCreate.body.token;

      await sessionRequest('post', '/api/v1/subscriptions', secondUser.token).send({
        account: 'Daily',
        amountMinor: -999,
        startDate: '2026-01-01',
        category: '@Second user export',
      });
      const firstExport = await request(app)
        .get('/api/v1/subscriptions/export')
        .set('Authorization', `Bearer ${firstToken}`);
      expect(firstExport.text).not.toContain('@Second user export');

      const importResponse = await request(app)
        .post('/api/v1/subscriptions/import')
        .set('Authorization', `Bearer ${secondToken}`)
        .set('Content-Type', 'application/x-ndjson')
        .set('Idempotency-Key', `sub-import-isolation-${Date.now()}`)
        .send(
          JSON.stringify({
            account: 'Daily',
            amountMinor: -1,
            startDate: '2026-01-01',
            category: '@Second user import',
          }),
        );
      expect(importResponse.status).toBe(200);
      const firstListAfter = await sessionRequest('get', '/api/v1/subscriptions');
      expect(
        firstListAfter.body.subscriptions.some(
          (subscription) => subscription.category === '@Second user import',
        ),
      ).toBe(false);
    });
  });

  describe('POST /grow/:id/{buy,sell,dividend,payback,cashflow,deposit}', () => {
    async function growToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `grow-action-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    async function createGrowProject(token, body) {
      const created = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      expect(created.status).toBe(201);
      return created.body;
    }

    it('buy on an asset-kind project creates the asset and reduces Grow.amount/the transaction by any financing loan', async () => {
      const { token, tokenId } = await growToken(['grow:r', 'grow:w', 'balance:r']);
      const title = `Car${Date.now()}${Math.random()}`;
      const project = await createGrowProject(token, { title, isAsset: true });

      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalAmountMinor: 150000, liabilitie: { loanMinor: 100000, creditMinor: 5000 } });
      expect(response.status).toBe(201);
      expect(response.body.grow.amountMinor).toBe(50000);
      expect(response.body.grow.status).toBe('bought');
      expect(response.body.transaction.amountMinor).toBe(-50000);
      expect(response.body.transaction.comment).toBe(
        `Liabilitie 1000 50; Buy Asset ${title} 1 x 1500;`,
      );

      const assets = await request(app)
        .get('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`);
      expect(assets.body.assets).toEqual(
        expect.arrayContaining([expect.objectContaining({ tag: title, amountMinor: 150000 })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'grow_buy',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, resourceId: project.id }),
        ]),
      );
    });

    it('buy on a share-kind project accumulates onto an existing position', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r']);
      const title = `MSFT${Date.now()}${Math.random()}`;
      const project = await createGrowProject(token, { title, share: true });

      const first = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 5, priceMinor: 20000 });
      expect(first.status).toBe(201);
      const second = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 10, priceMinor: 25000 });
      expect(second.status).toBe(201);
      expect(second.body.grow.share).toEqual({ tag: title, quantity: 15, priceMinor: 25000 });

      const shares = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`);
      expect(shares.body.shares).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tag: title, quantity: 15, priceMinor: 25000 }),
        ]),
      );
    });

    it('buy on an investment-kind project creates the companion M-<title> mortgage liability', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r']);
      const title = `RentalFlat${Date.now()}${Math.random()}`;
      const project = await createGrowProject(token, { title, investment: true });

      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ depositMinor: 2000000, mortgageMinor: 30000000 });
      expect(response.status).toBe(201);
      expect(response.body.grow.investment).toEqual({
        tag: title,
        depositMinor: 2000000,
        amountMinor: 30000000,
      });

      const liabilities = await request(app)
        .get('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(liabilities.body.liabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tag: `M-${title}`, amountMinor: 30000000 }),
        ]),
      );
    });

    it('rejects a buy on a project with no asset/share/investment kind', async () => {
      const { token } = await growToken(['grow:w']);
      const project = await createGrowProject(token, { title: `NoKind${Date.now()}` });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalAmountMinor: 100 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('rejects an investment-shaped body sent to an asset-kind project instead of silently producing NaN', async () => {
      const { token } = await growToken(['grow:w']);
      const project = await createGrowProject(token, {
        title: `KindMismatch${Date.now()}`,
        isAsset: true,
      });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ depositMinor: 10, mortgageMinor: 25000 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('renaming a share project carries over to its share, transactions, and income; a colliding rename is refused', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r', 'transactions:r']);
      const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const project = await createGrowProject(token, { title: `Coin${suffix}`, share: true });
      await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 2, priceMinor: 1000 })
        .expect(201);

      const renamed = await request(app)
        .patch(`/api/v1/grow/${project.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Token${suffix}` });
      expect(renamed.status).toBe(200);

      const shares = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`);
      const tags = shares.body.shares.map((share) => share.tag);
      expect(tags).toContain(`Token${suffix}`);
      expect(tags).not.toContain(`Coin${suffix}`);

      const transactions = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`);
      const buy = transactions.body.transactions.find((t) => t.category === `@Token${suffix}`);
      expect(buy.comment).toBe(`Buy Share Token${suffix} 2 x 10;`);

      const other = await createGrowProject(token, { title: `Other${suffix}`, share: true });
      const collision = await request(app)
        .patch(`/api/v1/grow/${other.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Token${suffix}x` });
      expect(collision.status).toBe(200);
      const onto = await request(app)
        .patch(`/api/v1/grow/${other.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Token${suffix}` });
      expect(onto.status).toBe(400);
    });

    it("lists, edits in place, and deletes a project's trades, undoing effects and reporting them", async () => {
      const { token } = await growToken([
        'grow:r',
        'grow:w',
        'balance:r',
        'transactions:r',
        'transactions:w',
      ]);
      const title = `Trade${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const project = await createGrowProject(token, { title, share: true });
      const bought = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 2, priceMinor: 1000 });
      expect(bought.status).toBe(201);
      expect(bought.body.effects.balanceSheet).toEqual([
        { type: 'share', tag: title, before: null, after: { quantity: 2, priceMinor: 1000 } },
      ]);
      const txId = bought.body.transaction.id;

      const listed = await request(app)
        .get(`/api/v1/grow/${project.id}/transactions`)
        .set('Authorization', `Bearer ${token}`);
      expect(listed.status).toBe(200);
      expect(listed.body.transactions.map((t) => t.id)).toEqual([txId]);
      expect(listed.body.transactions[0].growStatements[0]).toMatchObject({
        kind: 'buyShare',
        quantity: 2,
      });

      const locked = await request(app)
        .patch(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: -1 });
      expect(locked.status).toBe(400);

      const edited = await request(app)
        .patch(`/api/v1/grow/${project.id}/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 3 });
      expect(edited.status).toBe(200);
      expect(edited.body.transaction).toMatchObject({ id: txId, amountMinor: -3000 });

      const deleted = await request(app)
        .delete(`/api/v1/grow/${project.id}/transactions/${txId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body.effects.balanceSheet).toEqual([
        { type: 'share', tag: title, before: { quantity: 3, priceMinor: 1000 }, after: null },
      ]);
      const shares = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`);
      expect(shares.body.shares.map((share) => share.tag)).not.toContain(title);
    });

    it('rejects a generic transaction carrying a Grow trade statement', async () => {
      const { token } = await growToken(['transactions:w']);
      const response = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          account: 'Fire',
          amountMinor: -1000,
          date: '2026-09-24',
          time: '10:00',
          category: '@Anything',
          comment: 'Buy Share Anything 1 x 10;',
        });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('buys an asset-kind project by quantity x unit price', async () => {
      const { token } = await growToken(['grow:w']);
      const project = await createGrowProject(token, {
        title: `Gold${Date.now()}`,
        isAsset: true,
      });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 2.5, priceMinor: 6000 });
      expect(response.status).toBe(201);
      expect(response.body.transaction.amountMinor).toBe(-15000);
    });

    it('sell on an asset-kind project removes the asset when the sale zeroes it out', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r']);
      const title = `Boat${Date.now()}${Math.random()}`;
      const project = await createGrowProject(token, { title, isAsset: true });
      await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalAmountMinor: 120000 });

      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/sell`)
        .set('Authorization', `Bearer ${token}`)
        .send({ totalAmountMinor: 120000 });
      expect(response.status).toBe(201);
      expect(response.body.grow.status).toBe('sold');
      expect(response.body.transaction.amountMinor).toBe(120000);
      expect(response.body.transaction.account).toBe('Income');

      const assets = await request(app)
        .get('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${token}`);
      expect(assets.body.assets).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ tag: title })]),
      );
    });

    it('sell on an investment-kind project with a payback settles the attached liability atomically', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r']);
      const title = `PaidOffFlat${Date.now()}${Math.random()}`;
      const project = await createGrowProject(token, { title, investment: true });
      await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          depositMinor: 2000000,
          mortgageMinor: 30000000,
          liabilitie: { loanMinor: 231500, creditMinor: 46300 },
        });

      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/sell`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          depositMinor: 500000,
          mortgageMinor: 2900000,
          payback: { amountMinor: 231500, creditMinor: 46300 },
        });
      expect(response.status).toBe(201);
      expect(response.body.grow.liabilitie).toBeNull();
      expect(response.body.transaction.comment).toBe(
        `Payback Liabilitie 2315 463; Sell Investment ${title} 5000 29000;`,
      );

      const liabilities = await request(app)
        .get('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(liabilities.body.liabilities).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ tag: title })]),
      );
    });

    it('rejects selling a position that does not exist', async () => {
      const { token } = await growToken(['grow:w']);
      const project = await createGrowProject(token, {
        title: `NoPosition${Date.now()}`,
        share: true,
      });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/sell`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 1, priceMinor: 100 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('records a dividend transaction with no Share/Grow mutation', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r']);
      const title = `Dividend${Date.now()}${Math.random()}`;
      const project = await createGrowProject(token, { title, share: true });
      await request(app)
        .post(`/api/v1/grow/${project.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 10, priceMinor: 41500 });

      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/dividend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 10, priceMinor: 5000 });
      expect(response.status).toBe(201);
      expect(response.body.transaction.amountMinor).toBe(50000);
      expect(response.body.transaction.comment).toBe(`Dividende Share ${title} 10 x 50;`);

      const shares = await request(app)
        .get('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${token}`);
      expect(shares.body.shares).toEqual(
        expect.arrayContaining([expect.objectContaining({ tag: title, quantity: 10 })]),
      );
    });

    it('rejects a dividend on a non-share-kind project', async () => {
      const { token } = await growToken(['grow:w']);
      const project = await createGrowProject(token, {
        title: `NotShare${Date.now()}`,
        isAsset: true,
      });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/dividend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 1, priceMinor: 100 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('payback on a standalone debt-tracking project reduces the liability and Grow.liabilitie', async () => {
      const { token } = await growToken(['grow:r', 'grow:w', 'balance:r', 'balance:w']);
      const title = `Debt${Date.now()}${Math.random()}`;
      const liability = await request(app)
        .post('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`)
        .send({ tag: title, amountMinor: 500000, creditMinor: 20000 });
      expect(liability.status).toBe(201);
      const project = await createGrowProject(token, { title });
      // The embedded `.liabilitie` copy isn't set by any typed action (only PATCH's own
      // metadata fields are editable, and liabilitie is excluded from those too) — a real
      // client seeds it the same way `add-grow.component.ts` does at creation, via a direct
      // repository write (mirroring the already-shipped seedGrowProject helper's pattern).
      const usersDb = getUsersDb();
      const doc = await usersDb.get(firstUser.userId);
      const growEntry = doc.data.grow.find((g) => g.title === title);
      growEntry.liabilitie = { tag: title, amount: 5000, investment: true, credit: 200 };
      await usersDb.insert(doc);

      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/payback`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 50000, creditMinor: 10000 });
      expect(response.status).toBe(201);
      expect(response.body.grow.status).toBe('paid back');
      expect(response.body.grow.liabilitie.amountMinor).toBe(450000);

      const liabilities = await request(app)
        .get('/api/v1/balance/liabilities')
        .set('Authorization', `Bearer ${token}`);
      expect(liabilities.body.liabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tag: title, amountMinor: 450000, creditMinor: 10000 }),
        ]),
      );
    });

    it('rejects a payback when the grow project has no attached liability', async () => {
      const { token } = await growToken(['grow:w']);
      const project = await createGrowProject(token, {
        title: `NoLiability${Date.now()}`,
        isAsset: true,
      });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/payback`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 1, creditMinor: 1 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('validation_invalid');
    });

    it('records a cashflow transaction with no Grow mutation', async () => {
      const { token } = await growToken(['grow:r', 'grow:w']);
      const project = await createGrowProject(token, { title: `Cashflow${Date.now()}` });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/cashflow`)
        .set('Authorization', `Bearer ${token}`)
        .send({ cashflowMinor: 15000, creditMinor: 2000 });
      expect(response.status).toBe(201);
      expect(response.body.transaction.amountMinor).toBe(13000);
      expect(response.body.transaction.comment).toBe('CASHFLOW 150 - CREDIT 20;');
      expect(response.body.transaction.account).toBe('Income');
    });

    it('records a deposit transaction as a cash outflow', async () => {
      const { token } = await growToken(['grow:r', 'grow:w']);
      const project = await createGrowProject(token, { title: `Deposit${Date.now()}` });
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 30000 });
      expect(response.status).toBe(201);
      expect(response.body.transaction.amountMinor).toBe(-30000);
      expect(response.body.transaction.comment).toBe('Deposit 300;');
      expect(response.body.transaction.account).toBe('Fire');
    });

    it('rejects requests without the grow:w scope', async () => {
      const writer = await growToken(['grow:w']);
      const project = await createGrowProject(writer.token, {
        title: `ScopeCheck${Date.now()}`,
      });
      const { token: readOnly } = await growToken(['grow:r']);
      const response = await request(app)
        .post(`/api/v1/grow/${project.id}/deposit`)
        .set('Authorization', `Bearer ${readOnly}`)
        .send({ amountMinor: 100 });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('does not let a token act on another user’s grow project', async () => {
      const { token } = await growToken(['grow:w']);
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({ name: `grow-action-other-${Date.now()}`, scopes: ['grow:w'] });
      const otherProject = await createGrowProject(otherCreated.body.token, {
        title: `OtherUserProject${Date.now()}`,
      });
      const response = await request(app)
        .post(`/api/v1/grow/${otherProject.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amountMinor: 100 });
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });
  });

  describe('GET /reports/grow/:id/pnl', () => {
    async function growToken(scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
        name: `grow-pnl-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body;
    }

    it('sums buy/sell transactions into invested/returned/net figures', async () => {
      const { token } = await growToken(['grow:w', 'grow:r', 'reports:r']);
      const title = `PnlShare${Date.now()}${Math.random()}`;
      const project = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${token}`)
        .send({ title, share: true });
      expect(project.status).toBe(201);

      await request(app)
        .post(`/api/v1/grow/${project.body.id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 10, priceMinor: 41500 });
      await request(app)
        .post(`/api/v1/grow/${project.body.id}/sell`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 10, priceMinor: 45000 });

      const response = await request(app)
        .get(`/api/v1/reports/grow/${project.body.id}/pnl`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.title).toBe(title);
      expect(response.body.investedMinor).toBe(415000);
      expect(response.body.returnedMinor).toBe(450000);
      expect(response.body.netCashflowMinor).toBe(35000);
      expect(response.body.transactionCount).toBe(2);
    });

    it('returns 404 for a grow id that does not exist', async () => {
      const { token } = await growToken(['reports:r']);
      const response = await request(app)
        .get('/api/v1/reports/grow/grow_does_not_exist/pnl')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('does not let a token read another user’s grow project P&L', async () => {
      const otherCreated = await sessionRequest(
        'post',
        '/api/v1/auth/tokens',
        secondUser.token,
      ).send({ name: `grow-pnl-other-${Date.now()}`, scopes: ['grow:w'] });
      const otherProject = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ title: `OtherUserPnl${Date.now()}` });
      expect(otherProject.status).toBe(201);

      const { token } = await growToken(['reports:r']);
      const response = await request(app)
        .get(`/api/v1/reports/grow/${otherProject.body.id}/pnl`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('not_found');
    });

    it('rejects requests without the reports:r scope', async () => {
      const { token: writer } = await growToken(['grow:w']);
      const project = await request(app)
        .post('/api/v1/grow')
        .set('Authorization', `Bearer ${writer}`)
        .send({ title: `ScopeCheck${Date.now()}` });
      const response = await request(app)
        .get(`/api/v1/reports/grow/${project.body.id}/pnl`)
        .set('Authorization', `Bearer ${writer}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });
  });

  describe('GET /income/revenues, /income/interests, /income/properties', () => {
    // A dedicated, freshly-registered user per test — these three endpoints reflect the FULL
    // cumulative transaction history (rebuilt from scratch on every transaction write), so using
    // the shared firstUser/secondUser fixtures would make exact-value assertions fragile against
    // every other describe block's own Income-account fixtures in this same file.
    async function freshIncomeUser() {
      const user = await registerTestUser(`_income_entity_${Date.now()}_${Math.random()}`);
      const created = await request(app)
        .post('/api/v1/auth/tokens')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: `income-agent-${Date.now()}-${Math.random()}`, scopes: ['income:r'] });
      return { ...user, patToken: created.body.token };
    }

    it('reflects a new revenue tag the first time a transaction posts it', async () => {
      const user = await freshIncomeUser();
      const tag = `Salary${Date.now()}`;
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Income',
          amountMinor: 250000,
          date: '2026-09-05',
          time: '09:00',
          category: `@${tag}`,
          comment: '',
        });
      const response = await request(app)
        .get('/api/v1/income/revenues')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.status).toBe(200);
      expect(response.body.revenues).toEqual(
        expect.arrayContaining([{ tag, amountMinor: 250000 }]),
      );
    });

    it('classifies a transaction as interest income when its tag matches an existing share', async () => {
      const user = await freshIncomeUser();
      const tag = `MSFT${Date.now()}`;
      await request(app)
        .post('/api/v1/balance/shares')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ tag, quantity: 10, priceMinor: 41500 });
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Income',
          amountMinor: 8000,
          date: '2026-09-05',
          time: '09:00',
          category: `@${tag}`,
          comment: '',
        });
      const interests = await request(app)
        .get('/api/v1/income/interests')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(interests.status).toBe(200);
      expect(interests.body.interests).toEqual(
        expect.arrayContaining([{ tag, amountMinor: 8000 }]),
      );

      const revenues = await request(app)
        .get('/api/v1/income/revenues')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(revenues.body.revenues).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ tag })]),
      );
    });

    it('classifies a transaction as property income when its tag matches an existing investment', async () => {
      const user = await freshIncomeUser();
      const tag = `RentalUnit${Date.now()}`;
      await request(app)
        .post('/api/v1/balance/investments')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ tag, amountMinor: 18000000 });
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Income',
          amountMinor: 8000,
          date: '2026-09-05',
          time: '09:00',
          category: `@${tag}`,
          comment: '',
        });
      const properties = await request(app)
        .get('/api/v1/income/properties')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(properties.status).toBe(200);
      expect(properties.body.properties).toEqual(
        expect.arrayContaining([{ tag, amountMinor: 8000 }]),
      );
    });

    it('reflects an edited transaction amount', async () => {
      const user = await freshIncomeUser();
      const tag = `Salary${Date.now()}`;
      const created = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Income',
          amountMinor: 100000,
          date: '2026-09-05',
          time: '09:00',
          category: `@${tag}`,
          comment: '',
        });
      await request(app)
        .patch(`/api/v1/transactions/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ amountMinor: 150000 });
      const response = await request(app)
        .get('/api/v1/income/revenues')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.body.revenues).toEqual(
        expect.arrayContaining([{ tag, amountMinor: 150000 }]),
      );
    });

    it('removes a revenue tag once its only transaction is deleted', async () => {
      const user = await freshIncomeUser();
      const tag = `Salary${Date.now()}`;
      const created = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          account: 'Income',
          amountMinor: 100000,
          date: '2026-09-05',
          time: '09:00',
          category: `@${tag}`,
          comment: '',
        });
      await request(app)
        .delete(`/api/v1/transactions/${created.body.id}`)
        .set('Authorization', `Bearer ${user.token}`);
      const response = await request(app)
        .get('/api/v1/income/revenues')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.body.revenues).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ tag })]),
      );
    });

    it('rejects requests without the income:r scope', async () => {
      const user = await freshIncomeUser();
      const writeOnly = await request(app)
        .post('/api/v1/auth/tokens')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ name: `write-not-income-${Date.now()}`, scopes: ['transactions:w'] });
      const response = await request(app)
        .get('/api/v1/income/revenues')
        .set('Authorization', `Bearer ${writeOnly.body.token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('scope_insufficient');
    });

    it('keeps revenues isolated to the authenticated user document', async () => {
      const user = await freshIncomeUser();
      const other = await freshIncomeUser();
      const tag = `OnlyOtherUserRevenue${Date.now()}`;
      await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${other.token}`)
        .send({
          account: 'Income',
          amountMinor: 999900,
          date: '2026-09-05',
          time: '09:00',
          category: `@${tag}`,
          comment: '',
        });
      const response = await request(app)
        .get('/api/v1/income/revenues')
        .set('Authorization', `Bearer ${user.patToken}`);
      expect(response.status).toBe(200);
      expect(response.body.revenues).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ tag })]),
      );
    });
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

  it('refuses to purge a token that has not been revoked yet', async () => {
    const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'not-yet-revoked',
      scopes: ['transactions:r'],
    });
    const response = await sessionRequest(
      'delete',
      `/api/v1/auth/tokens/${created.body.tokenId}/purge`,
    );
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('conflict_token_not_revoked');

    const list = await sessionRequest('get', '/api/v1/auth/tokens');
    expect(list.body.tokens).toEqual(
      expect.arrayContaining([expect.objectContaining({ tokenId: created.body.tokenId })]),
    );
  });

  it('permanently deletes a revoked token', async () => {
    const created = await sessionRequest('post', '/api/v1/auth/tokens').send({
      name: 'to-be-purged',
      scopes: ['transactions:r'],
    });
    await sessionRequest('delete', `/api/v1/auth/tokens/${created.body.tokenId}`);

    const response = await sessionRequest(
      'delete',
      `/api/v1/auth/tokens/${created.body.tokenId}/purge`,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tokenId: created.body.tokenId, deleted: true });

    const list = await sessionRequest('get', '/api/v1/auth/tokens');
    expect(list.body.tokens).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ tokenId: created.body.tokenId })]),
    );

    const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
      resource: 'auth_tokens',
    });
    expect(auditEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: { type: 'session' },
          method: 'DELETE',
          resourceId: created.body.tokenId,
        }),
      ]),
    );
  });

  it('does not let a session purge another user’s revoked PAT', async () => {
    const created = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
      name: 'other-user-revoked-agent',
      scopes: ['transactions:r'],
    });
    await sessionRequest('delete', `/api/v1/auth/tokens/${created.body.tokenId}`, secondUser.token);

    const response = await sessionRequest(
      'delete',
      `/api/v1/auth/tokens/${created.body.tokenId}/purge`,
    );
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('not_found');
  });

  describe('Account (GET/PATCH/DELETE /account, POST /account/verify-password)', () => {
    // Fresh user per test — email changes and account deletion are
    // destructive/identity-sensitive; a shared account would corrupt other
    // tests.
    async function accountUser() {
      return registerTestUser(`_account_${Date.now()}_${Math.random()}`);
    }

    async function accountToken(sessionToken, scopes) {
      const created = await sessionRequest('post', '/api/v1/auth/tokens', sessionToken).send({
        name: `account-agent-${Date.now()}-${Math.random()}`,
        scopes,
      });
      return created.body.token;
    }

    describe('GET /account', () => {
      it('returns the account email, readable via a PAT with account:r', async () => {
        const user = await accountUser();
        const token = await accountToken(user.token, ['account:r']);
        const response = await request(app)
          .get('/api/v1/account')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(response.body.email).toBe(user.email);
      });

      it('requires the account:r scope', async () => {
        const user = await accountUser();
        const token = await accountToken(user.token, ['transactions:r']);
        const response = await request(app)
          .get('/api/v1/account')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
        expect(response.body.code).toBe('scope_insufficient');
      });
    });

    describe('PATCH /account', () => {
      it('updates the email via a session and reissues the session cookie with the full 24h lifetime', async () => {
        const user = await accountUser();
        const newEmail = `updated_${Date.now()}@test.local`;
        const response = await sessionRequest('patch', '/api/v1/account', user.token).send({
          email: newEmail,
        });
        expect(response.status).toBe(200);
        expect(response.body.email).toBe(newEmail);

        const cookies = response.headers['set-cookie'] || [];
        const accessCookie = cookies.find((c) => c.startsWith('access_token='));
        expect(accessCookie).toBeDefined();
        // 24h = 86400s — the fixed value; the legacy bug set this to 900 (15 min).
        expect(accessCookie).toContain('Max-Age=86400');

        // The stored account record must reflect the change immediately,
        // independent of which token reads it back.
        const readToken = await accountToken(user.token, ['account:r']);
        const getResponse = await request(app)
          .get('/api/v1/account')
          .set('Authorization', `Bearer ${readToken}`);
        expect(getResponse.body.email).toBe(newEmail);
      });

      it('also updates data.info.email in the same operation', async () => {
        const user = await accountUser();
        const newEmail = `updated_${Date.now()}@test.local`;
        await sessionRequest('patch', '/api/v1/account', user.token).send({ email: newEmail });

        const exportToken = await accountToken(user.token, ['data:bulk']);
        const exported = await request(app)
          .get('/api/v1/data/export')
          .set('Authorization', `Bearer ${exportToken}`);
        expect(exported.body.data.info.email).toBe(newEmail);
      });

      it('rejects a malformed email', async () => {
        const user = await accountUser();
        const response = await sessionRequest('patch', '/api/v1/account', user.token).send({
          email: 'not-an-email',
        });
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('validation_invalid');
      });

      it('rejects an email already used by another account', async () => {
        const userA = await accountUser();
        const userB = await accountUser();
        const response = await sessionRequest('patch', '/api/v1/account', userA.token).send({
          email: userB.email,
        });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('conflict_email_taken');
      });

      it('rejects a PAT, regardless of scope', async () => {
        const user = await accountUser();
        const token = await accountToken(user.token, ['account:r', 'account:w']);
        const response = await request(app)
          .patch('/api/v1/account')
          .set('Authorization', `Bearer ${token}`)
          .send({ email: `pat-attempt-${Date.now()}@test.local` });
        expect(response.status).toBe(403);
        expect(response.body.code).toBe('auth_session_required');
      });

      it('rejects an unrecognized field', async () => {
        const user = await accountUser();
        const response = await sessionRequest('patch', '/api/v1/account', user.token).send({
          username: 'nope',
        });
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('validation_invalid');
      });
    });

    describe('POST /account/verify-password', () => {
      it('returns valid: true for the correct password', async () => {
        const user = await accountUser();
        const response = await sessionRequest(
          'post',
          '/api/v1/account/verify-password',
          user.token,
        ).send({ password: 'TestPassword123!' });
        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(true);
      });

      it('rejects an incorrect password', async () => {
        const user = await accountUser();
        const response = await sessionRequest(
          'post',
          '/api/v1/account/verify-password',
          user.token,
        ).send({ password: 'wrong-password' });
        expect(response.status).toBe(401);
      });

      it('rejects a PAT, regardless of scope', async () => {
        const user = await accountUser();
        const token = await accountToken(user.token, ['account:r', 'account:w']);
        const response = await request(app)
          .post('/api/v1/account/verify-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ password: 'TestPassword123!' });
        expect(response.status).toBe(403);
        expect(response.body.code).toBe('auth_session_required');
      });
    });

    describe('DELETE /account', () => {
      it('requires confirm: true', async () => {
        const user = await accountUser();
        const response = await sessionRequest('delete', '/api/v1/account', user.token).send({});
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('validation_invalid');
      });

      it('rejects a PAT, regardless of scope', async () => {
        const user = await accountUser();
        const token = await accountToken(user.token, ['account:r', 'account:w']);
        const response = await request(app)
          .delete('/api/v1/account')
          .set('Authorization', `Bearer ${token}`)
          .send({ confirm: true });
        expect(response.status).toBe(403);
        expect(response.body.code).toBe('auth_session_required');
      });

      it('deletes the account and every PAT belonging to it, so a leaked PAT can no longer authenticate', async () => {
        const user = await accountUser();
        const token = await accountToken(user.token, ['transactions:r']);

        // Confirm the PAT works before deletion.
        const before = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
        expect(before.status).toBe(200);

        const response = await sessionRequest('delete', '/api/v1/account', user.token).send({
          confirm: true,
        });
        expect(response.status).toBe(200);
        expect(response.body.deletedTokenCount).toBe(1);

        // The same PAT must no longer authenticate — its document is gone.
        const after = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
      });

      it('clears the session cookies', async () => {
        const user = await accountUser();
        const response = await sessionRequest('delete', '/api/v1/account', user.token).send({
          confirm: true,
        });
        expect(response.status).toBe(200);
        const cookies = response.headers['set-cookie'] || [];
        const cleared = cookies.find((c) => c.startsWith('access_token='));
        expect(cleared).toBeDefined();
        expect(cleared).toMatch(/access_token=;/);
      });

      it('does not affect another user’s account or tokens', async () => {
        const userA = await accountUser();
        const userB = await accountUser();
        const tokenB = await accountToken(userB.token, ['transactions:r']);

        await sessionRequest('delete', '/api/v1/account', userA.token).send({ confirm: true });

        const stillWorks = await request(app)
          .get('/api/v1/me')
          .set('Authorization', `Bearer ${tokenB}`);
        expect(stillWorks.status).toBe(200);
      });
    });
  });
});
