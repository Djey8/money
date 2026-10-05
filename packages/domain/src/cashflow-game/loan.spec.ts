import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { fixedClock } from './clock';
import { pickCashflowProfession } from './engine';
import type { BookSubscription } from './effects';
import {
  BANK_LOAN_INTEREST_TITLE,
  BANK_LOAN_TAG,
  planAutoLoan,
  playBankLoan,
  type LoanBooks,
} from './loan';
import type { CardDeps } from './market-cards';
import { identityText } from './game-text';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

const TODAY = '2026-10-15';
const deps: CardDeps = {
  clock: fixedClock(TODAY),
  text: identityText,
  money: (minor) => `${(minor / 100).toLocaleString('en-US')} EUR`,
};
const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;
const STEP = gameSet.loanRule.incrementMinor; // 1.000

function books(extra: Partial<LoanBooks> = {}): LoanBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    gameSet.professions[0].id,
    TODAY,
  );
  const subscriptions: BookSubscription[] = picked.subscriptions.map((sub, index) => ({
    title: sub.title,
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: `2026-09-${index === 0 ? '01' : '03'}`,
    endDate: '',
    category: sub.category ?? '',
    comment: '#cashflow',
    frequency: sub.frequency,
  }));
  return {
    state: picked.state,
    subscriptions,
    transactions: [],
    liabilities: [],
    gameSet,
    ...extra,
  };
}

describe('playBankLoan: borrowing', () => {
  it('creates the Bank loan, its 10% interest subscription and the cash that actually changes hands', () => {
    const effects = playBankLoan(deepFreeze(books()), 2 * STEP, deps);

    expect(effects.liabilityUpserts).toEqual([
      { tag: BANK_LOAN_TAG, amountMinor: 2 * STEP, investment: false },
    ]);
    expect(effects.subscriptionUpserts).toHaveLength(1);
    expect(effects.subscriptionUpserts[0]).toMatchObject({
      title: BANK_LOAN_INTEREST_TITLE,
      account: 'Daily',
      amountMinor: -Math.round(0.1 * 2 * STEP),
      category: '@Bank loan',
      comment: '#cashflow',
      startDate: '2026-10-05', // the 1st and 3rd are the profession's own
    });
    expect(effects.appendedTransactions).toHaveLength(1);
    expect(effects.appendedTransactions[0]).toMatchObject({
      account: 'Daily',
      amountMinor: 2 * STEP,
      category: '@Bank loan',
      date: '2026-10-07', // after the new interest subscription took the 5th
    });
    expect(effects.state.gameSubscriptionTitles).toContain(BANK_LOAN_INTEREST_TITLE);
    expect(effects.step).toEqual({ kind: 'loanTaken', detail: '2,000 EUR' });
    expect(effects.persist).toEqual({ subscriptions: true, grow: false, balanceSheet: true });
  });

  it('borrowing more recomputes the interest from the whole new principal and keeps the date', () => {
    const b = books({ liabilities: [{ tag: BANK_LOAN_TAG, amountMinor: STEP }] });
    b.subscriptions.push({
      title: BANK_LOAN_INTEREST_TITLE,
      account: 'Daily',
      amountMinor: -Math.round(0.1 * STEP),
      startDate: '2026-09-17',
      endDate: '',
      category: '@Bank loan',
      comment: '#cashflow',
      frequency: 'monthly',
    });
    const effects = playBankLoan(b, STEP, deps);
    expect(effects.liabilityUpserts[0].amountMinor).toBe(2 * STEP);
    expect(effects.subscriptionUpserts[0]).toMatchObject({
      amountMinor: -Math.round(0.1 * 2 * STEP),
      startDate: '2026-09-17',
    });
  });

  it('books the cash on the day a dialog fixed, when one is given', () => {
    const effects = playBankLoan(books(), STEP, deps, { date: '2026-10-09' });
    expect(effects.appendedTransactions[0].date).toBe('2026-10-09');
  });
});

describe('playBankLoan: repaying', () => {
  const owing = (principal: number) =>
    books({ liabilities: [{ tag: BANK_LOAN_TAG, amountMinor: principal }] });

  it('a partial repayment lowers the loan and the interest, and costs real cash', () => {
    const effects = playBankLoan(owing(3 * STEP), -STEP, deps);
    expect(effects.liabilityUpserts[0].amountMinor).toBe(2 * STEP);
    expect(effects.subscriptionUpserts[0].amountMinor).toBe(-Math.round(0.1 * 2 * STEP));
    expect(effects.appendedTransactions[0].amountMinor).toBe(-STEP);
    expect(effects.step).toEqual({ kind: 'loanRepaid', detail: '1,000 EUR' });
  });

  it('repaying in full removes the loan and its interest, and the game stops charging it', () => {
    const effects = playBankLoan(owing(STEP), -STEP, deps);
    expect(effects.liabilityUpserts).toEqual([]);
    expect(effects.liabilityRemovals).toEqual([BANK_LOAN_TAG]);
    expect(effects.subscriptionUpserts).toEqual([]);
    expect(effects.subscriptionRemovals).toEqual([BANK_LOAN_INTEREST_TITLE]);
    expect(effects.state.gameSubscriptionTitles).not.toContain(BANK_LOAN_INTEREST_TITLE);
  });

  it('refuses to repay more than is owed', () => {
    expect(() => playBankLoan(owing(STEP), -2 * STEP, deps)).toThrow(
      'more than the outstanding loan',
    );
  });
});

describe('playBankLoan: refusals', () => {
  it('refuses a zero amount and one that is not a whole loan step', () => {
    expect(() => playBankLoan(books(), 0, deps)).toThrow('non-zero amount');
    expect(() => playBankLoan(books(), STEP + 1, deps)).toThrow('steps of');
  });

  it('refuses before a game has started', () => {
    expect(() => playBankLoan(books({ gameSet: undefined }), STEP, deps)).toThrow(
      'Pick a profession',
    );
    const b = books();
    b.state = { ...b.state, virtualDate: null };
    expect(() => playBankLoan(b, STEP, deps)).toThrow('Pick a profession');
  });
});

describe('planAutoLoan', () => {
  const plan = (costMinor: number, cashMinor: number, financedMinor = 0) =>
    planAutoLoan({ costMinor, cashMinor, financedMinor, incrementMinor: STEP });

  it('borrows nothing when cash covers the cost', () => {
    expect(plan(50000, 50000)).toEqual({ loanMinor: 0, converted: false });
    expect(plan(50000, 900000)).toEqual({ loanMinor: 0, converted: false });
  });

  it('borrows the shortfall rounded up to the loan step', () => {
    expect(plan(150000, 0)).toEqual({ loanMinor: 2 * STEP, converted: false });
    expect(plan(300000, 120000)).toEqual({ loanMinor: 2 * STEP, converted: false });
  });

  it('takes over a loan the player typed in, and says so', () => {
    expect(plan(50000, 900000, 250000)).toEqual({ loanMinor: 3 * STEP, converted: true });
  });

  it('borrows whichever is more: the typed loan or the shortfall', () => {
    expect(plan(500000, 0, 100000)).toEqual({ loanMinor: 5 * STEP, converted: true });
    expect(plan(100000, 0, 400000)).toEqual({ loanMinor: 4 * STEP, converted: true });
  });

  it('ignores a negative typed loan', () => {
    expect(plan(50000, 900000, -100)).toEqual({ loanMinor: 0, converted: false });
  });
});
