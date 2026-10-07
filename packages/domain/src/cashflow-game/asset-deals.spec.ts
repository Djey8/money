import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import {
  afterAssetBuy,
  afterAssetSell,
  beforeAssetBuy,
  openDecisions,
  paydayRollCount,
  recurringOwned,
  resolveGamble,
  sellCoins,
} from './asset-deals';
import { applyEffectsToBooks, type BookGrowProject, type GameBooks } from './books';
import { fixedClock } from './clock';
import { pickCashflowProfession } from './engine';
import { identityText, type GameText } from './game-text';
import type { CardDeps } from './market-cards';
import type { CashflowAssetDeal } from './types';

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
const deps: CardDeps = { clock: fixedClock(TODAY, NOW), text: echo, money: (m) => `${m / 100}E` };
const placeholderSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;

const deal = (extra: Partial<CashflowAssetDeal> = {}): CashflowAssetDeal => ({
  title: 'GOLD',
  coins: 5,
  costMinor: 500000,
  stage: 'planned',
  ...extra,
});

const project = (extra: Partial<BookGrowProject> = {}): BookGrowProject => ({
  title: 'GOLD',
  sub: '',
  phase: 'plan',
  status: 'planned',
  description: '',
  strategy: '',
  notes: [{ text: 'bought', createdAt: 'a' }],
  cashflowMinor: 0,
  amountMinor: 500000,
  isAsset: true,
  share: null,
  investment: null,
  loan: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

function books(deals: CashflowAssetDeal[] = [], extra: Partial<GameBooks> = {}): GameBooks {
  const picked = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'placeholder',
    placeholderSet.professions[0].id,
    TODAY,
  );
  return {
    state: { ...picked.state, assetDeals: deals },
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
    transactions: [],
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
    ...extra,
  };
}

describe('open decisions', () => {
  const mlm = (title: string, extra: Partial<CashflowAssetDeal> = {}) =>
    deal({
      title,
      recurring: true,
      stage: 'owned',
      costMinor: 100000,
      payoutMinor: 200000,
      ...extra,
    });

  it('lists paid cards waiting for their roll, and one decision for a due Payday group', () => {
    const state = books([
      deal({ title: 'A', stage: 'awaitingRoll' }),
      deal({ title: 'B', stage: 'planned' }),
      mlm('M1', { rollDue: true }),
      mlm('M2', { rollDue: true }),
      mlm('M3'),
    ]).state;
    expect(openDecisions(state).map((d) => d.title)).toEqual(['A', 'M1']);
    expect(recurringOwned(state).map((d) => d.title)).toEqual(['M1', 'M2', 'M3']);
  });

  it('a roll covers every due card of the same kind, and a plain card counts as one', () => {
    const state = books([
      mlm('M1', { rollDue: true }),
      mlm('M2', { rollDue: true }),
      mlm('M3', { rollDue: true, costMinor: 5 }),
      mlm('M4'),
    ]).state;
    expect(paydayRollCount(state, state.assetDeals![0])).toBe(2);
    expect(paydayRollCount(state, deal())).toBe(1);
  });

  it('nothing is open without waiting or due cards', () => {
    expect(openDecisions(books().state)).toEqual([]);
  });
});

describe('beforeAssetBuy', () => {
  it('a dice card is paid for but waits for the roll before it becomes an asset', () => {
    const state = books([deal({ successOn: 4 })]).state;
    const hook = beforeAssetBuy(deepFreeze(state), 'GOLD');
    expect(hook.gamble).toBe(true);
    expect(hook.effects!.state.assetDeals![0].stage).toBe('awaitingRoll');
    expect(hook.effects!.step).toBeNull();
  });

  it('pressing Buy again on a paid card still waits for the roll', () => {
    const state = books([deal({ successOn: 4, stage: 'awaitingRoll' })]).state;
    expect(beforeAssetBuy(state, 'GOLD').gamble).toBe(true);
  });

  it('a plain offer, a kept card and an unknown title are bought as usual', () => {
    expect(beforeAssetBuy(books([deal()]).state, 'GOLD')).toEqual({ gamble: false, effects: null });
    expect(
      beforeAssetBuy(books([deal({ successOn: 4, recurring: true })]).state, 'GOLD').gamble,
    ).toBe(false);
    expect(beforeAssetBuy(books().state, 'NOPE').gamble).toBe(false);
    // an already owned card is not a purchase waiting for anything
    expect(
      beforeAssetBuy(books([deal({ successOn: 4, stage: 'owned' })]).state, 'GOLD').gamble,
    ).toBe(false);
  });
});

describe('afterAssetBuy', () => {
  it('a paid gamble waits for its roll and brings the player to the decision', () => {
    const b = books([deal({ stage: 'awaitingRoll', successOn: 4 })], { growProjects: [project()] });
    const effects = afterAssetBuy(deepFreeze(b), 'GOLD');
    expect(effects.growUpdates).toEqual([
      { title: 'GOLD', status: 'awaiting roll', phase: 'execute' },
    ]);
    expect(effects.decisionNeeded).toBe(true);
    expect(effects.state.assetDeals![0].stage).toBe('awaitingRoll');
  });

  it('a plain offer is now owned and its project is in execution', () => {
    const b = books([deal()], {
      growProjects: [project()],
      assets: [{ tag: 'GOLD', amountMinor: 500000 }],
    });
    const effects = afterAssetBuy(b, 'GOLD');
    expect(effects.state.assetDeals![0].stage).toBe('owned');
    expect(effects.growUpdates).toEqual([{ title: 'GOLD', phase: 'execute' }]);
    expect(effects.decisionNeeded).toBe(false);
  });

  it('works for a title the game has no deal for, and with no project', () => {
    const effects = afterAssetBuy(books(), 'CAR');
    expect(effects.growUpdates).toEqual([]);
    expect(effects.state.assetDeals).toEqual([]);
  });
});

describe('afterAssetSell', () => {
  it('selling the last of it sells the project out and completes it', () => {
    const b = books([deal({ stage: 'owned', rollDue: true })], { growProjects: [project()] });
    const effects = afterAssetSell(deepFreeze(b), 'GOLD');
    expect(effects.state.assetDeals![0]).toMatchObject({ stage: 'sold', rollDue: false });
    expect(effects.growUpdates).toEqual([{ title: 'GOLD', phase: 'completed', status: 'sold' }]);
  });

  it('selling part of it leaves what is left bought and in execution', () => {
    const b = books([deal({ stage: 'owned' })], {
      growProjects: [project()],
      assets: [{ tag: 'GOLD', amountMinor: 100000 }],
    });
    const effects = afterAssetSell(b, 'GOLD');
    expect(effects.state.assetDeals![0].stage).toBe('owned');
    expect(effects.growUpdates).toEqual([{ title: 'GOLD', phase: 'execute', status: 'bought' }]);
  });
});

describe('sellCoins', () => {
  const owned = (extra: Partial<GameBooks> = {}) =>
    books([deal({ stage: 'owned' })], {
      growProjects: [project({ amountMinor: 500000 })],
      assets: [{ tag: 'GOLD', amountMinor: 500000 }],
      ...extra,
    });

  it('sells some coins: the asset and the project keep the cost of what is left, with a note', () => {
    const { sold, effects } = sellCoins(deepFreeze(owned()), 'GOLD', 2, 100000, deps);
    expect(sold).toBe(true);
    expect(effects!.state.assetDeals![0]).toMatchObject({ coins: 3, stage: 'owned' });
    expect(effects!.assetUpserts).toEqual([{ tag: 'GOLD', amountMinor: 300000 }]);
    expect(effects!.growUpdates[0]).toMatchObject({ title: 'GOLD', amountMinor: 300000 });
    expect(effects!.growUpdates[0].notes![1].text).toBe(
      'CashflowGame.coinsSoldNote{"sold":2,"price":"1000E","left":3}',
    );
    expect(effects!.persist).toEqual({ subscriptions: false, grow: false, balanceSheet: false });
  });

  it('selling the last coin removes the asset and sells the deal out, leaving the project’s amount', () => {
    const { effects } = sellCoins(owned(), 'GOLD', 5, 100000, deps);
    expect(effects!.assetRemovals).toEqual(['GOLD']);
    expect(effects!.assetUpserts).toEqual([]);
    expect(effects!.state.assetDeals![0]).toMatchObject({ coins: 0, stage: 'sold' });
    expect(effects!.growUpdates[0].amountMinor).toBeUndefined();
  });

  it('selling more than is owned sells it all', () => {
    const { effects } = sellCoins(owned(), 'GOLD', 9, 100000, deps);
    expect(effects!.state.assetDeals![0].stage).toBe('sold');
  });

  it('coins can be sold in fractions', () => {
    const { effects } = sellCoins(owned(), 'GOLD', 0.5, 100000, deps);
    expect(effects!.state.assetDeals![0].coins).toBe(4.5);
    expect(effects!.assetUpserts[0].amountMinor).toBe(450000);
  });

  it('is not a coin sale for an ordinary asset, no coins or a zero quantity', () => {
    expect(sellCoins(owned(), 'CAR', 1, 100, deps)).toEqual({ sold: false, effects: null });
    expect(sellCoins(owned(), 'GOLD', 0, 100, deps)).toEqual({ sold: false, effects: null });
    expect(sellCoins(books([deal({ stage: 'planned' })]), 'GOLD', 1, 100, deps).sold).toBe(false);
  });

  it('works without a project or an asset on the books', () => {
    const { sold, effects } = sellCoins(books([deal({ stage: 'owned' })]), 'GOLD', 1, 100, deps);
    expect(sold).toBe(true);
    expect(effects!.growUpdates).toEqual([]);
    expect(effects!.assetUpserts).toEqual([]);
  });
});

describe('resolveGamble: a paid dice card', () => {
  const waiting = (extra: Partial<CashflowAssetDeal> = {}, bookExtra: Partial<GameBooks> = {}) =>
    books([deal({ stage: 'awaitingRoll', successOn: 4, ...extra })], {
      growProjects: [project({ status: 'awaiting roll', phase: 'execute' })],
      ...bookExtra,
    });

  it('a win books the coins as an Asset at what was paid', () => {
    const { effects, kind } = resolveGamble(
      deepFreeze(waiting()),
      'GOLD',
      { won: true, roll: 5 },
      deps,
    );
    expect(kind).toBe('gamble');
    expect(effects.assetUpserts).toEqual([{ tag: 'GOLD', amountMinor: 500000 }]);
    expect(effects.state.assetDeals![0].stage).toBe('owned');
    expect(effects.growUpdates[0]).toMatchObject({ status: 'bought', phase: 'execute' });
    expect(effects.growUpdates[0].notes![1].text).toBe(
      '🎲 5: CashflowGame.diceWonToast{"coins":5,"amount":"0E"}',
    );
    expect(effects.step).toEqual({ kind: 'diceWon', detail: 'GOLD · 🎲 5' });
    expect(effects.persist).toEqual({ subscriptions: false, grow: true, balanceSheet: true });
  });

  it('a win adds to coins already owned', () => {
    const { effects } = resolveGamble(
      waiting({}, { assets: [{ tag: 'GOLD', amountMinor: 200000 }] }),
      'GOLD',
      { won: true },
      deps,
    );
    expect(effects.assetUpserts).toEqual([{ tag: 'GOLD', amountMinor: 700000 }]);
    expect(effects.step).toEqual({ kind: 'diceWon', detail: 'GOLD' });
  });

  it('a loss completes the card and the money is simply gone', () => {
    const { effects } = resolveGamble(waiting(), 'GOLD', { won: false, roll: 2 }, deps);
    expect(effects.assetUpserts).toEqual([]);
    expect(effects.appendedTransactions).toEqual([]);
    expect(effects.state.assetDeals![0].stage).toBe('lost');
    expect(effects.growUpdates[0]).toMatchObject({ status: 'lost', phase: 'completed' });
    expect(effects.step!.kind).toBe('diceLost');
  });

  it('a loan to a relative that comes back is income, and nothing is owned afterwards', () => {
    const { effects } = resolveGamble(
      waiting({ payoutMinor: 1000000, coins: 0 }),
      'GOLD',
      { won: true },
      deps,
    );
    expect(effects.appendedTransactions).toEqual([
      {
        account: 'Income',
        amountMinor: 1000000,
        date: '2026-10-05',
        time: '',
        category: '@GOLD',
        comment: 'GOLD paid back\n#cashflow',
      },
    ]);
    expect(effects.assetUpserts).toEqual([]);
    expect(effects.state.assetDeals![0].stage).toBe('paidBack');
    expect(effects.growUpdates[0]).toMatchObject({ status: 'paid back', phase: 'completed' });
  });

  it('uses the card’s own success and failure text when it has one', () => {
    const win = resolveGamble(waiting({ successText: 'Jackpot!' }), 'GOLD', { won: true }, deps);
    expect(win.effects.growUpdates[0].notes![1].text).toBe('🎲 Jackpot!');
    const lose = resolveGamble(
      waiting({ failureText: 'Fool’s gold.' }),
      'GOLD',
      { won: false, roll: 1 },
      deps,
    );
    expect(lose.effects.growUpdates[0].notes![1].text).toBe('🎲 1: Fool’s gold.');
  });

  it('works without a project, and refuses a card with no decision open', () => {
    const noProject = books([deal({ stage: 'awaitingRoll', successOn: 4 })]);
    expect(resolveGamble(noProject, 'GOLD', { won: true }, deps).effects.growUpdates).toEqual([]);
    expect(() => resolveGamble(books([deal()]), 'GOLD', { won: true }, deps)).toThrow(
      'no dice decision',
    );
    expect(() => resolveGamble(books(), 'NOPE', { won: true }, deps)).toThrow('no dice decision');
  });
});

describe('resolveGamble: a stock split', () => {
  const split = (quantity: number) =>
    books(
      [
        deal({
          title: 'SPLIT-OK4U',
          coins: 0,
          costMinor: 0,
          stage: 'awaitingRoll',
          split: { shareTag: 'OK4U' },
        }),
      ],
      {
        shares: [{ tag: 'OK4U', quantity, priceMinor: 500 }],
        growProjects: [
          project({ title: 'OK4U', share: { tag: 'OK4U', quantity, priceMinor: 500 } }),
        ],
      },
    );

  it('1-3 doubles the shares - in the balance sheet and on the project - and the decision goes away', () => {
    const { effects, kind, share } = resolveGamble(
      deepFreeze(split(100)),
      'SPLIT-OK4U',
      { won: true, roll: 2 },
      deps,
    );
    expect(kind).toBe('split');
    expect(share).toBe('OK4U');
    expect(effects.shareUpserts).toEqual([{ tag: 'OK4U', quantity: 200, priceMinor: 500 }]);
    expect(effects.growUpdates[0].share).toEqual({ tag: 'OK4U', quantity: 200, priceMinor: 500 });
    expect(effects.growUpdates[0].notes![1].text).toBe(
      '🎲 2: CashflowGame.splitDouble{"share":"OK4U","from":100,"to":200}',
    );
    expect(effects.state.assetDeals).toEqual([]);
    expect(effects.step).toEqual({ kind: 'shareSplit', detail: 'OK4U · 🎲 2 · 100 → 200' });
    expect(effects.persist).toEqual({ subscriptions: false, grow: true, balanceSheet: true });
  });

  it('4-6 halves them, keeping the half that rounds up', () => {
    const { effects } = resolveGamble(split(7), 'SPLIT-OK4U', { won: false, roll: 5 }, deps);
    expect(effects.shareUpserts[0].quantity).toBe(4);
    expect(effects.step).toEqual({ kind: 'shareReverseSplit', detail: 'OK4U · 🎲 5 · 7 → 4' });
  });

  it('leaves the project’s own share alone when its quantity was already different', () => {
    const b = split(100);
    b.growProjects = [
      project({ title: 'OK4U', share: { tag: 'OK4U', quantity: 50, priceMinor: 500 } }),
    ];
    const { effects } = resolveGamble(b, 'SPLIT-OK4U', { won: true }, deps);
    expect(effects.growUpdates[0].share).toBeUndefined();
  });
});

describe('resolveGamble: the Payday roll of kept cards', () => {
  const mlm = (title: string, extra: Partial<CashflowAssetDeal> = {}) =>
    deal({
      title,
      recurring: true,
      stage: 'owned',
      rollDue: true,
      costMinor: 100000,
      payoutMinor: 200000,
      coins: 0,
      ...extra,
    });
  const kept = () =>
    books([mlm('M1'), mlm('M2'), mlm('OTHER', { costMinor: 5 })], {
      growProjects: [
        project({ title: 'M1' }),
        project({ title: 'M2' }),
        project({ title: 'OTHER' }),
      ],
    });

  it('one roll for every card of the same kind: a win pays once per card, on different days', () => {
    const { effects, kind } = resolveGamble(deepFreeze(kept()), 'M1', { won: true, roll: 6 }, deps);
    expect(kind).toBe('paydayRoll');
    expect(effects.appendedTransactions.map((t) => [t.category, t.amountMinor, t.comment])).toEqual(
      [
        ['@M1', 200000, 'M1 payout\n#cashflow'],
        ['@M2', 200000, 'M2 payout\n#cashflow'],
      ],
    );
    const [first, second] = effects.appendedTransactions;
    expect(first.date).not.toBe(second.date);
    expect(effects.step).toEqual({ kind: 'diceWon', detail: 'M1 ×2 · 🎲 6' });
    expect(effects.growUpdates.map((u) => u.title)).toEqual(['M1', 'M2']);
    expect(effects.growUpdates[0].notes![1].text).toBe(
      '🎲 6: CashflowGame.diceWonPayoutToast{"amount":"4000E"}',
    );
  });

  it('the bonus of a kept card is booked as Income, like the salary - never on Daily', () => {
    const { effects } = resolveGamble(kept(), 'M1', { won: true, roll: 5 }, deps);
    expect(effects.appendedTransactions).toHaveLength(2);
    expect(effects.appendedTransactions.every((t) => t.account === 'Income')).toBe(true);
  });

  it('only the rolled kind is settled; the roll is cleared for those and left on the others', () => {
    const { effects } = resolveGamble(kept(), 'M1', { won: true }, deps);
    const byTitle = Object.fromEntries(effects.state.assetDeals!.map((d) => [d.title, d.rollDue]));
    expect(byTitle).toEqual({ M1: false, M2: false, OTHER: true });
  });

  it('a miss books nothing, and the cards stay in execution', () => {
    const { effects } = resolveGamble(kept(), 'M2', { won: false, roll: 3 }, deps);
    expect(effects.appendedTransactions).toEqual([]);
    expect(effects.step).toEqual({ kind: 'diceLost', detail: 'M1 ×2 · 🎲 3'.replace('M1', 'M2') });
    expect(effects.state.assetDeals!.every((d) => d.stage === 'owned')).toBe(true);
    expect(effects.persist.grow).toBe(true);
  });

  it('a card that is owned but not due has no Payday roll to settle', () => {
    expect(() =>
      resolveGamble(books([mlm('M1', { rollDue: false })]), 'M1', { won: true }, deps),
    ).toThrow('no dice decision');
  });

  it('the results apply cleanly to the books', () => {
    const b = kept();
    const { effects } = resolveGamble(b, 'M1', { won: true }, deps);
    const after = applyEffectsToBooks(b, effects);
    expect(after.transactions).toHaveLength(2);
    expect(after.growProjects.find((p) => p.title === 'M1')!.notes).toHaveLength(2);
  });
});

describe('purity', () => {
  it('no rule here mutates its input', () => {
    const b = deepFreeze(
      books([deal({ stage: 'awaitingRoll', successOn: 4 })], {
        growProjects: [project()],
        assets: [{ tag: 'GOLD', amountMinor: 1 }],
      }),
    );
    expect(() => {
      beforeAssetBuy(b.state, 'GOLD');
      afterAssetBuy(b, 'GOLD');
      afterAssetSell(b, 'GOLD');
      sellCoins(b, 'GOLD', 1, 100, deps);
      resolveGamble(b, 'GOLD', { won: true }, deps);
      openDecisions(b.state);
    }).not.toThrow();
    expect(identityText('x')).toBe('x');
  });
});
