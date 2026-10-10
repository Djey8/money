import {
  constructedSubscriptionComment,
  isGeneratedComment,
  staleGeneratedTransactions,
  SyncSubscription,
  SyncTransaction,
  subscriptionOccurrenceDates,
} from './subscription-sync';
import { monthlyEquivalentMinor } from './budget-from-subscriptions';
import { generateDueSubscriptionTransactions } from './subscription-generation';
import { FundState } from './fund-state';

const NOW = new Date('2026-04-15');

const gym: SyncSubscription = {
  title: 'Gym',
  account: 'Daily',
  amountMinor: -2000,
  startDate: '2026-01-10',
  endDate: null,
  category: '@Fitness',
  comment: '',
  frequency: 'monthly',
};

const generated = (sub: SyncSubscription, now = NOW): SyncTransaction[] =>
  subscriptionOccurrenceDates(sub, now).map((date) => ({
    date,
    account: sub.account,
    amountMinor: sub.amountMinor,
    category: sub.category,
    comment: constructedSubscriptionComment(sub.title, sub.comment),
  }));

const datesOf = (all: SyncTransaction[], indices: number[]) => indices.map((i) => all[i].date);

describe('isGeneratedComment', () => {
  it('accepts the comment itself and the comment followed by fund tags only', () => {
    expect(isGeneratedComment('Gym', 'Gym')).toBe(true);
    expect(isGeneratedComment('Gym\n#bucket:Flight Fund:50.00', 'Gym')).toBe(true);
    expect(isGeneratedComment('Gym\n#bucket:A:1.00 #bucket:B:2.50', 'Gym')).toBe(true);
    expect(isGeneratedComment('Gym\n#settle:Hotel:80.00', 'Gym')).toBe(true);
  });

  it('rejects another comment, even one that merely starts the same way', () => {
    expect(isGeneratedComment('Gym membership', 'Gym')).toBe(false);
    expect(isGeneratedComment('Gym + sauna', 'Gym')).toBe(false);
    expect(isGeneratedComment('Gym\nnotes', 'Gym')).toBe(false);
    expect(isGeneratedComment('', 'Gym')).toBe(false);
  });
});

describe('staleGeneratedTransactions', () => {
  it('removes nothing when nothing changed', () => {
    const all = generated(gym);
    expect(staleGeneratedTransactions(gym, { ...gym }, all, NOW)).toEqual([]);
  });

  it('removes everything the old subscription generated when its details change', () => {
    const all = generated(gym);
    expect(all).toHaveLength(4);
    expect(staleGeneratedTransactions(gym, { ...gym, amountMinor: -2500 }, all, NOW)).toEqual([
      0, 1, 2, 3,
    ]);
    for (const change of [
      { title: 'Fitness' },
      { account: 'Splurge' },
      { category: '@Sport' },
      { comment: 'sauna' },
    ]) {
      expect(staleGeneratedTransactions(gym, { ...gym, ...change }, all, NOW)).toHaveLength(4);
    }
  });

  it('removes only the occurrences after an end date moved into the past', () => {
    const all = generated(gym);
    const stale = staleGeneratedTransactions(gym, { ...gym, endDate: '2026-02-20' }, all, NOW);
    expect(datesOf(all, stale)).toEqual(['2026-03-10', '2026-04-10']);
  });

  it('removes nothing when the end date moves into the future, or is removed', () => {
    const ended = { ...gym, endDate: '2026-02-20' };
    const all = generated(ended);
    expect(all).toHaveLength(2);
    expect(staleGeneratedTransactions(ended, { ...gym, endDate: '2026-12-31' }, all, NOW)).toEqual(
      [],
    );
    expect(staleGeneratedTransactions(ended, { ...gym, endDate: null }, all, NOW)).toEqual([]);
  });

  it('keeps the occurrences a changed start date or frequency still produces', () => {
    const all = generated(gym);
    // starting a month later: January's transaction is stale, the rest stay
    const later = staleGeneratedTransactions(gym, { ...gym, startDate: '2026-02-10' }, all, NOW);
    expect(datesOf(all, later)).toEqual(['2026-01-10']);
    // quarterly from the same start: Feb and Mar go, Jan and Apr stay
    const quarterly = staleGeneratedTransactions(gym, { ...gym, frequency: 'quarterly' }, all, NOW);
    expect(datesOf(all, quarterly)).toEqual(['2026-02-10', '2026-03-10']);
  });

  it('removes everything when the subscription is deleted', () => {
    const all = generated(gym);
    expect(staleGeneratedTransactions(gym, null, all, NOW)).toEqual([0, 1, 2, 3]);
  });

  it('never touches a hand-made transaction that looks alike', () => {
    const all = generated(gym);
    const manual: SyncTransaction[] = [
      { ...all[0], date: '2026-02-11' }, // same everything, another day
      { ...all[0], comment: 'Gym day pass' }, // another comment, on the day of an occurrence
      { ...all[0], amountMinor: -2100 },
    ];
    const stale = staleGeneratedTransactions(gym, null, [...manual, ...all], NOW);
    expect(stale).toEqual([3, 4, 5, 6]);
  });

  it('recognises a generated transaction whose comment carries fund tags', () => {
    const smile: SyncSubscription = { ...gym, category: '@Trip', account: 'Smile' };
    const all = generated(smile).map((entry) => ({
      ...entry,
      comment: `${entry.comment}\n#bucket:Flight:20.00`,
    }));
    expect(staleGeneratedTransactions(smile, null, all, NOW)).toHaveLength(4);
    expect(staleGeneratedTransactions(smile, { ...smile }, all, NOW)).toEqual([]);
  });

  it('works for weekly subscriptions and an end date inside the range', () => {
    const weekly: SyncSubscription = { ...gym, frequency: 'weekly', startDate: '2026-03-30' };
    const all = generated(weekly);
    expect(all.map((entry) => entry.date)).toEqual(['2026-03-30', '2026-04-06', '2026-04-13']);
    const stale = staleGeneratedTransactions(
      weekly,
      { ...weekly, endDate: '2026-04-06' },
      all,
      NOW,
    );
    expect(datesOf(all, stale)).toEqual(['2026-04-13']);
  });
});

describe('an edit followed by the ordinary generation', () => {
  const fundState: FundState = {
    mojo: { amountMinor: 0, targetMinor: 100000 },
    smile: [],
    fire: [],
  };
  const asTransactions = (list: SyncTransaction[]) =>
    list.map((entry, index) => ({ ...entry, id: `tx_${index}`, currency: 'EUR', time: '00:00' }));

  it('ends with exactly the transactions the new subscription calls for', () => {
    let transactions = asTransactions(generated(gym));
    const edited = { ...gym, amountMinor: -3000 };
    const stale = staleGeneratedTransactions(gym, edited, transactions, NOW);
    transactions = transactions.filter((_, index) => !stale.includes(index));
    const generation = generateDueSubscriptionTransactions([edited], transactions, fundState, NOW);
    expect(generation.transactionsCreated).toBe(4);
    expect(generation.transactions.every((entry) => entry.amountMinor === -3000)).toBe(true);
  });

  it('adds only the missing ones when the end date moves back into the future', () => {
    const ended = { ...gym, endDate: '2026-02-20' };
    const transactions = asTransactions(generated(ended));
    const extended = { ...gym, endDate: null };
    const generation = generateDueSubscriptionTransactions(
      [extended],
      transactions,
      fundState,
      NOW,
    );
    expect(generation.transactions.map((entry) => entry.date)).toEqual([
      '2026-03-10',
      '2026-04-10',
    ]);
  });

  it('does not generate a second time for transactions that carry fund tags', () => {
    const tagged = asTransactions(generated(gym)).map((entry) => ({
      ...entry,
      comment: `${entry.comment}\n#bucket:Flight:20.00`,
    }));
    const generation = generateDueSubscriptionTransactions([gym], tagged, fundState, NOW);
    expect(generation.transactionsCreated).toBe(0);
  });
});

describe('monthlyEquivalentMinor', () => {
  it('turns every frequency into what it costs per month, keeping the sign', () => {
    expect(monthlyEquivalentMinor(-1000, 'monthly')).toBe(-1000);
    expect(monthlyEquivalentMinor(-1200, 'yearly')).toBe(-100);
    expect(monthlyEquivalentMinor(-3000, 'quarterly')).toBe(-1000);
    expect(monthlyEquivalentMinor(-1200, 'weekly')).toBe(-5200);
    expect(monthlyEquivalentMinor(-1200, 'biweekly')).toBe(-2600);
    expect(monthlyEquivalentMinor(500, 'yearly')).toBe(42);
  });
});
