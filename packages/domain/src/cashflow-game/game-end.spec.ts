import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { CLASSIC_RAT_RACE_BOARD as board } from './board';
import { applyEffectsToBooks, type GameBooks } from './books';
import { fixedClock } from './clock';
import { pickCashflowProfession } from './engine';
import { endIfOver, finalSummary, gameOutcome } from './game-end';
import { identityText } from './game-text';
import type { Rng } from './rng';
import { playTurn, settleDecision, whyCannotRoll, type TurnDeps } from './turn';

const TODAY = '2026-10-15';
const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'placeholder')!;
const profession = set.professions[0];

const dice =
  (...faces: number[]): Rng =>
  () =>
    (faces.shift()! - 1) / 6 + 0.01;
const deps = (rng: Rng): TurnDeps => ({
  clock: fixedClock(TODAY),
  text: identityText,
  money: (minor) => `${minor / 100}E`,
  board,
  profession,
  rng,
});

function solo(): GameBooks {
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
    transactions: [],
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
}

/** The books with one more game subscription, e.g. a property's cashflow or a big new expense. */
function withSubscription(books: GameBooks, title: string, amountMinor: number): GameBooks {
  return {
    ...books,
    state: {
      ...books.state,
      gameSubscriptionTitles: [...books.state.gameSubscriptionTitles, title],
    },
    subscriptions: [
      ...books.subscriptions,
      {
        title,
        account: 'Daily',
        amountMinor,
        startDate: '2026-09-05',
        endDate: '',
        category: '',
        comment: '#cashflow',
        frequency: 'monthly',
      },
    ],
  };
}

const expensesOf = (books: GameBooks) =>
  books.subscriptions.filter((s) => s.amountMinor < 0).reduce((sum, s) => sum - s.amountMinor, 0);

describe('how a game stands', () => {
  it('a fresh game is still being played', () => {
    const { state, subscriptions } = solo();
    expect(gameOutcome(state, subscriptions)).toBe('playing');
  });

  it('passive income covering every expense is escaping the rat race', () => {
    const books = withSubscription(solo(), 'Haus Cashflow', expensesOf(solo()));
    expect(gameOutcome(books.state, books.subscriptions)).toBe('escaped');
  });

  it('one cent short of the expenses is not yet an escape', () => {
    const books = withSubscription(solo(), 'Haus Cashflow', expensesOf(solo()) - 1);
    expect(gameOutcome(books.state, books.subscriptions)).toBe('playing');
  });

  it('a negative monthly cashflow is bankruptcy', () => {
    const books = withSubscription(solo(), 'Yacht', -10_000_000);
    expect(gameOutcome(books.state, books.subscriptions)).toBe('bankrupt');
  });
});

describe('ending the game', () => {
  it('sets the over phase and the outcome, and drops an open decision', () => {
    const base = withSubscription(solo(), 'Yacht', -10_000_000);
    const state = {
      ...base.state,
      turn: {
        phase: 'decide' as const,
        count: 2,
        pending: { kind: 'deal' as const, spaceIndex: 0 },
      },
    };
    const ended = endIfOver(state, base.subscriptions);
    expect(ended.turn).toEqual({ phase: 'over', count: 2, outcome: 'bankrupt' });
  });

  it('changes nothing while the game goes on, in a companion game, or once it is over', () => {
    const books = solo();
    expect(endIfOver(books.state, books.subscriptions)).toBe(books.state);
    const bust = withSubscription(books, 'Yacht', -10_000_000);
    const companion = { ...bust.state, mode: 'companion' as const };
    expect(endIfOver(companion, bust.subscriptions)).toBe(companion);
    const over = endIfOver(bust.state, bust.subscriptions);
    expect(endIfOver(over, bust.subscriptions)).toBe(over);
  });

  it('a roll that leaves the books bankrupt ends the game, and nothing more can be rolled', () => {
    const bust = withSubscription(solo(), 'Yacht', -10_000_000);
    const result = playTurn(bust, deps(dice(1)));
    expect(result.state.turn).toMatchObject({ phase: 'over', outcome: 'bankrupt', count: 1 });
    expect(whyCannotRoll(result.state)).toMatch(/over/);
    expect(() => playTurn({ ...bust, state: result.state }, deps(dice(1)))).toThrow(/over/);
  });

  it('a roll that leaves passive income above expenses ends the game as escaped, even on a card space', () => {
    const escaped = withSubscription(solo(), 'Haus Cashflow', 10_000_000);
    const result = playTurn(escaped, deps(dice(1))); // space 0: a Deals space
    expect(result.state.turn).toMatchObject({ phase: 'over', outcome: 'escaped' });
    expect(result.state.turn?.pending).toBeUndefined();
  });

  it('settling a card decision checks the end when the books are given: a purchase can win the game', () => {
    const books = solo();
    const open = playTurn(books, deps(dice(1))).state; // Deals space: decision open
    const afterBuy = withSubscription({ ...books, state: open }, 'Haus Cashflow', 10_000_000);
    expect(settleDecision(open, 'done', books.subscriptions).state.turn?.phase).toBe('roll');
    const settled = settleDecision(afterBuy.state, 'done', afterBuy.subscriptions).state;
    expect(settled.turn).toMatchObject({ phase: 'over', outcome: 'escaped' });
  });

  it('a decision settled without the books never ends the game (the caller checks)', () => {
    const books = solo();
    const open = playTurn(books, deps(dice(1))).state;
    expect(settleDecision(open, 'done').state.turn?.phase).toBe('roll');
  });
});

describe('the closing numbers', () => {
  it('report the outcome, the rounds and turns played, the children and the money', () => {
    const books = solo();
    const first = playTurn(books, deps(dice(6))); // lands on the Payday at 5
    const after = first.effects.reduce(applyEffectsToBooks, books);
    const summary = finalSummary({ ...after, state: first.state });
    expect(summary.outcome).toBe('playing');
    expect(summary.round).toBe(2); // the opening Payday of the first roll, and the Payday it landed on
    expect(summary.turns).toBe(1);
    expect(summary.finances.salaryMinor).toBeGreaterThan(0);
    expect(Number.isInteger(summary.cashMinor)).toBe(true);
  });

  it('say how a finished game ended', () => {
    const bust = withSubscription(solo(), 'Yacht', -10_000_000);
    const result = playTurn(bust, deps(dice(1)));
    expect(finalSummary({ ...bust, state: result.state }).outcome).toBe('bankrupt');
  });
});
