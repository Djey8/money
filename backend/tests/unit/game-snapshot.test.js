'use strict';

const { EncryptionSession, initialCashflowGameState, UNDO_STACK_LIMIT } = require('@money/domain');
const {
  readSnapshot,
  writeSnapshot,
  readHistoryStack,
  readHistoryLog,
  buildHistoryDocument,
} = require('../../services/game-snapshot');

const plainData = (schemaVersion = 1) => {
  const m = (decimal) => (schemaVersion >= 2 ? Math.round(decimal * 100) : decimal);
  return {
    meta: { schemaVersion, currency: 'EUR' },
    transactions: [
      {
        id: 'tx_1',
        account: 'Income',
        amount: m(3000),
        date: '2026-01-05',
        time: '',
        category: '@Salary',
        comment: '#cashflow',
      },
    ],
    subscriptions: [
      {
        id: 'subscriptions_1',
        title: 'Salary',
        account: 'Income',
        amount: m(3000),
        startDate: '2026-01-05',
        endDate: '',
        category: '@Salary',
        comment: '#cashflow',
        frequency: 'monthly',
      },
    ],
    grow: [],
    smile: [],
    fire: [],
    mojo: { amount: m(0), target: m(1000) },
    balance: {
      liabilities: [
        { id: 'liabilities_1', tag: 'Bank loan', amount: m(1000), investment: false, credit: m(0) },
      ],
      asset: {
        shares: [{ id: 'shares_1', tag: 'OK4U', quantity: 10, price: m(5) }],
        investments: [],
        assets: [{ id: 'assets_1', tag: 'GOLD', amount: m(500) }],
      },
    },
    cashflowGame: initialCashflowGameState(),
  };
};

function encryptLeaves(value, session) {
  if (Array.isArray(value)) return value.map((item) => encryptLeaves(item, session));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, encryptLeaves(v, session)]),
    );
  }
  return value === null ? null : session.encrypt(String(value));
}

describe('readSnapshot', () => {
  it('gives the app its in-memory shapes: decimal amounts, numbers, booleans', () => {
    const snapshot = readSnapshot({ ...plainData(), cashflowGame: undefined }, null);
    expect(snapshot.allTransactions[0]).toMatchObject({ amount: 3000, account: 'Income' });
    expect(snapshot.liabilities[0]).toMatchObject({
      tag: 'Bank loan',
      amount: 1000,
      investment: false,
    });
    expect(snapshot.allShares[0]).toMatchObject({ quantity: 10, price: 5 });
    expect(snapshot.allAssets[0].amount).toBe(500);
    expect(snapshot.mojo).toEqual({ amount: 0, target: 1000 });
  });

  it('reads a schema 2 (minor unit) document as the same decimals', () => {
    expect(readSnapshot(plainData(2), null).allSubscriptions[0].amount).toBe(3000);
  });

  it('reads an encrypted document', () => {
    const session = new EncryptionSession('secret');
    const data = { ...plainData(), ...encryptLeaves({ ...plainData(), meta: undefined }, session) };
    data.meta = { schemaVersion: 1 };
    expect(readSnapshot(data, session).allSubscriptions[0].amount).toBe(3000);
  });
});

describe('writeSnapshot', () => {
  it.each([1, 2])('puts a snapshot back so that it reads the same (schema %i)', (schemaVersion) => {
    const session = new EncryptionSession('secret');
    const data = plainData(schemaVersion);
    const before = readSnapshot(data, null);
    const written = writeSnapshot(data, before, session);
    // stored encrypted, read back identical
    expect(written.subscriptions[0].title).not.toBe('Salary');
    const after = readSnapshot(written, session);
    expect(after.allSubscriptions).toEqual(before.allSubscriptions);
    expect(after.liabilities).toEqual(before.liabilities);
    expect(after.allShares).toEqual(before.allShares);
    expect(after.allTransactions.map((t) => t.amount)).toEqual([3000]);
    expect(after.cashflowGame).toEqual(before.cashflowGame);
  });

  it('gives entities the app kept without an id one, so the API can address them', () => {
    const snapshot = readSnapshot(plainData(), null);
    delete snapshot.allSubscriptions[0].id;
    delete snapshot.allTransactions[0].id;
    const written = writeSnapshot(plainData(), snapshot, null);
    expect(written.subscriptions[0].id).toMatch(/^subscriptions_/);
    expect(written.transactions[0].id).toMatch(/^tx_/);
  });
});

describe('history document', () => {
  const deps = { text: (key) => key, money: (minor) => String(minor) };

  it('round-trips the undo stack, encrypted', () => {
    const session = new EncryptionSession('secret');
    const live = readSnapshot(plainData(), null);
    const stack = [{ step: { kind: 'start', at: '2026-10-06T10:00:00.000Z' }, ...live }];
    const document = buildHistoryDocument(stack, live, deps, '2026-10-06T10:00:01.000Z', session);
    const read = readHistoryStack({ cashflowGameHistory: document }, session);
    expect(read.stack).toHaveLength(1);
    expect(read.stack[0].step.kind).toBe('start');
    expect(read.updatedAt).toBe('2026-10-06T10:00:01.000Z');
    expect(readHistoryLog({ cashflowGameHistory: document }, session).steps[0]).toMatchObject({
      number: 1,
      kind: 'start',
    });
  });

  it('reads a missing or damaged history as empty', () => {
    expect(readHistoryStack({}, null).stack).toEqual([]);
    expect(readHistoryStack({ cashflowGameHistory: { payload: 'nonsense' } }, null).stack).toEqual(
      [],
    );
    expect(UNDO_STACK_LIMIT).toBeGreaterThan(0);
  });
});
