import { FundState, recalculateFundState } from './fund-state';
import { ApiTransaction } from './transaction';

const state: FundState = {
  mojo: { amountMinor: 5000, targetMinor: 10000 },
  smile: [
    {
      title: 'Holiday',
      buckets: [{ id: 'flight', title: 'Flights', targetMinor: 10000, amountMinor: 9000 }],
    },
  ],
  fire: [
    {
      title: 'Emergency',
      phase: 'saving',
      buckets: [{ id: 'car', title: 'Car', targetMinor: 5000, amountMinor: 0 }],
    },
  ],
};
const transaction = (overrides: Partial<ApiTransaction>): ApiTransaction => ({
  id: 'tx',
  account: 'Smile',
  amountMinor: -1000,
  currency: 'EUR',
  date: '2026-09-06',
  time: '09:00',
  category: '@Holiday',
  comment: '',
  ...overrides,
});

describe('recalculateFundState', () => {
  it('resets prior balances and caps explicit Smile allocations', () => {
    const result = recalculateFundState([transaction({ comment: '#bucket:Flights:120' })], state);
    expect(result.smile[0].buckets[0].amountMinor).toBe(10000);
    expect(state.smile[0].buckets[0].amountMinor).toBe(9000);
  });

  it('updates Mojo and completes a Fire project from matching transactions', () => {
    const result = recalculateFundState(
      [
        transaction({ account: 'Fire', category: '@Mojo', amountMinor: -7000 }),
        transaction({
          account: 'Fire',
          category: '@Emergency',
          amountMinor: -6000,
          date: '2026-09-07',
        }),
      ],
      state,
    );
    expect(result.mojo.amountMinor).toBe(7000);
    expect(result.fire[0]).toMatchObject({ phase: 'completed', completionDate: '2026-09-07' });
    expect(result.fire[0].buckets[0].amountMinor).toBe(5000);
  });

  it('adjusts a capped Smile transaction before derived accounting consumes it', () => {
    const result = recalculateFundState(
      [transaction({ amountMinor: -12000, comment: 'Fund #bucket:Flights:120' })],
      state,
    );
    expect(result.transactions[0]).toMatchObject({
      amountMinor: -10000,
      comment: 'Fund\n#bucket:Flights:100.00',
    });
  });

  it('adjusts a capped Fire transaction before derived accounting consumes it', () => {
    const result = recalculateFundState(
      [transaction({ account: 'Fire', category: '@Emergency', amountMinor: -6000 })],
      state,
    );
    expect(result.transactions[0].amountMinor).toBe(-5000);
    expect(result.fire[0].buckets[0].amountMinor).toBe(5000);
  });

  it('adjusts an untagged Smile transaction when equal allocation fills all buckets', () => {
    const result = recalculateFundState([transaction({ amountMinor: -12000 })], state);
    expect(result.transactions[0].amountMinor).toBe(-10000);
    expect(result.smile[0].buckets[0].amountMinor).toBe(10000);
  });

  it('redistributes an untagged Smile transaction to buckets with room instead of dropping the shortfall', () => {
    const multiBucketState: FundState = {
      mojo: { amountMinor: 0, targetMinor: 100000 },
      smile: [
        {
          title: 'Holiday',
          buckets: [
            { id: 'flights', title: 'Flights', targetMinor: 10000, amountMinor: 0 },
            { id: 'hotel', title: 'Hotel', targetMinor: 10000, amountMinor: 0 },
          ],
        },
      ],
      fire: [],
    };
    const result = recalculateFundState(
      [
        transaction({ id: 'tx1', amountMinor: -9000, comment: '#bucket:Flights:90' }),
        transaction({ id: 'tx2', amountMinor: -6000 }),
      ],
      multiBucketState,
    );
    expect(result.smile[0].buckets[0].amountMinor).toBe(10000);
    expect(result.smile[0].buckets[1].amountMinor).toBe(5000);
    expect(result.transactions[1].amountMinor).toBe(-6000);
  });

  it('leaves a transaction untouched when it matches a legacy project with no buckets yet', () => {
    const legacyState: FundState = {
      mojo: { amountMinor: 0, targetMinor: 0 },
      smile: [{ title: 'Holiday', buckets: [] }],
      fire: [{ title: 'Emergency', buckets: [] }],
    };
    const result = recalculateFundState(
      [
        transaction({ id: 'tx1', category: '@Holiday', amountMinor: -5000 }),
        transaction({ id: 'tx2', account: 'Fire', category: '@Emergency', amountMinor: -3000 }),
      ],
      legacyState,
    );
    expect(result.transactions[0].amountMinor).toBe(-5000);
    expect(result.transactions[1].amountMinor).toBe(-3000);
    expect(result.smile[0].buckets).toEqual([]);
    expect(result.fire[0].buckets).toEqual([]);
  });
});
