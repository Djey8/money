'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  createLocation,
  deleteLocation,
  listLocations,
} = require('../../repositories/location-repository');
const { createTransaction } = require('../../repositories/transaction-repository');
const {
  createTransfer,
  deleteTransfer,
  getTransfer,
  listTransfers,
  updateTransfer,
} = require('../../repositories/transfer-repository');
const { importUserData } = require('../../repositories/data-repository');

function harness(data = {}, encryptionConfig = { key: 'default', encryptDatabase: false }) {
  let document = { _id: 'user_1', _rev: '1-a', createdAt: 't', updatedAt: 't', data };
  const deps = {
    usersDb: {
      get: jest.fn(async () => structuredClone(document)),
      insert: jest.fn(async (next) => {
        document = { ...next, _rev: '2-b' };
      }),
    },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
  return { deps, doc: () => document };
}

const baseData = () => ({ mojo: { amount: 0, target: 100000 }, smile: [], fire: [] });
const balances = async (deps) =>
  Object.fromEntries((await listLocations(deps, 'user_1')).map((l) => [l.name, l.amountMinor]));
const atm = (from, to, extra = {}) => ({
  fromLocationId: from.id,
  toLocationId: to.id,
  amountMinor: 10000,
  date: '2026-10-05',
  time: '14:30',
  comment: 'ATM',
  ...extra,
});

async function setup(deps) {
  const bank = await createLocation(deps, 'user_1', { name: 'Bank', amountMinor: 100000 });
  const cash = await createLocation(deps, 'user_1', { name: 'Cash', amountMinor: 5000 });
  const wallet = await createLocation(deps, 'user_1', { name: 'Wallet', amountMinor: 0 });
  return { bank, cash, wallet };
}

describe('transfers between locations', () => {
  it('moves the amount from the source to the destination in one write; the total is unchanged', async () => {
    const { deps, doc } = harness(baseData());
    const { bank, cash } = await setup(deps);
    const created = await createTransfer(deps, 'user_1', atm(bank, cash));
    expect(created.id).toMatch(/^xfer_/);
    expect(await balances(deps)).toEqual({ Bank: 90000, Cash: 15000, Wallet: 0 });
    // stored decimal on a v1 document
    expect(doc().data.transfers[0]).toMatchObject({ amount: 100, date: '2026-10-05' });
    expect(await getTransfer(deps, 'user_1', created.id)).toEqual(created);
  });

  it('is not a transaction: nothing derived is touched', async () => {
    const { deps, doc } = harness(baseData());
    const { bank, cash } = await setup(deps);
    await createTransaction(deps, 'user_1', {
      account: 'Income',
      amountMinor: 200000,
      date: '2026-10-01',
      time: '09:00',
      category: '@Salary',
      comment: 'Pay',
      locationId: bank.id,
    });
    const before = structuredClone({
      transactions: doc().data.transactions,
      income: doc().data.income,
      mojo: doc().data.mojo,
      smile: doc().data.smile,
      fire: doc().data.fire,
    });
    await createTransfer(deps, 'user_1', atm(bank, cash, { amountMinor: 50000 }));
    const after = {
      transactions: doc().data.transactions,
      income: doc().data.income,
      mojo: doc().data.mojo,
      smile: doc().data.smile,
      fire: doc().data.fire,
    };
    expect(after).toEqual(before);
  });

  it('editing the amount moves the difference; moving the destination restores the first', async () => {
    const { deps } = harness(baseData());
    const { bank, cash, wallet } = await setup(deps);
    const created = await createTransfer(deps, 'user_1', atm(bank, cash));
    await updateTransfer(deps, 'user_1', created.id, { amountMinor: 15000 });
    expect(await balances(deps)).toEqual({ Bank: 85000, Cash: 20000, Wallet: 0 });
    await updateTransfer(deps, 'user_1', created.id, { toLocationId: wallet.id });
    expect(await balances(deps)).toEqual({ Bank: 85000, Cash: 5000, Wallet: 15000 });
  });

  it('deleting a transfer gives the money back', async () => {
    const { deps } = harness(baseData());
    const { bank, cash } = await setup(deps);
    const created = await createTransfer(deps, 'user_1', atm(bank, cash));
    expect(await deleteTransfer(deps, 'user_1', created.id)).toEqual({ id: created.id });
    expect(await balances(deps)).toEqual({ Bank: 100000, Cash: 5000, Wallet: 0 });
    expect(await deleteTransfer(deps, 'user_1', created.id)).toBeNull();
  });

  it('needs two different, existing locations', async () => {
    const { deps } = harness(baseData());
    const { bank } = await setup(deps);
    await expect(createTransfer(deps, 'user_1', atm(bank, bank))).rejects.toMatchObject({
      code: 'TRANSFER_INVALID',
    });
    await expect(
      createTransfer(deps, 'user_1', { ...atm(bank, bank), toLocationId: 'loc_nope' }),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
    expect(await listTransfers(deps, 'user_1')).toEqual([]);
  });

  it('lists the transfers of one location, in either direction', async () => {
    const { deps } = harness(baseData());
    const { bank, cash, wallet } = await setup(deps);
    await createTransfer(deps, 'user_1', atm(bank, cash));
    await createTransfer(deps, 'user_1', atm(cash, wallet));
    expect(await listTransfers(deps, 'user_1')).toHaveLength(2);
    expect(await listTransfers(deps, 'user_1', { locationId: cash.id })).toHaveLength(2);
    expect(await listTransfers(deps, 'user_1', { locationId: bank.id })).toHaveLength(1);
    expect(await listTransfers(deps, 'user_1', { locationId: wallet.id })).toHaveLength(1);
  });

  it('keeps the transfer when a location is deleted: that end is dropped, nothing else moves', async () => {
    const { deps, doc } = harness(baseData());
    const { bank, cash } = await setup(deps);
    const created = await createTransfer(deps, 'user_1', atm(bank, cash));
    await deleteLocation(deps, 'user_1', cash.id);
    const kept = await getTransfer(deps, 'user_1', created.id);
    expect(kept.fromLocationId).toBe(bank.id);
    expect('toLocationId' in kept).toBe(false);
    expect(doc().data.transfers[0].toLocationId).toBeUndefined();
    expect((await balances(deps)).Bank).toBe(90000);
  });

  it('works on an encrypted document and on a minor-unit (v2) document', async () => {
    const session = new EncryptionSession('secret');
    const enc = harness(
      {
        mojo: { amount: session.encrypt('0'), target: session.encrypt('100000') },
        smile: [],
        fire: [],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const a = await setup(enc.deps);
    await createTransfer(enc.deps, 'user_1', atm(a.bank, a.cash));
    const stored = enc.doc().data.transfers[0];
    expect(session.decrypt(stored.amount)).toBe('100');
    expect(session.decrypt(stored.fromLocationId)).toBe(a.bank.id);
    expect(await balances(enc.deps)).toEqual({ Bank: 90000, Cash: 15000, Wallet: 0 });

    const v2 = harness({ ...baseData(), meta: { schemaVersion: 2 } });
    const b = await setup(v2.deps);
    await createTransfer(v2.deps, 'user_1', atm(b.bank, b.cash));
    expect(v2.doc().data.transfers[0].amount).toBe(10000);
    expect(await balances(v2.deps)).toEqual({ Bank: 90000, Cash: 15000, Wallet: 0 });
  });

  it('whole-account import accepts transfers and older exports without them', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        const error = new Error('missing');
        error.statusCode = 404;
        throw error;
      }),
      insert: jest.fn(async () => undefined),
    };
    const authDb = { get: jest.fn(async () => ({})) };
    const base = {
      meta: { schemaVersion: 1, currency: 'EUR' },
      info: { email: 'a@test.local', username: 'a' },
      settings: { username: 'a' },
      transactions: [],
      balance: { asset: { assets: [], shares: [], investments: [] }, liabilities: [] },
      grow: [],
      budget: [],
      subscriptions: [],
      smile: [],
      fire: [],
      mojo: { target: 500 },
    };
    await importUserData(
      { usersDb, authDb },
      'user_1',
      {
        confirm: true,
        data: {
          ...base,
          locations: [{ id: 'l1', name: 'Bank', kind: 'bank', amount: 100 }],
          transfers: [
            {
              id: 'x1',
              fromLocationId: 'l1',
              toLocationId: 'l2',
              amount: 20,
              date: '2026-01-01',
              time: '10:00',
              comment: '',
            },
          ],
        },
      },
      { backupDir: require('os').tmpdir() },
    );
    const written = usersDb.insert.mock.calls[0][0].data;
    expect(written.transfers).toEqual([
      {
        id: 'x1',
        fromLocationId: 'l1',
        toLocationId: 'l2',
        amount: 20,
        date: '2026-01-01',
        time: '10:00',
        comment: '',
      },
    ]);
    usersDb.insert.mockClear();
    await importUserData(
      { usersDb, authDb },
      'user_1',
      { confirm: true, data: base },
      {
        backupDir: require('os').tmpdir(),
      },
    );
    expect(usersDb.insert.mock.calls[0][0].data.transfers).toBeUndefined();
    await expect(
      importUserData(
        { usersDb, authDb },
        'user_1',
        { confirm: true, data: { ...base, transfers: [{ id: 'x', amount: 'nope', date: 'd' }] } },
        { backupDir: require('os').tmpdir() },
      ),
    ).rejects.toMatchObject({ code: 'IMPORT_INVALID_DATA' });
  });
});
