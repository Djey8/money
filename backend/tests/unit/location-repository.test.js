'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  createLocation,
  deleteLocation,
  getLocation,
  listLocations,
  updateLocation,
} = require('../../repositories/location-repository');
const {
  batchTransactions,
  createTransaction,
  updateTransaction,
} = require('../../repositories/transaction-repository');

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
  return {
    deps,
    doc: () => document,
    edit: (change) => {
      document = { ...document, data: change(structuredClone(document.data)) };
    },
  };
}

const expense = (extra = {}) => ({
  account: 'Daily',
  amountMinor: -3000,
  date: '2026-10-01',
  time: '10:00',
  category: '@food',
  comment: '',
  ...extra,
});

const baseData = () => ({ mojo: { amount: 0, target: 100 }, smile: [], fire: [] });

describe('location repository', () => {
  it('creates, lists and gets a location with a stable loc_ id', async () => {
    const { deps } = harness(baseData());
    const created = await createLocation(deps, 'user_1', {
      name: ' N26 ',
      subName: 'Main',
      kind: 'bank',
      amountMinor: 123450,
    });
    expect(created).toEqual({
      id: expect.stringMatching(/^loc_/),
      name: 'N26',
      subName: 'Main',
      kind: 'bank',
      amountMinor: 123450,
    });
    expect(await listLocations(deps, 'user_1')).toEqual([created]);
    expect(await getLocation(deps, 'user_1', created.id)).toEqual(created);
    expect(await getLocation(deps, 'user_1', 'loc_nope')).toBeNull();
  });

  it('accepts every location type and nothing else', async () => {
    const { LOCATION_KINDS } = require('../../repositories/location-repository');
    expect(LOCATION_KINDS).toEqual([
      'bank',
      'savings',
      'cash',
      'crypto',
      'wallet',
      'broker',
      'card',
      'other',
    ]);
    const { deps } = harness(baseData());
    for (const kind of LOCATION_KINDS) {
      const created = await createLocation(deps, 'user_1', { name: `Place ${kind}`, kind });
      expect(created.kind).toBe(kind);
    }
  });

  it('defaults kind to other and the opening balance to 0, and omits an empty subName', async () => {
    const { deps } = harness(baseData());
    const created = await createLocation(deps, 'user_1', { name: 'Cash', subName: '  ' });
    expect(created).toEqual({
      id: expect.any(String),
      name: 'Cash',
      kind: 'other',
      amountMinor: 0,
    });
  });

  it('allows the same name with different sub names but not the same pair (case-insensitive)', async () => {
    const { deps } = harness(baseData());
    await createLocation(deps, 'user_1', { name: 'N26', subName: 'Main' });
    await createLocation(deps, 'user_1', { name: 'N26', subName: 'Instant Savings' });
    await expect(
      createLocation(deps, 'user_1', { name: 'n26', subName: ' main ' }),
    ).rejects.toMatchObject({ code: 'LOCATION_DUPLICATE_NAME' });
    await expect(createLocation(deps, 'user_1', { name: 'N26' })).resolves.toBeTruthy();
    await expect(createLocation(deps, 'user_1', { name: 'N26' })).rejects.toMatchObject({
      code: 'LOCATION_DUPLICATE_NAME',
    });
  });

  it('PATCH amountMinor is a plain overwrite; renaming is checked against the others only', async () => {
    const { deps } = harness(baseData());
    const a = await createLocation(deps, 'user_1', { name: 'Bank', amountMinor: 100 });
    const b = await createLocation(deps, 'user_1', { name: 'Cash' });
    const corrected = await updateLocation(deps, 'user_1', a.id, { amountMinor: 999 });
    expect(corrected.amountMinor).toBe(999);
    // renaming to itself (case change) is fine
    await expect(updateLocation(deps, 'user_1', a.id, { name: 'BANK' })).resolves.toMatchObject({
      name: 'BANK',
    });
    await expect(updateLocation(deps, 'user_1', b.id, { name: 'bank' })).rejects.toMatchObject({
      code: 'LOCATION_DUPLICATE_NAME',
    });
    expect(await updateLocation(deps, 'user_1', 'loc_nope', { name: 'x' })).toBeNull();
  });

  it('an empty subName on PATCH removes it', async () => {
    const { deps } = harness(baseData());
    const a = await createLocation(deps, 'user_1', { name: 'N26', subName: 'Main' });
    const updated = await updateLocation(deps, 'user_1', a.id, { subName: '' });
    expect(updated.subName).toBeUndefined();
  });

  it('stores and reads encrypted values and minor-unit amounts', async () => {
    const session = new EncryptionSession('secret');
    const { deps, doc } = harness(
      { ...baseData(), meta: { schemaVersion: 2 } },
      { key: 'secret', encryptDatabase: true },
    );
    const created = await createLocation(deps, 'user_1', {
      name: 'N26',
      subName: 'Main',
      amountMinor: 5000,
    });
    const stored = doc().data.locations[0];
    expect(stored.name).not.toBe('N26');
    expect(session.decrypt(stored.name)).toBe('N26');
    expect(session.decrypt(stored.amount)).toBe('5000');
    expect((await listLocations(deps, 'user_1'))[0]).toEqual(created);
  });

  it('delete keeps the history: transactions lose their link in the same write', async () => {
    const { deps, doc } = harness(baseData());
    const bank = await createLocation(deps, 'user_1', { name: 'Bank', amountMinor: 10000 });
    const cash = await createLocation(deps, 'user_1', { name: 'Cash', amountMinor: 5000 });
    await createTransaction(deps, 'user_1', expense({ locationId: bank.id }));
    await createTransaction(deps, 'user_1', expense({ locationId: bank.id, category: '@fuel' }));
    await createTransaction(deps, 'user_1', expense({ locationId: cash.id, category: '@bread' }));

    const result = await deleteLocation(deps, 'user_1', bank.id);
    expect(result).toEqual({ id: bank.id, transactionsUnlinked: 2 });
    const transactions = doc().data.transactions;
    expect(transactions).toHaveLength(3);
    expect(transactions.filter((t) => t.locationId !== undefined)).toHaveLength(1);
    expect(transactions.find((t) => t.locationId === cash.id)).toBeTruthy();
    expect((await listLocations(deps, 'user_1')).map((l) => l.id)).toEqual([cash.id]);
    expect(await deleteLocation(deps, 'user_1', bank.id)).toBeNull();
  });

  it('delete unlinks encrypted transactions too', async () => {
    const session = new EncryptionSession('secret');
    const { deps, doc } = harness(baseData(), { key: 'secret', encryptDatabase: true });
    const bank = await createLocation(deps, 'user_1', { name: 'Bank' });
    await createTransaction(deps, 'user_1', expense({ locationId: bank.id }));
    expect(session.decrypt(doc().data.transactions[0].locationId)).toBe(bank.id);
    const result = await deleteLocation(deps, 'user_1', bank.id);
    expect(result.transactionsUnlinked).toBe(1);
    expect(doc().data.transactions[0].locationId).toBeUndefined();
    expect(session.decrypt(doc().data.transactions[0].category)).toBe('@food');
  });
});

describe('transactions and locationId', () => {
  it('rejects a locationId that is not one of the caller locations', async () => {
    const { deps } = harness(baseData());
    await expect(
      createTransaction(deps, 'user_1', expense({ locationId: 'loc_unknown' })),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('update moves the booking between locations and a null clears it', async () => {
    const { deps, doc } = harness(baseData());
    const bank = await createLocation(deps, 'user_1', { name: 'Bank', amountMinor: 10000 });
    const cash = await createLocation(deps, 'user_1', { name: 'Cash', amountMinor: 5000 });
    const tx = await createTransaction(deps, 'user_1', expense({ locationId: bank.id }));
    await updateTransaction(deps, 'user_1', tx.id, { locationId: cash.id });
    expect((await listLocations(deps, 'user_1')).map((l) => l.amountMinor)).toEqual([10000, 2000]);
    await updateTransaction(deps, 'user_1', tx.id, { locationId: null });
    expect((await listLocations(deps, 'user_1')).map((l) => l.amountMinor)).toEqual([10000, 5000]);
    expect(doc().data.transactions[0].locationId).toBeUndefined();
  });

  it('a stale link (location removed behind its back) does not block editing the other fields', async () => {
    const { deps, edit } = harness(baseData());
    const bank = await createLocation(deps, 'user_1', { name: 'Bank' });
    const tx = await createTransaction(deps, 'user_1', expense({ locationId: bank.id }));
    // The location vanishes without the unlink step (e.g. edited by hand); the transaction keeps the id.
    edit((data) => ({ ...data, locations: [] }));
    await expect(
      updateTransaction(deps, 'user_1', tx.id, { comment: 'still editable' }),
    ).resolves.toMatchObject({ comment: 'still editable', locationId: bank.id });
    // but a brand-new booking cannot point at it
    await expect(
      createTransaction(deps, 'user_1', expense({ locationId: bank.id })),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('batch reports an unknown locationId per item and still applies the valid ones', async () => {
    const { deps } = harness(baseData());
    const bank = await createLocation(deps, 'user_1', { name: 'Bank', amountMinor: 10000 });
    const result = await batchTransactions(deps, 'user_1', [
      { op: 'create', fields: expense({ locationId: bank.id }) },
      { op: 'create', fields: expense({ locationId: 'loc_unknown' }) },
    ]);
    expect(result.results.map((r) => r.status)).toEqual(['created', 'error']);
    expect(result.results[1].error).toMatch(/locationId/);
    expect((await listLocations(deps, 'user_1'))[0].amountMinor).toBe(7000);
  });
});

describe('batch stale-link rule and import validation', () => {
  it('a batch update re-sending an unchanged stale link succeeds, a new unknown one fails', async () => {
    const { deps, edit } = harness(baseData());
    const bank = await createLocation(deps, 'user_1', { name: 'Bank' });
    const tx = await createTransaction(deps, 'user_1', expense({ locationId: bank.id }));
    edit((data) => ({ ...data, locations: [] }));
    const result = await batchTransactions(deps, 'user_1', [
      { op: 'update', id: tx.id, fields: { locationId: bank.id, comment: 'same link' } },
      { op: 'update', id: tx.id, fields: { locationId: 'loc_other' } },
    ]);
    expect(result.results.map((r) => r.status)).toEqual(['updated', 'error']);
  });
});

describe('assertImportableLocations', () => {
  const { assertImportableLocations } = require('../../repositories/location-repository');
  const ok = { id: 'a', name: 'N26', subName: 'Main', kind: 'bank', amount: 1 };

  it('accepts a valid list', () => {
    expect(() =>
      assertImportableLocations([ok, { ...ok, id: 'b', subName: 'Other' }]),
    ).not.toThrow();
  });

  it.each([
    ['a missing id', { ...ok, id: undefined }],
    ['a non-numeric amount', { ...ok, amount: '5' }],
    ['a missing amount', { ...ok, amount: undefined }],
    ['an unknown kind', { ...ok, kind: 'piggybank' }],
    ['an empty name', { ...ok, name: ' ' }],
  ])('rejects %s', (_label, bad) => {
    expect(() => assertImportableLocations([bad])).toThrow();
  });

  it('rejects duplicate ids and duplicate name + sub name', () => {
    expect(() => assertImportableLocations([ok, { ...ok, subName: 'x' }])).toThrow(/Duplicate/);
    expect(() =>
      assertImportableLocations([ok, { ...ok, id: 'b', name: 'n26', subName: 'main' }]),
    ).toThrow(/Duplicate/);
  });
});
