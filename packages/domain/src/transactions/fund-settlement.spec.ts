import { recalculateFundState, FundState } from './fund-state';
import { computeProjectTotals } from './fund-projects';
import { ApiTransaction } from './transaction';

function tx(overrides: Partial<ApiTransaction>): ApiTransaction {
  return {
    id: 'tx',
    account: 'Smile',
    amountMinor: 0,
    currency: 'EUR',
    date: '2026-09-01',
    time: '10:00',
    category: '@Alps',
    comment: '',
    ...overrides,
  };
}

function state(kind: 'smile' | 'fire', targetMinor = 50000): FundState {
  const project = {
    title: 'Alps',
    buckets: [
      { id: 'b_guide', title: 'Mountain guide', targetMinor, amountMinor: 0 },
      { id: 'b_hut', title: 'Hut', targetMinor: 20000, amountMinor: 0 },
    ],
  };
  return {
    mojo: { amountMinor: 0, targetMinor: 0 },
    smile: kind === 'smile' ? [project] : [],
    fire: kind === 'fire' ? [project] : [],
  };
}

const saved = (amountMinor: number) =>
  tx({
    id: 'tx_saved',
    amountMinor: -amountMinor,
    comment: `#bucket:Mountain guide:${(amountMinor / 100).toFixed(2)}`,
  });

const settle = (actual: string, overrides: Partial<ApiTransaction> = {}) =>
  tx({
    id: 'tx_settle',
    date: '2026-09-20',
    comment: `Invoice #123\n#settle:Mountain guide:${actual}`,
    ...overrides,
  });

describe('settling a bucket', () => {
  it('tops up a shortfall: saved 500, paid 650 -> the settlement is -150 and the bucket shows plan vs actual', () => {
    const result = recalculateFundState([saved(50000), settle('650.00')], state('smile'));
    const guide = result.smile[0].buckets[0];
    expect(guide).toMatchObject({
      targetMinor: 50000,
      amountMinor: 65000,
      settledMinor: 65000,
      settledDate: '2026-09-20',
    });
    expect(result.transactions[1].amountMinor).toBe(-15000);
  });

  it('releases a surplus: saved 60, paid 50 -> the settlement is +10', () => {
    const result = recalculateFundState([saved(6000), settle('50.00')], state('smile', 6000));
    expect(result.smile[0].buckets[0]).toMatchObject({ amountMinor: 5000, settledMinor: 5000 });
    expect(result.transactions[1].amountMinor).toBe(1000);
  });

  it('keeps an exact settlement as a 0 transaction (it carries the receipt), unlike other 0 transactions', () => {
    const result = recalculateFundState(
      [saved(50000), settle('500.00'), tx({ id: 'tx_zero', amountMinor: 0, comment: 'nothing' })],
      state('smile'),
    );
    expect(result.transactions.map((t) => [t.id, t.amountMinor])).toEqual([
      ['tx_saved', -50000],
      ['tx_settle', -0],
    ]);
    expect(result.smile[0].buckets[0].settledMinor).toBe(50000);
  });

  it('settles a bucket nothing was saved for: the whole bill is the settlement', () => {
    const result = recalculateFundState([settle('50.00')], state('smile'));
    expect(result.transactions[0].amountMinor).toBe(-5000);
  });

  it("takes no further contributions once settled, and doesn't split untagged money into it", () => {
    const result = recalculateFundState(
      [
        saved(50000),
        settle('650.00'),
        tx({
          id: 'tx_more',
          date: '2026-10-01',
          amountMinor: -10000,
          comment: '#bucket:Mountain guide:100.00',
        }),
        tx({ id: 'tx_untagged', date: '2026-10-02', amountMinor: -4000 }),
      ],
      state('smile'),
    );
    expect(result.transactions.find((t) => t.id === 'tx_more')?.amountMinor).toBe(-0);
    expect(result.smile[0].buckets.map((b) => b.amountMinor)).toEqual([65000, 4000]);
  });

  it('recomputes the settlement when an earlier contribution changes (replay keeps it exact)', () => {
    const result = recalculateFundState([saved(30000), settle('650.00')], state('smile'));
    expect(result.transactions[1].amountMinor).toBe(-35000);
  });

  it('re-settling updates the actual cost; removing the settlement reopens the bucket with its savings', () => {
    const resettled = recalculateFundState([saved(50000), settle('680.00')], state('smile'));
    expect(resettled.smile[0].buckets[0].settledMinor).toBe(68000);

    const reopened = recalculateFundState([saved(50000)], state('smile'));
    expect(reopened.smile[0].buckets[0]).toMatchObject({ amountMinor: 50000 });
    expect(reopened.smile[0].buckets[0].settledMinor).toBeUndefined();
  });

  it('totals use the actual cost of settled buckets and keep the planned sum', () => {
    const result = recalculateFundState([saved(50000), settle('650.00')], state('smile'));
    expect(computeProjectTotals(result.smile[0].buckets)).toMatchObject({
      targetMinor: 65000 + 20000,
      plannedTargetMinor: 50000 + 20000,
      amountMinor: 65000,
    });
  });

  it('completes a Fire fund when its last bucket is settled', () => {
    const result = recalculateFundState(
      [
        tx({ id: 'tx_hut', account: 'Fire', amountMinor: -20000, comment: '#bucket:Hut:200.00' }),
        settle('400.00', { account: 'Fire' }),
      ],
      state('fire'),
    );
    expect(result.fire[0]).toMatchObject({ phase: 'completed', completionDate: '2026-09-20' });
  });
});
