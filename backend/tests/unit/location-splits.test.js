'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  createLocation,
  deleteLocation,
  listLocations,
} = require('../../repositories/location-repository');
const {
  batchTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
} = require('../../repositories/transaction-repository');
const {
  createSubscription,
  listSubscriptions,
  refreshSubscriptions,
  updateSubscription,
} = require('../../repositories/subscription-repository');

const NOW = new Date('2026-04-15');

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
const salary = (extra = {}) => ({
  account: 'Income',
  amountMinor: 300000,
  date: '2026-10-01',
  time: '10:00',
  category: '@Salary',
  comment: 'Salary',
  ...extra,
});

async function twoLocations(deps) {
  const main = await createLocation(deps, 'user_1', { name: 'N26', subName: 'Main' });
  const savings = await createLocation(deps, 'user_1', { name: 'N26', subName: 'Instant Savings' });
  return { main, savings };
}
const balance = async (deps, id) =>
  (await listLocations(deps, 'user_1')).find((l) => l.id === id).amountMinor;

describe('splitting a booking across locations', () => {
  it('books the main location the remainder and the other location its share', async () => {
    const { deps, doc } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createTransaction(
      deps,
      'user_1',
      salary({
        locationId: main.id,
        locationSplits: [{ locationId: savings.id, amountMinor: 60000 }],
      }),
    );
    expect(created.locationSplits).toEqual([{ locationId: savings.id, amountMinor: 60000 }]);
    expect(await balance(deps, main.id)).toBe(240000);
    expect(await balance(deps, savings.id)).toBe(60000);
    // stored decimal on a v1 document, only the OTHER amounts
    expect(doc().data.transactions[0].locationSplits).toEqual([
      { locationId: savings.id, amount: 600 },
    ]);
  });

  it('an amount edit changes only the main location; clearing the split moves it back', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createTransaction(
      deps,
      'user_1',
      salary({
        locationId: main.id,
        locationSplits: [{ locationId: savings.id, amountMinor: 60000 }],
      }),
    );
    await updateTransaction(deps, 'user_1', created.id, { amountMinor: 320000 });
    expect(await balance(deps, main.id)).toBe(260000);
    expect(await balance(deps, savings.id)).toBe(60000);

    const cleared = await updateTransaction(deps, 'user_1', created.id, { locationSplits: null });
    expect('locationSplits' in cleared).toBe(false);
    expect(await balance(deps, main.id)).toBe(320000);
    expect(await balance(deps, savings.id)).toBe(0);
  });

  it('deleting a split booking gives both locations back', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createTransaction(
      deps,
      'user_1',
      salary({
        locationId: main.id,
        locationSplits: [{ locationId: savings.id, amountMinor: 60000 }],
      }),
    );
    await deleteTransaction(deps, 'user_1', created.id);
    expect(await balance(deps, main.id)).toBe(0);
    expect(await balance(deps, savings.id)).toBe(0);
  });

  it('an expense split takes from both locations', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    await createTransaction(
      deps,
      'user_1',
      salary({
        account: 'Daily',
        category: '@food',
        amountMinor: -10000,
        locationId: main.id,
        locationSplits: [{ locationId: savings.id, amountMinor: -2500 }],
      }),
    );
    expect(await balance(deps, main.id)).toBe(-7500);
    expect(await balance(deps, savings.id)).toBe(-2500);
  });

  it.each([
    ['no main location', (m, s) => ({ locationSplits: [{ locationId: s, amountMinor: 100 }] })],
    [
      'a split with the wrong sign',
      (m, s) => ({ locationId: m, locationSplits: [{ locationId: s, amountMinor: -100 }] }),
    ],
    [
      'splits adding up to more than the booking',
      (m, s) => ({ locationId: m, locationSplits: [{ locationId: s, amountMinor: 999999 }] }),
    ],
    [
      'the main location as a split',
      (m) => ({ locationId: m, locationSplits: [{ locationId: m, amountMinor: 100 }] }),
    ],
    [
      'a repeated split location',
      (m, s) => ({
        locationId: m,
        locationSplits: [
          { locationId: s, amountMinor: 100 },
          { locationId: s, amountMinor: 100 },
        ],
      }),
    ],
  ])('rejects %s', async (_label, build) => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    await expect(
      createTransaction(deps, 'user_1', salary(build(main.id, savings.id))),
    ).rejects.toMatchObject({ code: 'LOCATION_SPLIT_INVALID' });
  });

  it('rejects a split to an unknown location, also per item in a batch', async () => {
    const { deps } = harness(baseData());
    const { main } = await twoLocations(deps);
    const body = salary({
      locationId: main.id,
      locationSplits: [{ locationId: 'loc_nope', amountMinor: 100 }],
    });
    await expect(createTransaction(deps, 'user_1', body)).rejects.toMatchObject({
      code: 'LOCATION_NOT_FOUND',
    });
    const result = await batchTransactions(deps, 'user_1', [{ op: 'create', fields: body }]);
    expect(result.results[0].status).toBe('error');
  });

  it('works on an encrypted document and on a minor-unit (v2) document', async () => {
    const session = new EncryptionSession('secret');
    const encrypted = harness(
      {
        mojo: { amount: session.encrypt('0'), target: session.encrypt('100000') },
        smile: [],
        fire: [],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const a = await twoLocations(encrypted.deps);
    await createTransaction(
      encrypted.deps,
      'user_1',
      salary({
        locationId: a.main.id,
        locationSplits: [{ locationId: a.savings.id, amountMinor: 60000 }],
      }),
    );
    const leg = encrypted.doc().data.transactions[0].locationSplits[0];
    expect(session.decrypt(leg.locationId)).toBe(a.savings.id);
    expect(session.decrypt(leg.amount)).toBe('600');
    expect(await balance(encrypted.deps, a.savings.id)).toBe(60000);

    const v2 = harness({ ...baseData(), meta: { schemaVersion: 2 } });
    const b = await twoLocations(v2.deps);
    await createTransaction(
      v2.deps,
      'user_1',
      salary({
        locationId: b.main.id,
        locationSplits: [{ locationId: b.savings.id, amountMinor: 60000 }],
      }),
    );
    expect(v2.doc().data.transactions[0].locationSplits[0].amount).toBe(60000);
    expect(await balance(v2.deps, b.main.id)).toBe(240000);
  });

  it('deleting a split location drops its part and keeps the rest of the booking', async () => {
    const { deps, doc } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    await createTransaction(
      deps,
      'user_1',
      salary({
        locationId: main.id,
        locationSplits: [{ locationId: savings.id, amountMinor: 60000 }],
      }),
    );
    await deleteLocation(deps, 'user_1', savings.id);
    expect(doc().data.transactions[0].locationSplits).toBeUndefined();
    expect(doc().data.transactions[0].locationId).toBe(main.id);
  });
});

describe('a subscription with a split rule', () => {
  const rule = (savingsId) => [{ locationId: savingsId, percent: 20 }];
  const input = (main, savings, extra = {}) => ({
    title: 'Salary',
    account: 'Income',
    amountMinor: 300000,
    startDate: '2026-01-15',
    category: '@Salary',
    frequency: 'monthly',
    locationId: main,
    locationSplit: rule(savings),
    ...extra,
  });

  it('stores the rule and generates every booking 80 / 20', async () => {
    const { deps, doc } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createSubscription(deps, 'user_1', input(main.id, savings.id));
    expect(created.locationSplit).toEqual(rule(savings.id));
    expect((await listSubscriptions(deps, 'user_1'))[0].locationSplit).toEqual(rule(savings.id));

    const result = await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(result.transactionsCreated).toBe(4);
    for (const t of doc().data.transactions) {
      expect(t.locationId).toBe(main.id);
      expect(t.locationSplits).toEqual([{ locationId: savings.id, amount: 600 }]);
    }
    expect(await balance(deps, main.id)).toBe(4 * 240000);
    expect(await balance(deps, savings.id)).toBe(4 * 60000);
  });

  it('a rule change applies only to what is generated next', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createSubscription(deps, 'user_1', input(main.id, savings.id));
    await refreshSubscriptions(deps, 'user_1', { now: NOW });
    await updateSubscription(
      deps,
      'user_1',
      created.id,
      { locationSplit: [{ locationId: savings.id, percent: 50 }] },
      { now: NOW },
    );
    // history unchanged
    expect(await balance(deps, savings.id)).toBe(4 * 60000);
    await refreshSubscriptions(deps, 'user_1', { now: new Date('2026-05-20') });
    expect(await balance(deps, savings.id)).toBe(4 * 60000 + 150000);
  });

  it('editing the subscription amount keeps old bookings consistent (main absorbs, extras stay)', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createSubscription(deps, 'user_1', input(main.id, savings.id));
    await refreshSubscriptions(deps, 'user_1', { now: NOW });
    await updateSubscription(deps, 'user_1', created.id, { amountMinor: 320000 }, { now: NOW });
    expect(await balance(deps, savings.id)).toBe(4 * 60000);
    expect(await balance(deps, main.id)).toBe(4 * 260000);
  });

  it('clearing the main location clears the rule; a rule needs a main location and valid numbers', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    const created = await createSubscription(deps, 'user_1', input(main.id, savings.id));
    const cleared = await updateSubscription(deps, 'user_1', created.id, { locationId: null });
    expect('locationSplit' in cleared).toBe(false);

    await expect(
      createSubscription(deps, 'user_1', input(undefined, savings.id)),
    ).rejects.toMatchObject({ code: 'LOCATION_SPLIT_INVALID' });
    await expect(
      createSubscription(deps, 'user_1', {
        ...input(main.id, savings.id),
        locationSplit: [{ locationId: savings.id, percent: 150 }],
      }),
    ).rejects.toMatchObject({ code: 'LOCATION_SPLIT_INVALID' });
    await expect(
      createSubscription(deps, 'user_1', {
        ...input(main.id, savings.id),
        locationSplit: [{ locationId: 'loc_nope', percent: 10 }],
      }),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('deleting a location the subscription points at clears that part of the subscription', async () => {
    const { deps } = harness(baseData());
    const { main, savings } = await twoLocations(deps);
    await createSubscription(deps, 'user_1', input(main.id, savings.id));
    await deleteLocation(deps, 'user_1', savings.id);
    const [afterSavings] = await listSubscriptions(deps, 'user_1');
    expect('locationSplit' in afterSavings).toBe(false);
    expect(afterSavings.locationId).toBe(main.id);
    await deleteLocation(deps, 'user_1', main.id);
    const [afterMain] = await listSubscriptions(deps, 'user_1');
    expect('locationId' in afterMain).toBe(false);
  });
});
