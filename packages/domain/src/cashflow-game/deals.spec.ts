import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { applyEffectsToBooks, type BookGrowProject, type GameBooks } from './books';
import { fixedClock } from './clock';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { identityText, type GameText } from './game-text';
import {
  dealInputFromCard,
  doodadLoanNote,
  executeDeal,
  LIABILITY_EXPENSE_KEYS,
  LOAN_NOTE_MARK,
  nextInvestmentLabel,
  planDeal,
  plannedDeals,
  registerInvestmentIncome,
  removeExpenseForPaidLiability,
  sellCardToFriend,
  setPhaseAfterTrade,
  syncPlanNote,
  takenDealLabels,
  type DealDeps,
  type DealInput,
} from './deals';
import { initialCashflowGameState, type CashflowDealCard } from './types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

const TODAY = '2026-10-15';
const NOW = '2026-10-15T09:00:00.000Z';
const echo: GameText = (key, params) => (params ? `${key}${JSON.stringify(params)}` : key);
const deps: DealDeps = {
  clock: fixedClock(TODAY, NOW),
  text: echo,
  money: (minor) => `${minor / 100}E`,
  plainMoney: (minor) => `${minor / 100}P`,
};

const placeholderSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;
const STEP = placeholderSet.loanRule.incrementMinor; // 1.000

/** A started game with `cashMinor` on the Daily account (so cash on hand is exactly that). */
function books(cashMinor = 0, extra: Partial<GameBooks> = {}): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    placeholderSet.professions[0].id,
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
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: placeholderSet,
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
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
    ...extra,
  };
}

const project = (extra: Partial<BookGrowProject> = {}): BookGrowProject => ({
  title: 'OK4U',
  sub: 'OK4U Inc.',
  phase: 'plan',
  status: 'planned',
  description: '',
  strategy: '',
  notes: [],
  cashflowMinor: 0,
  amountMinor: 0,
  isAsset: false,
  share: { tag: 'OK4U', quantity: 250, priceMinor: 1000 },
  investment: null,
  loan: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

const propertyProject = (extra: Partial<BookGrowProject> = {}): BookGrowProject =>
  project({
    title: 'EFH',
    sub: '',
    share: null,
    investment: { tag: 'EFH', depositMinor: 300000, amountMinor: 4700000 },
    amountMinor: 300000,
    cashflowMinor: 25000,
    ...extra,
  });

const shareInput = (extra: Partial<DealInput> = {}): DealInput =>
  ({
    kind: 'share',
    title: 'OK4U',
    subtitle: 'OK4U Inc.',
    quantity: 250,
    priceMinor: 1000,
    description: 'A stock.',
    strategy: 'Trades 5-30',
    note: 'Careful.',
    ...extra,
  }) as DealInput;

describe('planDeal', () => {
  it('a stock card becomes a planned Grow project with its text, range and a bank-loan note', () => {
    const effects = planDeal(deepFreeze(books(100000)), shareInput(), deps);

    const [update] = effects.growUpdates;
    expect(update).toMatchObject({
      title: 'OK4U',
      create: true,
      createdAt: NOW,
      status: 'planned',
      phase: 'plan',
      sub: 'OK4U Inc.',
      description: 'A stock.',
      strategy: 'Trades 5-30',
      share: { tag: 'OK4U', quantity: 250, priceMinor: 1000 },
    });
    expect(update.notes![0]).toEqual({ text: 'Careful.', createdAt: NOW });
    expect(update.notes![1].text.startsWith(LOAN_NOTE_MARK)).toBe(true);
    expect(update.notes![1].text).toContain('CashflowGame.noteLoanShare');
    expect(effects.step).toEqual({ kind: 'planDeal', detail: 'OK4U' });
    expect(effects.persist.grow).toBe(true);
    expect(effects.appendedTransactions).toEqual([]); // no money moves
  });

  it('puts the loan the buy would need into the project’s Loan field, and the rest into the deposit', () => {
    // cost 2.500, cash 1.000 -> short 1.500 -> a loan of 2.000, never more than the cost
    const { growUpdates } = planDeal(books(100000), shareInput(), deps);
    expect(growUpdates[0].loan).toEqual({
      tag: 'OK4U',
      amountMinor: 2 * STEP,
      creditMinor: 0,
      investment: true,
    });
    expect(growUpdates[0].amountMinor).toBe(250 * 1000 - 2 * STEP);
  });

  it('no loan when cash covers the cost', () => {
    const { growUpdates } = planDeal(books(1000000), shareInput(), deps);
    expect(growUpdates[0].loan).toBeNull();
    expect(growUpdates[0].amountMinor).toBe(250000);
  });

  it('the same stock again moves the price and notes it - without touching the holding or the text already there', () => {
    const b = books(1000000, {
      shares: [{ tag: 'OK4U', quantity: 100, priceMinor: 500 }],
      growProjects: [
        project({ description: 'mine', sub: 'Mine', notes: [{ text: 'old', createdAt: 'a' }] }),
      ],
    });
    const effects = planDeal(
      deepFreeze(b),
      shareInput({ priceMinor: 700 } as Partial<DealInput>),
      deps,
    );
    const [update] = effects.growUpdates;
    expect(update.create).toBe(false);
    expect(update.share).toEqual({ tag: 'OK4U', quantity: 250, priceMinor: 700 });
    expect(update.description).toBeUndefined(); // the project already has its own
    expect(update.sub).toBeUndefined();
    expect(update.notes![0]).toEqual({ text: 'old', createdAt: 'a' });
    expect(update.notes![1].text).toBe('CashflowGame.cardDrawnAgain{"price":7}');
    expect(effects.shareUpserts).toEqual([]); // the position is not touched by a plan
  });

  it('a property plan keeps the whole Anzahlung as the deposit and its cashflow, with no project loan', () => {
    const effects = planDeal(
      books(0),
      {
        kind: 'investment',
        title: 'EFH',
        depositMinor: 300000,
        mortgageMinor: 4700000,
        cashflowMinor: 25000,
        description: 'House',
      },
      deps,
    );
    expect(effects.growUpdates[0]).toMatchObject({
      amountMinor: 300000,
      cashflowMinor: 25000,
      investment: { tag: 'EFH', depositMinor: 300000, amountMinor: 4700000 },
      description: 'House',
      loan: null,
    });
    expect(effects.growUpdates[0].notes!.some((n) => n.text.includes('noteCashInvestment'))).toBe(
      true,
    );
  });

  it('a special asset is an asset project with a coins note and a deal waiting in the game state', () => {
    const b = books(0);
    b.state = {
      ...b.state,
      assetDeals: [{ title: 'GOLD', coins: 1, costMinor: 1, stage: 'lost' }],
    };
    const effects = planDeal(
      b,
      { kind: 'asset', title: 'GOLD', costMinor: 500000, coins: 5, successOn: 4, payoutMinor: 0 },
      deps,
    );
    expect(effects.growUpdates[0]).toMatchObject({ isAsset: true, amountMinor: 500000 });
    expect(effects.growUpdates[0].notes!.some((n) => n.text.includes('assetCoinsNote'))).toBe(true);
    expect(effects.state.assetDeals).toEqual([
      { title: 'GOLD', coins: 5, costMinor: 500000, successOn: 4, stage: 'planned' },
    ]); // replaced, not stacked
  });

  it('refuses before a profession is picked, and a title that already exists as another kind', () => {
    const noGame = books();
    noGame.state = initialCashflowGameState();
    expect(() => planDeal(noGame, shareInput(), deps)).toThrow('Pick a profession');

    const property = books(0, { growProjects: [propertyProject({ title: 'OK4U' })] });
    expect(() => planDeal(property, shareInput(), deps)).toThrow('different kind of Grow project');
    const share = books(0, { growProjects: [project({ title: 'EFH' })] });
    expect(() =>
      planDeal(
        share,
        { kind: 'investment', title: 'EFH', depositMinor: 1, mortgageMinor: 1, cashflowMinor: 1 },
        deps,
      ),
    ).toThrow('different kind of Grow project');
  });
});

describe('syncPlanNote', () => {
  it('keeps one 🏦 note, updating it in place as the quantity changes', () => {
    const b = books(100000);
    const planned = project({
      notes: [
        { text: 'mine', createdAt: 'a' },
        { text: `${LOAN_NOTE_MARK}old`, createdAt: 'b' },
      ],
    });
    const update = syncPlanNote(deepFreeze(b), deepFreeze(planned), deps)!;
    expect(update.notes).toHaveLength(2);
    expect(update.notes![1].createdAt).toBe('b');
    expect(update.notes![1].text).not.toContain('old');
  });

  it('asks only for the cash while the share count is still open', () => {
    const update = syncPlanNote(
      books(5000),
      project({ share: { tag: 'OK4U', quantity: 0, priceMinor: 1000 } }),
      deps,
    )!;
    expect(update.notes![0].text).toContain('noteCashShare');
    expect(update.amountMinor).toBe(0);
    expect(update.loan).toBeNull();
  });

  it('never lends more than the cost, even though the bank lends in whole steps', () => {
    // cost 500, cash 0 -> the step is 1.000, but the project loan is capped at the cost
    const update = syncPlanNote(
      books(0),
      project({ share: { tag: 'OK4U', quantity: 1, priceMinor: 50000 } }),
      deps,
    )!;
    expect(update.loan).toEqual({
      tag: 'OK4U',
      amountMinor: 50000,
      creditMinor: 0,
      investment: true,
    });
    expect(update.amountMinor).toBe(0);
  });

  it('leaves a bought or sold project alone, and one with nothing to say', () => {
    expect(syncPlanNote(books(), project({ status: 'bought' }), deps)).toBeNull();
    expect(
      syncPlanNote(books(), project({ share: null, investment: null, isAsset: false }), deps),
    ).toBeNull();
  });
});

describe('executeDeal', () => {
  it('buys the planned shares on the Fire account when cash covers it: one step, real positions', () => {
    const b = books(1000000, { growProjects: [project()] });
    const { steps, kind } = executeDeal(deepFreeze(b), 'OK4U', undefined, deps);

    expect(kind).toBe('share');
    expect(steps).toHaveLength(1);
    const buy = steps[0];
    expect(buy.step).toEqual({ kind: 'buyDeal', detail: 'OK4U' });
    expect(buy.appendedTransactions).toHaveLength(1);
    expect(buy.appendedTransactions[0]).toMatchObject({
      account: 'Fire',
      amountMinor: -250000,
      category: '@OK4U',
      comment: 'Buy Share OK4U 250 x 10;',
      date: '2026-10-05', // the 1st and 3rd are the profession's, the 2nd holds the funding
    });
    expect(buy.shareUpserts).toEqual([{ tag: 'OK4U', quantity: 250, priceMinor: 1000 }]);
    expect(buy.growUpdates[0]).toMatchObject({
      title: 'OK4U',
      amountMinor: 250000,
      updatedAt: NOW,
    });
    expect(buy.persist).toEqual({ subscriptions: true, grow: true, balanceSheet: true });
  });

  it('a quantity chosen at the table overrides the planned one, and adds to what is held', () => {
    const b = books(1000000, {
      shares: [{ tag: 'OK4U', quantity: 100, priceMinor: 500 }],
      growProjects: [project({ amountMinor: 50000 })],
    });
    const { steps } = executeDeal(b, 'OK4U', 10, deps);
    expect(steps[0].shareUpserts).toEqual([{ tag: 'OK4U', quantity: 110, priceMinor: 1000 }]);
    expect(steps[0].growUpdates[0].amountMinor).toBe(50000 + 10000);
  });

  it('short of cash it borrows first - two steps, the loan then the purchase, dated one after the other', () => {
    const b = books(100000, { growProjects: [project()] }); // cost 2.500, cash 1.000
    const { steps } = executeDeal(b, 'OK4U', undefined, deps);

    expect(steps).toHaveLength(2);
    expect(steps[0].step).toEqual({ kind: 'loanAuto' });
    expect(steps[0].liabilityUpserts[0].amountMinor).toBe(2 * STEP);
    expect(steps[0].appendedTransactions[0]).toMatchObject({ amountMinor: 2 * STEP });
    expect(steps[1].step).toEqual({ kind: 'buyDeal', detail: 'OK4U' });
    // the loan's cash and its interest subscription took the earlier slots; the purchase gets the next free one
    const loanDate = steps[0].appendedTransactions[0].date;
    const buyDate = steps[1].appendedTransactions[0].date;
    expect(buyDate).not.toBe(loanDate);
    expect(buyDate > loanDate).toBe(true);
  });

  it('a property: deposit paid, mortgage as a real liability, cashflow as a Payday subscription', () => {
    const b = books(1000000, { growProjects: [propertyProject()] });
    const { steps, kind } = executeDeal(deepFreeze(b), 'EFH', undefined, deps);
    expect(kind).toBe('investment');
    const buy = steps[0];
    expect(buy.investmentUpserts).toEqual([
      { tag: 'EFH', depositMinor: 300000, amountMinor: 4700000 },
    ]);
    expect(buy.liabilityUpserts).toEqual([
      { tag: 'M-EFH', amountMinor: 4700000, investment: true },
    ]);
    expect(buy.appendedTransactions[0]).toMatchObject({
      account: 'Fire',
      amountMinor: -300000,
      comment: 'Buy Investment EFH 3000 47000;',
    });
    expect(buy.subscriptionUpserts[0]).toMatchObject({
      title: 'EFH Cashflow',
      account: 'Income',
      amountMinor: 25000,
    });
    expect(buy.state.gameSubscriptionTitles).toContain('EFH Cashflow');
  });

  it('buying a property again adds to the position and its mortgage', () => {
    const b = books(1000000, {
      investments: [{ tag: 'EFH', depositMinor: 300000, amountMinor: 4700000 }],
      liabilities: [{ tag: 'M-EFH', amountMinor: 4700000, investment: true }],
      growProjects: [propertyProject({ amountMinor: 300000 })],
    });
    const { steps } = executeDeal(b, 'EFH', undefined, deps);
    expect(steps[0].investmentUpserts[0]).toMatchObject({
      depositMinor: 600000,
      amountMinor: 9400000,
    });
    expect(steps[0].liabilityUpserts[0].amountMinor).toBe(9400000);
  });

  it('the steps apply cleanly in order, and the loan is in the books before the purchase', () => {
    const b = books(100000, { growProjects: [project()] });
    const { steps } = executeDeal(b, 'OK4U', undefined, deps);
    const after = steps.reduce((acc, effects) => applyEffectsToBooks(acc, effects), b);
    expect(after.liabilities).toContainEqual({
      tag: 'Bank loan',
      amountMinor: 2 * STEP,
      investment: false,
    });
    expect(after.shares).toEqual([{ tag: 'OK4U', quantity: 250, priceMinor: 1000 }]);
  });

  it('a refused deal returns nothing - there is no half a deal', () => {
    const b = books(100000, { growProjects: [project()] });
    expect(() => executeDeal(b, 'NOPE', undefined, deps)).toThrow('plan it first');
    expect(() => executeDeal(b, 'OK4U', 0, deps)).toThrow('how many shares');
    expect(() => executeDeal(b, 'OK4U', 2.5, deps)).toThrow('how many shares');
    const noGame = books();
    noGame.state = initialCashflowGameState();
    expect(() => executeDeal(noGame, 'OK4U', 1, deps)).toThrow('Pick a profession');
    expect(() =>
      executeDeal(books(0, { growProjects: [project({ share: null })] }), 'OK4U', 1, deps),
    ).toThrow('not a share or a property deal');
  });
});

describe('registerInvestmentIncome', () => {
  const withProject = (cashflowMinor: number, subscriptions: BookSubscription[] = []) => ({
    state: books().state,
    subscriptions,
    growProjects: [propertyProject({ cashflowMinor })],
  });

  it('turns a property’s cashflow into a game subscription on a free day', () => {
    const effects = registerInvestmentIncome(
      withProject(25000, books().subscriptions),
      'EFH',
      deps,
    )!;
    expect(effects.subscriptionUpserts[0]).toMatchObject({
      title: 'EFH Cashflow',
      amountMinor: 25000,
      category: '@EFH',
      startDate: '2026-10-05', // the 1st and 3rd are the profession's own
    });
    expect(effects.state.gameSubscriptionTitles).toContain('EFH Cashflow');
    expect(effects.step).toBeNull();
  });

  it('running it again refreshes the amount and keeps the date and the single title', () => {
    const first = registerInvestmentIncome(withProject(25000, books().subscriptions), 'EFH', deps)!;
    const again = registerInvestmentIncome(
      {
        state: first.state,
        subscriptions: [...books().subscriptions, first.subscriptionUpserts[0]],
        growProjects: [propertyProject({ cashflowMinor: 35000 })],
      },
      'EFH',
      deps,
    )!;
    expect(again.subscriptionUpserts[0]).toMatchObject({
      amountMinor: 35000,
      startDate: first.subscriptionUpserts[0].startDate,
    });
    expect(again.state.gameSubscriptionTitles.filter((t) => t === 'EFH Cashflow')).toHaveLength(1);
  });

  it('does nothing for a project that pays nothing, or one that is not there', () => {
    expect(registerInvestmentIncome(withProject(0), 'EFH', deps)).toBeNull();
    expect(registerInvestmentIncome(withProject(100), 'GHOST', deps)).toBeNull();
  });
});

describe('setPhaseAfterTrade', () => {
  const held = {
    shares: [{ tag: 'OK4U', quantity: 5, priceMinor: 100 }],
    investments: [],
    assets: [],
  };

  it('a buy is execute; selling part of a position keeps it there', () => {
    const b = { state: books().state, growProjects: [project()], ...held };
    expect(setPhaseAfterTrade(b, 'OK4U', 'buy')!.growUpdates).toEqual([
      { title: 'OK4U', phase: 'execute' },
    ]);
    expect(setPhaseAfterTrade(b, 'OK4U', 'sell')!.growUpdates[0].phase).toBe('execute');
  });

  it('selling the last of it completes the project and takes its market offer along', () => {
    const state = {
      ...books().state,
      marketOffers: [
        { title: 'EFH', salePriceMinor: 1, cardId: 'm', label: '+10%' },
        { title: 'OTHER', salePriceMinor: 2, cardId: 'm', label: '+10%' },
      ],
    };
    const b = {
      state,
      growProjects: [propertyProject()],
      shares: [],
      investments: [],
      assets: [],
    };
    const effects = setPhaseAfterTrade(deepFreeze(b), 'EFH', 'sell')!;
    expect(effects.growUpdates[0].phase).toBe('completed');
    expect(effects.state.marketOffers!.map((o) => o.title)).toEqual(['OTHER']);
  });

  it('knows nothing of a project that is not there', () => {
    expect(
      setPhaseAfterTrade({ state: books().state, growProjects: [], ...held }, 'X', 'buy'),
    ).toBeNull();
  });
});

describe('removeExpenseForPaidLiability', () => {
  const carCard = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions.find((p) =>
    (p.starterKit.liabilities ?? []).some((l) => l.key && LIABILITY_EXPENSE_KEYS[l.key]),
  )!;
  const liability = carCard.starterKit.liabilities!.find(
    (l) => l.key && LIABILITY_EXPENSE_KEYS[l.key],
  )!;
  const expense = carCard.expenses.find((e) => e.key === LIABILITY_EXPENSE_KEYS[liability.key!])!;
  const state = {
    ...initialCashflowGameState(),
    gameSubscriptionTitles: ['Salary', expense.title, 'Bank loan interest'],
  };

  it('ends the monthly expense of a starting liability once it is paid off', () => {
    const { title, effects } = removeExpenseForPaidLiability(
      deepFreeze({ state, liabilities: [] }),
      carCard,
      liability.tag,
      identityText,
    );
    expect(title).toBe(expense.title);
    expect(effects!.subscriptionRemovals).toEqual([expense.title]);
    expect(effects!.state.gameSubscriptionTitles).toEqual(['Salary', 'Bank loan interest']);
  });

  it('does nothing while any of it is still owed', () => {
    const result = removeExpenseForPaidLiability(
      { state, liabilities: [{ tag: liability.tag, amountMinor: 1, investment: false }] },
      carCard,
      liability.tag,
      identityText,
    );
    expect(result).toEqual({ title: null, effects: null });
  });

  it('a repaid Bank loan ends its interest', () => {
    const { title, effects } = removeExpenseForPaidLiability(
      { state, liabilities: [] },
      undefined,
      'Bank loan',
      identityText,
    );
    expect(title).toBe('Bank loan interest');
    expect(effects!.subscriptionRemovals).toEqual(['Bank loan interest']);
  });

  it('finds the expense under the translated title the game was started with', () => {
    const german: GameText = (key) =>
      key === `CashflowGame.liabilityTag.${liability.key}`
        ? 'Übersetzt-Schuld'
        : key === `CashflowGame.expenseLine.${expense.key}`
          ? 'Übersetzt-Ausgabe'
          : key;
    const translatedState = { ...state, gameSubscriptionTitles: ['Salary', 'Übersetzt-Ausgabe'] };
    const result = removeExpenseForPaidLiability(
      { state: translatedState, liabilities: [] },
      carCard,
      'Übersetzt-Schuld',
      german,
    );
    expect(result.title).toBe('Übersetzt-Ausgabe');
  });

  it('a liability the player added by hand has no expense to end', () => {
    expect(
      removeExpenseForPaidLiability(
        { state, liabilities: [] },
        carCard,
        'My own debt',
        identityText,
      ),
    ).toEqual({ title: null, effects: null });
    expect(
      removeExpenseForPaidLiability(
        { state, liabilities: [] },
        undefined,
        'Car loan',
        identityText,
      ),
    ).toEqual({ title: null, effects: null });
  });
});

describe('sellCardToFriend', () => {
  const card = { title: 'OK4U Inc.', symbol: 'OK4U' };

  it('books one-time Daily income named after the card, on the next free day, as one step', () => {
    const b = books();
    const effects = sellCardToFriend(deepFreeze(b), card, 150000, undefined, deps);
    expect(effects.step).toEqual({ kind: 'cardSale', detail: 'OK4U' });
    expect(effects.appendedTransactions).toEqual([
      {
        account: 'Daily',
        amountMinor: 150000,
        date: '2026-10-05',
        time: '',
        category: '@OK4U card sale',
        comment: 'CashflowGame.cardSaleComment{"name":"OK4U"}\n#cashflow',
      },
    ]);
  });

  it('a share card cannot be sold to a friend - it belongs to whoever drew it; property and asset cards can', () => {
    const b = books();
    expect(() =>
      sellCardToFriend(b, { ...card, assetKind: 'share' }, 150000, undefined, deps),
    ).toThrow(/share card belongs to whoever drew it/);
    expect(
      sellCardToFriend(b, { ...card, assetKind: 'investment' }, 150000, undefined, deps)
        .appendedTransactions,
    ).toHaveLength(1);
    expect(
      sellCardToFriend(b, { ...card, assetKind: 'asset' }, 150000, undefined, deps)
        .appendedTransactions,
    ).toHaveLength(1);
  });

  it('uses the label when one is given, and the title for a card without a ticker', () => {
    expect(sellCardToFriend(books(), card, 1, 'EFH-II', deps).step!.detail).toBe('EFH-II');
    expect(sellCardToFriend(books(), { title: 'Gold' }, 1, undefined, deps).step!.detail).toBe(
      'Gold',
    );
  });

  it('refuses before a game starts and for a price that is not above zero', () => {
    const noGame = books();
    noGame.state = initialCashflowGameState();
    expect(() => sellCardToFriend(noGame, card, 100, undefined, deps)).toThrow('Pick a profession');
    expect(() => sellCardToFriend(books(), card, 0, undefined, deps)).toThrow(
      'price your friend pays',
    );
  });
});

describe('cards, labels and the planned list', () => {
  it('the next copy of a property is the bare label, then -II, -III, -IV', () => {
    expect(nextInvestmentLabel('EFH', new Set())).toBe('EFH');
    expect(nextInvestmentLabel('EFH', new Set(['EFH']))).toBe('EFH-II');
    expect(nextInvestmentLabel('EFH', new Set(['EFH', 'EFH-II', 'EFH-III']))).toBe('EFH-IV');
    expect(
      nextInvestmentLabel('EFH', new Set(['EFH', 'EFH-II', 'EFH-III', 'EFH-IV', 'EFH-V'])),
    ).toBe('EFH-VI');
  });

  it('every label already in use counts, wherever it is used', () => {
    const taken = takenDealLabels({
      growProjects: [project({ title: 'A' })],
      investments: [{ tag: 'B', depositMinor: 0, amountMinor: 0 }],
      assets: [{ tag: 'C', amountMinor: 0 }],
    });
    expect([...taken].sort()).toEqual(['A', 'B', 'C']);
  });

  it('a stock card keeps its ticker as the title and its name as the subtitle', () => {
    const card: CashflowDealCard = {
      id: 'd1',
      title: 'OK4U Inc.',
      assetKind: 'share',
      symbol: 'OK4U',
      priceMinor: 700,
    };
    expect(
      dealInputFromCard(card, { description: 'd', note: 'n', strategy: 's' }, new Set()),
    ).toEqual({
      kind: 'share',
      title: 'OK4U',
      subtitle: 'OK4U Inc.',
      quantity: 0,
      priceMinor: 700,
      description: 'd',
      note: 'n',
      strategy: 's',
    });
  });

  it('a property card takes the next free label, in the game’s language', () => {
    const card: CashflowDealCard = {
      id: 'd2',
      title: 'Einfamilienhaus',
      assetKind: 'investment',
      symbol: 'EFH',
      depositMinor: 300000,
      mortgageMinor: 4700000,
      cashflowMinor: 25000,
    };
    const input = dealInputFromCard(
      card,
      { symbol: 'SFH', title: 'Single-family home' },
      new Set(['SFH']),
    );
    expect(input).toMatchObject({
      kind: 'investment',
      title: 'SFH-II',
      subtitle: 'Single-family home',
      depositMinor: 300000,
      mortgageMinor: 4700000,
      cashflowMinor: 25000,
    });
  });

  it('a special-asset card carries its dice and texts, and drops a payout of zero', () => {
    const card: CashflowDealCard = {
      id: 'd3',
      title: 'Gold',
      assetKind: 'asset',
      symbol: 'GOLD',
      costMinor: 500000,
      quantity: 5,
      successOn: 4,
      payoutMinor: 0,
    };
    expect(
      dealInputFromCard(card, { success: 'win', failure: 'lose' }, new Set(['GOLD'])),
    ).toMatchObject({
      kind: 'asset',
      title: 'GOLD-II',
      costMinor: 500000,
      coins: 5,
      successOn: 4,
      payoutMinor: undefined,
      successText: 'win',
      failureText: 'lose',
    });
  });

  it('plannedDeals lists projects that no real position backs yet', () => {
    const list = plannedDeals({
      growProjects: [
        project({ title: 'A' }),
        project({ title: 'B' }),
        propertyProject({ title: 'C' }),
        propertyProject({ title: 'D' }),
        project({ title: 'E', share: null, investment: null }),
      ],
      shares: [{ tag: 'B', quantity: 1, priceMinor: 1 }],
      investments: [{ tag: 'D', depositMinor: 1, amountMinor: 1 }],
    });
    expect(list.map((p) => p.title)).toEqual(['A', 'C']);
  });
});

describe('doodadLoanNote', () => {
  it('names the cash, the cost and the loan the payment would need', () => {
    const note = doodadLoanNote(books(100000), 250000, deps);
    expect(note.startsWith(LOAN_NOTE_MARK)).toBe(true);
    expect(note).toContain('CashflowGame.noteCashDoodad');
    expect(note).toContain('"cash":"1000P"');
    expect(note).toContain('"cost":"2500P"');
    expect(note).toContain(`"loan":"${(2 * STEP) / 100}P"`);
  });
});
