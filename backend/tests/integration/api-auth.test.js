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
    expect(response.body).toEqual({ id: created.body.id });
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
