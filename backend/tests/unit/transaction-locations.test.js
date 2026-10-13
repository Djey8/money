'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} = require('../../repositories/transaction-repository');

function harness(data, encryptionConfig = { key: 'default', encryptDatabase: false }) {
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

const baseData = (locations) => ({
  mojo: { amount: 0, target: 100 },
  smile: [],
  fire: [],
  locations,
});

const expense = (extra = {}) => ({
  account: 'Daily',
  amountMinor: -3000,
  date: '2026-10-01',
  time: '10:00',
  category: '@food',
  comment: '',
  ...extra,
});

describe('transaction writes and location balances', () => {
  const bank = () => ({ id: 'loc_bank', name: 'Bank', amount: 100 });
  const cash = () => ({ id: 'loc_cash', name: 'Cash', amount: 50 });

  it('a booking at a location moves its balance in the same write and keeps the link', async () => {
    const { deps, doc } = harness(baseData([bank(), cash()]));
    const created = await createTransaction(deps, 'user_1', expense({ locationId: 'loc_bank' }));
    expect(doc().data.transactions[0]).toMatchObject({ id: created.id, locationId: 'loc_bank' });
    expect(doc().data.locations.map((l) => l.amount)).toEqual([70, 50]);
    expect(deps.usersDb.insert).toHaveBeenCalledTimes(1);
  });

  it('a booking without a location moves nothing', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    await createTransaction(deps, 'user_1', expense());
    expect(doc().data.locations[0].amount).toBe(100);
  });

  it('deleting the booking gives the amount back', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    const created = await createTransaction(deps, 'user_1', expense({ locationId: 'loc_bank' }));
    await deleteTransaction(deps, 'user_1', created.id);
    expect(doc().data.locations[0].amount).toBe(100);
  });

  it('an amount edit applies only the difference', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    const created = await createTransaction(deps, 'user_1', expense({ locationId: 'loc_bank' }));
    await updateTransaction(deps, 'user_1', created.id, { amountMinor: -4500 });
    expect(doc().data.locations[0].amount).toBe(55);
  });

  it('writing an unrelated transaction keeps every other transaction link and balance', async () => {
    const { deps, doc } = harness(baseData([bank(), cash()]));
    const linked = await createTransaction(deps, 'user_1', expense({ locationId: 'loc_cash' }));
    await createTransaction(deps, 'user_1', expense({ category: '@fuel' }));
    const stored = doc().data.transactions.find((t) => t.id === linked.id);
    expect(stored.locationId).toBe('loc_cash');
    expect(doc().data.locations.map((l) => l.amount)).toEqual([100, 20]);
  });

  it('a booking at an unknown location is rejected and nothing is written', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    await expect(
      createTransaction(deps, 'user_1', expense({ locationId: 'loc_gone' })),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
    expect(doc().data.locations[0].amount).toBe(100);
    expect(doc().data.transactions).toBeUndefined();
  });

  it('a document with no locations at all rejects any locationId', async () => {
    const { deps } = harness({ mojo: { amount: 0, target: 100 }, smile: [], fire: [] });
    await expect(
      createTransaction(deps, 'user_1', expense({ locationId: 'loc_bank' })),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('moves encrypted balances too', async () => {
    const session = new EncryptionSession('secret');
    const data = {
      mojo: { amount: session.encrypt('0'), target: session.encrypt('100') },
      smile: [],
      fire: [],
      locations: [
        {
          id: session.encrypt('loc_bank'),
          name: session.encrypt('Bank'),
          amount: session.encrypt('100'),
        },
      ],
    };
    const { deps, doc } = harness(data, { key: 'secret', encryptDatabase: true });
    await createTransaction(deps, 'user_1', expense({ locationId: 'loc_bank' }));
    expect(session.decrypt(doc().data.locations[0].amount)).toBe('70');
    expect(session.decrypt(doc().data.locations[0].name)).toBe('Bank');
    expect(session.decrypt(doc().data.transactions[0].locationId)).toBe('loc_bank');
  });

  it('moves minor-unit balances on a schema version 2 document', async () => {
    const data = {
      ...baseData([{ id: 'loc_bank', name: 'Bank', amount: 10000 }]),
      meta: { schemaVersion: 2 },
    };
    const { deps, doc } = harness(data);
    await createTransaction(deps, 'user_1', expense({ locationId: 'loc_bank' }));
    expect(doc().data.locations[0].amount).toBe(7000);
  });
});
