import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { applyEffectsToBooks, type GameBooks } from './books';
import { fixedClock } from './clock';
import type { DealDeps } from './deals';
import { pickCashflowProfession } from './engine';
import {
  cardExpenseComment,
  doodadAccount,
  MARKET_COST_ACCOUNT,
  payCardExpense,
  type CardExpenseInput,
} from './expenses';
import type { GameText } from './game-text';
import { initialCashflowGameState } from './types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

const TODAY = '2026-10-15';
const echo: GameText = (key, params) => (params ? `${key}${JSON.stringify(params)}` : key);
const deps: DealDeps = {
  clock: fixedClock(TODAY),
  text: echo,
  money: (minor) => `${minor / 100}E`,
  plainMoney: (minor) => `${minor / 100}P`,
};
const placeholderSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;
const STEP = placeholderSet.loanRule.incrementMinor;

function books(cashMinor: number): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    placeholderSet.professions[0].id,
    TODAY,
  );
  return {
    state: picked.state,
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: placeholderSet,
    subscriptions: picked.subscriptions.map((sub, index) => ({
      title: sub.title,
      account: sub.account,
      amountMinor: sub.amountMinor,
      startDate: `2026-09-${index === 0 ? '01' : '03'}`,
      endDate: '',
      category: sub.category ?? '',
      comment: '#cashflow',
      frequency: sub.frequency,
    })),
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
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
}

const doodad = (extra: Partial<CardExpenseInput> = {}): CardExpenseInput => ({
  kind: 'doodad',
  title: 'Gold tooth',
  flavor: 'Maybe you get a shiny gold tooth!',
  category: 'Health',
  costMinor: 150000,
  account: 'Splurge',
  ...extra,
});

describe('cardExpenseComment', () => {
  it('lists what was bought, the joke and the loan note, each after a blank line, then the tag', () => {
    expect(cardExpenseComment('doodad', { title: 'Tooth', flavor: 'Shiny.' }, '🏦 note')).toBe(
      'Tooth\n\nShiny.\n\n🏦 note\n\n#doodad',
    );
    expect(
      cardExpenseComment('marketCost', { title: 'Pipe', flavor: 'Broke at EFH.' }, '🏦 n'),
    ).toBe('Pipe\n\nBroke at EFH.\n\n🏦 n\n\n#market');
  });

  it('leaves out a block that is not there', () => {
    expect(cardExpenseComment('doodad', { title: 'Tooth' }, '🏦 note')).toBe(
      'Tooth\n\n🏦 note\n\n#doodad',
    );
    expect(cardExpenseComment('doodad', {}, '')).toBe('\n\n#doodad');
  });
});

describe('the suggested accounts', () => {
  it('a Doodad is paid from the card’s own account, or the Splurge account', () => {
    expect(doodadAccount({ account: 'Smile' })).toBe('Smile');
    expect(doodadAccount({})).toBe('Splurge');
  });

  it('a Market cost comes out of Fire', () => {
    expect(MARKET_COST_ACCOUNT).toBe('Fire');
  });
});

describe('payCardExpense', () => {
  it('with enough cash it is one step: the expense, tagged and named after its category', () => {
    const steps = payCardExpense(deepFreeze(books(1000000)), doodad(), deps);

    expect(steps).toHaveLength(1);
    expect(steps[0].step).toEqual({ kind: 'doodad', detail: 'Health' });
    expect(steps[0].appendedTransactions).toEqual([
      {
        account: 'Splurge',
        amountMinor: -150000,
        date: '2026-10-05', // 1st and 3rd are the profession's, the 2nd holds the funding
        time: '',
        category: '@Health',
        comment: expect.stringContaining('#doodad'),
      },
    ]);
    expect(steps[0].appendedTransactions[0].comment).toContain('Gold tooth');
    expect(steps[0].appendedTransactions[0].comment).toContain('CashflowGame.noteCashDoodad');
  });

  it('short of cash it borrows first - two steps, the loan rounded up, then the expense after it', () => {
    const steps = payCardExpense(books(50000), doodad({ costMinor: 250000 }), deps);

    expect(steps).toHaveLength(2);
    expect(steps[0].step).toEqual({ kind: 'loanAuto', detail: `${(2 * STEP) / 100}E` }); // short 2.000, already a whole step
    expect(steps[0].liabilityUpserts[0].amountMinor).toBe(
      steps[0].appendedTransactions[0].amountMinor,
    );
    expect(steps[1].step).toEqual({ kind: 'doodad', detail: 'Health' });
    const loanDate = steps[0].appendedTransactions[0].date;
    const payDate = steps[1].appendedTransactions[0].date;
    expect(payDate > loanDate).toBe(true);
  });

  it('the loan is booked on the first free day, before the loan’s own interest subscription takes one', () => {
    const steps = payCardExpense(books(0), doodad({ costMinor: STEP }), deps);
    expect(steps[0].appendedTransactions[0].date).toBe('2026-10-05');
    // the loan and its interest subscription both took the 5th, so the expense lands on the next free day
    expect(steps[1].appendedTransactions[0].date).toBe('2026-10-07');
  });

  it('a date the player chose is kept for the expense, and for the loan when given', () => {
    const steps = payCardExpense(
      books(0),
      doodad({ costMinor: STEP, date: '2026-10-20', loanDate: '2026-10-19' }),
      deps,
    );
    expect(steps[0].appendedTransactions[0].date).toBe('2026-10-19');
    expect(steps[1].appendedTransactions[0].date).toBe('2026-10-20');
  });

  it('the steps apply cleanly in order and leave the loan in the books before the expense', () => {
    const b = books(0);
    const steps = payCardExpense(b, doodad({ costMinor: STEP }), deps);
    const after = steps.reduce((acc, effects) => applyEffectsToBooks(acc, effects), b);
    expect(after.liabilities).toContainEqual({
      tag: 'Bank loan',
      amountMinor: STEP,
      investment: false,
    });
    expect(after.transactions.map((t) => t.category)).toEqual(['@Bank loan', '@Health']);
  });

  it('a Market cost is a marketCost step carrying the market tag', () => {
    const steps = payCardExpense(
      books(1000000),
      {
        kind: 'marketCost',
        title: 'Broken pipe',
        flavor: 'The pipe at EFH broke.',
        category: 'EFH',
        costMinor: 100000,
        account: MARKET_COST_ACCOUNT,
      },
      deps,
    );
    expect(steps[0].step).toEqual({ kind: 'marketCost', detail: 'EFH' });
    expect(steps[0].appendedTransactions[0]).toMatchObject({ account: 'Fire', category: '@EFH' });
    expect(steps[0].appendedTransactions[0].comment.endsWith('#market')).toBe(true);
  });

  it('refuses before a game has started and for a cost that is not above zero - and then changes nothing', () => {
    const noGame = books(1000000);
    noGame.state = initialCashflowGameState();
    expect(() => payCardExpense(noGame, doodad(), deps)).toThrow('Pick a profession');
    expect(() => payCardExpense(books(1000000), doodad({ costMinor: 0 }), deps)).toThrow(
      'what this costs',
    );
  });
});
