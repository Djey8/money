import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { HARVEST_CARDS } from '../cashflow-harvest-cards';
import { OPPORTUNITY_CARDS } from '../cashflow-opportunity-cards';
import { applyEffectsToBooks, type GameBooks } from './books';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import {
  drawHarvestCard,
  indexOf,
  initialMarkets,
  ladderPayout,
  playHarvestCard,
  rideLadder,
  sellHolding,
  tickMarkets,
  tickWorld,
  unitPriceNow,
  valueOf,
} from './harvest';
import { buyOpportunity, monthlyOf, type OpportunityContext } from './opportunity';
import { seededRng } from './rng';

const harvest = (id: string) => HARVEST_CARDS.find((c) => c.id === id)!;
const opportunity = (id: string) => OPPORTUNITY_CARDS.find((c) => c.id === id)!;

function start(): GameBooks {
  const result = pickCashflowProfession(
    CASHFLOW_GAME_SETS,
    'jfk-stories',
    'dual-student-informatik',
    '2026-11-15',
    'solo',
  );
  const subscriptions: BookSubscription[] = result.subscriptions.map((sub) => ({
    title: sub.title,
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: '2026-11-15',
    endDate: '',
    category: sub.category ?? '',
    comment: '',
    frequency: 'monthly',
  }));
  return {
    state: { ...result.state, markets: initialMarkets() },
    allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
    gameSet: undefined,
    subscriptions,
    transactions: [],
    liabilities: [],
    shares: [],
    investments: [],
    assets: [],
    growProjects: [],
  };
}

const context = (books: GameBooks): OpportunityContext => ({
  life: books.state.life,
  careerStage: 1,
  holdings: books.state.holdings ?? [],
  debtMinor: 0,
});

const buy = (books: GameBooks, id: string, choice = {}, rolls = {}) =>
  applyEffectsToBooks(
    books,
    buyOpportunity(books, opportunity(id), choice, rolls, {
      date: '2026-11-15',
      lang: 'en',
      context: context(books),
      cards: OPPORTUNITY_CARDS,
    }).effects,
  );

const harvestContext = {
  cards: OPPORTUNITY_CARDS,
  lang: 'en' as const,
  date: '2026-12-15',
  rng: seededRng(4),
};

const play = (books: GameBooks, id: string, rng = seededRng(4)) => {
  const result = playHarvestCard(books, harvest(id), { ...harvestContext, rng });
  return { result, books: applyEffectsToBooks(books, result.effects) };
};

describe('the Harvest stack', () => {
  it('has the 87 cards with the 103 physical cards of a Medium game, in both languages', () => {
    expect(HARVEST_CARDS).toHaveLength(87);
    expect(HARVEST_CARDS.reduce((sum, c) => sum + c.copies, 0)).toBe(103);
    for (const c of HARVEST_CARDS)
      expect(c.title.en && c.title.de && c.story.en && c.story.de).toBeTruthy();
  });

  it('the pile gives every copy once before it is shuffled again', () => {
    let deck;
    const seen: string[] = [];
    const rng = seededRng(2);
    for (let i = 0; i < 103; i += 1) {
      const draw = drawHarvestCard(HARVEST_CARDS, deck, rng);
      deck = draw.deck;
      seen.push(draw.card.id);
    }
    expect(new Set(seen).size).toBe(HARVEST_CARDS.filter((c) => c.copies > 0).length);
    expect(seen.filter((id) => id === 'H05')).toHaveLength(3);
  });

  it('a crash moves the indices, the held shares are priced again, and the value is the card price times the index', () => {
    const books = buy(start(), 'S10', { units: 4 });
    const held = books.state.holdings![0];
    expect(unitPriceNow(opportunity('S10'), held, books.state)).toBe(10000);
    const { books: after, result } = play(books, 'H01');
    expect(indexOf(after.state, 'WORLD')).toBe(0.75);
    expect(indexOf(after.state, 'GOLD')).toBe(1.06);
    expect(after.shares.find((s) => s.tag === 'WORLD')).toMatchObject({
      quantity: 4,
      priceMinor: 7500,
    });
    expect(valueOf(opportunity('S10'), after.state.holdings![0], after.state)).toBe(30000);
    expect(result.pending.told[0]).toContain('WORLD −25%');
  });

  it('a die decides the move of a market, and a six may roll again', () => {
    const books = buy(start(), 'S18', { units: 1 });
    // a die that always rolls a 6 on the first roll and the second
    const sixes = () => 0.99;
    const { books: after } = play(books, 'H33', sixes);
    expect(indexOf(after.state, 'BTC')).toBe(10);
  });

  it('a sale in a window: the units are sold at the index, the rest stay, the proceeds are income', () => {
    let books = buy(start(), 'S10', { units: 4 });
    ({ books } = play(books, 'H05'));
    const price = unitPriceNow(opportunity('S10'), books.state.holdings![0], books.state);
    expect(price).toBe(10700);
    const effects = sellHolding(
      books,
      'WORLD',
      { grossMinor: price * 3, costsMinor: 0, owedMinor: 0, units: 3 },
      harvestContext,
    );
    expect(effects.appendedTransactions[0]).toMatchObject({ amountMinor: 32100, account: 'Fire' });
    expect(effects.shareUpserts[0].quantity).toBe(1);
    const after = applyEffectsToBooks(books, effects);
    expect(after.state.holdings![0].units).toBe(1);
    // selling the rest ends the project
    const last = sellHolding(
      after,
      'WORLD',
      { grossMinor: price, costsMinor: 0, owedMinor: 0 },
      harvestContext,
    );
    expect(last.shareRemovals).toEqual(['WORLD']);
    expect(last.growUpdates[0]).toMatchObject({ phase: 'completed' });
  });

  it('a buyer for a property pays the price times the index times a roll, less the mortgage and the costs', () => {
    const books = buy(start(), 'T01');
    const { result } = play(books, 'H53', () => 0.5);
    const sale = result.pending.sales[0];
    // roll 4 -> x1.08 of 36,000 = 38,880; costs 6%; the mortgage of 28,800 is repaid
    expect(sale).toMatchObject({
      holding: 'Studio Flat in a Small Town' === sale.holding ? sale.holding : sale.holding,
    });
    expect(sale.grossMinor).toBeGreaterThan(0);
    expect(sale.netMinor).toBe(sale.grossMinor - sale.costsMinor - sale.owedMinor);
    expect(sale.owedMinor).toBe(opportunity('T01').property!.mortgageMinor);
    const effects = sellHolding(books, sale.holding, sale, harvestContext);
    expect(effects.liabilityRemovals).toContain(sale.holding);
    expect(effects.subscriptionRemovals.length).toBe(1);
  });

  it('holders roll for themselves: a viral video changes the cash flow of a content side hustle for good', () => {
    const books = buy(start(), 'S28', {}, { outcome: 5 });
    const holding = books.state.holdings![0];
    expect(monthlyOf({ ...holding, rampLeft: 0 })).toBe(6000);
    const { books: after } = play({ ...books }, 'H63', () => 0.99);
    expect(after.state.holdings![0].factor).toBe(3);
  });

  it('a trap is revealed: its shares are gone and its index is zero', () => {
    const books = buy(start(), 'T22', { units: 2 });
    const { books: after, result } = play(books, 'H79');
    expect(after.state.holdings![0].ended).toBe(true);
    expect(after.shares.find((s) => s.tag === 'PREIPO')).toBeUndefined();
    expect(result.pending.told[0]).toContain('scam');
  });

  it('a hype ladder: a win multiplies the stake, a loss leaves what the card says', () => {
    const books = buy(start(), 'S18', { units: 2 });
    const { result } = play(books, 'H37', () => 0.5);
    const offer = result.pending.ladders[0];
    expect(offer).toMatchObject({
      state: 'open',
      maxSteps: 4,
      successFrom: 6,
      step: 3.2,
      fail: 0.5,
    });
    const win = rideLadder(offer, () => 0.99).offer;
    expect(win).toMatchObject({ steps: 1, multiplier: 3.2, state: 'riding' });
    expect(ladderPayout(win)).toBe(Math.round(offer.stakeMinor * 3.2));
    const lost = rideLadder(win, () => 0).offer;
    expect(lost.state).toBe('done');
    expect(ladderPayout(lost)).toBe(Math.round(offer.stakeMinor * 0.5));
  });

  it('every Payday the markets drift, and recovering brings a fall half-way back', () => {
    const books = start();
    const drifted = tickMarkets(books.state);
    expect(indexOf(drifted, 'WORLD')).toBeCloseTo(1.0051, 4);
    expect(indexOf(drifted, 'ALTS')).toBeCloseTo(1.0111, 4);
    const { books: crashed } = play(books, 'H01');
    const { books: recovered } = play(crashed, 'H11');
    expect(indexOf(recovered.state, 'WORLD')).toBeCloseTo(0.875, 3);
  });

  it('the Payday of the world prices the holdings and counts down what the cards did', () => {
    let books = buy(start(), 'S10', { units: 4 });
    ({ books } = play(books, 'H09'));
    expect(books.state.marketEffects?.[0]).toMatchObject({ paydaysLeft: 6 });
    const tick = tickWorld(
      { state: books.state, subscriptions: books.subscriptions, growProjects: books.growProjects },
      OPPORTUNITY_CARDS,
      { date: '2027-01-15', lang: 'en' },
    );
    expect(tick.effects.sharePrices.length + tick.effects.shareUpserts.length).toBeGreaterThan(0);
    expect(tick.effects.state.marketEffects?.[0]).toMatchObject({ paydaysLeft: 5 });
  });
});
