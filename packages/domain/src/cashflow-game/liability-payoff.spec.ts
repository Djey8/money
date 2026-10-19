import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { applyEffectsToBooks, type GameBooks } from './books';
import { fixedClock } from './clock';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { identityText } from './game-text';
import type { DealDeps } from './deals';
import { payableLiabilities, planLiabilityPayoff, payOffLiability } from './liability-payoff';
import { summarizeGameFinances } from './saved-games';

const SET = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const PROFESSION = SET.professions.find((p) => p.id === 'hausmeister')!;
const deps: DealDeps = {
  clock: fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
  text: identityText,
  money: (minor) => `${minor / 100}`,
  plainMoney: (minor) => `${minor / 100}`,
};

/** The Hausmeister at the start, with `cashMinor` on the Daily account. */
function books(cashMinor: number): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'cashflow',
    'hausmeister',
    '2026-10-15',
  );
  const subscriptions: BookSubscription[] = picked.subscriptions.map((sub, index) => ({
    title: sub.title,
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: `2026-10-0${index < 8 ? index + 1 : 9}`,
    endDate: '',
    category: sub.category ?? '',
    comment: '#cashflow',
    frequency: sub.frequency,
  }));
  return {
    state: picked.state,
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: SET,
    subscriptions,
    transactions: cashMinor
      ? [
          {
            account: 'Daily',
            amountMinor: cashMinor,
            date: '2026-10-02',
            time: '',
            category: '',
            comment: '',
          },
        ]
      : [],
    liabilities: (picked.starterKit.liabilities ?? []).map((entry) => ({
      tag: entry.tag,
      amountMinor: entry.amountMinor,
      investment: false,
    })),
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
}

const CAR = 'Autokredit';

describe('paying a liability off', () => {
  it('lists the starting debts, never the Bank loan or a property mortgage', () => {
    const b = books(0);
    b.liabilities.push(
      { tag: 'Bank loan', amountMinor: 100000, investment: false },
      { tag: 'M-EFH', amountMinor: 4000000, investment: true },
    );
    expect(payableLiabilities(b).map((l) => l.tag)).toEqual([
      'Eigenheim-Hypothek',
      CAR,
      'Kreditkartenschulden',
    ]);
    expect(planLiabilityPayoff(b, PROFESSION, 'Bank loan', deps).ok).toBe(false);
  });

  it('with the cash at hand: one payment of the full amount, the debt and its monthly expense end', () => {
    const b = books(1_000_000);
    const before = summarizeGameFinances(b.state, b.subscriptions);
    const plan = planLiabilityPayoff(b, PROFESSION, CAR, deps);
    expect(plan).toMatchObject({ ok: true, amountMinor: 400_000, borrowMinor: 0 });
    expect(plan.freedMonthlyMinor).toBe(10_000);
    const steps = payOffLiability(b, PROFESSION, CAR, deps);
    const after = steps.reduce(applyEffectsToBooks, b);
    expect(after.liabilities.some((l) => l.tag === CAR)).toBe(false);
    expect(after.state.gameSubscriptionTitles).not.toContain(plan.expenseTitle);
    expect(after.subscriptions.some((s) => s.title === plan.expenseTitle)).toBe(false);
    const finances = summarizeGameFinances(after.state, after.subscriptions);
    expect(finances.expensesMinor).toBe(before.expensesMinor - 10_000);
    expect(finances.monthlyCashflowMinor).toBe(before.monthlyCashflowMinor + 10_000);
    expect(steps[steps.length - 1].step).toEqual({ kind: 'payoff', detail: CAR });
    // the payment itself: out of the Daily account, the whole amount
    const payment = steps[steps.length - 1].appendedTransactions[0];
    expect(payment.amountMinor).toBe(-400_000);
  });

  it('short of cash the normal Bank loan is taken first, and the plan says how much (it is allowed when the cashflow stays positive)', () => {
    const b = books(100_000);
    const plan = planLiabilityPayoff(b, PROFESSION, CAR, deps);
    expect(plan.borrowMinor).toBeGreaterThan(0);
    expect(plan.borrowMinor % SET.loanRule.incrementMinor).toBe(0);
    expect(plan.cashflowAfterMinor).toBeGreaterThanOrEqual(0);
    expect(plan.ok).toBe(true);
    const steps = payOffLiability(b, PROFESSION, CAR, deps);
    expect(steps).toHaveLength(2);
    expect(steps[0].step?.kind).toBe('loanAuto');
    const after = steps.reduce(applyEffectsToBooks, b);
    expect(after.liabilities.some((l) => l.tag === 'Bank loan')).toBe(true);
    expect(after.liabilities.some((l) => l.tag === CAR)).toBe(false);
  });

  it('is refused when the loan it needs would put the monthly cashflow below zero - nothing changes', () => {
    // almost no spare cashflow: the loan for the mortgage costs far more per month than the mortgage line saves
    const b = books(0);
    b.subscriptions = [
      ...b.subscriptions,
      {
        title: 'Heavy cost',
        account: 'Daily',
        amountMinor: -(
          summarizeGameFinances(b.state, b.subscriptions).monthlyCashflowMinor - 5_000
        ),
        startDate: '2026-10-09',
        endDate: '',
        category: '',
        comment: '#cashflow',
        frequency: 'monthly',
      },
    ];
    b.state = {
      ...b.state,
      gameSubscriptionTitles: [...b.state.gameSubscriptionTitles, 'Heavy cost'],
    };
    const plan = planLiabilityPayoff(b, PROFESSION, 'Eigenheim-Hypothek', deps);
    expect(plan.ok).toBe(false);
    expect(plan.reason).toMatch(/bankruptcy/);
    expect(() => payOffLiability(b, PROFESSION, 'Eigenheim-Hypothek', deps)).toThrow(/bankruptcy/);
  });

  it('refuses a debt that is not there', () => {
    expect(planLiabilityPayoff(books(1_000_000), PROFESSION, 'Nothing', deps).ok).toBe(false);
  });
});
