'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EncryptionSession } = require('@money/domain');
const {
  recalculateUserData,
  RecalculateError,
  exportUserData,
  importUserData,
  ImportError,
} = require('../../repositories/data-repository');

describe('exportUserData', () => {
  it('returns the document data as-is, plus createdAt/updatedAt, for an unencrypted account', async () => {
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          _rev: '1-a',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          data: { transactions: [{ id: 'tx_1', amount: -12.5 }], meta: { schemaVersion: 1 } },
        })),
      },
      authDb: { get: jest.fn(async () => ({})) },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result).toEqual({
      data: { transactions: [{ id: 'tx_1', amount: -12.5 }], meta: { schemaVersion: 1 } },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('decrypts every encrypted value in the document, unlike the legacy as-stored export', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            transactions: [{ id: 'tx_1', amount: session.encrypt('-12.5') }],
            smile: [{ title: session.encrypt('Vacation') }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    // A real number, not the stringified form encryption stores it as —
    // matches what an unencrypted account's export returns for the same field.
    expect(result.data.transactions[0].amount).toBe(-12.5);
    expect(typeof result.data.transactions[0].amount).toBe('number');
    expect(result.data.smile[0].title).toBe('Vacation');
  });

  it('recovers quantity/riskScore as numbers too, not just documented money fields', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            grow: [{ riskScore: session.encrypt('4'), share: { quantity: session.encrypt('12') } }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result.data.grow[0].riskScore).toBe(4);
    expect(result.data.grow[0].share.quantity).toBe(12);
  });

  it('recovers settings.allocation fields as numbers and boolean fields as real booleans', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            settings: {
              isEuropeanFormat: session.encrypt('true'),
              allocation: {
                daily: session.encrypt('60'),
                splurge: session.encrypt('10'),
                smile: session.encrypt('10'),
                fire: session.encrypt('20'),
              },
            },
            grow: [{ isAsset: session.encrypt('false') }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result.data.settings.allocation).toEqual({
      daily: 60,
      splurge: 10,
      smile: 10,
      fire: 20,
    });
    expect(result.data.settings.isEuropeanFormat).toBe(true);
    expect(result.data.grow[0].isAsset).toBe(false);
  });

  it('recovers manuallyAdjusted on a Smile/Fire payment plan as a real boolean', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            smile: [{ plannedSubscriptions: [{ manuallyAdjusted: session.encrypt('true') }] }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result.data.smile[0].plannedSubscriptions[0].manuallyAdjusted).toBe(true);
  });

  it('throws rather than silently returning leftover ciphertext when encryptDatabase was toggled off', async () => {
    // PUT /encryption-config allows turning encryptDatabase off without re-encrypting
    // already-stored data — getEncryptionSession then returns null even though the
    // document can still hold real ciphertext from when it was on.
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: { transactions: [{ id: 'tx_1', amount: session.encrypt('-12.5') }] },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: false },
        })),
      },
    };

    await expect(exportUserData(deps, 'user_1')).rejects.toThrow(/no decrypt callback/);
  });

  it('never includes the encryption config or key, since it only ever reads usersDb data', async () => {
    const usersDb = {
      get: jest.fn(async () => ({ _id: 'user_1', data: { transactions: [] } })),
    };
    const authDb = {
      get: jest.fn(async () => ({
        encryptionConfig: { key: 'super-secret-key', encryptLocal: true, encryptDatabase: true },
      })),
    };

    const result = await exportUserData({ usersDb, authDb }, 'user_1');

    expect(JSON.stringify(result)).not.toContain('super-secret-key');
    expect(result.encryptionConfig).toBeUndefined();
  });

  it('returns an empty document for a user with no data yet, matching the legacy 404 fallback', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    const result = await exportUserData({ usersDb, authDb }, 'user_1');

    expect(result).toEqual({ data: {}, createdAt: null, updatedAt: null });
  });

  it('propagates a real (non-404) database error rather than masking it as empty data', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    await expect(exportUserData({ usersDb, authDb }, 'user_1')).rejects.toThrow('ECONNRESET');
  });
});

describe('recalculateUserData', () => {
  it('forces a full derived-state recalculation and reports the transaction count', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        mojo: { amount: 0, target: 100 },
        smile: [],
        fire: [],
        transactions: [
          {
            id: 'tx_1',
            account: 'Income',
            amount: 1250,
            date: '2026-09-06',
            time: '09:00',
            category: '@Salary',
            comment: 'Pay',
          },
        ],
      },
    };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result).toEqual({ transactionCount: 1 });
    // The recalculation actually ran and wrote the derived accounting state
    // back, not just re-saved the transactions untouched.
    expect(document.data.income.revenue.revenues).toEqual([{ tag: 'Salary', amount: 1250 }]);
  });

  it('does not add, remove, or otherwise change the stored transactions themselves', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -12.5,
            date: '2026-01-01',
            time: '08:00',
            category: '@Food',
            comment: '',
          },
          {
            id: 'tx_2',
            account: 'Income',
            amount: 3000,
            date: '2026-01-02',
            time: '09:00',
            category: '@Salary',
            comment: '',
          },
        ],
      },
    };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({})) },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result.transactionCount).toBe(2);
    expect(document.data.transactions).toHaveLength(2);
    expect(document.data.transactions.map((tx) => tx.id).sort()).toEqual(['tx_1', 'tx_2']);
  });

  it('recalculates an encrypted document, decrypting and re-encrypting the derived fields', async () => {
    const session = new EncryptionSession('secret');
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: session.encrypt('tx_1'),
            account: session.encrypt('Income'),
            amount: session.encrypt('1250'),
            date: session.encrypt('2026-09-06'),
            time: session.encrypt('09:00'),
            category: session.encrypt('@Salary'),
            comment: session.encrypt('Pay'),
          },
        ],
      },
    };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result.transactionCount).toBe(1);
    expect(session.decrypt(document.data.income.revenue.revenues[0].tag)).toBe('Salary');
  });

  it('returns a zero count without writing anything for a user with no document yet', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }),
      insert: jest.fn(),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    const result = await recalculateUserData({ usersDb, authDb }, 'user_1');

    expect(result).toEqual({ transactionCount: 0 });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('refuses to recalculate rather than silently dropping a zero-amount transaction', async () => {
    // recalculateFundState (packages/domain/src/transactions/fund-state.ts) excludes any
    // transaction with amountMinor === 0 from its output, and withTransactionsWrite writes back
    // exactly what that engine returns — so recalculating an account holding a zero-amount
    // transaction (impossible to create through this API, but reachable via legacy or imported
    // data) would otherwise silently delete it on write. This must refuse instead.
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: 0,
            date: '2026-01-01',
            time: '08:00',
            category: '@Log',
            comment: '',
          },
          {
            id: 'tx_2',
            account: 'Income',
            amount: 3000,
            date: '2026-01-02',
            time: '09:00',
            category: '@Salary',
            comment: '',
          },
        ],
      },
    };
    const usersDb = {
      get: jest.fn(async () => structuredClone(document)),
      insert: jest.fn(async (next) => {
        document = { ...next, _rev: '2-b' };
      }),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    await expect(recalculateUserData({ usersDb, authDb }, 'user_1')).rejects.toThrow(
      RecalculateError,
    );
    await expect(recalculateUserData({ usersDb, authDb }, 'user_1')).rejects.toMatchObject({
      code: 'RECALCULATE_WOULD_DROP_TRANSACTIONS',
    });

    // Nothing was written — both transactions are still exactly as stored.
    expect(usersDb.insert).not.toHaveBeenCalled();
    expect(document.data.transactions).toHaveLength(2);
  });

  it('retries on a CouchDB write conflict', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -5,
            date: '2026-01-01',
            time: '08:00',
            category: '@Food',
            comment: '',
          },
        ],
      },
    };
    let insertAttempts = 0;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          insertAttempts += 1;
          if (insertAttempts === 1) {
            const err = new Error('conflict');
            err.statusCode = 409;
            throw err;
          }
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({})) },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result.transactionCount).toBe(1);
    expect(insertAttempts).toBeGreaterThanOrEqual(2);
  });
});

describe('importUserData', () => {
  let backupDir;

  beforeEach(() => {
    backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-test-'));
  });

  afterEach(() => {
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  function makeDb(initialDoc) {
    let doc = initialDoc;
    return {
      get: jest.fn(async () => {
        if (!doc) {
          const err = new Error('not_found');
          err.statusCode = 404;
          throw err;
        }
        return JSON.parse(JSON.stringify(doc));
      }),
      insert: jest.fn(async (next) => {
        doc = { ...next, _rev: `${(parseInt((doc && doc._rev) || '1', 10) || 1) + 1}-mock` };
      }),
      _getCurrent: () => doc,
    };
  }

  it('rejects a request without confirm: true', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData({ usersDb, authDb }, 'user_1', { data: {} }, { backupDir }),
    ).rejects.toThrow(ImportError);
  });

  it('rejects a request with no data object', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData({ usersDb, authDb }, 'user_1', { confirm: true }, { backupDir }),
    ).rejects.toThrow(ImportError);
  });

  it('rejects a schema-version mismatch against an existing account', async () => {
    const usersDb = makeDb({
      _id: 'user_1',
      _rev: '1-a',
      data: { meta: { schemaVersion: 1 }, transactions: [] },
    });
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        { confirm: true, data: { meta: { schemaVersion: 2 }, transactions: [] } },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_SCHEMA_VERSION_MISMATCH' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('allows any schema version for a brand-new account with no prior document', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      { confirm: true, data: { meta: { schemaVersion: 2 }, transactions: [] } },
      { backupDir },
    );
    expect(result.schemaVersion).toBe(2);
  });

  it('refuses to import a zero-amount transaction rather than silently dropping it', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [
              {
                id: 'tx_1',
                account: 'Daily',
                amount: 0,
                date: '2026-01-01',
                time: '08:00',
                category: '@Log',
                comment: '',
              },
            ],
          },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_WOULD_DROP_TRANSACTIONS' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('imports a full unencrypted document and recalculates derived state from the imported transactions', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };

    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      {
        confirm: true,
        data: {
          meta: { schemaVersion: 1, currency: 'EUR' },
          info: { email: 'a@test.local', username: 'a' },
          settings: { username: 'a', theme: 'dark' },
          transactions: [
            {
              id: 'tx_1',
              account: 'Income',
              amount: 5000,
              date: '2026-01-01',
              time: '09:00',
              category: '@Salary',
              comment: '',
            },
          ],
          balance: { asset: { assets: [], shares: [], investments: [] }, liabilities: [] },
          grow: [],
          budget: [],
          subscriptions: [],
          smile: [],
          fire: [],
          mojo: { target: 500 },
        },
      },
      { backupDir },
    );

    expect(result.transactionCount).toBe(1);
    expect(result.schemaVersion).toBe(1);
    expect(result.backupFile).toBeNull(); // no prior document existed to back up

    const stored = usersDb._getCurrent();
    expect(stored.data.transactions[0]).toMatchObject({ account: 'Income', amount: 5000 });
    expect(stored.data.income.revenue.revenues).toEqual([{ tag: 'Salary', amount: 5000 }]);
    expect(stored.data.mojo).toEqual({ target: 500, amount: 0 });
    expect(stored.data.info).toEqual({ email: 'a@test.local', username: 'a' });
    expect(stored.data.settings.username).toBe('a');
  });

  it('round-trips a full encrypted document (assets/shares/grow/smile) through import then export', async () => {
    const usersDb = makeDb(null);
    const authDb = {
      get: jest.fn(async () => ({
        encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
      })),
    };

    const importPayload = {
      confirm: true,
      data: {
        meta: { schemaVersion: 1, currency: 'EUR' },
        info: { email: 'b@test.local', username: 'b' },
        settings: { username: 'b', isEuropeanFormat: false },
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -50,
            date: '2026-01-02',
            time: '10:00',
            category: '@Groceries',
            comment: '',
          },
        ],
        smile: [
          {
            id: 'smile_1',
            title: 'Vacation',
            sub: '',
            phase: 'active',
            description: '',
            buckets: [{ id: 'bucket_1', title: 'Flights', target: 1000, amount: 0 }],
            links: [],
            notes: [],
            actionItems: [],
            plannedSubscriptions: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        fire: [],
        grow: [
          {
            id: 'grow_1',
            title: 'Rental',
            sub: '',
            phase: 'active',
            description: '',
            strategy: '',
            riskScore: 3,
            risks: '',
            links: [],
            actionItems: [],
            notes: [],
            cashflow: 0,
            amount: 0,
            isAsset: false,
            share: null,
            investment: null,
            liabilitie: { tag: 'Rental', amount: 150000, investment: true, credit: 4200 },
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        budget: [],
        subscriptions: [],
        balance: {
          asset: {
            assets: [{ id: 'assets_1', tag: 'Car', amount: 20000 }],
            shares: [{ id: 'shares_1', tag: 'RentalShare', quantity: 10, price: 2500 }],
            investments: [],
          },
          liabilities: [],
        },
        mojo: { target: 1000 },
      },
    };

    await importUserData({ usersDb, authDb }, 'user_1', importPayload, { backupDir });

    // Stored form must actually be ciphertext.
    const stored = usersDb._getCurrent();
    expect(stored.data.transactions[0].amount).toMatch(/^v2:/);
    expect(stored.data.grow[0].riskScore).toMatch(/^v2:/);
    expect(stored.data.info).toEqual({ email: 'b@test.local', username: 'b' }); // never encrypted
    expect(stored.data.meta).toEqual({ schemaVersion: 1, currency: 'EUR' }); // never encrypted

    // Re-exporting must recover the exact original plaintext content.
    const exported = await exportUserData({ usersDb, authDb }, 'user_1');
    expect(exported.data.transactions[0]).toMatchObject({ account: 'Daily', amount: -50 });
    expect(exported.data.grow[0]).toMatchObject({ riskScore: 3, isAsset: false });
    expect(exported.data.grow[0].liabilitie).toEqual({
      tag: 'Rental',
      amount: 150000,
      investment: true,
      credit: 4200,
    });
    expect(exported.data.smile[0].buckets[0]).toMatchObject({ title: 'Flights', target: 1000 });
    expect(exported.data.balance.asset.assets[0]).toEqual({
      id: 'assets_1',
      tag: 'Car',
      amount: 20000,
    });
    expect(exported.data.balance.asset.shares[0]).toEqual({
      id: 'shares_1',
      tag: 'RentalShare',
      quantity: 10,
      price: 2500,
    });
  });

  it('writes a timestamped backup of the pre-import document before overwriting', async () => {
    const usersDb = makeDb({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        meta: { schemaVersion: 1, currency: 'EUR' },
        transactions: [
          {
            id: 'tx_old',
            account: 'Daily',
            amount: -1,
            date: '2026-01-01',
            time: '08:00',
            category: '@Old',
            comment: '',
          },
        ],
      },
    });
    const authDb = { get: jest.fn(async () => ({})) };

    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      {
        confirm: true,
        data: {
          meta: { schemaVersion: 1, currency: 'EUR' },
          transactions: [
            {
              id: 'tx_new',
              account: 'Daily',
              amount: -2,
              date: '2026-01-02',
              time: '09:00',
              category: '@New',
              comment: '',
            },
          ],
        },
      },
      { backupDir },
    );

    expect(result.backupFile).toEqual(expect.any(String));
    expect(fs.existsSync(result.backupFile)).toBe(true);
    const backup = JSON.parse(fs.readFileSync(result.backupFile, 'utf8'));
    expect(backup.data.transactions[0].id).toBe('tx_old');

    const stored = usersDb._getCurrent();
    expect(stored.data.transactions[0].id).toBe('tx_new');
  });

  it('rejects invalid nested data with a clear error instead of an opaque crash', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [{ account: 'Daily', amount: -5 }], // missing id, date, time, category
          },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
  });

  it('retries on a CouchDB write conflict', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    const originalInsert = usersDb.insert;
    let attempts = 0;
    usersDb.insert = jest.fn(async (doc) => {
      attempts += 1;
      if (attempts === 1) {
        const err = new Error('conflict');
        err.statusCode = 409;
        throw err;
      }
      return originalInsert(doc);
    });

    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      { confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } },
      { backupDir },
    );

    expect(result.transactionCount).toBe(0);
    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  it('rejects a present-but-malformed collection instead of silently wiping it', async () => {
    // requireArrayField must distinguish "key absent" (legitimate — a real
    // export omits a collection a brand-new account never touched) from
    // "key present but not an array" (malformed/corrupted input) — the
    // latter must never be silently coerced into "delete everything here".
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: { meta: { schemaVersion: 1 }, transactions: [], grow: 'not-an-array' },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed transactions field instead of silently importing zero transactions', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        { confirm: true, data: { meta: { schemaVersion: 1 }, transactions: null } },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed balance object rather than silently wiping assets/shares/investments/liabilities', async () => {
    // importedData.balance?.asset?.assets-style optional chaining makes a
    // malformed *intermediate* object (balance: null) indistinguishable
    // from "genuinely absent" once it reaches the leaf array check — the
    // intermediate object itself must be validated too.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        { confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [], balance: null } },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed balance.asset object rather than silently wiping assets/shares/investments', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [],
            balance: { asset: 'not-an-object', liabilities: [] },
          },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed meta, info, or mojo object rather than silently corrupting or resetting it', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    for (const badField of ['meta', 'info', 'mojo']) {
      await expect(
        importUserData(
          { usersDb, authDb },
          'user_1',
          {
            confirm: true,
            data: { meta: { schemaVersion: 1 }, transactions: [], [badField]: 'garbage-string' },
          },
          { backupDir },
        ),
      ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    }
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed settings value rather than silently resetting allocation ratios to defaults', async () => {
    // decryptSettings's own fallback logic treats any malformed-but-truthy
    // settings value as "every field absent" and silently substitutes
    // DEFAULT_SETTINGS (including the user's real Daily/Splurge/Smile/Fire
    // allocation ratios) — settings must be validated before reaching it,
    // the same as every other object field in this function.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    for (const badSettings of ['garbage-string', ['not-an-object'], 42]) {
      await expect(
        importUserData(
          { usersDb, authDb },
          'user_1',
          {
            confirm: true,
            data: { meta: { schemaVersion: 1 }, transactions: [], settings: badSettings },
          },
          { backupDir },
        ),
      ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    }
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed meta.currency rather than silently persisting a corrupted value', async () => {
    // A bare `value || 'EUR'` fallback only substitutes for falsy values —
    // a malformed-but-truthy currency (an object, an array, NaN) would
    // otherwise be written straight into storage, corrupting the one field
    // every downstream money computation for the account depends on.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    for (const badCurrency of [{}, [], NaN, '']) {
      await expect(
        importUserData(
          { usersDb, authDb },
          'user_1',
          {
            confirm: true,
            data: {
              meta: { schemaVersion: 1, currency: badCurrency },
              transactions: [],
            },
          },
          { backupDir },
        ),
      ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    }
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a malformed settings.allocation field type rather than silently corrupting it to NaN', async () => {
    // decryptAllocation's own `Number(x ?? default)` only guards against a
    // MISSING field, not a present-but-wrong-type one — a string/object/NaN
    // per field would otherwise silently become NaN in storage with no error.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [],
            settings: { allocation: { daily: 'not-a-number', splurge: 10, smile: 10, fire: 20 } },
          },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('rejects a settings.allocation that does not sum to 100', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [],
            settings: { allocation: { daily: 90, splurge: 90, smile: 90, fire: 90 } },
          },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('allows an absent settings.allocation to fall back to defaults', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      {
        confirm: true,
        data: { meta: { schemaVersion: 1 }, transactions: [], settings: { username: 'x' } },
      },
      { backupDir },
    );
    expect(result.transactionCount).toBe(0);
    expect(usersDb._getCurrent().data.settings.allocation).toEqual({
      daily: 60,
      splurge: 10,
      smile: 10,
      fire: 20,
    });
  });

  it('rejects a malformed Smile bucket target with a clean 400 instead of an unwrapped 500', async () => {
    // decryptMoney (smile-repository.js) has no Number.isFinite check of its
    // own — a malformed target silently becomes NaN and survives the first
    // validation pass untouched. It's only caught downstream, inside
    // applyDerivedState's readNumber (transaction-derived-state.js), which
    // throws a plain Error — that throw must be translated into the same
    // clean ImportError/IMPORT_INVALID_DATA every other malformed field
    // gets, not propagate as an unwrapped 500.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        {
          confirm: true,
          data: {
            meta: { schemaVersion: 1 },
            transactions: [],
            smile: [
              {
                id: 'smile_1',
                title: 'Vacation',
                sub: '',
                phase: 'active',
                description: '',
                buckets: [{ id: 'bucket_1', title: 'Flights', target: 'not-a-number', amount: 0 }],
                links: [],
                notes: [],
                actionItems: [],
                plannedSubscriptions: [],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('accepts a well-formed settings object and a valid currency, applying both correctly', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      {
        confirm: true,
        data: {
          meta: { schemaVersion: 1, currency: 'USD' },
          transactions: [],
          settings: {
            username: 'restored',
            allocation: { daily: 50, splurge: 20, smile: 15, fire: 15 },
          },
        },
      },
      { backupDir },
    );
    expect(result.transactionCount).toBe(0);
    const stored = usersDb._getCurrent().data;
    expect(stored.meta.currency).toBe('USD');
    expect(stored.settings.username).toBe('restored');
    expect(stored.settings.allocation).toEqual({ daily: 50, splurge: 20, smile: 15, fire: 15 });
  });

  it('accepts a well-formed balance object with all sub-collections present', async () => {
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      {
        confirm: true,
        data: {
          meta: { schemaVersion: 1 },
          transactions: [],
          balance: {
            asset: {
              assets: [{ id: 'assets_1', tag: 'Car', amount: 20000 }],
              shares: [],
              investments: [],
            },
            liabilities: [],
          },
        },
      },
      { backupDir },
    );
    expect(result.transactionCount).toBe(0);
    expect(usersDb._getCurrent().data.balance.asset.assets[0]).toMatchObject({ tag: 'Car' });
  });

  it('accepts a genuinely absent collection key as empty, matching a brand-new account export', async () => {
    // A brand-new account's own export omits transactions/grow/etc.
    // entirely (registration only ever writes data.info) — re-importing
    // that exact shape must succeed, not be rejected as malformed.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };
    const result = await importUserData(
      { usersDb, authDb },
      'user_1',
      { confirm: true, data: { info: { email: 'a@test.local', username: 'a' } } },
      { backupDir },
    );
    expect(result.transactionCount).toBe(0);
  });

  it('re-validates the schema version and re-backs-up against a document that appears concurrently between the initial read and the write', async () => {
    // Simulates the exact race this guard closes: at the time of the
    // *first* read (before assembling/encrypting the imported data), no
    // document exists yet — but by the time the write actually happens, a
    // concurrent write (e.g. another device, or a racing duplicate import)
    // has created one on a different schema version. Trusting only the
    // first read would silently skip both the version check and the
    // backup for the data that's about to be destroyed.
    const usersDb = makeDb(null);
    const authDb = { get: jest.fn(async () => ({})) };

    let getCallCount = 0;
    const concurrentDoc = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        meta: { schemaVersion: 2 },
        transactions: [
          {
            id: 'tx_concurrent',
            account: 'Daily',
            amount: -999,
            date: '2026-01-01',
            time: '08:00',
            category: '@Concurrent',
            comment: '',
          },
        ],
      },
    };
    usersDb.get = jest.fn(async () => {
      getCallCount += 1;
      // First call (the initial "fail fast" read): no document yet.
      if (getCallCount === 1) {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }
      // Second call (inside the write-retry loop): a concurrent write has
      // since created a real, differently-versioned document.
      return JSON.parse(JSON.stringify(concurrentDoc));
    });

    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        { confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } },
        { backupDir },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_SCHEMA_VERSION_MISMATCH' });

    // The concurrently-created document must never have been overwritten.
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('wipes a collection present in the current account but absent from the import payload', async () => {
    const usersDb = makeDb({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        meta: { schemaVersion: 1 },
        transactions: [],
        grow: [
          {
            id: 'grow_old',
            title: 'Old Rental',
            sub: '',
            phase: 'active',
            description: '',
            strategy: '',
            riskScore: 3,
            risks: '',
            links: [],
            actionItems: [],
            notes: [],
            cashflow: 0,
            amount: 0,
            isAsset: false,
            share: null,
            investment: null,
            liabilitie: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    const authDb = { get: jest.fn(async () => ({})) };

    await importUserData(
      { usersDb, authDb },
      'user_1',
      { confirm: true, data: { meta: { schemaVersion: 1 }, transactions: [] } },
      { backupDir },
    );

    expect(usersDb._getCurrent().data.grow).toEqual([]);
  });
});
