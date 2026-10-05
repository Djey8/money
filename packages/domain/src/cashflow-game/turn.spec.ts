import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { CLASSIC_RAT_RACE_BOARD as board } from './board';
import { applyEffectsToBooks, type GameBooks } from './books';
import { fixedClock } from './clock';
import { pickCashflowProfession } from './engine';
import { identityText } from './game-text';
import { seededRng, type Rng } from './rng';
import {
  currentTurn,
  playTurn,
  settleDecision,
  whyCannotRoll,
  type TurnDeps,
  type TurnResult,
} from './turn';
import type { CashflowGameState } from './types';

const TODAY = '2026-10-15';
const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'placeholder')!;
const profession = set.professions[0];

/** An rng that hands out the given die faces in order (face f is (f - 1) / 6 + a hair). */
const dice =
  (...faces: number[]): Rng =>
  () =>
    (faces.shift()! - 1) / 6 + 0.01;

const deps = (rng: Rng): TurnDeps => ({
  clock: fixedClock(TODAY),
  text: identityText,
  board,
  profession,
  rng,
});

function solo(extra: Partial<CashflowGameState> = {}): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    profession.id,
    TODAY,
    'solo',
  );
  return {
    state: { ...picked.state, ...extra },
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

/** Plays a turn and applies its effects, like the caller does. */
function turn(books: GameBooks, rng: Rng, dice?: 1 | 2): { books: GameBooks; result: TurnResult } {
  const result = playTurn(books, deps(rng), { dice });
  return { books: result.effects.reduce(applyEffectsToBooks, books), result };
}

describe('a solo game starts at START with the first roll open', () => {
  it('the token is before space 0 and nothing is pending', () => {
    const { state } = solo();
    expect(state.mode).toBe('solo');
    expect(state.boardPosition).toBeNull();
    expect(currentTurn(state)).toEqual({ phase: 'roll', count: 0 });
    expect(whyCannotRoll(state)).toBeNull();
  });

  it('a companion game cannot roll', () => {
    const picked = pickCashflowProfession(CASHFLOW_GAME_SETS, 'placeholder', profession.id, TODAY);
    expect(whyCannotRoll(picked.state)).toMatch(/solo/);
    expect(picked.state.turn).toBeUndefined();
  });
});

describe('rolling', () => {
  it('the first roll of n lands on space n - 1; a Deals space leaves a decision open', () => {
    const { books, result } = turn(solo(), dice(1));
    expect(result.move.to).toBe(0);
    expect(books.state.boardPosition).toBe(0);
    expect(books.state.turn).toEqual({
      phase: 'decide',
      count: 1,
      lastRoll: [1],
      pending: { kind: 'deal', spaceIndex: 0 },
    });
    expect(result.step.kind).toBe('roll');
    expect(result.effects).toHaveLength(1);
    expect(result.effects.every((effect) => effect.step === null)).toBe(true);
  });

  it('refuses another roll until the card is dealt with or passed', () => {
    const { books } = turn(solo(), dice(1));
    expect(whyCannotRoll(books.state)).toMatch(/card/);
    expect(() => playTurn(books, deps(dice(3)))).toThrow(/card/);
  });

  it('a Doodad and a Market space are decisions too', () => {
    expect(turn(solo(), dice(2)).books.state.turn?.pending).toEqual({
      kind: 'doodad',
      spaceIndex: 1,
    });
    const atSix = solo({ boardPosition: 6, turn: { phase: 'roll', count: 3 } });
    expect(turn(atSix, dice(1)).books.state.turn?.pending).toEqual({
      kind: 'market',
      spaceIndex: 7,
    });
  });

  it('landing on a Payday pays it once, and it is not a decision', () => {
    const start = solo();
    const { books, result } = turn(start, dice(6));
    expect(result.move.landedOnPayday).toBe(true);
    expect(books.state.round).toBe(1);
    expect(books.transactions.length).toBeGreaterThan(0);
    expect(books.state.turn?.phase).toBe('roll');
    expect(books.state.turn?.pending).toBeUndefined();
  });

  it('passing a Payday pays it, then the landing space is resolved', () => {
    // from space 3 a 4 enters 4 5 6 7: passes the Payday at 5, lands on the Market at 7
    const at3 = solo({ boardPosition: 3, turn: { phase: 'roll', count: 2 } });
    const { books, result } = turn(at3, dice(4));
    expect(result.move.passedPaydays).toBe(1);
    expect(books.state.round).toBe(1);
    expect(books.state.turn?.pending).toEqual({ kind: 'market', spaceIndex: 7 });
  });

  it('landing on Baby adds a child through the existing rule', () => {
    const at16 = solo({ boardPosition: 16, turn: { phase: 'roll', count: 4 } });
    const { books } = turn(at16, dice(3)); // 17 18 19 = Baby
    expect(books.state.children).toBe(1);
    expect(books.state.turn?.phase).toBe('roll');
  });

  it('landing on Baby with three children already changes nothing, and the turn goes on', () => {
    const full = solo({ boardPosition: 16, children: 3, turn: { phase: 'roll', count: 4 } });
    const { books } = turn(full, dice(3));
    expect(books.state.children).toBe(3);
    expect(books.state.boardPosition).toBe(19);
    expect(books.state.turn?.phase).toBe('roll');
  });

  it('is one History step, whatever it did', () => {
    const at3 = solo({ boardPosition: 3, turn: { phase: 'roll', count: 2 } });
    const { result } = turn(at3, dice(4));
    expect(result.step).toEqual({ kind: 'roll', detail: '4 -> market (7)' });
  });

  it('never changes the books it was given', () => {
    const start = solo();
    const before = JSON.stringify(start);
    playTurn(start, deps(dice(6)));
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('Charity: one or two dice for the next three turns', () => {
  const charityBooks = () =>
    solo({ boardPosition: 0, charityRoundsLeft: 3, turn: { phase: 'roll', count: 1 } });

  it('landing on it donates and opens the three turns', () => {
    const at0 = solo({ boardPosition: 0, turn: { phase: 'roll', count: 1 } });
    const { books } = turn(at0, dice(3)); // 1 2 3 -> space 3 = Charity
    expect(books.state.charityRoundsLeft).toBe(3);
    expect(books.transactions.some((t) => t.category === '@Charity')).toBe(true);
  });

  it('two dice are rolled and summed only when chosen', () => {
    const { result } = turn(charityBooks(), dice(2, 3), 2);
    expect(result.roll).toEqual({ dice: [2, 3], total: 5 });
    expect(turn(charityBooks(), dice(2)).result.roll.dice).toHaveLength(1);
  });

  it('three rolls use the three turns up, and the fourth is one die whatever is asked', () => {
    let books = charityBooks();
    const counts: number[] = [];
    // keep every landing a plain space we can step past: settle any decision as done
    for (const faces of [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ]) {
      const rolled = turn(books, dice(...faces), 2);
      counts.push(rolled.result.roll.dice.length);
      books = rolled.books;
      if (books.state.turn?.phase === 'decide') {
        books = { ...books, state: settleDecision(books.state, 'done').state };
      }
    }
    expect(counts).toEqual([2, 2, 2, 1]);
    expect(books.state.charityRoundsLeft).toBe(0);
  });
});

describe('Downsized: the spanner shows until the next roll removes it', () => {
  it('landing on it pays the expenses and sets the reminder; nothing is skipped', () => {
    const at10 = solo({ boardPosition: 10, turn: { phase: 'roll', count: 3 } });
    const { books } = turn(at10, dice(1)); // 11 = Arbeitslos
    expect(books.state.unemployedRoundsLeft).toBe(2);
    expect(books.state.turn?.phase).toBe('roll'); // the next roll is open straight away
  });

  it('the next roll clears the spanner and plays normally', () => {
    const at11 = solo({
      boardPosition: 11,
      unemployedRoundsLeft: 2,
      turn: { phase: 'roll', count: 4 },
    });
    const { books, result } = turn(at11, dice(1)); // 12 = Deals
    expect(books.state.unemployedRoundsLeft).toBe(0);
    expect(result.move.to).toBe(12);
  });
});

describe('settling a card decision', () => {
  const decide = () => turn(solo(), dice(1)).books.state;

  it('done reopens the roll with no step of its own', () => {
    const settled = settleDecision(decide(), 'done');
    expect(settled.step).toBeNull();
    expect(settled.state.turn).toEqual({ phase: 'roll', count: 1, lastRoll: [1] });
    expect(whyCannotRoll(settled.state)).toBeNull();
  });

  it('passed is an undoable step of its own', () => {
    expect(settleDecision(decide(), 'passed').step).toEqual({ kind: 'skipCard', detail: 'deal' });
  });

  it('there is nothing to settle outside a decision, or in a companion game', () => {
    expect(() => settleDecision(solo().state, 'done')).toThrow(/no card/);
    const companion = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      profession.id,
      TODAY,
    );
    expect(() => settleDecision(companion.state, 'done')).toThrow(/solo/);
  });
});

describe('a whole seeded game of turns', () => {
  it('never throws, stays on the ring, pays a Payday per Payday entered, and replays from its seed', () => {
    const play = (seed: number) => {
      const rng = seededRng(seed);
      let books = solo();
      let paydays = 0;
      for (let i = 0; i < 300; i++) {
        const dice = books.state.charityRoundsLeft > 0 ? 2 : 1;
        const rolled = turn(books, rng, dice);
        paydays += rolled.result.move.paydays;
        books = rolled.books;
        expect(books.state.boardPosition).toBeGreaterThanOrEqual(0);
        expect(books.state.boardPosition).toBeLessThan(24);
        if (books.state.turn?.phase === 'decide') {
          books = { ...books, state: settleDecision(books.state, i % 2 ? 'done' : 'passed').state };
        }
      }
      return { books, paydays };
    };
    const first = play(21);
    expect(first.books.state.round).toBe(first.paydays);
    expect(first.books.state.turn?.count).toBe(300);
    expect(JSON.stringify(play(21).books)).toBe(JSON.stringify(first.books));
  });
});
