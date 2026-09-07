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
        { asset: { assets: [{ id: 'assets_fixture_other', tag: 'Only second user asset', amount: 999900 }] } },
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
        { title: 'Netflix', category: '@KpiNetflix', amount: -1000000 },
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
        .send({ name: `fire-coverage-agent-${Date.now()}-${Math.random()}`, scopes: ['reports:r'] });
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
        .send({ name: `write-not-reports-fire-coverage-${Date.now()}`, scopes: ['transactions:w'] });
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
      const response = await request(app).get('/api/v1/mojo').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        amountMinor: 150000,
        targetMinor: 200000,
        remainingMinor: 50000,
        percentFilled: 75,
      });
    });

    it('updates only the target, leaving the derived amount untouched, and audit logs the write', async () => {
      const { token, tokenId } = await mojoToken(['mojo:r', 'mojo:w']);
      await setMojo(firstUser.userId, { amount: 1500, target: 2000 });
      const response = await request(app)
        .put('/api/v1/mojo')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetMinor: 300000 });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        amountMinor: 150000,
        targetMinor: 300000,
        remainingMinor: 150000,
        percentFilled: 50,
      });
      const stored = await getUsersDb().get(firstUser.userId);
      expect(stored.data.mojo.amount).toBe(1500);
      expect(stored.data.mojo.target).toBe(3000);
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'mojo' });
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
      const getResponse = await request(app).get('/api/v1/mojo').set('Authorization', `Bearer ${writeOnly}`);
      expect(getResponse.status).toBe(403);
      expect(getResponse.body.code).toBe('scope_insufficient');
    });

    it('keeps Mojo status isolated to the authenticated user document', async () => {
      const { token } = await mojoToken(['mojo:r']);
      await setMojo(firstUser.userId, { amount: 1000, target: 2000 });
      await setMojo(secondUser.userId, { amount: 999900, target: 999900 });
      const response = await request(app).get('/api/v1/mojo').set('Authorization', `Bearer ${token}`);
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
      const response = await request(app).get('/api/v1/smile').set('Authorization', `Bearer ${token}`);
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
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'smile' });
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
          buckets: [{ title: 'Flights', targetMinor: 150000 }, { title: 'Hotel', targetMinor: 80000 }],
          links: [{ label: 'Trip site', url: 'https://example.com' }],
          actionItems: [{ text: 'Book flights', priority: 'high' }],
          notes: [{ text: 'Remember passports' }],
        });
      expect(response.status).toBe(201);
      expect(response.body.buckets.map((b) => b.title)).toEqual(['Flights', 'Hotel']);
      expect(response.body.totals.targetMinor).toBe(230000);
      expect(response.body.links).toEqual([{ label: 'Trip site', url: 'https://example.com' }]);
      expect(response.body.actionItems).toEqual([{ text: 'Book flights', done: false, priority: 'high' }]);
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
      const getResponse = await request(app).get('/api/v1/smile').set('Authorization', `Bearer ${writeOnly}`);
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
      const response = await request(app).get('/api/v1/smile').set('Authorization', `Bearer ${token}`);
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
        .send({ title: `Smile Id Test ${Date.now()}-${Math.random()}`, targetMinor: 100000, ...overrides });
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
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'smile' });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'PATCH', resourceId: created.id }),
        ]),
      );
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
            { id: existingBucketId, title: created.buckets[0].title, targetMinor: 200000, amountMinor: 50000 },
            { title: 'New Bucket', targetMinor: 30000 },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.buckets[0]).toMatchObject({ id: existingBucketId, targetMinor: 200000, amountMinor: 50000 });
      expect(response.body.buckets[1].id).not.toBe(existingBucketId);
      expect(response.body.totals.targetMinor).toBe(230000);
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
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'smile' });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'DELETE', resourceId: created.id }),
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

    it('does not let one user read, patch, or delete another user\'s Smile project', async () => {
      const { token: ownerToken } = await smileToken(['smile:w']);
      const created = await createProject(ownerToken);

      const otherUserSmileToken = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
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
        .send({ title: `Smile Plan Test ${Date.now()}-${Math.random()}`, targetMinor: 300000, ...overrides });
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

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'smile' });
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
      const otherCreated = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
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
      const response = await request(app).get('/api/v1/fire').set('Authorization', `Bearer ${token}`);
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
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'fire' });
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
          buckets: [{ title: 'Flights', targetMinor: 150000 }, { title: 'Hotel', targetMinor: 80000 }],
          links: [{ label: 'Trip site', url: 'https://example.com' }],
          actionItems: [{ text: 'Book flights', priority: 'high' }],
          notes: [{ text: 'Remember passports' }],
        });
      expect(response.status).toBe(201);
      expect(response.body.buckets.map((b) => b.title)).toEqual(['Flights', 'Hotel']);
      expect(response.body.totals.targetMinor).toBe(230000);
      expect(response.body.links).toEqual([{ label: 'Trip site', url: 'https://example.com' }]);
      expect(response.body.actionItems).toEqual([{ text: 'Book flights', done: false, priority: 'high' }]);
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
      const getResponse = await request(app).get('/api/v1/fire').set('Authorization', `Bearer ${writeOnly}`);
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
      const response = await request(app).get('/api/v1/fire').set('Authorization', `Bearer ${token}`);
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
        .send({ title: `Fire Id Test ${Date.now()}-${Math.random()}`, targetMinor: 100000, ...overrides });
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
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'fire' });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'PATCH', resourceId: created.id }),
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
            { id: existingBucketId, title: created.buckets[0].title, targetMinor: 200000, amountMinor: 50000 },
            { title: 'New Bucket', targetMinor: 30000 },
          ],
        });
      expect(response.status).toBe(200);
      expect(response.body.buckets[0]).toMatchObject({ id: existingBucketId, targetMinor: 200000, amountMinor: 50000 });
      expect(response.body.buckets[1].id).not.toBe(existingBucketId);
      expect(response.body.totals.targetMinor).toBe(230000);
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
      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'fire' });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'DELETE', resourceId: created.id }),
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

    it('does not let one user read, patch, or delete another user\'s Fire project', async () => {
      const { token: ownerToken } = await fireToken(['fire:w']);
      const created = await createProject(ownerToken);

      const otherUserFireToken = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
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
        .send({ title: `Fire Plan Test ${Date.now()}-${Math.random()}`, targetMinor: 300000, ...overrides });
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

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, { resource: 'fire' });
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
      const otherCreated = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
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

      const list = await request(app).get('/api/v1/balance/assets').set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.assets).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
      );

      const auditEntries = await queryAuditEntries(getAuditDb(), firstUser.userId, {
        resource: 'balance_assets',
      });
      expect(auditEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'POST', resourceId: created.body.id }),
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
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'PATCH', resourceId: created.body.id }),
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
          expect.objectContaining({ actor: { type: 'token', tokenId }, method: 'DELETE', resourceId: created.body.id }),
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
      const otherCreated = await sessionRequest('post', '/api/v1/auth/tokens', secondUser.token).send({
        name: `balance-other-${Date.now()}`,
        scopes: ['balance:w'],
      });
      const otherAsset = await request(app)
        .post('/api/v1/balance/assets')
        .set('Authorization', `Bearer ${otherCreated.body.token}`)
        .send({ tag: `Only Other User Asset ${Date.now()}`, amountMinor: 999900 });
      expect(otherAsset.status).toBe(201);

      const list = await request(app).get('/api/v1/balance/assets').set('Authorization', `Bearer ${token}`);
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
