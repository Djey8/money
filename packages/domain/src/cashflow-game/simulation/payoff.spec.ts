import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import type { GameBooks } from '../books';
import type { BookSubscription } from '../effects';
import { pickCashflowProfession } from '../engine';
import { summarizeGameFinances } from '../saved-games';
import type { CashflowDealCard } from '../types';
import { debtToPayOff, PAYOFF_STYLES, withDebtPayoff } from './payoff';
import type { PolicyView } from './policy';
import { PRESET_POLICIES } from './strategies';

const SET = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;

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
    comment: '#dreamfund',
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

function viewOf(b: GameBooks): PolicyView {
  const cash = b.transactions.reduce((sum, t) => sum + t.amountMinor, 0);
  return {
    books: b,
    cashMinor: cash,
    finances: summarizeGameFinances(b.state, b.subscriptions),
    bankLoanMinor: 0,
    loanStepMinor: SET.loanRule.incrementMinor,
    loanInterestPercent: SET.loanRule.monthlyInterestPercent,
    round: 3,
    turn: 7,
    children: 0,
    charityRoundsLeft: 0,
  };
}

const cashProperties = PRESET_POLICIES.find((p) => p.id === 'cash-properties')!;
const property = {
  id: 'p',
  title: 'EFH',
  assetKind: 'investment',
  depositMinor: 500_000,
} as CashflowDealCard;

describe('the bots know a debt can be paid off', () => {
  it('a bot with the cash pays the quickest debt off - never borrowing for it, and keeping its reserve', () => {
    const style = PAYOFF_STYLES['debt-first'];
    // 5,000 on the account: the credit card (3,000 owed, 100 a month = 30 months) is quicker than the car loan (4,000 / 100)
    expect(debtToPayOff(viewOf(books(500_000)), style)).toBe('Kreditkartenschulden');
    // not enough cash for the smallest debt: nothing (it would have to borrow)
    expect(debtToPayOff(viewOf(books(200_000)), style)).toBeNull();
    // a reserve to keep: 3,000 owed + 1,000 reserve is not there with 3,500
    expect(
      debtToPayOff(viewOf(books(350_000)), { chance: 1, horizonMonths: 99, reserveMinor: 100_000 }),
    ).toBeNull();
  });

  it('a debt that takes too long to pay itself back is left, unless paying it gets the bot out of the rat race', () => {
    const slow = { chance: 1, horizonMonths: 10, reserveMinor: 0 };
    expect(debtToPayOff(viewOf(books(5_000_000)), slow)).toBeNull();
    expect(debtToPayOff(viewOf(books(5_000_000)), { ...slow, horizonMonths: 200 })).not.toBeNull();
  });

  it('the thought is added to any strategy: always for the debt-first bot, never for the others at chance 0, and its deals wait', () => {
    const rich = viewOf(books(500_000));
    const dana = withDebtPayoff(cashProperties, 'debt-first', 'master');
    expect(dana.maintain(rich)).toEqual(
      expect.arrayContaining([{ kind: 'payoff', tag: 'Kreditkartenschulden' }]),
    );
    // it buys nothing while a debt is left to pay off
    expect(dana.deal(rich, property)).toEqual({ buy: false });
    // the plain strategy has no such thought
    expect(cashProperties.maintain(rich).some((move) => move.kind === 'payoff')).toBe(false);
    // a style with no chance (a made-up level factor of 0 does not exist: a beginner keeps 20%) still never pays more than it can
    const beginner = withDebtPayoff(cashProperties, 'cash-properties', 'beginner');
    for (let round = 0; round < 20; round += 1) {
      const moves = beginner.maintain({ ...viewOf(books(100_000)), round });
      expect(moves.some((move) => move.kind === 'payoff')).toBe(false); // 1,000 cash pays nothing off
    }
  });

  it('a debt-free bot is no longer held back: its deals are the strategy own', () => {
    const b = books(500_000);
    b.liabilities = [];
    const dana = withDebtPayoff(cashProperties, 'debt-first', 'master');
    expect(dana.deal(viewOf(b), property)).toEqual(cashProperties.deal(viewOf(b), property));
  });
});
