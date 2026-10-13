'use strict';

const {
  createSubscription,
  listSubscriptions,
  refreshSubscriptions,
  updateSubscription,
  batchSubscriptions,
} = require('../../repositories/subscription-repository');

const NOW = new Date('2026-04-15');

function harness(data) {
  let document = { _id: 'user_1', _rev: '1-a', createdAt: 't', updatedAt: 't', data };
  const deps = {
    usersDb: {
      get: jest.fn(async () => structuredClone(document)),
      insert: jest.fn(async (next) => {
        document = { ...next, _rev: '2-b' };
      }),
    },
    authDb: {
      get: jest.fn(async () => ({ encryptionConfig: { key: 'default', encryptDatabase: false } })),
    },
  };
  return {
    deps,
    doc: () => document,
    edit: (change) => {
      document = { ...document, data: change(structuredClone(document.data)) };
    },
  };
}

const baseData = (locations) => ({
  mojo: { amount: 0, target: 100000 },
  smile: [],
  fire: [],
  locations,
});
const bank = () => ({ id: 'loc_bank', name: 'Bank', amount: 1000, kind: 'bank' });
const cash = () => ({ id: 'loc_cash', name: 'Cash', amount: 500, kind: 'cash' });
const input = (extra = {}) => ({
  title: 'Spotify',
  account: 'Daily',
  amountMinor: -1000,
  startDate: '2026-01-15',
  category: '@Streaming',
  frequency: 'monthly',
  ...extra,
});
const balances = (doc) => doc.data.locations.map((l) => l.amount);

describe('subscriptions and locations', () => {
  it('stores the location on the subscription and rejects an unknown one', async () => {
    const { deps } = harness(baseData([bank()]));
    const created = await createSubscription(deps, 'user_1', input({ locationId: 'loc_bank' }));
    expect(created.locationId).toBe('loc_bank');
    expect((await listSubscriptions(deps, 'user_1'))[0].locationId).toBe('loc_bank');
    await expect(
      createSubscription(deps, 'user_1', input({ locationId: 'loc_nope' })),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('a subscription without a location has no locationId field at all', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    const created = await createSubscription(deps, 'user_1', input());
    expect('locationId' in created).toBe(false);
    expect(doc().data.subscriptions[0].locationId).toBeUndefined();
  });

  it('refresh books the generated transactions at the location and moves its balance', async () => {
    const { deps, doc } = harness(baseData([bank(), cash()]));
    await createSubscription(deps, 'user_1', input({ locationId: 'loc_bank' }));
    const result = await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(result.transactionsCreated).toBe(4);
    expect(doc().data.transactions.every((t) => t.locationId === 'loc_bank')).toBe(true);
    // 1000 - 4 * 10.00
    expect(balances(doc())).toEqual([960, 500]);
    // a second refresh finds everything already generated
    expect((await refreshSubscriptions(deps, 'user_1', { now: NOW })).transactionsCreated).toBe(0);
  });

  it('changing the subscription location leaves history alone and applies to what is generated next', async () => {
    const { deps, doc } = harness(baseData([bank(), cash()]));
    const created = await createSubscription(deps, 'user_1', input({ locationId: 'loc_bank' }));
    await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(balances(doc())).toEqual([960, 500]);

    await updateSubscription(deps, 'user_1', created.id, { locationId: 'loc_cash' }, { now: NOW });
    // the four existing bookings stay at the bank, nothing moved
    expect(doc().data.transactions.map((t) => t.locationId)).toEqual(Array(4).fill('loc_bank'));
    expect(balances(doc())).toEqual([960, 500]);

    // the next occurrence is the first one booked at the new location
    const later = await refreshSubscriptions(deps, 'user_1', { now: new Date('2026-05-20') });
    expect(later.transactionsCreated).toBe(1);
    expect(doc().data.transactions.at(-1).locationId).toBe('loc_cash');
    expect(balances(doc())).toEqual([960, 490]);
  });

  it('clearing the subscription location unlinks nothing already booked; later ones have none', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    const created = await createSubscription(deps, 'user_1', input({ locationId: 'loc_bank' }));
    await refreshSubscriptions(deps, 'user_1', { now: NOW });
    const updated = await updateSubscription(
      deps,
      'user_1',
      created.id,
      { locationId: null },
      { now: NOW },
    );
    expect('locationId' in updated).toBe(false);
    expect(doc().data.transactions.every((t) => t.locationId === 'loc_bank')).toBe(true);
    expect(balances(doc())).toEqual([960]);
    await refreshSubscriptions(deps, 'user_1', { now: new Date('2026-05-20') });
    expect(doc().data.transactions.at(-1).locationId).toBeUndefined();
    expect(balances(doc())).toEqual([960]);
  });

  it('a generated transaction moved to another location by hand is not generated again', async () => {
    const { deps, doc, edit } = harness(baseData([bank(), cash()]));
    await createSubscription(deps, 'user_1', input({ locationId: 'loc_bank' }));
    await refreshSubscriptions(deps, 'user_1', { now: NOW });
    edit((data) => {
      data.transactions[1].locationId = 'loc_cash';
      return data;
    });
    expect((await refreshSubscriptions(deps, 'user_1', { now: NOW })).transactionsCreated).toBe(0);
    edit((data) => {
      delete data.transactions[2].locationId;
      return data;
    });
    expect((await refreshSubscriptions(deps, 'user_1', { now: NOW })).transactionsCreated).toBe(0);
    expect(doc().data.transactions).toHaveLength(4);
  });

  it('subscriptions that were never given a location keep generating exactly as before', async () => {
    const { deps, doc } = harness(baseData([bank()]));
    await createSubscription(deps, 'user_1', input());
    const result = await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(result.transactionsCreated).toBe(4);
    expect(doc().data.transactions.some((t) => t.locationId !== undefined)).toBe(false);
    expect(balances(doc())).toEqual([1000]);
  });

  it('changing only the amount keeps a booking the user moved by hand where it is', async () => {
    const { deps, doc } = harness(baseData([bank(), cash()]));
    const created = await createSubscription(deps, 'user_1', input({ locationId: 'loc_bank' }));
    await refreshSubscriptions(deps, 'user_1', { now: NOW });
    // hand-move the first generated booking to cash (balances kept consistent by editing the document)
    const d = structuredClone(doc());
    d.data.transactions[0].locationId = 'loc_cash';
    d.data.locations[0].amount += 10;
    d.data.locations[1].amount -= 10;
    const harness2 = harness(d.data);
    await updateSubscription(
      harness2.deps,
      'user_1',
      created.id,
      { amountMinor: -2000 },
      { now: NOW },
    );
    const txs = harness2.doc().data.transactions;
    expect(txs.map((t) => t.locationId)).toEqual(['loc_cash', 'loc_bank', 'loc_bank', 'loc_bank']);
  });

  it('a batch create rejects an unknown location per item and still creates the valid ones', async () => {
    const { deps } = harness(baseData([bank()]));
    const results = await batchSubscriptions(deps, 'user_1', [
      { op: 'create', fields: input({ locationId: 'loc_bank' }) },
      { op: 'create', fields: input({ title: 'Other', locationId: 'loc_nope' }) },
    ]);
    expect(results.map((r) => r.status)).toEqual(['created', 'error']);
  });
});
