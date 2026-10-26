import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { LIFE_CARDS } from '../cashflow-life-cards';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { emptyEmergencyDeck } from './emergency-deck';
import {
  applyLifeOutcome,
  endLifeLine,
  lifeContext,
  netMonthlyMinor,
  tickLife,
  type LifeBooks,
} from './life-books';
import {
  drawLifeCard,
  INITIAL_LIFE_STATE,
  meetsRequirement,
  resolveLifeCard,
  type LifeCard,
} from './life-deck';
import { seededRng } from './rng';

const card = (id: string): LifeCard => LIFE_CARDS.find((c) => c.id === id)!;
const byId = (id: string) => LIFE_CARDS.find((c) => c.id === id);

/** A started game of the Dual Student, as the books a life card reads. */
function start(): LifeBooks {
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
  return { state: result.state, subscriptions };
}

/** Plays a decision on a card and puts it in the books, like the app does. */
function play(
  books: LifeBooks,
  id: string,
  decision: Parameters<typeof resolveLifeCard>[1],
  rng = seededRng(5),
): LifeBooks {
  const context = lifeContext(books, 'en', rng);
  const outcome = resolveLifeCard(card(id), decision, context, byId);
  const effects = applyLifeOutcome(books, outcome, { date: '2026-11-15', lang: 'en' });
  const subscriptions = [
    ...books.subscriptions.filter(
      (sub) =>
        !effects.subscriptionRemovals.includes(sub.title) &&
        !effects.subscriptionUpserts.some((up) => up.title === sub.title),
    ),
    ...effects.subscriptionUpserts,
  ];
  return { state: effects.state, subscriptions };
}

const monthly = (books: LifeBooks) =>
  books.subscriptions
    .filter((sub) => books.state.gameSubscriptionTitles.includes(sub.title))
    .reduce((sum, sub) => sum + sub.amountMinor, 0);

describe('the Life stack (temp_cards v0.3)', () => {
  it('has the 27 cards, 36 with the copies, in English and German', () => {
    expect(LIFE_CARDS).toHaveLength(27);
    expect(LIFE_CARDS.reduce((sum, c) => sum + c.copies, 0)).toBe(36);
    for (const c of LIFE_CARDS)
      expect(c.title.en && c.title.de && c.story.en && c.story.de).toBeTruthy();
  });

  it('starts a custom character with a life: single, no car, no pet, employed', () => {
    const books = start();
    expect(books.state.life).toEqual(INITIAL_LIFE_STATE);
    expect(books.state.livingStandard).toBe(1);
    expect(netMonthlyMinor(books.state, books.subscriptions)).toBe(283300 - 84500);
  });

  it('a card that cannot happen is put back and the next one is drawn', () => {
    const rng = seededRng(2);
    let deck = emptyEmergencyDeck();
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const draw = drawLifeCard(LIFE_CARDS, deck, INITIAL_LIFE_STATE, rng);
      expect(meetsRequirement(draw.card.requires, INITIAL_LIFE_STATE)).toBe(true);
      kinds.add(draw.card.id);
      deck = draw.deck;
    }
    // a single player is never broken up with, never proposed to
    expect(kinds.has('L04')).toBe(false);
    expect(kinds.has('L03')).toBe(false);
    expect(kinds.has('L01')).toBe(true);
  });

  it('falling in love: a monthly cost and a partner', () => {
    const before = start();
    const after = play(before, 'L01', { kind: 'fate' });
    expect(after.state.life!.relationship).toBe('partner');
    expect(monthly(after)).toBe(monthly(before) - 6000);
    expect(after.state.gameSubscriptionTitles).toHaveLength(
      before.state.gameSubscriptionTitles.length + 1,
    );
  });

  it('moving in together: a payment now, a saving every month, and a new home', () => {
    const partner = play(start(), 'L01', { kind: 'fate' });
    const after = play(partner, 'L02', { kind: 'accept' });
    expect(after.state.life).toMatchObject({ relationship: 'cohabiting', home: 'with_partner' });
    expect(monthly(after)).toBe(monthly(partner) + 25000);
  });

  it('a break-up depends on how far the relationship had come, and a married couple pays the lawyer', () => {
    let books = play(start(), 'L01', { kind: 'fate' });
    books = play(books, 'L03', { kind: 'accept' });
    expect(books.state.life!.relationship).toBe('married');
    expect(books.state.charityRoundsLeft).toBe(3);
    const apart = play(books, 'L04', { kind: 'fate' });
    expect(apart.state.life).toMatchObject({ relationship: 'single', home: 'own_flat' });
  });

  it('the reward is two dice for some turns, the way Charity gives them', () => {
    const books = play(play(start(), 'L01', { kind: 'fate' }), 'L03', { kind: 'accept' });
    expect(books.state.charityRoundsLeft).toBe(3);
  });

  it('a baby: asked about, then three Paydays later it arrives with its monthly cost and a new child', () => {
    let books = play(play(start(), 'L01', { kind: 'fate' }), 'L02', { kind: 'accept' });
    // find a roll that brings the baby
    let rolled = books;
    for (let seed = 1; seed < 40; seed += 1) {
      const attempt = play(books, 'L05', { kind: 'roll' }, seededRng(seed));
      if ((attempt.state.lifeScheduled ?? []).length > 0) {
        rolled = attempt;
        break;
      }
    }
    expect(rolled.state.lifeScheduled).toHaveLength(1);
    expect(rolled.state.life!.kids).toBe(0);
    books = rolled;
    for (let payday = 0; payday < 3; payday += 1) {
      const tick = tickLife(books, { date: '2026-12-15', lang: 'en', rng: seededRng(9) })!;
      books = {
        state: tick.effects.state,
        subscriptions: [
          ...books.subscriptions.filter(
            (sub) => !tick.effects.subscriptionRemovals.includes(sub.title),
          ),
          ...tick.effects.subscriptionUpserts,
        ],
      };
      if (payday < 2) expect(books.state.life!.kids).toBe(0);
    }
    expect(books.state.life!.kids).toBe(1);
    expect(books.state.lifeScheduled).toHaveLength(0);
    // the child costs money each month, the child benefit and the parental leave are lines of their own
    expect(books.state.lifeLines!.some((line) => line.amountMinor < -50000)).toBe(true);
  });

  it('a child costs more where the living standard is higher', () => {
    const cost = (standard: number) => {
      const books = start();
      const married = {
        ...books,
        state: {
          ...books.state,
          livingStandard: standard,
          life: { ...books.state.life!, relationship: 'partner' as const },
        },
      };
      const context = lifeContext(married, 'en', seededRng(3));
      const outcome = resolveLifeCard(card('L06'), { kind: 'fate' }, context, byId);
      return Math.abs(outcome.lines.find((line) => line.id.endsWith(':child'))!.amountMinor);
    };
    expect(cost(2)).toBeGreaterThan(cost(1) * 1.9);
  });

  it('a move replaces the effects of the last move', () => {
    const first = play(start(), 'L17', { kind: 'accept' });
    expect(first.state.life!.location).toBe('abroad_europe');
    const lines = first.state.lifeLines!.length;
    const second = play(first, 'L16', { kind: 'accept' });
    expect(second.state.life!.location).toBe('other_city');
    // the lines of the Zurich move are gone, the new ones are there
    expect(second.state.lifeLines!.filter((line) => line.cardId === 'L17')).toHaveLength(0);
    expect(second.state.lifeLines!.filter((line) => line.cardId === 'L16').length).toBeGreaterThan(
      0,
    );
    expect(lines).toBeGreaterThan(0);
  });

  it('losing the job cuts the income until a new one is found, or the next offer pays less', () => {
    const before = start();
    const net = netMonthlyMinor(before.state, before.subscriptions);
    let books = play(before, 'L19', { kind: 'fate' });
    expect(books.state.life!.employment).toBe('unemployed');
    expect(monthly(books)).toBe(monthly(before) - Math.round(net * 0.4));
    expect(books.state.jobSearch).toMatchObject({ rollFrom: 6, paydaysLeft: 6 });
    // six Paydays without a six (a rng that never rolls a six): the next offer pays 15% less
    const never = () => 0;
    for (let payday = 0; payday < 6; payday += 1) {
      const tick = tickLife(books, { date: '2026-12-15', lang: 'en', rng: never })!;
      books = {
        state: tick.effects.state,
        subscriptions: [
          ...books.subscriptions.filter(
            (sub) =>
              !tick.effects.subscriptionRemovals.includes(sub.title) &&
              !tick.effects.subscriptionUpserts.some((up) => up.title === sub.title),
          ),
          ...tick.effects.subscriptionUpserts,
        ],
      };
    }
    expect(books.state.life!.employment).toBe('employed');
    expect(books.state.jobSearch).toBeUndefined();
    expect(monthly(books)).toBe(monthly(before) - Math.round(net * 0.15));
  });

  it('a new job is found on a six: the salary is whole again', () => {
    const before = start();
    let books = play(before, 'L19', { kind: 'fate' });
    const always = () => 0.99; // a six
    const tick = tickLife(books, { date: '2026-12-15', lang: 'en', rng: always })!;
    books = {
      state: tick.effects.state,
      subscriptions: books.subscriptions.filter(
        (sub) => !tick.effects.subscriptionRemovals.includes(sub.title),
      ),
    };
    expect(books.state.life!.employment).toBe('employed');
    expect(monthly(books)).toBe(monthly(before));
  });

  it('lifestyle creep can be ended for a small price; a gym contract not before its term', () => {
    const creep = play(start(), 'L21', { kind: 'fate' });
    const line = creep.state.lifeLines![0];
    const ended = endLifeLine(creep, line.id, { date: '2026-12-15', lang: 'en' })!;
    expect(ended.appendedTransactions[0].amountMinor).toBe(-2000);
    expect(ended.state.lifeLines).toHaveLength(0);
    const gym = play(start(), 'L26', { kind: 'accept' });
    expect(
      endLifeLine(gym, gym.state.lifeLines![0].id, { date: '2026-12-15', lang: 'en' }),
    ).toBeNull();
  });

  it('giving 10% costs a tenth of the net income once and gives two dice', () => {
    const before = start();
    const net = netMonthlyMinor(before.state, before.subscriptions);
    const context = lifeContext(before, 'en');
    const outcome = resolveLifeCard(card('L22'), { kind: 'give' }, context, byId);
    expect(outcome.oneTimeMinor).toBe(-Math.round(net / 10));
    expect(outcome.rewardTurns).toBe(3);
  });

  it('a short-time work cut ends by itself after its Paydays', () => {
    let books = play(start(), 'L20', { kind: 'fate' });
    expect(books.state.life!.employment).toBe('short_time');
    for (let payday = 0; payday < 3; payday += 1) {
      const tick = tickLife(books, { date: '2026-12-15', lang: 'en' })!;
      books = {
        state: tick.effects.state,
        subscriptions: books.subscriptions.filter(
          (sub) => !tick.effects.subscriptionRemovals.includes(sub.title),
        ),
      };
    }
    expect(books.state.life!.employment).toBe('employed');
    expect(books.state.lifeLines).toHaveLength(0);
  });
});
