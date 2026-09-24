'use strict';

/**
 * Item-level bucket/list edits and the money guard on Smile/Fire projects
 * (fund-project-repository.js). CouchDB is mocked; the fund engine runs.
 */

const { updateSmileProject } = require('../../repositories/smile-repository');

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

function vacationWithSavings() {
  return {
    smile: [
      {
        id: 'smile_1',
        title: 'Vacation',
        sub: '',
        phase: 'saving',
        description: '',
        buckets: [
          { id: 'b_flight', title: 'Flight', target: 60000, amount: 20000 },
          { id: 'b_hotel', title: 'Hotel', target: 40000, amount: 0 },
        ],
        links: [],
        actionItems: [{ text: 'Book flight', done: false, priority: 'high' }],
        notes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    transactions: [
      {
        id: 'tx_1',
        account: 'Smile',
        amount: -20000,
        date: '2026-09-01',
        time: '10:00',
        category: '@Vacation',
        comment: '#bucket:Flight:200.00',
      },
    ],
  };
}

describe('item-level bucket edits', () => {
  it('updates, adds and edits optional fields by bucket id without resending the list', async () => {
    const { deps } = writableDeps(vacationWithSavings());
    const result = await updateSmileProject(deps, 'user_1', 'smile_1', {
      bucketsUpdate: [
        { id: 'b_hotel', targetMinor: 50000, notes: 'Near the beach', targetDate: '2027-06-01' },
      ],
      bucketsAdd: [{ title: 'Food', targetMinor: 30000 }],
    });
    expect(result.buckets.map((b) => [b.title, b.targetMinor, b.amountMinor])).toEqual([
      ['Flight', 60000, 20000],
      ['Hotel', 50000, 0],
      ['Food', 30000, 0],
    ]);
    expect(result.buckets[1]).toMatchObject({ notes: 'Near the beach', targetDate: '2027-06-01' });

    const cleared = await updateSmileProject(deps, 'user_1', 'smile_1', {
      bucketsUpdate: [{ id: 'b_hotel', notes: null }],
    });
    expect(cleared.buckets[1]).not.toHaveProperty('notes');
  });

  it('refuses to remove a bucket that holds money', async () => {
    const { deps } = writableDeps(vacationWithSavings());
    await expect(
      updateSmileProject(deps, 'user_1', 'smile_1', { bucketsRemove: ['b_flight'] }),
    ).rejects.toMatchObject({ code: 'FUND_HAS_MONEY' });
    // ...also when the bucket is just left out of a whole-list replace.
    await expect(
      updateSmileProject(deps, 'user_1', 'smile_1', {
        buckets: [{ id: 'b_hotel', title: 'Hotel', targetMinor: 40000 }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_HAS_MONEY' });
  });

  it("with force, strips the removed bucket's tags so its money is redistributed, not zeroed", async () => {
    const { deps, current } = writableDeps(vacationWithSavings());
    const result = await updateSmileProject(deps, 'user_1', 'smile_1', {
      bucketsRemove: ['b_flight'],
      force: true,
    });
    expect(result.buckets.map((b) => [b.title, b.amountMinor])).toEqual([['Hotel', 20000]]);
    expect(current().data.transactions[0]).toMatchObject({ amount: -20000, comment: '' });
  });

  it('refuses unknown bucket ids, duplicate titles, and removing the last bucket', async () => {
    const { deps } = writableDeps(vacationWithSavings());
    await expect(
      updateSmileProject(deps, 'user_1', 'smile_1', {
        bucketsUpdate: [{ id: 'nope', title: 'X' }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
    await expect(
      updateSmileProject(deps, 'user_1', 'smile_1', {
        bucketsAdd: [{ title: 'hotel', targetMinor: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
    await expect(
      updateSmileProject(deps, 'user_1', 'smile_1', {
        bucketsRemove: ['b_flight', 'b_hotel'],
        force: true,
      }),
    ).rejects.toMatchObject({ code: 'FUND_INVALID_INPUT' });
  });
});

describe('item-level list edits', () => {
  it('ticks one action item and adds a note', async () => {
    const { deps } = writableDeps(vacationWithSavings());
    const result = await updateSmileProject(deps, 'user_1', 'smile_1', {
      actionItemsUpdate: [{ index: 0, done: true }],
      notesAdd: [{ text: 'Flights booked' }],
    });
    expect(result.actionItems).toEqual([{ text: 'Book flight', done: true, priority: 'high' }]);
    expect(result.notes[0].text).toBe('Flights booked');
  });
});
