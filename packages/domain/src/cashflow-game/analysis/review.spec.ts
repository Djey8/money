import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { buyDealAction, type ActionDeps } from '../actions';
import { cardSeenBeforePass } from '../history';
import { settleDecision } from '../turn';
import { applyEffectsToBooks, type GameBooks } from '../books';
import { fixedClock } from '../clock';
import { identityText } from '../game-text';
import { seededRng } from '../rng';
import { PRESET_POLICIES } from '../simulation/strategies';
import { SimGame } from '../simulation/session';
import { booksFromSnapshot } from './books-from-snapshot';
import { labelMove, reviewGame } from './review';
import { snapshotFromBooks } from './snapshot-from-books';

const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'cashflow')!;
const policy = PRESET_POLICIES.find((candidate) => candidate.id === 'all-rounder')!;

const deps: ActionDeps = {
  clock: fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
  text: identityText,
  money: (minor) => `${minor / 100}`,
  plainMoney: (minor) => `${minor / 100}`,
  cards: {
    textFor: () => ({}),
    symbolFor: (symbol) => symbol,
    sharedText: () => '',
    groupName: (group) => group,
  },
  rng: seededRng(1),
};

/** A game a few rolls in, with cash enough to buy a property. */
function midGame(): GameBooks {
  const game = new SimGame({
    gameSets: CASHFLOW_GAME_SETS,
    gameSetId: 'cashflow',
    professionId: 'lehrer',
    policy: PRESET_POLICIES.find((candidate) => candidate.id === 'never-buy')!,
    seed: 5,
  });
  for (let turn = 0; turn < 6; turn += 1) game.playTurn();
  return {
    ...game.books,
    transactions: [
      ...game.books.transactions,
      {
        account: 'Daily',
        amountMinor: 3000000,
        date: '2026-10-02',
        time: '',
        category: '',
        comment: '',
      },
    ],
  };
}

describe('booksFromSnapshot', () => {
  it('turns the app snapshot back into the same books', () => {
    const books = midGame();
    const again = booksFromSnapshot(snapshotFromBooks(books), { gameSet: set });
    expect(again.transactions).toEqual(books.transactions);
    expect(again.subscriptions).toEqual(books.subscriptions);
    expect(again.liabilities).toEqual(books.liabilities);
    expect(again.state).toEqual(books.state);
  });
});

describe('labelMove', () => {
  it('names a move by the chance it won or lost, and breaks a tie by the time it saved', () => {
    expect(labelMove(0.2, null)).toBe('best');
    expect(labelMove(0.02, null)).toBe('good');
    expect(labelMove(0, null)).toBe('neutral');
    expect(labelMove(0, 15)).toBe('good');
    expect(labelMove(0, -15)).toBe('inaccuracy');
    expect(labelMove(-0.03, null)).toBe('inaccuracy');
    expect(labelMove(-0.08, null)).toBe('mistake');
    expect(labelMove(-0.3, null)).toBe('blunder');
  });

  it('judges by the rolls saved when both alternatives nearly always escape (a high salary)', () => {
    expect(labelMove(0, 20, true)).toBe('best');
    expect(labelMove(0, 9, true)).toBe('good');
    expect(labelMove(0, 2, true)).toBe('neutral');
    expect(labelMove(0, -6, true)).toBe('inaccuracy');
    expect(labelMove(0, -12, true)).toBe('mistake');
    expect(labelMove(0, -25, true)).toBe('blunder');
    expect(labelMove(0, null, true)).toBe('neutral');
  });
});

describe('reviewGame', () => {
  it('judges a purchase against not buying it, with the dice the same for both', () => {
    const before = midGame();
    const cards = set.decks!.dealSmall!.filter((card) => card.assetKind === 'investment');
    const card = cards.find((candidate) => (candidate.cashflowMinor ?? 0) > 0)!;
    const plan = buyDealAction(before, { cardId: card.id }, deps);
    const after = plan.effects.reduce(applyEffectsToBooks, before);

    const review = reviewGame(
      [
        {
          ...snapshotFromBooks(before),
          step: { kind: 'buyDeal', detail: plan.result!['title'] as string },
        },
      ],
      snapshotFromBooks(after),
      { gameSets: CASHFLOW_GAME_SETS, policy, rollouts: 30, horizon: 250 },
    );

    expect(review.judged).toBe(1);
    const [move] = review.moves;
    expect(move.kind).toBe('purchase');
    expect(move.alternative).toBe('not buying it');
    expect(move.escapeChance.taken).toBeGreaterThan(move.escapeChance.other - 0.5);
    expect(move.escapeChance.delta).toBeCloseTo(
      move.escapeChance.taken - move.escapeChance.other,
      10,
    );
    expect(move.facts.passiveIncomeAfterMinor).toBeGreaterThan(0);
    expect(['best', 'good', 'neutral', 'inaccuracy', 'mistake', 'blunder']).toContain(move.label);
    expect(review.final.outcome).toBe('playing');
    // the same review twice is the same review: the dice are seeded
    const again = reviewGame(
      [
        {
          ...snapshotFromBooks(before),
          step: { kind: 'buyDeal', detail: plan.result!['title'] as string },
        },
      ],
      snapshotFromBooks(after),
      { gameSets: CASHFLOW_GAME_SETS, policy, rollouts: 30, horizon: 250 },
    );
    expect(again.moves).toEqual(review.moves);
  });

  it('skips steps that are not decisions, and stops at its time budget', () => {
    const before = midGame();
    const stack = [
      { ...snapshotFromBooks(before), step: { kind: 'payday' as const, detail: 'Round 3' } },
      { ...snapshotFromBooks(before), step: { kind: 'roll' as const, detail: '4' } },
    ];
    const review = reviewGame(stack, snapshotFromBooks(before), {
      gameSets: CASHFLOW_GAME_SETS,
      policy,
      rollouts: 5,
    });
    expect(review.moves).toEqual([]);
    expect(review.steps).toBe(2);
    expect(review.turningPoint).toBeNull();
  });

  it('judges a card that was drawn and then left against buying it', () => {
    const start = midGame();
    const card = set
      .decks!.dealSmall!.filter((candidate) => candidate.assetKind === 'investment')
      .find((candidate) => (candidate.cashflowMinor ?? 0) > 0)!;
    // landed on a Deal space, drew the card (no step of its own: only the deck remembers it), then passed
    const onSpace: GameBooks = {
      ...start,
      state: {
        ...start.state,
        drawnCardIds: { ...start.state.drawnCardIds, dealSmall: [card.id] },
        turn: {
          phase: 'decide',
          count: 7,
          lastRoll: [4],
          pending: { kind: 'deal', spaceIndex: 4 },
        },
      },
    };
    const passed: GameBooks = {
      ...onSpace,
      state: settleDecision(onSpace.state, 'passed', onSpace.subscriptions).state,
    };
    const stack = [
      { ...snapshotFromBooks(start), step: { kind: 'roll' as const, detail: '4' } },
      { ...snapshotFromBooks(onSpace), step: { kind: 'skipCard' as const, detail: 'deal' } },
    ];

    expect(cardSeenBeforePass(stack, 1)).toEqual({ deck: 'dealSmall', cardId: card.id });
    expect(cardSeenBeforePass(stack, 0)).toBeNull();

    const review = reviewGame(stack, snapshotFromBooks(passed), {
      gameSets: CASHFLOW_GAME_SETS,
      policy,
      rollouts: 20,
      horizon: 250,
    });
    expect(review.judged).toBe(1);
    expect(review.moves[0]).toMatchObject({ kind: 'passed-card', alternative: 'buying it' });

    // a game that logged the pick itself (cardPicked) names the card without the decks' memory
    const picked = [
      stack[0],
      {
        ...snapshotFromBooks({
          ...onSpace,
          state: { ...onSpace.state, drawnCardIds: start.state.drawnCardIds },
        }),
        step: {
          kind: 'cardPicked' as const,
          detail: card.title,
          cardId: card.id,
          deck: 'dealSmall' as const,
        },
      },
      { ...snapshotFromBooks(onSpace), step: { kind: 'skipCard' as const, detail: 'deal' } },
    ];
    expect(cardSeenBeforePass(picked, 2)).toEqual({ deck: 'dealSmall', cardId: card.id });

    // a pass with no card drawn first has nothing to judge
    const unseen = [
      stack[0],
      {
        ...snapshotFromBooks({
          ...onSpace,
          state: { ...onSpace.state, drawnCardIds: start.state.drawnCardIds },
        }),
        step: { kind: 'skipCard' as const, detail: 'deal' },
      },
    ];
    expect(cardSeenBeforePass(unseen, 1)).toBeNull();
  });

  it('says so when the time runs out, and shares the time between the decisions', () => {
    const before = midGame();
    const cards = set.decks!.dealSmall!.filter((card) => card.assetKind === 'investment');
    const card = cards.find((candidate) => (candidate.cashflowMinor ?? 0) > 0)!;
    const plan = buyDealAction(before, { cardId: card.id }, deps);
    const after = plan.effects.reduce(applyEffectsToBooks, before);
    const purchase = {
      ...snapshotFromBooks(before),
      step: { kind: 'buyDeal' as const, detail: plan.result!['title'] as string },
    };
    const stack = [purchase, purchase, purchase, purchase];

    // no budget: everything is judged and nothing is missing
    const all = reviewGame(stack, snapshotFromBooks(after), {
      gameSets: CASHFLOW_GAME_SETS,
      policy,
      rollouts: 20,
      horizon: 250,
    });
    expect(all.judged).toBe(4);
    expect(all.truncated).toBe(false);
    expect(all.unjudged).toBe(0);

    // a budget too short for all of them: the review says it is incomplete, and how much is missing
    const tight = reviewGame(stack, snapshotFromBooks(after), {
      gameSets: CASHFLOW_GAME_SETS,
      policy,
      rollouts: 400,
      horizon: 250,
      timeBudgetMs: 1,
    });
    expect(tight.judged + tight.unjudged).toBe(4);
    expect(tight.truncated).toBe(tight.unjudged > 0);
    expect(tight.unjudged).toBeGreaterThan(0);
  });
});

describe('describeReview', () => {
  it('puts the game, the turning point and the benchmark into words', async () => {
    const { describeReview, placeInSpread } = await import('./render');
    const move = {
      number: 12,
      round: 7,
      kind: 'purchase' as const,
      title: 'EFH',
      label: 'blunder' as const,
      escapeChance: { taken: 0.3, other: 0.55, delta: -0.25 },
      rollsToEscape: { taken: 120, other: 90 },
      alternative: 'not buying it',
      facts: {
        title: 'EFH',
        depositMinor: 500000,
        cashflowMinor: 20000,
        returnPerMonth: 0.04,
        cashAfterMinor: 0,
        bankLoanAfterMinor: 200000,
        monthlyCashflowAfterMinor: -5000,
        passiveIncomeAfterMinor: 20000,
      },
    };
    const text = describeReview(
      {
        moves: [move],
        turningPoint: move,
        bestMove: null,
        counts: { best: 0, good: 0, neutral: 0, inaccuracy: 0, mistake: 0, blunder: 1 },
        final: {
          outcome: 'bankrupt',
          round: 31,
          rolls: 58,
          passiveIncomeMinor: 20000,
          expensesMinor: 300000,
          monthlyCashflowMinor: -5000,
          cashMinor: 1000,
          children: 2,
        },
        steps: 80,
        judged: 1,
        truncated: false,
        unjudged: 0,
        rolloutsUsed: { min: 100, max: 100 },
        skipped: 0,
        rollouts: 100,
      },
      {
        money: (minor) => `${minor / 100}`,
        benchmark: {
          professionTitle: 'Teacher',
          strategyLabel: 'All-rounder',
          escapeRate: 0.8,
          rolls: { p10: 50, median: 80, p90: 130 },
          games: 300,
          placement: null,
        },
      },
    );
    expect(text).toContain('went bankrupt after 58 rolls');
    expect(text).toContain('Where the game turned');
    expect(text).toContain('a blunder');
    expect(text).toContain('55%');
    expect(text).toContain('Against the strategy lab');
    expect(placeInSpread(80, { p10: 50, median: 80, p90: 130 })).toBeCloseTo(0.5, 5);
    expect(placeInSpread(40, { p10: 50, median: 80, p90: 130 })).toBeLessThan(0.1);
    expect(placeInSpread(200, { p10: 50, median: 80, p90: 130 })).toBeGreaterThan(0.9);
  });
});
