import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { fixedClock } from './clock';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { identityText, type GameText } from './game-text';
import {
  MARKET_NOTE_MARK,
  placeOneOffTransactions,
  playBaby,
  playCharity,
  playDownsized,
  playPayday,
  previewSpace,
  professionTitleText,
  upsertBookSubscription,
  type RoundBooks,
  type RoundDeps,
} from './rounds';

/** Freezes a value all the way down, so any mutation by the code under test throws. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

const TODAY = '2026-10-15'; // 31 days
const deps: RoundDeps = { clock: fixedClock(TODAY), text: identityText };

const placeholderSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!;
const profession = placeholderSet.professions[0];

/** A freshly started placeholder game: its salary and expense subscriptions, dated like the app dates them. */
function startedBooks(extra: Partial<RoundBooks> = {}): RoundBooks {
  const picked = pickCashflowProfession(CASHFLOW_GAME_SETS, 'placeholder', profession.id, TODAY);
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
  return { state: picked.state, subscriptions, transactions: [], ...extra };
}

const salary = (books: RoundBooks) => books.subscriptions[0];

describe('playPayday', () => {
  it('posts one transaction per game subscription, each on its own subscription’s day this month', () => {
    const books = startedBooks();
    const effects = playPayday(deepFreeze(books), deps);

    expect(effects.appendedTransactions).toHaveLength(2);
    expect(effects.appendedTransactions[0]).toMatchObject({
      account: 'Income',
      amountMinor: salary(books).amountMinor,
      date: '2026-10-01',
    });
    expect(effects.appendedTransactions[1]).toMatchObject({ account: 'Daily', date: '2026-10-03' });
    expect(effects.appendedTransactions.every((t) => t.comment.includes('#cashflow'))).toBe(true);
  });

  it('advances the round and the game calendar, and names the step', () => {
    const effects = playPayday(startedBooks(), deps);
    expect(effects.state.round).toBe(1);
    expect(effects.state.virtualDate).toBe('2026-11-15'); // the game calendar started on TODAY
    expect(effects.step).toEqual({ kind: 'payday', detail: 'CashflowGame.Round 1' });
  });

  it('writes the History entry with the dates actually used', () => {
    const effects = playPayday(startedBooks(), deps);
    const entry = effects.state.history[effects.state.history.length - 1];
    expect(entry.createdTransactions).toEqual(effects.appendedTransactions);
  });

  it('ages game transactions back a month - by position - and leaves plain ones alone', () => {
    const effects = playPayday(
      startedBooks({
        transactions: [
          { date: '2026-10-31', comment: 'Salary\n#cashflow' },
          { date: '2026-10-05', comment: 'Groceries' },
          { date: '2026-09-15', comment: 'Buy Share OK4U 250 x 10;' },
        ],
      }),
      deps,
    );
    expect(effects.transactionDates).toEqual([
      { index: 0, date: '2026-09-30' },
      { index: 2, date: '2026-08-15' },
    ]);
  });

  it('only acts on the subscriptions the game owns', () => {
    const books = startedBooks();
    books.subscriptions.push({
      ...salary(books),
      title: 'Someone else’s Netflix',
      amountMinor: -999,
    });
    expect(playPayday(books, deps).appendedTransactions).toHaveLength(2);
  });

  it('clears market offers and exactly their notes, and asks for the Grow write', () => {
    const books = startedBooks({
      growNotes: [
        {
          title: 'EFH',
          notes: [
            { text: `${MARKET_NOTE_MARK}A buyer offers 80.000`, createdAt: 'a' },
            { text: 'my own note', createdAt: 'b' },
          ],
        },
        { title: 'OK4U', notes: [{ text: 'untouched', createdAt: 'c' }] },
      ],
    });
    books.state = {
      ...books.state,
      marketOffers: [{ title: 'EFH', salePriceMinor: 8000000, cardId: 'm1', label: '+10%' }],
    };

    const effects = playPayday(deepFreeze(books), deps);

    expect(effects.state.marketOffers).toEqual([]);
    expect(effects.growUpdates).toEqual([
      { title: 'EFH', notes: [{ text: 'my own note', createdAt: 'b' }] },
    ]);
    expect(effects.persist.grow).toBe(true);
  });

  it('does not touch Grow when there were no offers', () => {
    const effects = playPayday(startedBooks(), deps);
    expect(effects.growUpdates).toEqual([]);
    expect(effects.persist).toEqual({ subscriptions: false, grow: false, balanceSheet: false });
  });

  it('puts a roll on every kept Multi-Level-Marketing card and flags the decision', () => {
    const books = startedBooks();
    books.state = {
      ...books.state,
      assetDeals: [
        { title: 'MLM', coins: 0, costMinor: 1000, stage: 'owned', recurring: true },
        { title: 'GOLD', coins: 5, costMinor: 5000, stage: 'owned' },
      ],
    };
    const effects = playPayday(deepFreeze(books), deps);
    expect(effects.state.assetDeals?.map((d) => [d.title, d.rollDue])).toEqual([
      ['MLM', true],
      ['GOLD', undefined],
    ]);
    expect(effects.decisionNeeded).toBe(true);
  });

  it('refuses before a profession has been picked', () => {
    const books = startedBooks();
    books.state = { ...books.state, virtualDate: null };
    expect(() => playPayday(books, deps)).toThrow('Pick a profession');
  });
});

describe('playBaby', () => {
  it('adds a child and a new children-expense subscription on a free day, tagged for the game', () => {
    const books = startedBooks();
    const effects = playBaby(deepFreeze(books), profession, deps);

    expect(effects.state.children).toBe(1);
    const [sub] = effects.subscriptionUpserts;
    expect(sub).toMatchObject({
      title: 'CashflowGame.childrenExpensesSubscriptionTitle',
      account: 'Daily',
      amountMinor: -profession.perChildExpenseMinor,
      category: '@CashflowGame.childrenExpenses',
      comment: '#cashflow',
    });
    // 1st and 3rd are the profession's own days; the next free slot is the 5th.
    expect(sub.startDate).toBe('2026-10-05');
    expect(effects.state.gameSubscriptionTitles).toContain(sub.title);
    expect(effects.persist.subscriptions).toBe(true);
    expect(effects.step).toEqual({ kind: 'baby' });
  });

  it('a second child scales the same subscription - no duplicate title, same date', () => {
    const first = playBaby(startedBooks(), profession, deps);
    const books = startedBooks();
    books.state = first.state;
    books.subscriptions.push(first.subscriptionUpserts[0]);

    const second = playBaby(deepFreeze(books), profession, deps);

    expect(second.state.children).toBe(2);
    expect(second.subscriptionUpserts[0].amountMinor).toBe(-2 * profession.perChildExpenseMinor);
    expect(second.subscriptionUpserts[0].startDate).toBe(first.subscriptionUpserts[0].startDate);
    const title = first.subscriptionUpserts[0].title;
    expect(second.state.gameSubscriptionTitles.filter((t) => t === title)).toHaveLength(1);
  });

  it('writes the title and category in the game’s language', () => {
    const german: GameText = (key, params) =>
      key === 'CashflowGame.childrenExpensesSubscriptionTitle'
        ? `${params?.profession} Kinderausgaben`
        : key === 'CashflowGame.childrenExpenses'
          ? 'Kinderausgaben'
          : key;
    const effects = playBaby(startedBooks(), profession, { ...deps, text: german });
    expect(effects.subscriptionUpserts[0]).toMatchObject({
      title: `${profession.title} Kinderausgaben`,
      category: '@Kinderausgaben',
    });
  });

  it('refuses a fourth child', () => {
    const books = startedBooks();
    books.state = { ...books.state, children: 3 };
    expect(() => playBaby(books, profession, deps)).toThrow('maximum of 3 children');
  });
});

describe('playCharity', () => {
  it('pays 10% of the monthly income on the next free day and opens the dice choice for 3 turns', () => {
    const books = startedBooks();
    const effects = playCharity(deepFreeze(books), deps);

    expect(effects.appendedTransactions).toHaveLength(1);
    expect(effects.appendedTransactions[0]).toMatchObject({
      account: 'Daily',
      amountMinor: -Math.round(salary(books).amountMinor * 0.1),
      category: '@Charity',
      date: '2026-10-05', // the 1st and 3rd are taken by the game's own subscriptions
    });
    expect(effects.state.charityRoundsLeft).toBe(3);
    expect(effects.step).toEqual({ kind: 'charity' });
  });
});

describe('playDownsized', () => {
  it('pays every expense once, no income, and shows the sitting-out reminder', () => {
    const effects = playDownsized(deepFreeze(startedBooks()), deps);

    expect(effects.appendedTransactions.map((t) => t.account)).toEqual(['Daily']);
    expect(effects.appendedTransactions[0].amountMinor).toBeLessThan(0);
    expect(effects.state.unemployedRoundsLeft).toBe(2);
    expect(effects.step).toEqual({ kind: 'downsized' });
  });

  it('ends an active charity bonus', () => {
    const books = startedBooks();
    books.state = { ...books.state, charityRoundsLeft: 3 };
    expect(playDownsized(books, deps).state.charityRoundsLeft).toBe(0);
  });
});

describe('placeOneOffTransactions', () => {
  const record = (amountMinor: number) => ({
    account: 'Daily',
    amountMinor,
    date: 'game-calendar',
    time: '',
    category: '',
    comment: '#cashflow',
  });

  it('gives consecutive records different free days, skipping the ones this month already uses', () => {
    const books = startedBooks({ transactions: [{ date: '2026-10-05' }] });
    const placed = placeOneOffTransactions([record(1), record(2)], books, TODAY);
    expect(placed.map((r) => r.date)).toEqual(['2026-10-07', '2026-10-09']);
  });

  it('uses a fixed date when given one', () => {
    const placed = placeOneOffTransactions(
      [record(1), record(2)],
      startedBooks(),
      TODAY,
      '2026-10-02',
    );
    expect(placed.map((r) => r.date)).toEqual(['2026-10-02', '2026-10-02']);
  });
});

describe('upsertBookSubscription', () => {
  const upsert = {
    title: 'Bank loan interest',
    account: 'Daily',
    amountMinor: -10000,
    frequency: 'monthly' as const,
    category: '@Bank loan',
  };

  it('creates a dated, tagged subscription when none exists', () => {
    expect(upsertBookSubscription([], upsert, TODAY)).toEqual({
      title: 'Bank loan interest',
      account: 'Daily',
      amountMinor: -10000,
      startDate: '2026-10-01',
      endDate: '',
      category: '@Bank loan',
      comment: '#cashflow',
      frequency: 'monthly',
    });
  });

  it('updates an existing one in place: keeps its date, takes the new amount, adds the tag if missing', () => {
    const existing: BookSubscription = {
      title: 'Bank loan interest',
      account: 'Splurge',
      amountMinor: -5000,
      startDate: '2026-09-17',
      endDate: '',
      category: '@Mine',
      comment: 'my note',
      frequency: 'weekly',
    };
    expect(upsertBookSubscription([existing], { ...upsert, category: undefined }, TODAY)).toEqual({
      ...existing,
      account: 'Daily',
      amountMinor: -10000,
      frequency: 'monthly',
      category: '@Mine',
      comment: 'my note\n#cashflow',
    });
  });
});

describe('previewSpace', () => {
  it('previews charity and downsized without applying anything', () => {
    const books = deepFreeze(startedBooks());
    expect(previewSpace(books, 'charity', profession, identityText)).toEqual({
      amountMinor: Math.round(salary(books).amountMinor * 0.1),
    });
    expect(previewSpace(books, 'downsized', profession, identityText)).toEqual({
      amountMinor: Math.abs(books.subscriptions[1].amountMinor),
    });
  });

  it('previews a baby as the added monthly expense and the new child count, null at 3 children', () => {
    const books = startedBooks();
    expect(previewSpace(books, 'baby', profession, identityText)).toEqual({
      amountMinor: profession.perChildExpenseMinor,
      children: 1,
    });
    books.state = { ...books.state, children: 3 };
    expect(previewSpace(books, 'baby', profession, identityText)).toBeNull();
  });

  it('is null for a baby without a profession, and for a game that has not started', () => {
    expect(previewSpace(startedBooks(), 'baby', undefined, identityText)).toBeNull();
    const books = startedBooks();
    books.state = { ...books.state, virtualDate: null };
    expect(previewSpace(books, 'charity', profession, identityText)).toBeNull();
  });
});

describe('professionTitleText', () => {
  it('uses the translation, or the card’s own title when there is none', () => {
    const translated: GameText = (key) =>
      key === `CashflowGame.profession.${profession.id}.title` ? 'Übersetzt' : key;
    expect(professionTitleText(translated, profession)).toBe('Übersetzt');
    expect(professionTitleText(identityText, profession)).toBe(profession.title);
  });
});
