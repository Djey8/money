import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { CLASSIC_RAT_RACE_BOARD as board } from './board';
import { applyEffectsToBooks, type GameBooks } from './books';
import { cashOnHandMinor } from './cash';
import { drawRandomCard } from './cards';
import { fixedClock } from './clock';
import { dealInputFromCard, executeDeal, planDeal, takenDealLabels, type DealDeps } from './deals';
import { pickCashflowProfession } from './engine';
import { finalSummary, gameOutcome, type FinalSummary } from './game-end';
import { identityText } from './game-text';
import { seededRng, type Rng } from './rng';
import { currentTurn, playTurn, settleDecision, whyCannotRoll, type TurnDeps } from './turn';

/**
 * Whole solo games from a seed, through the real rules (todo/cashflow-game-pro.md slice B5). A simple policy plays the
 * decisions; every turn the invariants must hold; the same seed must replay to the same game. The transcript doubles as
 * the shape of "an agent plays a game" for the Pro API's scripted test (D5).
 */

const TODAY = '2026-10-15';
const SET_ID = 'cashflow'; // the Classic set: real Small and Big Deal piles
const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === SET_ID)!;
const profession = set.professions[0];

type Policy = 'never-buy' | 'buy-affordable-properties';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

function startBooks(): GameBooks {
  const picked = pickCashflowProfession(CASHFLOW_GAME_SETS, SET_ID, profession.id, TODAY, 'solo');
  const startingSavings = picked.startingTransactions.map((t) => ({ ...t }));
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
    transactions: startingSavings,
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
}

export interface Played {
  books: GameBooks;
  transcript: string[];
  summary: FinalSummary;
  bought: number;
}

/** Plays up to `maxTurns` rolls, deciding every open card by the policy, stopping when the game ends. */
export function playSoloGame(seed: number, policy: Policy, maxTurns = 400): Played {
  const rng: Rng = seededRng(seed);
  const turnDeps = (): TurnDeps => ({
    clock: fixedClock(TODAY),
    text: identityText,
    money: (m) => `${m / 100}`,
    board,
    profession,
    rng,
  });
  const dealDeps: DealDeps = {
    clock: fixedClock(TODAY, `${TODAY}T09:00:00.000Z`),
    text: identityText,
    money: (m) => `${m / 100}`,
    plainMoney: (m) => `${m / 100}`,
  };
  let books = startBooks();
  const transcript: string[] = [];
  let bought = 0;
  let paydays = 0;

  for (let turn = 0; turn < maxTurns && currentTurn(books.state).phase !== 'over'; turn++) {
    deepFreeze(books); // a rule that mutates its input throws here
    const before = books;
    const result = playTurn(before, turnDeps(), {
      dice: books.state.charityRoundsLeft > 0 ? 2 : 1,
    });
    books = result.effects.reduce(applyEffectsToBooks, before);
    paydays += result.move.paydays + (result.openingPayday ? 1 : 0);
    transcript.push(`${turn + 1}: ${result.step.detail}`);

    // Invariants of every turn.
    expect(books.state).toEqual(result.state);
    expect(result.move.to).toBeGreaterThanOrEqual(0);
    expect(result.move.to).toBeLessThan(board.length);
    expect(books.state.round).toBe(paydays);
    expect(books.state.children).toBeLessThanOrEqual(3);
    expect(books.transactions.every((t) => Number.isInteger(t.amountMinor))).toBe(true);
    expect(Number.isFinite(cashOnHandMinor(books.transactions, books.allocation))).toBe(true);

    if (currentTurn(books.state).phase !== 'decide') continue;
    const pending = books.state.turn!.pending!;
    let how: 'done' | 'passed' = 'passed';
    if (policy === 'buy-affordable-properties' && pending.kind === 'deal') {
      const pile = rng() < 0.5 ? 'dealSmall' : 'dealBig';
      const drawn = drawRandomCard(set.decks![pile]!, books.state.drawnCardIds[pile], rng);
      books = {
        ...books,
        state: {
          ...books.state,
          drawnCardIds: { ...books.state.drawnCardIds, [pile]: drawn.drawnIds },
        },
      };
      how = 'done';
      const card = drawn.card;
      if (card.assetKind === 'investment') {
        const input = dealInputFromCard(card, {}, takenDealLabels(books));
        const deposit = input.kind === 'investment' ? input.depositMinor : 0;
        if (deposit <= cashOnHandMinor(books.transactions, books.allocation)) {
          books = applyEffectsToBooks(books, planDeal(books, input, dealDeps));
          for (const step of executeDeal(books, input.title, undefined, dealDeps).steps) {
            books = applyEffectsToBooks(books, step);
          }
          bought++;
          transcript.push(`${turn + 1}: bought ${input.title}`);
        }
      }
    }
    books = {
      ...books,
      state: settleDecision(books.state, how, books.subscriptions).state,
    };
    // The books and the state agree about whether the game is over.
    const phase = currentTurn(books.state).phase;
    expect(phase === 'over').toBe(gameOutcome(books.state, books.subscriptions) !== 'playing');
  }
  return { books, transcript, summary: finalSummary(books), bought };
}

const GOLDEN_SEED_4_START = [
  '1: 6 -> payday (5)',
  '2: 2 -> market (7)',
  '3: 2 -> doodad (9)',
  '4: 1 -> deal (10)',
  '5: 1 -> downsized (11)',
  '6: 6 -> doodad (17)',
];

describe('seeded solo games', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

  it.each(SEEDS)(
    'seed %i: never buying plays on without error and keeps every invariant',
    (seed) => {
      const played = playSoloGame(seed, 'never-buy', 150);
      // salary alone never leaves the rat race, and with no purchase there is nothing to lose it either
      expect(played.summary.outcome).toBe('playing');
      expect(played.summary.turns).toBe(150);
      expect(played.bought).toBe(0);
      expect(played.books.investments).toEqual([]);
    },
  );

  it.each(SEEDS)(
    'seed %i: buying affordable properties escapes the rat race, invariants intact',
    (seed) => {
      const played = playSoloGame(seed, 'buy-affordable-properties');
      // what was bought is really owned and really pays - and enough of it leaves the rat race
      expect(played.books.investments.length).toBe(played.bought);
      expect(played.bought).toBeGreaterThan(0);
      expect(played.summary.outcome).toBe('escaped');
      expect(played.summary.finances.passiveIncomeMinor).toBeGreaterThanOrEqual(
        played.summary.finances.expensesMinor,
      );
      expect(played.summary.turns).toBeLessThan(150);
      expect(currentTurn(played.books.state)).toMatchObject({ phase: 'over', outcome: 'escaped' });
    },
  );

  it('the same seed replays to the very same game', () => {
    const a = playSoloGame(42, 'buy-affordable-properties');
    const b = playSoloGame(42, 'buy-affordable-properties');
    expect(b.transcript).toEqual(a.transcript);
    expect(JSON.stringify(b.books)).toBe(JSON.stringify(a.books));
  });

  it('different seeds play different games', () => {
    expect(playSoloGame(1, 'never-buy', 40).transcript).not.toEqual(
      playSoloGame(2, 'never-buy', 40).transcript,
    );
  });

  it('a finished game is over for good: nothing more can be rolled', () => {
    const { books } = playSoloGame(3, 'buy-affordable-properties');
    expect(whyCannotRoll(books.state)).toMatch(/over/);
  });

  it('golden game: seed 4 buying properties - what an agent’s scripted game is compared with (D5)', () => {
    const played = playSoloGame(4, 'buy-affordable-properties');
    expect(played.summary).toMatchObject({ outcome: 'escaped', turns: 52, round: 28, children: 1 });
    expect(played.transcript.slice(0, 6)).toEqual(GOLDEN_SEED_4_START);
    expect(played.transcript.filter((line) => line.includes('bought'))).toHaveLength(6);
  });
});
