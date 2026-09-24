import {
  generateDueSubscriptionTransactions,
  SubscriptionForGeneration,
} from './subscription-generation';
import { FundState } from './fund-state';
import { ApiTransaction } from './transaction';

const NOW = new Date('2026-04-15');

function emptyFundState(): FundState {
  return { mojo: { amountMinor: 0, targetMinor: 100000 }, smile: [], fire: [] };
}

function subscription(
  overrides: Partial<SubscriptionForGeneration> = {},
): SubscriptionForGeneration {
  return {
    title: 'Spotify',
    account: 'Daily',
    amountMinor: -1000,
    startDate: '2026-01-15',
    endDate: null,
    category: '@Streaming',
    comment: '',
    frequency: 'monthly',
    ...overrides,
  };
}

function tx(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: 'tx_existing',
    account: 'Daily',
    amountMinor: -1000,
    currency: 'EUR',
    date: '2026-01-15',
    time: '09:00',
    category: '@Streaming',
    comment: 'Spotify',
    ...overrides,
  };
}

describe('generateDueSubscriptionTransactions', () => {
  it('generates one transaction per due occurrence with the constructed comment', () => {
    const result = generateDueSubscriptionTransactions([subscription()], [], emptyFundState(), NOW);
    expect(result.subscriptionsProcessed).toBe(1);
    expect(result.transactionsCreated).toBe(4); // Jan 15, Feb 15, Mar 15, Apr 15
    expect(result.transactions[0]).toEqual({
      account: 'Daily',
      amountMinor: -1000,
      date: '2026-01-15',
      time: '00:00',
      category: '@Streaming',
      comment: 'Spotify',
    });
  });

  it('appends the comment as "title + comment" when a comment is set', () => {
    const result = generateDueSubscriptionTransactions(
      [
        subscription({
          comment: 'shared with roommate',
          startDate: '2026-04-01',
          frequency: 'monthly',
        }),
      ],
      [],
      emptyFundState(),
      NOW,
    );
    expect(result.transactions[0].comment).toBe('Spotify + shared with roommate');
  });

  it('does not regenerate a transaction that already exists (same date/account/amount/category/comment)', () => {
    const existing = [tx({ date: '2026-01-15' })];
    const result = generateDueSubscriptionTransactions(
      [subscription({ startDate: '2026-01-15', endDate: '2026-01-15' })],
      existing,
      emptyFundState(),
      NOW,
    );
    expect(result.transactionsCreated).toBe(0);
    expect(result.subscriptionsProcessed).toBe(1);
  });

  it('regenerates when the existing transaction differs on amount (a real re-run hazard the API accepts as documented)', () => {
    const existing = [tx({ date: '2026-01-15', amountMinor: -500 })];
    const result = generateDueSubscriptionTransactions(
      [subscription({ startDate: '2026-01-15', endDate: '2026-01-15', amountMinor: -1000 })],
      existing,
      emptyFundState(),
      NOW,
    );
    expect(result.transactionsCreated).toBe(1);
  });

  it('skips a subscription that has not started yet, and does not count it as processed', () => {
    const result = generateDueSubscriptionTransactions(
      [subscription({ startDate: '2026-12-01' })],
      [],
      emptyFundState(),
      NOW,
    );
    expect(result.subscriptionsProcessed).toBe(0);
    expect(result.transactionsCreated).toBe(0);
  });

  it('uses endDate as the boundary when it has already passed, instead of now', () => {
    const result = generateDueSubscriptionTransactions(
      [subscription({ startDate: '2026-01-15', endDate: '2026-02-20', frequency: 'monthly' })],
      [],
      emptyFundState(),
      NOW,
    );
    // Jan 15, Feb 15 only — Mar/Apr would be within `now` but past the subscription's own end date.
    expect(result.transactions.map((t) => t.date)).toEqual(['2026-01-15', '2026-02-15']);
  });

  it('treats an empty-string endDate the same as no end date', () => {
    const result = generateDueSubscriptionTransactions(
      [subscription({ startDate: '2026-03-15', endDate: '' })],
      [],
      emptyFundState(),
      NOW,
    );
    expect(result.transactions.map((t) => t.date)).toEqual(['2026-03-15', '2026-04-15']);
  });

  it('skips generating a transaction entirely once Mojo is already at or over target', () => {
    // `recalculateFundState` always rebuilds amountMinor by replaying transactions — a prior
    // @Mojo contribution of exactly the target amount is how "already full" is set up here.
    const mojoTarget: FundState = {
      mojo: { amountMinor: 0, targetMinor: 50000 },
      smile: [],
      fire: [],
    };
    const priorContribution = tx({
      id: 'tx_prior',
      category: '@Mojo',
      amountMinor: -50000,
      date: '2026-01-01',
    });
    const result = generateDueSubscriptionTransactions(
      [subscription({ category: '@Mojo', startDate: '2026-04-01', frequency: 'monthly' })],
      [priorContribution],
      mojoTarget,
      NOW,
    );
    expect(result.transactionsCreated).toBe(0);
    expect(result.subscriptionsProcessed).toBe(1);
  });

  it('generates a Mojo contribution while under target, then skips every later occurrence in the same run once it reaches target', () => {
    // Prior contributions bring Mojo to 6000/10000; a weekly -4000 subscription's first
    // occurrence exactly fills it to target, so every later occurrence in this run is skipped.
    const mojoTarget: FundState = {
      mojo: { amountMinor: 0, targetMinor: 10000 },
      smile: [],
      fire: [],
    };
    const priorContribution = tx({
      id: 'tx_prior',
      category: '@Mojo',
      amountMinor: -6000,
      date: '2026-01-01',
    });
    const result = generateDueSubscriptionTransactions(
      [
        subscription({
          category: '@Mojo',
          account: 'Daily',
          amountMinor: -4000,
          startDate: '2026-04-01',
          endDate: '2026-04-15',
          frequency: 'weekly',
        }),
      ],
      [priorContribution],
      mojoTarget,
      NOW,
    );
    expect(result.transactions.map((t) => t.date)).toEqual(['2026-04-01']);
  });

  it('skips generating a transaction once a matching Smile project is already fully funded', () => {
    const smileState: FundState = {
      mojo: { amountMinor: 0, targetMinor: 100000 },
      smile: [
        {
          title: 'Holiday',
          buckets: [{ id: 'b1', title: 'Flights', targetMinor: 50000, amountMinor: 0 }],
        },
      ],
      fire: [],
    };
    const priorContribution = tx({
      id: 'tx_prior',
      category: '@Holiday',
      amountMinor: -50000,
      date: '2026-01-01',
    });
    const result = generateDueSubscriptionTransactions(
      [subscription({ category: '@Holiday', startDate: '2026-04-01', frequency: 'monthly' })],
      [priorContribution],
      smileState,
      NOW,
    );
    expect(result.transactionsCreated).toBe(0);
  });

  it('skips a Fire fund whose target bucket is full (the original never checked Fire)', () => {
    const fireState: FundState = {
      mojo: { amountMinor: 0, targetMinor: 100000 },
      smile: [],
      fire: [
        {
          title: 'Car',
          buckets: [
            { id: 'b1', title: 'Repair', targetMinor: 30000, amountMinor: 0 },
            { id: 'b2', title: 'Tyres', targetMinor: 20000, amountMinor: 0 },
          ],
        },
      ],
    };
    const prior = tx({ id: 'tx_prior', category: '@Car', amountMinor: -30000, date: '2026-01-01' });
    const untagged = generateDueSubscriptionTransactions(
      [subscription({ category: '@Car', startDate: '2026-04-01', frequency: 'monthly' })],
      [prior],
      fireState,
      NOW,
    );
    // Untagged @Car money only ever fills the first bucket, which is full.
    expect(untagged.transactionsCreated).toBe(0);

    const tyres = generateDueSubscriptionTransactions(
      [subscription({ category: '@Tyres', startDate: '2026-04-01', frequency: 'monthly' })],
      [prior],
      fireState,
      NOW,
    );
    expect(tyres.transactionsCreated).toBeGreaterThan(0);
  });

  it('skips a plan whose own tagged bucket is full even though another bucket has room', () => {
    const smileState: FundState = {
      mojo: { amountMinor: 0, targetMinor: 100000 },
      smile: [
        {
          title: 'Holiday',
          buckets: [
            { id: 'b1', title: 'Flights', targetMinor: 50000, amountMinor: 0 },
            { id: 'b2', title: 'Hotel', targetMinor: 50000, amountMinor: 0 },
          ],
        },
      ],
      fire: [],
    };
    const prior = tx({
      id: 'tx_prior',
      category: '@Holiday',
      amountMinor: -50000,
      date: '2026-01-01',
      comment: '#bucket:Flights:500.00',
    });
    const result = generateDueSubscriptionTransactions(
      [
        subscription({
          category: '@Holiday',
          comment: '#bucket:Flights:50.00',
          startDate: '2026-04-01',
          frequency: 'monthly',
        }),
      ],
      [prior],
      smileState,
      NOW,
    );
    expect(result.transactionsCreated).toBe(0);
  });

  it('still generates a transaction for a Smile project that is under target', () => {
    const smileState: FundState = {
      mojo: { amountMinor: 0, targetMinor: 100000 },
      smile: [
        {
          title: 'Holiday',
          buckets: [{ id: 'b1', title: 'Flights', targetMinor: 50000, amountMinor: 0 }],
        },
      ],
      fire: [],
    };
    const priorContribution = tx({
      id: 'tx_prior',
      category: '@Holiday',
      amountMinor: -10000,
      date: '2026-01-01',
    });
    const result = generateDueSubscriptionTransactions(
      [subscription({ category: '@Holiday', startDate: '2026-04-01', frequency: 'monthly' })],
      [priorContribution],
      smileState,
      NOW,
    );
    expect(result.transactionsCreated).toBe(1);
  });

  it('processes multiple subscriptions independently, each with its own due-date window', () => {
    const result = generateDueSubscriptionTransactions(
      [
        subscription({
          title: 'Spotify',
          category: '@Streaming',
          startDate: '2026-04-01',
          frequency: 'monthly',
        }),
        subscription({
          title: 'Gym',
          category: '@Fitness',
          startDate: '2026-04-10',
          frequency: 'monthly',
        }),
      ],
      [],
      emptyFundState(),
      NOW,
    );
    expect(result.subscriptionsProcessed).toBe(2);
    expect(result.transactionsCreated).toBe(2);
  });
});
