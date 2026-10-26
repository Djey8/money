import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { OPPORTUNITY_CARDS } from '../cashflow-opportunity-cards';
import { applyEffectsToBooks, type GameBooks } from './books';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import {
  DEFAULT_OPPORTUNITY_SETTINGS,
  buyOpportunity,
  canOffer,
  drawOpportunityOffers,
  quoteOpportunity,
  tickOpportunities,
  type OpportunityContext,
} from './opportunity';
import { seededRng } from './rng';

const card = (id: string) => OPPORTUNITY_CARDS.find((c) => c.id === id)!;

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
    state: result.state,
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

const context = (
  books: GameBooks,
  extra: Partial<OpportunityContext> = {},
): OpportunityContext => ({
  life: books.state.life,
  careerStage: 1,
  holdings: books.state.holdings ?? [],
  debtMinor: 300000,
  ...extra,
});

const options = (books: GameBooks) => ({
  date: '2026-11-15',
  lang: 'en' as const,
  context: context(books),
  cards: OPPORTUNITY_CARDS,
});

describe('the Opportunity stack', () => {
  it('has the 98 cards of the three piles, and every card reads in both languages', () => {
    expect(OPPORTUNITY_CARDS).toHaveLength(98);
    expect(OPPORTUNITY_CARDS.filter((c) => c.pile === 'seed')).toHaveLength(36);
    expect(OPPORTUNITY_CARDS.filter((c) => c.pile === 'sapling')).toHaveLength(32);
    expect(OPPORTUNITY_CARDS.filter((c) => c.pile === 'tree')).toHaveLength(30);
    for (const c of OPPORTUNITY_CARDS) {
      expect(c.title.en && c.title.de && c.story.en && c.story.de).toBeTruthy();
    }
  });

  it('a pile offers a card of its own that can happen to the player, and each card once before the pile is shuffled again', () => {
    const books = start();
    let deck;
    const seen = new Set<string>();
    const rng = seededRng(3);
    for (let i = 0; i < 20; i += 1) {
      const draw = drawOpportunityOffers(
        OPPORTUNITY_CARDS,
        deck,
        'sapling',
        DEFAULT_OPPORTUNITY_SETTINGS,
        context(books, { debtMinor: 0 }),
        rng,
      );
      deck = draw.deck;
      expect(draw.offers).toHaveLength(1);
      expect(draw.offers[0].pile).toBe('sapling');
      // needs the career or a flat of one's own: never offered while it cannot happen
      expect(['P18', 'P28']).not.toContain(draw.offers[0].id);
      seen.add(draw.offers[0].id);
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('cards that ask for a stage, a flat or a debt are offered only when it is there', () => {
    const books = start();
    expect(canOffer(card('P18'), context(books, { careerStage: 2 }), OPPORTUNITY_CARDS)).toBe(
      false,
    );
    expect(canOffer(card('P18'), context(books, { careerStage: 3 }), OPPORTUNITY_CARDS)).toBe(true);
    expect(canOffer(card('P28'), context(books, { debtMinor: 50000 }), OPPORTUNITY_CARDS)).toBe(
      false,
    );
    expect(canOffer(card('T29'), context(books), OPPORTUNITY_CARDS)).toBe(false);
  });

  it('up to three offers per landing, never the same card twice', () => {
    const books = start();
    const draw = drawOpportunityOffers(
      OPPORTUNITY_CARDS,
      undefined,
      'seed',
      { ...DEFAULT_OPPORTUNITY_SETTINGS, offersPerLanding: 3 },
      context(books),
      seededRng(9),
    );
    expect(new Set(draw.offers.map((o) => o.id)).size).toBe(3);
  });

  it('shares are bought in units up to the maximum: the cost is units times price, and the Grow project, position and dividend follow', () => {
    const books = start();
    const etf = card('S10');
    expect(
      quoteOpportunity(
        etf,
        { units: 3 },
        context(books),
        DEFAULT_OPPORTUNITY_SETTINGS,
        OPPORTUNITY_CARDS,
      ),
    ).toMatchObject({
      ok: true,
      costMinor: 30000,
    });
    expect(
      quoteOpportunity(
        etf,
        { units: 21 },
        context(books),
        DEFAULT_OPPORTUNITY_SETTINGS,
        OPPORTUNITY_CARDS,
      ).ok,
    ).toBe(false);
    const bought = buyOpportunity(books, etf, { units: 3 }, {}, options(books));
    expect(bought.effects.shareUpserts).toEqual([{ tag: 'WORLD', quantity: 3, priceMinor: 10000 }]);
    const project = bought.effects.growUpdates.find((u) => u.title === 'WORLD')!;
    expect(project).toMatchObject({ create: true, phase: 'execute', amountMinor: 30000 });
    expect(project.details?.links?.length).toBeGreaterThan(0);
    // 3 units x 0.15 TT a month
    expect(bought.effects.subscriptionUpserts[0]).toMatchObject({
      title: 'WORLD Cashflow',
      amountMinor: 45,
    });
    expect(bought.effects.state.holdings).toHaveLength(1);
    // buying again adds units to the same project
    const after = applyEffectsToBooks(books, bought.effects);
    const more = buyOpportunity(after, etf, { units: 2 }, {}, options(after));
    expect(more.effects.shareUpserts[0].quantity).toBe(5);
  });

  it('a savings card takes its saving off the matching expense line and keeps counting what it has saved', () => {
    const books = start();
    const before = books.subscriptions.find(
      (s) => s.title === books.state.lineTitles?.['utilities'],
    )!;
    const bought = buyOpportunity(books, card('S02'), {}, {}, options(books));
    const line = bought.effects.subscriptionUpserts.find((s) => s.title === before.title)!;
    expect(line.amountMinor).toBe(before.amountMinor + 700);
    expect(bought.holding).toMatchObject({ monthlySavingsMinor: 700, savedFrom: before.title });
    const project = bought.effects.growUpdates[0];
    expect(project.details).toMatchObject({ monthlySavingsMinor: 700, annualSavingsMinor: 8400 });
    // every Payday adds to the total
    const after = applyEffectsToBooks(books, bought.effects);
    const tick = tickOpportunities(
      { state: after.state, subscriptions: after.subscriptions, growProjects: after.growProjects },
      OPPORTUNITY_CARDS,
      { date: '2026-12-15', lang: 'en' },
    )!;
    expect(tick.effects.state.holdings![0].savedMinor).toBe(700);
    const note = tick.effects.growUpdates.at(-1)!.notes!.at(-1)!.text;
    expect(note).toContain('Total saved so far: 7');
  });

  it('a die decides the saving of the subscription audit', () => {
    const books = start();
    const bought = buyOpportunity(books, card('S01'), {}, { outcome: 6 }, options(books));
    expect(bought.holding.monthlySavingsMinor).toBe(5000);
    expect(bought.told[0]).toContain('Roll 6');
  });

  it('a property: the deposit and side costs are paid, the mortgage becomes a liability, the net cash flow a monthly line', () => {
    const books = start();
    const flat = card('T01');
    const bought = buyOpportunity(books, flat, {}, {}, options(books));
    expect(bought.effects.liabilityUpserts[0]).toMatchObject({
      amountMinor: 2880000,
      investment: true,
    });
    expect(bought.effects.investmentUpserts[0]).toMatchObject({
      depositMinor: 1098000,
      amountMinor: 2880000,
    });
    expect(bought.effects.subscriptionUpserts[0].amountMinor).toBe(-400);
    // the limit of two side hustles: a third needs one to go
    const hustle = card('S30');
    let owned = books;
    for (const id of ['S28', 'S32']) {
      owned = applyEffectsToBooks(
        owned,
        buyOpportunity(owned, card(id), {}, { outcome: 3 }, options(owned)).effects,
      );
    }
    const quote = quoteOpportunity(
      hustle,
      {},
      context(owned),
      DEFAULT_OPPORTUNITY_SETTINGS,
      OPPORTUNITY_CARDS,
    );
    expect(quote).toMatchObject({ ok: false, reason: 'sideHustleFull', needsSwap: true });
    const swapped = buyOpportunity(
      owned,
      hustle,
      { swapOut: 'S28' },
      { outcome: 3 },
      options(owned),
    );
    expect(swapped.effects.subscriptionRemovals).toContain('Start a YouTube Channel Cashflow');
  });

  it('a Ponzi scheme pays for its few Paydays and then stops, a locked deposit comes back', () => {
    let books = start();
    books = applyEffectsToBooks(
      books,
      buyOpportunity(books, card('S21'), {}, {}, options(books)).effects,
    );
    const pays = books.subscriptions.find((s) => s.title.endsWith('Cashflow'))!;
    expect(pays.amountMinor).toBe(8000);
    const run = (b: GameBooks) => {
      const tick = tickOpportunities(
        { state: b.state, subscriptions: b.subscriptions, growProjects: b.growProjects },
        OPPORTUNITY_CARDS,
        { date: '2026-12-15', lang: 'en' },
      )!;
      return { books: applyEffectsToBooks(b, tick.effects), news: tick.news };
    };
    const first = run(books);
    expect(first.news).toEqual([]);
    const second = run(first.books);
    expect(second.news[0]).toContain('stopped paying');
    expect(second.books.subscriptions.some((s) => s.title.endsWith('Cashflow'))).toBe(false);

    let deposit = start();
    deposit = applyEffectsToBooks(
      deposit,
      buyOpportunity(deposit, card('S35'), {}, {}, options(deposit)).effects,
    );
    for (let i = 0; i < 11; i += 1) deposit = run(deposit).books;
    const last = run(deposit);
    expect(last.news[0]).toContain('locked money is back');
  });
});
