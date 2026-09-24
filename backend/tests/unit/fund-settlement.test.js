'use strict';

/**
 * Settling Smile/Fire buckets (fund-contribution-repository.js). CouchDB is
 * mocked; the fund engine runs for real.
 */

const {
  contributeToProject,
  settleBucket,
  unsettleBucket,
} = require('../../repositories/fund-contribution-repository');
const { createTransaction } = require('../../repositories/transaction-repository');

function writableDeps(data) {
  let document = { _id: 'user_1', _rev: '1-a', data: { meta: { schemaVersion: 2 }, ...data } };
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

function alps(guideTarget = 50000) {
  return {
    smile: [
      {
        id: 'smile_1',
        title: 'Alps',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [
          { id: 'b_guide', title: 'Mountain guide', target: guideTarget, amount: 0 },
          { id: 'b_petrol', title: 'Petrol', target: 6000, amount: 0 },
        ],
        links: [],
        actionItems: [],
        notes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

async function withSavings(deps, bucketId, amountMinor) {
  await contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
    buckets: [{ bucketId, amountMinor }],
    date: '2026-09-01',
    time: '10:00',
  });
}

describe('settleBucket', () => {
  it('mountain guide: saved 500, paid 650 -> -150 top-up, plan vs actual on the bucket', async () => {
    const { deps } = writableDeps(alps());
    await withSavings(deps, 'b_guide', 50000);

    const result = await settleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_guide', {
      actualMinor: 65000,
      receipt: 'Guide invoice #123',
      date: '2026-09-20',
    });

    expect(result.differenceMinor).toBe(-15000);
    expect(result.settlement).toMatchObject({
      account: 'Smile',
      category: '@Alps',
      comment: 'Guide invoice #123\n#settle:Mountain guide:650.00',
    });
    expect(result.bucket).toMatchObject({
      status: 'settled',
      targetMinor: 50000,
      settledMinor: 65000,
      amountMinor: 65000,
      varianceMinor: 15000,
      settledDate: '2026-09-20',
    });
  });

  it('petrol: saved 60, paid 50 -> +10 released back to the account', async () => {
    const { deps } = writableDeps(alps());
    await withSavings(deps, 'b_petrol', 6000);
    const result = await settleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_petrol', {
      actualMinor: 5000,
    });
    expect(result.differenceMinor).toBe(1000);
    expect(result.bucket).toMatchObject({ amountMinor: 5000, varianceMinor: -1000 });
  });

  it('moves a surplus into another bucket instead of releasing it', async () => {
    const { deps } = writableDeps(alps());
    await withSavings(deps, 'b_petrol', 6000);
    const result = await settleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_petrol', {
      actualMinor: 5000,
      surplus: { moveToBucketId: 'b_guide' },
    });
    expect(result.differenceMinor).toBe(1000);
    expect(result.surplusContribution.amountMinor).toBe(-1000);
    expect(result.project.buckets.map((b) => b.amountMinor)).toEqual([1000, 5000]);
  });

  it('settling again edits the same settlement; unsettle reopens the bucket with its savings', async () => {
    const { deps, current } = writableDeps(alps());
    await withSavings(deps, 'b_guide', 50000);
    const first = await settleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_guide', {
      actualMinor: 65000,
    });
    const again = await settleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_guide', {
      actualMinor: 68000,
    });
    expect(again.settlement.id).toBe(first.settlement.id);
    expect(again.differenceMinor).toBe(-18000);
    expect(current().data.transactions).toHaveLength(2);

    const reopened = await unsettleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_guide');
    expect(reopened.bucket).toMatchObject({ status: 'open', amountMinor: 50000 });
    expect(current().data.transactions).toHaveLength(1);
  });

  it('refuses contributions to a settled bucket and a hand-written #settle tag', async () => {
    const { deps } = writableDeps(alps());
    await settleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_petrol', { actualMinor: 5000 });
    await expect(
      contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
        buckets: [{ bucketId: 'b_petrol', amountMinor: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_FULL' });
    await expect(
      createTransaction(deps, 'user_1', {
        account: 'Smile',
        amountMinor: -100,
        date: '2026-09-24',
        time: '10:00',
        category: '@Alps',
        comment: '#settle:Petrol:1.00',
      }),
    ).rejects.toMatchObject({ code: 'TRANSACTION_GROW_TRADE' });
  });

  it('refuses unsettling a bucket that is not settled, and an unknown bucket', async () => {
    const { deps } = writableDeps(alps());
    await expect(
      unsettleBucket(deps, 'user_1', 'smile', 'smile_1', 'b_guide'),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
    await expect(
      settleBucket(deps, 'user_1', 'smile', 'smile_1', 'nope', { actualMinor: 1 }),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
  });
});
