'use strict';

/**
 * Balance-sheet edits stay consistent with linked Grow projects
 * (services/grow-links.js). CouchDB is mocked.
 */

const { updateInvestment } = require('../../repositories/investment-repository');
const { updateLiability } = require('../../repositories/liability-repository');
const { updateShare } = require('../../repositories/share-repository');
const { updateAsset } = require('../../repositories/asset-repository');

function writableDeps(data) {
  let document = { _id: 'user_1', _rev: '1-a', data };
  return {
    deps: {
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
    },
    current: () => document,
  };
}

function grow(overrides) {
  return {
    id: 'grow_1',
    title: 'Flat',
    amount: 0,
    cashflow: 0,
    isAsset: false,
    share: null,
    investment: null,
    liabilitie: null,
    ...overrides,
  };
}

describe('editing a linked investment or loan', () => {
  it('writes an investment edit into the linked project', async () => {
    const { deps, current } = writableDeps({
      meta: { schemaVersion: 2 },
      grow: [grow({ investment: { tag: 'Flat', deposit: 500, amount: 2000 } })],
      balance: {
        asset: { investments: [{ id: 'investments_1', tag: 'Flat', deposit: 500, amount: 2000 }] },
      },
    });

    await updateInvestment(deps, 'user_1', 'investments_1', { amountMinor: 1500 });

    expect(current().data.grow[0].investment).toEqual({ tag: 'Flat', deposit: 500, amount: 1500 });
  });

  it('writes a loan edit into the linked project', async () => {
    const { deps, current } = writableDeps({
      meta: { schemaVersion: 2 },
      grow: [grow({ liabilitie: { tag: 'Flat', amount: 1000, investment: true, credit: 50 } })],
      balance: {
        liabilities: [
          { id: 'liabilities_1', tag: 'Flat', amount: 1000, credit: 50, investment: true },
        ],
      },
    });

    await updateLiability(deps, 'user_1', 'liabilities_1', { amountMinor: 800, creditMinor: 40 });

    expect(current().data.grow[0].liabilitie).toMatchObject({ amount: 800, credit: 40 });
  });

  it('leaves unlinked projects untouched', async () => {
    const { deps, current } = writableDeps({
      meta: { schemaVersion: 2 },
      grow: [grow({ title: 'Other', investment: { tag: 'Other', deposit: 1, amount: 1 } })],
      balance: {
        asset: { investments: [{ id: 'investments_1', tag: 'Flat', deposit: 500, amount: 2000 }] },
      },
    });

    await updateInvestment(deps, 'user_1', 'investments_1', { amountMinor: 1500 });

    expect(current().data.grow[0].investment).toEqual({ tag: 'Other', deposit: 1, amount: 1 });
  });
});

describe('renaming a balance-sheet entry', () => {
  it.each([
    [
      'share',
      updateShare,
      'shares_1',
      { asset: { shares: [{ id: 'shares_1', tag: 'Flat', quantity: 1, price: 1 }] } },
    ],
    [
      'asset',
      updateAsset,
      'assets_1',
      { asset: { assets: [{ id: 'assets_1', tag: 'Flat', amount: 1 }] } },
    ],
    [
      'investment',
      updateInvestment,
      'investments_1',
      { asset: { investments: [{ id: 'investments_1', tag: 'Flat', deposit: 1, amount: 1 }] } },
    ],
    [
      'loan',
      updateLiability,
      'liabilities_1',
      {
        liabilities: [{ id: 'liabilities_1', tag: 'Flat', amount: 1, credit: 0, investment: true }],
      },
    ],
    [
      'mortgage',
      updateLiability,
      'liabilities_1',
      {
        liabilities: [
          { id: 'liabilities_1', tag: 'M-Flat', amount: 1, credit: 0, investment: true },
        ],
      },
    ],
  ])(
    'refuses to rename a %s linked to a Grow project away from its title',
    async (_kind, update, id, balance) => {
      const { deps } = writableDeps({ grow: [grow({})], balance });
      await expect(update(deps, 'user_1', id, { tag: 'Renamed' })).rejects.toMatchObject({
        code: 'BALANCE_TAG_LINKED_TO_GROW',
      });
    },
  );

  it('allows renaming an unlinked entry to match a project (fixing a typo)', async () => {
    const { deps, current } = writableDeps({
      meta: { schemaVersion: 2 },
      grow: [grow({ title: 'SOL', share: { tag: 'SOL', quantity: 3.54, price: 8795 } })],
      balance: { asset: { shares: [{ id: 'shares_1', tag: 'SLO', quantity: 3.54, price: 8833 }] } },
    });

    await updateShare(deps, 'user_1', 'shares_1', { tag: 'SOL' });

    expect(current().data.balance.asset.shares[0].tag).toBe('SOL');
    expect(current().data.grow[0].share).toMatchObject({ quantity: 3.54, price: 8833 });
  });
});
