import { fixedClock } from './clock';
import type { GameText } from './game-text';
import {
  businessCardLabels,
  buyerCardTypes,
  coinsOwnedOf,
  labelMatches,
  marketCardKind,
  marketSaleFor,
  playBoostCard,
  playMarketBuyerCard,
  playMarketCostCard,
  playShareSplitCard,
  propertyCardTypes,
  updateSharePrice,
  type CardBooks,
  type CardDeps,
} from './market-cards';
import { MARKET_NOTE_MARK, type BookSubscription } from './rounds';
import { initialCashflowGameState, type CashflowDealCard, type CashflowMarketCard } from './types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

/** A text function that shows its key and parameters, so a test can see exactly what the rule asked for. */
const echo: GameText = (key, params) => (params ? `${key}${JSON.stringify(params)}` : key);
const money = (minor: number) => `${(minor / 100).toLocaleString('en-US')} EUR`;
const deps: CardDeps = {
  clock: fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
  text: echo,
  money,
};

function books(extra: Partial<CardBooks> = {}): CardBooks {
  return {
    state: {
      ...initialCashflowGameState(),
      gameSetId: 'cashflow',
      professionId: 'hausmeister',
      virtualDate: '2026-10-15',
      gameSubscriptionTitles: ['Salary'],
    },
    subscriptions: [],
    investments: [],
    shares: [],
    assets: [],
    growProjects: [],
    ...extra,
  };
}

const efh = { tag: 'EFH', depositMinor: 1000000, amountMinor: 6000000 }; // original price 70.000
const efhProject = (notes: { text: string; createdAt: string }[] = []) => ({
  title: 'EFH',
  notes,
  cashflowMinor: 25000,
});

const buyerCard = (sells: CashflowMarketCard['sells']): CashflowMarketCard => ({
  id: 'm1',
  title: 'Buyer',
  description: '',
  sells,
});

describe('labelMatches', () => {
  it('matches the label itself and its numbered copies, ignoring case', () => {
    expect(labelMatches('EFH', 'efh')).toBe(true);
    expect(labelMatches('EFH-II', 'EFH')).toBe(true);
    expect(labelMatches('efh-xiv', 'EFH')).toBe(true);
  });

  it('does not match a different label, a longer one, or a non-roman suffix', () => {
    expect(labelMatches('EFH2', 'EFH')).toBe(false);
    expect(labelMatches('EFHX', 'EFH')).toBe(false);
    expect(labelMatches('MFH4', 'EFH')).toBe(false);
    expect(labelMatches('EFH-2', 'EFH')).toBe(false);
  });

  it('treats the label literally, not as a pattern', () => {
    expect(labelMatches('A.B', 'A.B')).toBe(true);
    expect(labelMatches('AxB', 'A.B')).toBe(false);
  });
});

describe('marketCardKind and the types a card names', () => {
  const card = (extra: Partial<CashflowMarketCard>): CashflowMarketCard => ({
    id: 'x',
    title: 'x',
    description: '',
    ...extra,
  });

  it('reads what a Market card does from the fields it carries', () => {
    expect(marketCardKind(card({ sells: { family: 'EFH', plusPercent: 20 } }))).toBe('buyer');
    expect(marketCardKind(card({ sells: { family: 'GOLD', pricePerCoinMinor: 100 } }))).toBe(
      'gold',
    );
    expect(marketCardKind(card({ splits: { symbol: 'OK4U' } }))).toBe('split');
    expect(marketCardKind(card({ boost: { maxCashflowMinor: 1, addMinor: 1 } }))).toBe('boost');
    expect(marketCardKind(card({ pays: { costMinor: 1 } }))).toBe('cost');
    expect(marketCardKind(card({}))).toBe('text');
  });

  it('lists a buyer’s types with their labels, and takes the unit count from the symbol', () => {
    const labelFor = (symbol: string) => (symbol === 'EFH' ? 'SFH' : undefined);
    const types = buyerCardTypes(
      card({ sells: { family: 'EFH', symbols: ['EFH', 'APH24'] } }),
      labelFor,
    );
    expect(types).toEqual([
      { labels: ['EFH', 'SFH'], units: undefined },
      { labels: ['APH24', 'APH24'], units: 24 },
    ]);
  });

  it('falls back to the family when a buyer names no symbols', () => {
    expect(buyerCardTypes(card({ sells: { family: 'ETW' } }), () => undefined)).toEqual([
      { labels: ['ETW', 'ETW'], units: undefined },
    ]);
  });

  it('knows every property type and every business', () => {
    const labelFor = (symbol: string) => `${symbol}!`;
    expect(propertyCardTypes(labelFor).map((t) => t.labels[0])).toEqual([
      'EFH',
      'ETW',
      'MFH4',
      'MFH8',
      'DH',
      'APH12',
      'APH24',
      'APH60',
    ]);
    expect(businessCardLabels(labelFor)).toEqual([
      'PIZZA',
      'PIZZA!',
      'GP',
      'GP!',
      'AU',
      'AU!',
      'AWA',
      'AWA!',
    ]);
  });
});

describe('playMarketBuyerCard: property buyers', () => {
  const types = [{ labels: ['EFH', 'SFH'] }];

  it('offers the original price plus a percentage, and notes it on the property’s project', () => {
    const { effects, matched } = playMarketBuyerCard(
      deepFreeze(books({ investments: [efh], growProjects: [efhProject()] })),
      buyerCard({ family: 'EFH', plusPercent: 20 }),
      { title: 'Buyer card', types },
      deps,
    );

    expect(matched).toEqual(['EFH']);
    expect(effects.state.marketOffers).toEqual([
      { title: 'EFH', salePriceMinor: 8400000, cardId: 'm1', label: '+20%' },
    ]);
    expect(effects.step).toEqual({ kind: 'marketCard', detail: 'Buyer card' });
    expect(effects.persist.grow).toBe(true);
    const [update] = effects.growUpdates;
    expect(update.title).toBe('EFH');
    expect(update.notes).toHaveLength(1);
    expect(update.notes![0].createdAt).toBe('2026-10-15T09:00:00.000Z');
    expect(update.notes![0].text.startsWith(MARKET_NOTE_MARK)).toBe(true);
    expect(update.notes![0].text).toContain('CashflowGame.noteMarketOffer');
    expect(update.notes![0].text).toContain('"offer":"+20%"');
    expect(update.notes![0].text).toContain('"profit":"14,000 EUR"');
    expect(update.notes![0].text).toContain('"cash":"24,000 EUR"'); // 84.000 - 60.000 mortgage
  });

  it('a fixed profit, a fixed price and a per-unit price', () => {
    const run = (sells: CashflowMarketCard['sells'], tag = 'EFH', type = types[0]) =>
      playMarketBuyerCard(
        books({ investments: [{ ...efh, tag }], growProjects: [] }),
        buyerCard(sells),
        { types: [type] },
        deps,
      ).effects.state.marketOffers![0];

    expect(run({ family: 'EFH', plusMinor: 500000 })).toMatchObject({
      salePriceMinor: 7500000,
      label: '+5,000 EUR',
    });
    expect(run({ family: 'ETW', priceMinor: 6500000 })).toMatchObject({
      salePriceMinor: 6500000,
      label: '65,000 EUR',
    });
    expect(
      run({ family: 'APH', pricePerUnitMinor: 300000 }, 'APH24', {
        labels: ['APH24'],
        units: 24,
      } as any),
    ).toMatchObject({ salePriceMinor: 7200000, label: '3,000 EUR × 24' });
  });

  it('warns when the offer would not even repay the mortgage', () => {
    const { effects } = playMarketBuyerCard(
      books({ investments: [efh], growProjects: [efhProject()] }),
      buyerCard({ family: 'EFH', priceMinor: 5000000 }),
      { types },
      deps,
    );
    expect(effects.growUpdates[0].notes![0].text).toContain('CashflowGame.noteMarketOfferLoss');
    expect(effects.growUpdates[0].notes![0].text).toContain('"loss":"10,000 EUR"');
  });

  it('matches numbered copies and replaces only the offers it renews', () => {
    const b = books({
      investments: [efh, { ...efh, tag: 'EFH-II' }, { ...efh, tag: 'ETW' }],
      growProjects: [],
    });
    b.state = {
      ...b.state,
      marketOffers: [
        { title: 'EFH', salePriceMinor: 1, cardId: 'old', label: 'old' },
        { title: 'ETW', salePriceMinor: 2, cardId: 'keep', label: 'keep' },
      ],
    };

    const { effects, matched } = playMarketBuyerCard(
      b,
      buyerCard({ family: 'EFH', plusPercent: 10 }),
      { types },
      deps,
    );

    expect(matched.sort()).toEqual(['EFH', 'EFH-II']);
    expect(effects.state.marketOffers!.map((o) => [o.title, o.cardId])).toEqual([
      ['ETW', 'keep'],
      ['EFH', 'm1'],
      ['EFH-II', 'm1'],
    ]);
  });

  it('keeps one market note per project: a new offer replaces the old one in place', () => {
    const notes = [
      { text: 'my own note', createdAt: 'a' },
      { text: `${MARKET_NOTE_MARK}old offer`, createdAt: 'b' },
    ];
    const { effects } = playMarketBuyerCard(
      books({ investments: [efh], growProjects: [efhProject(notes)] }),
      buyerCard({ family: 'EFH', plusPercent: 10 }),
      { types },
      deps,
    );
    const updated = effects.growUpdates[0].notes!;
    expect(updated).toHaveLength(2);
    expect(updated[0]).toEqual(notes[0]);
    expect(updated[1].createdAt).toBe('b'); // the note keeps its place and date
    expect(updated[1].text).not.toContain('old offer');
  });

  it('a buyer for a property the player does not own matches nothing, but is still a History step', () => {
    const { effects, matched } = playMarketBuyerCard(
      books({ investments: [{ ...efh, tag: 'MFH4' }] }),
      buyerCard({ family: 'EFH', plusPercent: 10 }),
      { title: 'No match', types },
      deps,
    );
    expect(matched).toEqual([]);
    expect(effects.state.marketOffers).toEqual([]);
    expect(effects.step).toEqual({ kind: 'marketCard', detail: 'No match' });
  });

  it('refuses a card with no offer, and a game that has not started', () => {
    expect(() =>
      playMarketBuyerCard(books(), { id: 'x', title: 'x', description: '' }, { types }, deps),
    ).toThrow('no offer to play');
    const b = books();
    b.state = { ...b.state, virtualDate: null };
    expect(() =>
      playMarketBuyerCard(b, buyerCard({ family: 'EFH', plusPercent: 1 }), { types }, deps),
    ).toThrow('Pick a profession');
  });
});

describe('playMarketBuyerCard: gold buyers', () => {
  const goldCard = buyerCard({ family: 'GOLD', pricePerCoinMinor: 100000 });
  const owned = (coins: number) => {
    const b = books({ assets: [{ tag: 'GOLD', amountMinor: 500000 }], growProjects: [] });
    b.state = {
      ...b.state,
      assetDeals: [{ title: 'GOLD', coins, costMinor: 500000, stage: 'owned' }],
    };
    return b;
  };

  it('offers cash for every coin still owned', () => {
    const { effects, matched } = playMarketBuyerCard(
      owned(5),
      goldCard,
      { types: [{ labels: ['GOLD'] }] },
      deps,
    );
    expect(matched).toEqual(['GOLD']);
    expect(effects.state.marketOffers).toEqual([
      {
        title: 'GOLD',
        salePriceMinor: 500000,
        cardId: 'm1',
        label: '1,000 EUR × 5',
        pricePerCoinMinor: 100000,
      },
    ]);
  });

  it('ignores gold with no coins left', () => {
    expect(
      playMarketBuyerCard(owned(0), goldCard, { types: [{ labels: ['GOLD'] }] }, deps).matched,
    ).toEqual([]);
  });

  it('marketSaleFor follows the coins left, and nets the whole price', () => {
    const b = owned(5);
    const { effects } = playMarketBuyerCard(b, goldCard, { types: [{ labels: ['GOLD'] }] }, deps);
    const state = effects.state;
    expect(marketSaleFor(state, [], 'GOLD')).toEqual({
      salePriceMinor: 500000,
      netCashMinor: 500000,
      label: '1,000 EUR × 5',
      pricePerCoinMinor: 100000,
      coins: 5,
    });
    const afterSale = {
      ...state,
      assetDeals: [{ title: 'GOLD', coins: 2, costMinor: 500000, stage: 'owned' as const }],
    };
    expect(marketSaleFor(afterSale, [], 'GOLD')).toMatchObject({
      salePriceMinor: 200000,
      coins: 2,
    });
    expect(coinsOwnedOf(afterSale, 'GOLD')).toBe(2);
    expect(marketSaleFor({ ...afterSale, assetDeals: [] }, [], 'GOLD')).toBeNull();
  });
});

describe('marketSaleFor: properties', () => {
  it('is the buyer’s price and what is left after the mortgage is paid back', () => {
    const state = {
      ...books().state,
      marketOffers: [{ title: 'EFH', salePriceMinor: 8400000, cardId: 'm1', label: '+20%' }],
    };
    expect(marketSaleFor(state, [efh], 'EFH')).toEqual({
      salePriceMinor: 8400000,
      netCashMinor: 2400000,
      label: '+20%',
    });
  });

  it('is null with no offer or no such property', () => {
    expect(marketSaleFor(books().state, [efh], 'EFH')).toBeNull();
    const state = {
      ...books().state,
      marketOffers: [{ title: 'EFH', salePriceMinor: 1, cardId: 'm1', label: '' }],
    };
    expect(marketSaleFor(state, [], 'EFH')).toBeNull();
  });
});

describe('playShareSplitCard', () => {
  const split: CashflowMarketCard = {
    id: 's1',
    title: 'Split',
    description: '',
    splits: { symbol: 'OK4U' },
  };

  it('with the share, opens a dice decision that says what each outcome does', () => {
    const { effects, share } = playShareSplitCard(
      deepFreeze(books({ shares: [{ tag: 'OK4U', quantity: 100, priceMinor: 500 }] })),
      split,
      { title: 'Stock split', labels: ['OK4U'] },
      deps,
    );
    expect(share).toBe('OK4U');
    expect(effects.decisionNeeded).toBe(true);
    expect(effects.write).toBe(true);
    expect(effects.state.assetDeals).toEqual([
      {
        title: 'SPLIT-OK4U',
        coins: 0,
        costMinor: 0,
        stage: 'awaitingRoll',
        split: { shareTag: 'OK4U' },
        successText: 'CashflowGame.splitDouble{"share":"OK4U","from":100,"to":200}',
        failureText: 'CashflowGame.splitHalve{"share":"OK4U","from":100,"to":50}',
      },
    ]);
  });

  it('halving rounds the half you keep up', () => {
    const { effects } = playShareSplitCard(
      books({ shares: [{ tag: 'OK4U', quantity: 7, priceMinor: 500 }] }),
      split,
      { labels: ['ok4u'] },
      deps,
    );
    expect(effects.state.assetDeals![0].failureText).toContain('"to":4');
  });

  it('replaces an earlier open split of the same share instead of stacking a second', () => {
    const b = books({ shares: [{ tag: 'OK4U', quantity: 10, priceMinor: 500 }] });
    b.state = {
      ...b.state,
      assetDeals: [
        {
          title: 'SPLIT-OK4U',
          coins: 0,
          costMinor: 0,
          stage: 'awaitingRoll',
          split: { shareTag: 'OK4U' },
        },
      ],
    };
    const { effects } = playShareSplitCard(b, split, { labels: ['OK4U'] }, deps);
    expect(effects.state.assetDeals).toHaveLength(1);
  });

  it('without the share (or with none left) the card does not apply: a History step, nothing written', () => {
    for (const shares of [[], [{ tag: 'OK4U', quantity: 0, priceMinor: 500 }]]) {
      const { effects, share } = playShareSplitCard(
        books({ shares }),
        split,
        { title: 'Split', labels: ['OK4U'] },
        deps,
      );
      expect(share).toBeNull();
      expect(effects.write).toBe(false);
      expect(effects.step).toEqual({ kind: 'marketCard', detail: 'Split' });
      expect(effects.decisionNeeded).toBe(false);
    }
  });
});

describe('playBoostCard', () => {
  const boost: CashflowMarketCard = {
    id: 'b1',
    title: 'Business boom',
    description: '',
    boost: { maxCashflowMinor: 50000, addMinor: 10000 },
  };
  const subscription = (title: string, amountMinor: number): BookSubscription => ({
    title,
    account: 'Income',
    amountMinor,
    startDate: '2026-09-07',
    endDate: '',
    category: '',
    comment: '#cashflow',
    frequency: 'monthly',
  });

  it('raises every cash-flowing investment under the limit, in the project and in its Payday subscription', () => {
    const b = books({
      investments: [efh, { ...efh, tag: 'BIG' }, { ...efh, tag: 'NONE' }],
      growProjects: [
        efhProject(),
        { title: 'BIG', notes: [], cashflowMinor: 90000 }, // over the limit
        { title: 'NONE', notes: [], cashflowMinor: 0 }, // pays nothing
      ],
      subscriptions: [subscription('EFH Cashflow', 25000)],
    });

    const { effects, changed } = playBoostCard(deepFreeze(b), boost, { title: 'Boom' }, deps);

    expect(changed).toEqual([{ title: 'EFH', fromMinor: 25000, toMinor: 35000 }]);
    expect(effects.growUpdates).toHaveLength(1);
    expect(effects.growUpdates[0]).toMatchObject({ title: 'EFH', cashflowMinor: 35000 });
    expect(effects.growUpdates[0].notes![0].text).toContain('CashflowGame.noteMarketBoost');
    expect(effects.subscriptionUpserts).toEqual([
      { ...subscription('EFH Cashflow', 35000), category: '@EFH' },
    ]);
    expect(effects.persist).toEqual({ subscriptions: true, grow: true, balanceSheet: false });
    expect(effects.step).toEqual({ kind: 'marketCard', detail: 'Boom' });
  });

  it('registers a new Payday subscription on a free day and with the game, for an investment that had none', () => {
    const b = books({ investments: [efh], growProjects: [efhProject()] });
    const { effects } = playBoostCard(b, boost, {}, deps);
    expect(effects.subscriptionUpserts[0]).toMatchObject({
      title: 'EFH Cashflow',
      startDate: '2026-10-01',
      comment: '#cashflow',
      account: 'Income',
    });
    expect(effects.state.gameSubscriptionTitles).toEqual(['Salary', 'EFH Cashflow']);
  });

  it('two new subscriptions in one card land on different days', () => {
    const b = books({
      investments: [efh, { ...efh, tag: 'ETW' }],
      growProjects: [efhProject(), { title: 'ETW', notes: [], cashflowMinor: 10000 }],
    });
    const { effects } = playBoostCard(b, boost, {}, deps);
    expect(effects.subscriptionUpserts.map((s) => s.startDate)).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);
  });

  it('with business labels, only those businesses are boosted', () => {
    const b = books({
      investments: [efh, { ...efh, tag: 'PIZZA' }],
      growProjects: [efhProject(), { title: 'PIZZA', notes: [], cashflowMinor: 20000 }],
    });
    const { changed } = playBoostCard(b, boost, { businessLabels: ['PIZZA', 'Pizza'] }, deps);
    expect(changed.map((c) => c.title)).toEqual(['PIZZA']);
  });

  it('a boost that finds nothing to raise is still a History step', () => {
    const { effects, changed } = playBoostCard(books(), boost, { title: 'Boom' }, deps);
    expect(changed).toEqual([]);
    expect(effects.step).toEqual({ kind: 'marketCard', detail: 'Boom' });
  });
});

describe('playMarketCostCard', () => {
  const cost: CashflowMarketCard = {
    id: 'c1',
    title: 'Broken pipe',
    description: '',
    pays: { costMinor: 100000 },
  };
  const types = [{ labels: ['EFH'] }, { labels: ['ETW'] }];

  it('with a property, hands over the first one and records nothing (the Add dialog takes its own step)', () => {
    const { effects, property } = playMarketCostCard(
      books({ investments: [{ ...efh, tag: 'ETW' }, efh] }),
      cost,
      { title: 'Pipe', types },
    );
    expect(property).toBe('ETW');
    expect(effects.step).toBeNull();
    expect(effects.write).toBe(false);
  });

  it('without a property the card does not apply, and is a History step', () => {
    const { effects, property } = playMarketCostCard(books(), cost, { title: 'Pipe', types });
    expect(property).toBeNull();
    expect(effects.step).toEqual({ kind: 'marketCard', detail: 'Pipe' });
  });

  it('refuses a card with no cost', () => {
    expect(() =>
      playMarketCostCard(books(), { id: 'x', title: 'x', description: '' }, { types }),
    ).toThrow('no cost to pay');
  });
});

describe('updateSharePrice', () => {
  const card: CashflowDealCard = {
    id: 'd1',
    title: 'OK4U Inc.',
    assetKind: 'share',
    symbol: 'OK4U',
    priceMinor: 700,
  };
  const held = () =>
    books({
      shares: [{ tag: 'OK4U', quantity: 100, priceMinor: 500 }],
      growProjects: [
        {
          title: 'OK4U',
          notes: [{ text: 'bought', createdAt: 'a' }],
          cashflowMinor: 0,
          share: { tag: 'OK4U', priceMinor: 500 },
        },
      ],
    });

  it('sets the new price on the holding and the project, and writes what happened into the notes', () => {
    const { effects, title } = updateSharePrice(
      deepFreeze(held()),
      card,
      { description: 'Rumours.' },
      deps,
    );
    expect(title).toBe('OK4U');
    expect(effects.sharePrices).toEqual([{ tag: 'OK4U', priceMinor: 700 }]);
    expect(effects.growUpdates[0]).toMatchObject({
      title: 'OK4U',
      sharePriceMinor: 700,
      updatedAt: '2026-10-15T09:00:00.000Z',
    });
    const notes = effects.growUpdates[0].notes!;
    expect(notes[0]).toEqual({ text: 'bought', createdAt: 'a' });
    expect(notes[1].text).toBe(
      'CashflowGame.notePriceUp{"symbol":"OK4U","from":"5 EUR","to":"7 EUR"} Rumours.',
    );
    expect(effects.step).toEqual({ kind: 'priceUpdate', detail: 'OK4U · 5 EUR → 7 EUR' });
    expect(effects.persist).toEqual({ subscriptions: false, grow: true, balanceSheet: true });
  });

  it('says the price went down when it did', () => {
    const { effects } = updateSharePrice(held(), { ...card, priceMinor: 300 }, {}, deps);
    expect(effects.growUpdates[0].notes![1].text).toContain('CashflowGame.notePriceDown');
  });

  it('refuses when the player holds none of that share, or none is left', () => {
    expect(() => updateSharePrice(books(), card, {}, deps)).toThrow('You hold no OK4U shares');
    const sold = held();
    sold.shares = [{ tag: 'OK4U', quantity: 0, priceMinor: 500 }];
    expect(() => updateSharePrice(sold, card, {}, deps)).toThrow('You hold no OK4U shares');
  });

  it('names a card without a ticker by its title', () => {
    expect(() => updateSharePrice(books(), { ...card, symbol: undefined }, {}, deps)).toThrow(
      'You hold no OK4U Inc. shares',
    );
  });
});
