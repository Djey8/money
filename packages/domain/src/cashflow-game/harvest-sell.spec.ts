import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { HARVEST_CARDS } from '../cashflow-harvest-cards';
import { HARVEST_CARDS_MORE } from '../cashflow-harvest-more';
import { OPPORTUNITY_CARDS } from '../cashflow-opportunity-cards';
import { tuneOpportunityCards } from '../cashflow-opportunity-tuning';
import { applyEffectsToBooks, type GameBooks } from './books';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import {
  matchesTarget,
  playHarvestCard,
  initialMarkets,
  sellHolding,
  taxOnSale,
  unitPriceNow,
} from './harvest';
import { marketOfTag } from './harvest-deck';
import { buyOpportunity, type OpportunityContext } from './opportunity';
import { offerIsOpen } from './rules';
import { seededRng } from './rng';

const ALL = [...HARVEST_CARDS, ...HARVEST_CARDS_MORE];
const TUNED = tuneOpportunityCards(OPPORTUNITY_CARDS);
const harvest = (id: string) => ALL.find((c) => c.id === id)!;
const opportunity = (id: string) => TUNED.find((c) => c.id === id)!;

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
      cards: TUNED,
    }).effects,
  );

const harvestContext = {
  cards: TUNED,
  lang: 'en' as const,
  date: '2026-12-15',
  validRolls: 2,
};

const play = (books: GameBooks, id: string, rng = seededRng(4)) => {
  const result = playHarvestCard(books, harvest(id), { ...harvestContext, rng });
  return { result, books: applyEffectsToBooks(books, result.effects) };
};

/** How many of the physical Harvest cards bring a buyer or a window for one Opportunity card. */
function sellCopies(id: string): number {
  const card = opportunity(id);
  const tag = card.share ? card.share.ticker : card.market?.tag;
  const holding = {
    cardId: card.id,
    title: card.title.en,
    boughtRound: 0,
    paydays: 0,
    marketTag: tag,
    cashflowMinor: card.cashflowMinor ?? 1,
    paidMinor: 1,
  };
  let copies = 0;
  for (const h of ALL) {
    const sells = h.ops.some((op) => {
      if (op.op === 'sellWindow') {
        return (
          !!tag &&
          (card.share || card.market) &&
          (op.markets === 'ALL' ||
            op.markets.includes(tag) ||
            op.markets.includes(marketOfTag(tag) as string))
        );
      }
      if (op.op !== 'buyer') return false;
      const b = op.buyer;
      if (!b.targets.some((target) => matchesTarget(card, holding, target))) return false;
      if (b.basis === 'index') return !!card.share;
      if (b.basis === 'asset') return !card.share && !card.property;
      if (b.basis === 'property') return !!card.property;
      if (b.basis === 'business')
        return (
          !card.share &&
          !card.property &&
          !tag &&
          (!!card.sideHustle || !!card.loan || (card.cashflowMinor ?? 0) > 0 || !!card.dice)
        );
      return true;
    });
    if (sells) copies += h.copies;
  }
  return copies;
}

describe('selling what the Opportunity cards made (JFK, 2026-11-05)', () => {
  it('every kind of holding has a buyer or a window on a fair share of the Harvest cards', () => {
    // 145 physical cards; a property or a business used to have a buyer on 3 of 103
    const total = ALL.reduce((sum, c) => sum + c.copies, 0);
    const exempt = new Set(['S07', 'S08', 'S09', 'S35', 'P01', 'P28']); // savings and a pay rise are not sold
    const rows = TUNED.filter(
      (card) => card.growType === 'income-growth' && !card.trap && !exempt.has(card.id),
    ).map((card) => ({ id: card.id, copies: sellCopies(card.id) }));
    const thin = rows.filter((row) => row.copies < 5);
    expect(thin).toEqual([]);
    // the middle holding sees a chance on about one draw in ten
    const sorted = [...rows].sort((a, b) => a.copies - b.copies);
    expect(sorted[Math.floor(sorted.length / 2)].copies).toBeGreaterThanOrEqual(total * 0.06);
  });

  it('a property or a business has far more buyers than before', () => {
    expect(sellCopies('T01')).toBeGreaterThanOrEqual(9);
    expect(sellCopies('P20')).toBeGreaterThanOrEqual(12);
    expect(sellCopies('S29')).toBeGreaterThanOrEqual(8);
  });

  it('a buyer of a business pays at least a share of what was paid, and a die moves it', () => {
    const books = buy(start(), 'P20');
    const paid = books.state.holdings![0].paidMinor!;
    const { result } = play(books, 'H95', () => 0.5);
    const sale = result.pending.sales[0];
    expect(sale.grossMinor).toBeGreaterThanOrEqual(Math.round(paid * 0.6));
    expect(sale.label).toContain('×1');
    const lucky = play(books, 'H95', () => 0.99).result.pending.sales[0];
    expect(lucky.grossMinor).toBeGreaterThan(sale.grossMinor);
    const unlucky = play(books, 'H95', () => 0).result.pending.sales[0];
    expect(unlucky.grossMinor).toBeLessThan(sale.grossMinor);
  });

  it('a block trade pays a little above the screen price, as a die says', () => {
    const books = buy(start(), 'S10', { units: 4 });
    const price = unitPriceNow(opportunity('S10'), books.state.holdings![0], books.state);
    const { result } = play(books, 'H104', () => 0.99);
    expect(result.pending.sales[0].grossMinor).toBe(Math.round(price * 4 * 1.2));
    const small = play(books, 'H104', () => 0).result.pending.sales[0];
    expect(small.grossMinor).toBe(Math.round(price * 4 * 1.01));
  });

  it('a Harvest offer stays open for the turns the table allows, across a Payday, then it is off', () => {
    const books = buy(start(), 'S10', { units: 4 });
    const { books: after } = play(books, 'H107', () => 0.5);
    const offer = after.state.marketOffers!.find((entry) => entry.title === 'WORLD')!;
    expect(offer.validRolls).toBe(2);
    const at = offer.offeredAtRoll ?? 0;
    expect(offerIsOpen({ turn: { count: at } } as never, offer)).toBe(true);
    expect(offerIsOpen({ turn: { count: at + 1 } } as never, offer)).toBe(true);
    expect(offerIsOpen({ turn: { count: at + 2 } } as never, offer)).toBe(false);
  });

  it('a scam that is found out falls to a fraction and can still be sold - once', () => {
    const books = buy(start(), 'S17', { units: 10 });
    const before = unitPriceNow(opportunity('S17'), books.state.holdings![0], books.state);
    const { books: after, result } = play(books, 'H111');
    expect(after.state.holdings![0].priceFactor).toBe(0.2);
    expect(unitPriceNow(opportunity('S17'), after.state.holdings![0], after.state)).toBe(
      Math.round(before * 0.2),
    );
    expect(result.pending.window).toEqual(['LITHX']);
    const offer = after.state.marketOffers!.find((entry) => entry.title === 'LITHX')!;
    expect(offer.pricePerShareMinor).toBe(Math.round(before * 0.2));
    // and then the market closes it
    const { books: closed } = play(after, 'H78');
    expect(closed.state.holdings![0].ended).toBe(true);
  });

  it('a claims buyer pays cents on the euro for a lending scam', () => {
    const books = buy(start(), 'S21');
    const { result } = play(books, 'H114', () => 0);
    const sale = result.pending.sales[0];
    expect(sale.grossMinor).toBe(Math.round(books.state.holdings![0].paidMinor! * 0.15));
  });
});

describe('the tax on the profit of a sale (JFK, 2026-11-06)', () => {
  it('is a share of the profit only: nothing on a loss, nothing when it is off', () => {
    expect(taxOnSale(12000, 10000, 26.375)).toBe(528); // 2,000 profit
    expect(taxOnSale(9000, 10000, 26.375)).toBe(0);
    expect(taxOnSale(12000, 10000, 0)).toBe(0);
    expect(taxOnSale(12000, 10000, undefined)).toBe(0);
  });

  const holdWorld = () => {
    const books = buy(start(), 'S10', { units: 4 });
    return play(books, 'H05').books; // the world index rises: a profit
  };

  it('comes off the proceeds of a sale and is told in the notes of the project', () => {
    const books = holdWorld();
    const held = books.state.holdings![0];
    const price = unitPriceNow(opportunity('S10'), held, books.state) * 4;
    const sale = { grossMinor: price, costsMinor: 0, owedMinor: 0 };
    const free = sellHolding(books, 'WORLD', sale, { ...harvestContext, rng: seededRng(1) });
    const taxed = sellHolding(books, 'WORLD', sale, {
      ...harvestContext,
      rng: seededRng(1),
      taxPercent: 25,
    });
    const profit = price - held.paidMinor!;
    expect(profit).toBeGreaterThan(0);
    expect(free.appendedTransactions[0].amountMinor).toBe(price);
    expect(taxed.appendedTransactions[0].amountMinor).toBe(price - Math.round(profit * 0.25));
    const notes = taxed.growUpdates.flatMap((update) => update.notes ?? []).map((n) => n.text);
    expect(notes.some((text) => text.includes('Tax on the profit (25%)'))).toBe(true);
  });

  it('is worked out on the units sold only, and the rest keeps its share of what was paid', () => {
    const books = holdWorld();
    const held = books.state.holdings![0];
    const unit = unitPriceNow(opportunity('S10'), held, books.state);
    const effects = sellHolding(
      books,
      'WORLD',
      { grossMinor: unit * 3, costsMinor: 0, owedMinor: 0, units: 3 },
      { ...harvestContext, rng: seededRng(1), taxPercent: 25 },
    );
    const profit = unit * 3 - Math.round((held.paidMinor! * 3) / 4);
    expect(effects.appendedTransactions[0].amountMinor).toBe(unit * 3 - Math.round(profit * 0.25));
    expect(effects.state.holdings![0].paidMinor).toBe(Math.round(held.paidMinor! / 4));
  });
});
