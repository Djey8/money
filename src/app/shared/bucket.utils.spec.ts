import { Transaction } from '../interfaces/transaction';
import {
  bucketCapacity,
  findSettlementIndex,
  settleBucketTransactions,
  unsettleBucketTransactions,
} from './bucket.utils';

const base = { account: 'Smile', date: '2026-09-24', time: '10:00' };

function contribution(amount: number): Transaction {
  return {
    ...base,
    amount: -amount,
    category: '@Alps',
    comment: `#bucket:Guide:${amount.toFixed(2)}`,
  };
}

describe('bucket.utils', () => {
  it('uses the settled amount as capacity once settled', () => {
    expect(bucketCapacity({ target: 500 })).toBe(500);
    expect(bucketCapacity({ target: 500, settledAmount: 650 })).toBe(650);
  });

  it('tops up the difference when the actual cost is higher', () => {
    const transactions = [contribution(500)];
    settleBucketTransactions(transactions, {
      ...base,
      projectTitle: 'Alps',
      bucket: { title: 'Guide', amount: 500 },
      actual: 650,
      receipt: 'Invoice 123',
    });
    expect(transactions[1]).toMatchObject({
      amount: -150,
      category: '@Alps',
      comment: 'Invoice 123\n#settle:Guide:650.00',
    });
  });

  it('releases a surplus, or moves it into another bucket', () => {
    const released = [contribution(60)];
    settleBucketTransactions(released, {
      ...base,
      projectTitle: 'Alps',
      bucket: { title: 'Guide', amount: 60 },
      actual: 50,
    });
    expect(released).toHaveLength(2);
    expect(released[1].amount).toBe(10);

    const moved = [contribution(60)];
    settleBucketTransactions(moved, {
      ...base,
      projectTitle: 'Alps',
      bucket: { title: 'Guide', amount: 60 },
      actual: 50,
      moveSurplusTo: 'Hut',
    });
    expect(moved[2]).toMatchObject({
      amount: -10,
      comment: 'Surplus from Guide\n#bucket:Hut:10.00',
    });
  });

  it('settling again replaces the same settlement, based on the original savings', () => {
    // Settled at 650 with 500 saved: the bucket now holds 650, the settlement is -150.
    const transactions = [contribution(500)];
    settleBucketTransactions(transactions, {
      ...base,
      projectTitle: 'Alps',
      bucket: { title: 'Guide', amount: 500 },
      actual: 650,
    });
    settleBucketTransactions(transactions, {
      ...base,
      projectTitle: 'Alps',
      bucket: { title: 'Guide', amount: 650 },
      actual: 700,
    });
    expect(transactions).toHaveLength(2);
    expect(transactions[1]).toMatchObject({ amount: -200, comment: '#settle:Guide:700.00' });
  });

  it('unsettling removes the settlement only', () => {
    const transactions = [contribution(500)];
    settleBucketTransactions(transactions, {
      ...base,
      projectTitle: 'Alps',
      bucket: { title: 'Guide', amount: 500 },
      actual: 650,
    });
    expect(findSettlementIndex(transactions, 'alps', 'guide')).toBe(1);
    expect(unsettleBucketTransactions(transactions, 'Alps', 'Guide')).toBe(true);
    expect(transactions).toEqual([contribution(500)]);
    expect(unsettleBucketTransactions(transactions, 'Alps', 'Guide')).toBe(false);
  });
});
