import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { CARD_TEXT_DE } from '../cashflow-card-text-de-data';
import { CAREER_PENSION_CARDS } from '../cashflow-opportunity-enrich';
import { applyEffectsToBooks, type GameBooks } from './books';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { initialMarkets, standingSale, tickWorld } from './harvest';
import { buyOpportunity, monthlyOf, type OpportunityContext } from './opportunity';

const CARDS = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories')!.decks!.opportunity!;
const card = (id: string) => CARDS.find((entry) => entry.id === id)!;

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

const buy = (books: GameBooks, id: string, rolls = {}) =>
  applyEffectsToBooks(
    books,
    buyOpportunity(books, card(id), {}, rolls, {
      date: '2026-11-15',
      lang: 'en',
      context: context(books),
      cards: CARDS,
    }).effects,
  );

const payday = (books: GameBooks, n: number) => {
  const tick = tickWorld(
    { state: books.state, subscriptions: books.subscriptions, growProjects: books.growProjects },
    CARDS,
    { date: `2027-01-${String((n % 28) + 1).padStart(2, '0')}`, lang: 'en' },
  );
  return { books: applyEffectsToBooks(books, tick.effects), effects: tick.effects };
};

describe('pensions and employer benefits (JFK, 2026-11-06)', () => {
  it('brings nine new cards with their own words, in both languages', () => {
    expect(CAREER_PENSION_CARDS.map((entry) => entry.id)).toEqual([
      'S37',
      'S38',
      'S39',
      'S40',
      'P33',
      'P34',
      'P35',
      'T31',
      'T32',
    ]);
    for (const entry of CAREER_PENSION_CARDS) {
      expect(CARDS).toContain(entry);
      expect(entry.links.length).toBeGreaterThanOrEqual(2);
      expect(entry.actions.length).toBeGreaterThanOrEqual(3);
      expect(entry.tip).toMatch(/Do:.*Don’t:/);
      for (const text of [entry.tip!, entry.strategy, entry.risks, entry.category]) {
        expect(CARD_TEXT_DE[text]).toBeTruthy();
      }
    }
  });

  it('a plan you pay into takes the payment every Payday from the Fire account and pays out with the bonus', () => {
    let books = buy(start(), 'S37');
    const holding = books.state.holdings![0];
    expect(holding.contributionLeft).toBe(12);
    const line = books.subscriptions.find((sub) => sub.title === holding.subscription)!;
    expect(line).toMatchObject({ account: 'Fire', amountMinor: -4000 });
    let last = payday(books, 0);
    books = last.books;
    expect(books.state.holdings![0].contributedMinor).toBe(4000);
    for (let n = 1; n < 12; n += 1) {
      last = payday(books, n);
      books = last.books;
    }
    const ended = books.state.holdings![0];
    expect(ended.ended).toBe(true);
    // 12 x 40 paid in, the employer adds half: one payment at the end, and the line is gone
    expect(last.effects.appendedTransactions.at(-1)).toMatchObject({
      account: 'Income',
      amountMinor: 48000 + 24000,
    });
    expect(books.subscriptions.some((sub) => sub.title === holding.subscription)).toBe(false);
  });

  it('stopped early, it gives back what went in, less a tenth, and no bonus', () => {
    let books = buy(start(), 'S38');
    for (let n = 0; n < 3; n += 1) books = payday(books, n).books;
    const held = books.state.holdings![0];
    expect(held.contributedMinor).toBe(24000);
    expect(standingSale(card('S38'), held, books.state)).toMatchObject({
      grossMinor: 21600,
      discountPercent: 10,
    });
  });

  it('a course starts to pay when it is finished, and nobody buys it', () => {
    const books = buy(start(), 'S40', { outcome: 6 });
    const held = books.state.holdings![0];
    expect(held.rampLeft).toBe(3);
    expect(monthlyOf(held)).toBe(0);
    expect(held.cashflowMinor).toBe(15000);
    expect(standingSale(card('S40'), held, books.state)).toBeNull();
  });
});
