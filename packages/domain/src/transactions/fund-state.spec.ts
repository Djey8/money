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
});
