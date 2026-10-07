import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { CLASSIC_RAT_RACE_BOARD as board } from './board';
import { applyEffectsToBooks, type GameBooks } from './books';
import { cashOnHandMinor } from './cash';
import { fixedClock } from './clock';
import { pickCashflowProfession } from './engine';
import { identityText } from './game-text';
import type { Rng } from './rng';
import { payWithAutoLoan, playCharityPaying, playDownsizedPaying } from './auto-pay';
import { playTurn, type TurnDeps } from './turn';
import { playDownsized } from './rounds';

const TODAY = '2026-10-15';
const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'placeholder')!;
const profession = set.professions[0];
const STEP = set.loanRule.incrementMinor;

const deps = {
  clock: fixedClock(TODAY),
  text: identityText,
  money: (minor: number) => `${minor / 100}E`,
};

/** A started solo game with `cashMinor` on the account (the income account is shared out, so cash is exactly that). */
function books(cashMinor: number): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    profession.id,
    TODAY,
    'solo',
  );
  return {
    state: picked.state,
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: set,
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
            account: 'Income',
            amountMinor: cashMinor,
            date: '2026-10-01',
            time: '',
            category: '@Savings',
            comment: '#cashflow',
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

const cash = (b: GameBooks) => cashOnHandMinor(b.transactions, b.allocation);
const apply = (b: GameBooks, effects: ReturnType<typeof playDownsizedPaying>['effects']) =>
  effects.reduce(applyEffectsToBooks, b);
const expensesMinor = (b: GameBooks) =>
  b.subscriptions.filter((s) => s.amountMinor < 0).reduce((sum, s) => sum - s.amountMinor, 0);

describe('Downsized with too little cash', () => {
  it('takes the bank loan first, in the loan step, then pays - the balance never goes negative', () => {
    const start = books(0);
    expect(expensesMinor(start)).toBeGreaterThan(0);
    const paid = playDownsizedPaying(start, deps);

    expect(paid.effects).toHaveLength(2);
    expect(paid.effects[0].step?.kind).toBe('loanAuto');
    expect(paid.effects[1].step?.kind).toBe('downsized');
    expect(paid.loansMinor).toHaveLength(1);
    expect(paid.loansMinor[0] % STEP).toBe(0);
    expect(paid.loansMinor[0]).toBeGreaterThanOrEqual(expensesMinor(start));

    const after = apply(start, paid.effects);
    expect(cash(after)).toBeGreaterThanOrEqual(0);
    expect(after.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor).toBe(
      paid.loansMinor[0],
    );
    // the sitting-out reminder is still set by the payment
    expect(after.state.unemployedRoundsLeft).toBe(2);
  });

  it('borrows only what is short: some cash on hand shrinks the loan', () => {
    const none = playDownsizedPaying(books(0), deps).loansMinor[0];
    const some = playDownsizedPaying(books(none / 2), deps).loansMinor;
    expect(some.length === 0 || some[0] < none).toBe(true);
  });

  it('takes no loan when cash covers it', () => {
    const start = books(10_000_000);
    const paid = playDownsizedPaying(start, deps);
    expect(paid.effects).toHaveLength(1);
    expect(paid.loansMinor).toEqual([]);
    expect(paid.effects[0].step?.kind).toBe('downsized');
    expect(cash(apply(start, paid.effects))).toBeGreaterThanOrEqual(0);
  });

  it('covers the interest the loan itself adds to "every expense": still never negative, whatever the cash', () => {
    for (const cashMinor of [0, 1, 1000, 90_000, 179_999, 180_000, 181_000, 199_999, 250_000]) {
      const start = books(cashMinor);
      const after = apply(start, playDownsizedPaying(start, deps).effects);
      expect(cash(after)).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not change the books it was given', () => {
    const start = books(0);
    const before = JSON.stringify(start);
    playDownsizedPaying(start, deps);
    expect(JSON.stringify(start)).toBe(before);
  });

  it('refuses a loan when no game has started', () => {
    expect(() => playDownsizedPaying({ ...books(0), gameSet: undefined }, deps)).toThrow(
      /Pick a profession/,
    );
  });
});

describe('Charity with too little cash', () => {
  it('takes the bank loan first when the 10 % donation is not covered, and not otherwise', () => {
    const rich = playCharityPaying(books(10_000_000), deps);
    expect(rich.loansMinor).toEqual([]);
    expect(rich.effects).toHaveLength(1);

    const poor = playCharityPaying(books(0), deps);
    expect(poor.loansMinor).toHaveLength(1);
    expect(poor.effects.map((e) => e.step?.kind)).toEqual(['loanAuto', 'charity']);
    expect(cash(apply(books(0), poor.effects))).toBeGreaterThanOrEqual(0);
  });
});

describe('the general rule', () => {
  it('pays for any payment rule the same way', () => {
    const paid = payWithAutoLoan(books(0), (round) => playDownsized(round, deps), deps);
    expect(paid.effects).toHaveLength(2);
  });
});

describe('a solo roll that lands on Downsized with an empty account', () => {
  const dice =
    (...faces: number[]): Rng =>
    () =>
      (faces.shift()! - 1) / 6 + 0.01;
  const turnDeps = (rng: Rng): TurnDeps => ({ ...deps, board, profession, rng });

  it('borrows first inside the same roll and ends with a balance that is not negative', () => {
    // from space 10 a roll of 1 enters space 11: Downsized. The turn has been played before (count 3): no opening Payday.
    const at10 = books(0);
    at10.state = { ...at10.state, boardPosition: 10, turn: { phase: 'roll', count: 3 } };
    const result = playTurn(at10, turnDeps(dice(1)));
    const after = result.effects.reduce(applyEffectsToBooks, at10);

    expect(result.step.kind).toBe('roll'); // still one step for the player, loan included
    expect(result.autoLoansMinor).toHaveLength(1);
    expect(cash(after)).toBeGreaterThanOrEqual(0);
    expect(after.liabilities.some((l) => l.tag === 'Bank loan')).toBe(true);
    expect(after.state.unemployedRoundsLeft).toBe(2);
  });

  it('reports no loan when the account could pay', () => {
    const rich = books(10_000_000);
    rich.state = { ...rich.state, boardPosition: 10, turn: { phase: 'roll', count: 3 } };
    expect(playTurn(rich, turnDeps(dice(1))).autoLoansMinor).toEqual([]);
  });
});
