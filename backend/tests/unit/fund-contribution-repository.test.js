'use strict';

/**
 * Contributions to Smile/Fire/Mojo (fund-contribution-repository.js).
 * CouchDB is mocked; the fund engine itself runs for real.
 */

const {
  contributeToProject,
  contributeToMojo,
  listProjectTransactions,
  listMojoTransactions,
} = require('../../repositories/fund-contribution-repository');

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

function project(id, title, buckets) {
  return {
    id,
    title,
    sub: '',
    phase: 'saving',
    description: '',
    buckets,
    links: [],
    actionItems: [],
    notes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const vacation = () =>
  project('smile_1', 'Vacation', [
    { id: 'b_flight', title: 'Flight', target: 60000, amount: 0 },
    { id: 'b_hotel', title: 'Hotel', target: 40000, amount: 0 },
  ]);

describe('contributeToProject (Smile)', () => {
  it('splits evenly across buckets by default, as a negative transaction from the Smile account', async () => {
    const { deps } = writableDeps({ smile: [vacation()] });
    const result = await contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
      amountMinor: 20000,
      date: '2026-09-24',
      time: '10:00',
    });
    expect(result.transaction).toMatchObject({
      account: 'Smile',
      amountMinor: -20000,
      category: '@Vacation',
    });
    expect(result.project.buckets.map((b) => b.amountMinor)).toEqual([10000, 10000]);
    expect(result.effects.smile).toHaveLength(2);
  });

  it('splits across chosen buckets by id, writing the #bucket tags itself', async () => {
    const { deps } = writableDeps({ smile: [vacation()] });
    const result = await contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
      buckets: [{ bucketId: 'b_hotel', amountMinor: 15000 }],
      comment: 'September savings',
    });
    expect(result.transaction.comment).toBe('September savings\n#bucket:Hotel:150.00');
    expect(result.project.buckets.map((b) => b.amountMinor)).toEqual([0, 15000]);
  });

  it('is capped at the room left, and says so', async () => {
    const { deps } = writableDeps({ smile: [vacation()] });
    const result = await contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
      buckets: [{ bucketId: 'b_hotel', amountMinor: 50000 }],
    });
    expect(result.requestedMinor).toBe(50000);
    expect(result.appliedMinor).toBe(40000);
    expect(result.transaction.amountMinor).toBe(-40000);
  });

  it('refuses a full bucket, an unknown bucket, and a mismatched total', async () => {
    const full = vacation();
    full.buckets[1].amount = 40000;
    const { deps } = writableDeps({
      smile: [full],
      transactions: [
        {
          id: 'tx_0',
          account: 'Smile',
          amount: -40000,
          date: '2026-09-01',
          time: '10:00',
          category: '@Vacation',
          comment: '#bucket:Hotel:400.00',
        },
      ],
    });
    await expect(
      contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
        buckets: [{ bucketId: 'b_hotel', amountMinor: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_FULL' });
    await expect(
      contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
        buckets: [{ bucketId: 'nope', amountMinor: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
    await expect(
      contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
        amountMinor: 5,
        buckets: [{ bucketId: 'b_flight', amountMinor: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
  });

  it('returns null for a project that does not exist', async () => {
    const { deps } = writableDeps({ smile: [vacation()] });
    await expect(
      contributeToProject(deps, 'user_1', 'smile', 'smile_missing', { amountMinor: 1 }),
    ).resolves.toBeNull();
  });
});

describe('a default Smile split is pinned with tags', () => {
  it('so adding a bucket later does not move money already saved', async () => {
    const { deps } = writableDeps({ smile: [vacation()] });
    const result = await contributeToProject(deps, 'user_1', 'smile', 'smile_1', {
      amountMinor: 20000,
    });
    expect(result.transaction.comment).toBe('#bucket:Flight:100.00 #bucket:Hotel:100.00');

    const { updateSmileProject } = require('../../repositories/smile-repository');
    const updated = await updateSmileProject(deps, 'user_1', 'smile_1', {
      bucketsAdd: [{ title: 'Food', targetMinor: 30000 }],
    });
    expect(updated.buckets.map((b) => b.amountMinor)).toEqual([10000, 10000, 0]);
  });
});

describe('contributeToProject (Fire)', () => {
  it('goes to the first bucket by default and completes the fund when every bucket is full', async () => {
    const { deps } = writableDeps({
      fire: [
        project('fire_1', 'Car', [{ id: 'b_repair', title: 'Repair', target: 30000, amount: 0 }]),
      ],
    });
    const result = await contributeToProject(deps, 'user_1', 'fire', 'fire_1', {
      amountMinor: 30000,
    });
    expect(result.transaction.account).toBe('Fire');
    expect(result.project.buckets[0].amountMinor).toBe(30000);
    expect(result.project.phase).toBe('completed');
  });
});

describe('contributeToMojo', () => {
  it('adds to Mojo from the Fire account by default, capped at the target', async () => {
    const { deps, current } = writableDeps({ mojo: { amount: 0, target: 100000 } });
    const result = await contributeToMojo(deps, 'user_1', { amountMinor: 150000 });
    expect(result.transaction).toMatchObject({ account: 'Fire', category: '@Mojo' });
    expect(current().data.mojo.amount).toBe(100000);
    expect(result.effects.mojo).toEqual({ beforeMinor: 0, afterMinor: 100000 });
  });
});

describe('transaction lists', () => {
  it("lists what counts toward a project (Fire: its title or a bucket's), with parsed allocations", async () => {
    const { deps } = writableDeps({
      fire: [
        project('fire_1', 'Car', [{ id: 'b_repair', title: 'Repair', target: 30000, amount: 0 }]),
      ],
      transactions: [
        {
          id: 'tx_1',
          account: 'Fire',
          amount: -100,
          date: '2026-09-01',
          time: '10:00',
          category: '@Car',
          comment: '#bucket:Repair:1.00',
        },
        {
          id: 'tx_2',
          account: 'Fire',
          amount: -200,
          date: '2026-09-02',
          time: '10:00',
          category: '@Repair',
          comment: '',
        },
        {
          id: 'tx_3',
          account: 'Daily',
          amount: -300,
          date: '2026-09-03',
          time: '10:00',
          category: '@Food',
          comment: '',
        },
        {
          id: 'tx_4',
          account: 'Daily',
          amount: -400,
          date: '2026-09-04',
          time: '10:00',
          category: '@Mojo',
          comment: '',
        },
      ],
    });
    const transactions = await listProjectTransactions(deps, 'user_1', 'fire', 'fire_1');
    expect(transactions.map((t) => t.id)).toEqual(['tx_1', 'tx_2']);
    expect(transactions[0].bucketAllocations).toEqual([
      { bucketTitle: 'Repair', amountMinor: 100 },
    ]);
    expect((await listMojoTransactions(deps, 'user_1')).map((t) => t.id)).toEqual(['tx_4']);
  });
});
