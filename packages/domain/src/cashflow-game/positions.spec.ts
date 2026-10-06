import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { applyEffectsToBooks, type BookGrowProject, type GameBooks } from './books';
import { fixedClock } from './clock';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { identityText } from './game-text';
import { planDeal, executeDeal, type DealDeps, type DealInput } from './deals';
import { resolveGamble } from './asset-deals';
import { buyAssetDeal, sellPosition } from './positions';

const TODAY = '2026-10-15';
const NOW = '2026-10-15T09:00:00.000Z';
const deps: DealDeps = {
  clock: fixedClock(TODAY, NOW),
  text: (key, params) => (params ? `${key}${JSON.stringify(params)}` : key),
  money: (minor) => `${minor / 100}E`,
  plainMoney: (minor) => `${minor / 100}P`,
};
void identityText;

const placeholderSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;

function books(cashMinor = 0): GameBooks {
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
  };
}

const cashOf = (b: GameBooks) =>
  b.transactions.filter((t) => t.account === 'Daily').reduce((sum, t) => sum + t.amountMinor, 0);

const applyAll = (start: GameBooks, steps: ReturnType<typeof executeDeal>['steps']) =>
  steps.reduce(applyEffectsToBooks, start);

function bought(input: DealInput, cashMinor = 2000000): GameBooks {
  let b = books(cashMinor);
  b = applyEffectsToBooks(b, planDeal(b, input, deps));
  const quantity = input.kind === 'share' ? input.quantity : undefined;
  return applyAll(b, executeDeal(b, input.title, quantity, deps).steps);
}

const shareInput = {
  kind: 'share',
  title: 'OK4U',
  subtitle: 'OK4U Inc.',
  quantity: 100,
  priceMinor: 1000,
} as DealInput;
const propertyInput = {
  kind: 'investment',
  title: 'EFH',
  subtitle: 'House',
  depositMinor: 300000,
  mortgageMinor: 4700000,
  cashflowMinor: 25000,
} as DealInput;
const goldInput = {
  kind: 'asset',
  title: 'GOLD',
  subtitle: 'Gold',
  costMinor: 500000,
  coins: 5,
  successOn: 4,
} as DealInput;

describe('sellPosition - shares', () => {
  it('sells part of a position at a price: the income comes in, the rest stays held', () => {
    const owned = bought(shareInput);
    const step = sellPosition(owned, { title: 'OK4U', quantity: 40, priceMinor: 1500 }, deps);
    const after = applyAll(owned, step.steps);
    expect(step.cashMinor).toBe(60000);
    expect(after.shares).toEqual([{ tag: 'OK4U', quantity: 60, priceMinor: 1500 }]);
    expect(after.transactions.at(-1)).toMatchObject({
      account: 'Income',
      amountMinor: 60000,
      comment: 'Sell Share OK4U 40 x 15;',
    });
    expect(after.growProjects.find((p) => p.title === 'OK4U')).toMatchObject({
      status: 'sold',
      phase: 'execute',
    });
  });

  it('selling the last share closes the position and completes the project', () => {
    const owned = bought(shareInput);
    const after = applyAll(owned, sellPosition(owned, { title: 'OK4U' }, deps).steps);
    expect(after.shares).toEqual([]);
    expect(after.growProjects.find((p) => p.title === 'OK4U')?.phase).toBe('completed');
  });

  it('refuses more than is held, and a share that is not held', () => {
    const owned = bought(shareInput);
    expect(() => sellPosition(owned, { title: 'OK4U', quantity: 101 }, deps)).toThrow('hold 100');
    expect(() => sellPosition(books(), { title: 'OK4U' }, deps)).toThrow('No Grow project');
  });
});

describe('sellPosition - properties', () => {
  it('sells to a market buyer: the mortgage is paid back, deposit plus profit comes in, the cashflow ends', () => {
    const owned = bought(propertyInput);
    expect(owned.subscriptions.some((sub) => sub.title === 'EFH Cashflow')).toBe(true);
    const offered: GameBooks = {
      ...owned,
      state: {
        ...owned.state,
        marketOffers: [{ title: 'EFH', salePriceMinor: 5200000, cardId: 'm1', label: 'Buyer' }],
      },
    };
    const step = sellPosition(offered, { title: 'EFH' }, deps);
    const after = applyAll(offered, step.steps);
    // price 52.000 - mortgage 47.000 = 5.000 net: the 3.000 deposit and a 2.000 profit
    expect(step.cashMinor).toBe(500000);
    expect(after.transactions.at(-1)).toMatchObject({ account: 'Income', amountMinor: 500000 });
    expect(after.transactions.at(-1)?.comment).toBe('Sell Investment EFH 3000 47000;');
    expect(after.investments).toEqual([]);
    expect(after.liabilities.find((l) => l.tag === 'M-EFH')).toBeUndefined();
    expect(after.subscriptions.some((sub) => sub.title === 'EFH Cashflow')).toBe(false);
    expect(after.state.marketOffers).toEqual([]); // the offer goes with the property
    const grow: BookGrowProject = after.growProjects.find((p) => p.title === 'EFH')!;
    // the project's amount follows the dialog's arithmetic: what the buy added, less the deposit that came back
    expect(grow).toMatchObject({ status: 'sold', phase: 'completed', amountMinor: 300000 });
  });

  it('needs a buyer: a Market card offer, or a price given', () => {
    const owned = bought(propertyInput);
    expect(() => sellPosition(owned, { title: 'EFH' }, deps)).toThrow('No buyer');
    const step = sellPosition(owned, { title: 'EFH', salePriceMinor: 5000000 }, deps);
    expect(step.cashMinor).toBe(300000);
  });

  it('a sale that does not cover the mortgage is paid from your own pocket, with the loan first when cash is short', () => {
    const owned = bought(propertyInput, 300000); // just the deposit in cash, nothing left after the buy
    const cash = cashOf(owned);
    const step = sellPosition(owned, { title: 'EFH', salePriceMinor: 4000000 }, deps);
    expect(step.cashMinor).toBe(-700000);
    expect(step.steps.length).toBe(2); // the automatic loan, then the sale
    const after = applyAll(owned, step.steps);
    expect(after.transactions.at(-1)).toMatchObject({ account: 'Daily', amountMinor: -700000 });
    expect(after.liabilities.some((l) => l.tag === 'Bank loan')).toBe(true);
    expect(cash).toBeLessThan(700000);
    expect(cashOf(after)).toBeGreaterThanOrEqual(0);
  });
});

describe('buyAssetDeal and selling coins', () => {
  function planned(input: DealInput, cashMinor = 2000000): GameBooks {
    const b = books(cashMinor);
    return applyEffectsToBooks(b, planDeal(b, input, deps));
  }

  it('a dice card is paid for but is no asset until the roll decides it', () => {
    const b = planned(goldInput);
    const result = buyAssetDeal(b, 'GOLD', deps);
    const after = applyAll(b, result.steps);
    expect(after.assets).toEqual([]);
    expect(after.state.assetDeals?.[0].stage).toBe('awaitingRoll');
    expect(after.transactions.at(-1)).toMatchObject({ account: 'Fire', amountMinor: -500000 });
    expect(result.steps.at(-1)?.decisionNeeded).toBe(true);

    const won = resolveGamble(after, 'GOLD', { won: true, roll: 5 }, deps);
    const settled = applyEffectsToBooks(after, won.effects);
    expect(settled.assets).toEqual([{ tag: 'GOLD', amountMinor: 500000 }]);
  });

  it('a plain offer or a kept MLM card is owned at once', () => {
    const b = planned({ ...goldInput, successOn: undefined, title: 'ARTWORK' } as DealInput);
    const after = applyAll(b, buyAssetDeal(b, 'ARTWORK', deps).steps);
    expect(after.assets).toEqual([{ tag: 'ARTWORK', amountMinor: 500000 }]);
    expect(after.state.assetDeals?.[0].stage).toBe('owned');
  });

  it('takes the loan first when the card costs more than the cash', () => {
    const b = planned(goldInput, 100000);
    const result = buyAssetDeal(b, 'GOLD', deps);
    expect(result.steps).toHaveLength(2);
    expect(cashOf(applyAll(b, result.steps))).toBeGreaterThanOrEqual(0);
  });

  it('sells coins one by one at the buyer price, keeping the cost of the coins left', () => {
    const b = planned({ ...goldInput, successOn: undefined } as DealInput);
    const owned = applyAll(b, buyAssetDeal(b, 'GOLD', deps).steps);
    const step = sellPosition(owned, { title: 'GOLD', quantity: 2, priceMinor: 150000 }, deps);
    const after = applyAll(owned, step.steps);
    expect(step.cashMinor).toBe(300000);
    expect(after.assets).toEqual([{ tag: 'GOLD', amountMinor: 300000 }]); // 3 of 5 coins left
    expect(after.state.assetDeals?.[0]).toMatchObject({ coins: 3, stage: 'owned' });
    expect(after.transactions.at(-1)?.comment).toBe('Sell Asset GOLD 2 x 1500;');

    const rest = applyAll(
      after,
      sellPosition(after, { title: 'GOLD', priceMinor: 100000 }, deps).steps,
    );
    expect(rest.assets).toEqual([]);
    expect(rest.state.assetDeals?.[0].stage).toBe('sold');
  });

  it('refuses a card that was never planned', () => {
    expect(() => buyAssetDeal(books(), 'GOLD', deps)).toThrow('plan the card first');
  });
});
