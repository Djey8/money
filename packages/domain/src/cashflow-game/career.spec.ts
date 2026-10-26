import { DUAL_STUDENT_CAREER } from '../cashflow-career-dual-student';
import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import {
  applyCareerMoment,
  applyCareerStage,
  findStage,
  initialCareer,
  momentOf,
  rollCareer,
  tickCareer,
  type CareerState,
} from './career';
import type { BookSubscription } from './effects';
import { pickCashflowProfession } from './engine';
import { monthlyExpensesMinor, netMonthlyMinor, type LifeBooks } from './life-books';

const track = DUAL_STUDENT_CAREER;
const fixed = (value: number) => () => (value - 0.5) / 6; // a die that always shows `value`

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

/** Applies the effects of a promotion to the books, like the app. */
function promote(books: LifeBooks, id: string): LifeBooks {
  const effects = applyCareerStage(books, findStage(track, id)!, {
    date: '2026-12-15',
    lang: 'en',
  });
  const upserted = new Set(effects.subscriptionUpserts.map((sub) => sub.title));
  return {
    state: effects.state,
    subscriptions: [
      ...books.subscriptions.filter((sub) => !upserted.has(sub.title)),
      ...effects.subscriptionUpserts,
    ],
  };
}

const cashflow = (books: LifeBooks) =>
  books.subscriptions
    .filter((sub) => books.state.gameSubscriptionTitles.includes(sub.title))
    .reduce((sum, sub) => sum + sub.amountMinor, 0);

describe('the career of the Dual Student (temp_cards v0.2)', () => {
  it('has nine stages with both languages, a technical and a management branch', () => {
    expect(track.stages).toHaveLength(9);
    for (const stage of track.stages)
      expect(stage.title.en && stage.title.de && stage.story.en && stage.story.de).toBeTruthy();
    expect(findStage(track, 'C4')!.next!.stages).toEqual(['C5T', 'C5M']);
    expect(findStage(track, 'C6T')!.next).toBeNull();
    expect(findStage(track, 'C7M')!.companyCar).toBe(true);
  });

  it('starts as a dual student, at the first stage of the ladder', () => {
    const books = start();
    expect(books.state.career).toEqual({ stage: 'C1', paydaysInStage: 0 });
  });

  it('too early: nothing happens, the tile tells how long it is', () => {
    const career: CareerState = { stage: 'C1', paydaysInStage: 1 };
    expect(rollCareer(career, track, fixed(6))).toEqual({ kind: 'waiting', paydaysLeft: 2 });
  });

  it('on time a die decides: 4 or more promotes the student, a 1 or 2 retakes the exam for a fee, a 3 does nothing', () => {
    const career: CareerState = { stage: 'C1', paydaysInStage: 3 };
    expect(rollCareer(career, track, fixed(4))).toMatchObject({ kind: 'promoted', to: 'C2' });
    expect(rollCareer(career, track, fixed(3))).toEqual({ kind: 'failed', roll: 3 });
    expect(rollCareer(career, track, fixed(2))).toMatchObject({
      kind: 'failed',
      retakeMinor: -15000,
    });
  });

  it('the senior chooses a branch; a 5 on a 6 is a career moment; the top asks for nothing', () => {
    expect(rollCareer({ stage: 'C4', paydaysInStage: 5 }, track, fixed(6))).toMatchObject({
      kind: 'branch',
      options: ['C5T', 'C5M'],
    });
    const moment = rollCareer({ stage: 'C5T', paydaysInStage: 6 }, track, fixed(5));
    expect(moment.kind).toBe('moment');
    expect(rollCareer({ stage: 'C5T', paydaysInStage: 6 }, track, fixed(4))).toMatchObject({
      kind: 'failed',
    });
    expect(rollCareer({ stage: 'C6T', paydaysInStage: 99 }, track, fixed(6))).toEqual({
      kind: 'top',
    });
    expect(momentOf(1)).toBe('spotBonus');
    expect(momentOf(4)).toBe('meritRaise');
    expect(momentOf(6)).toBe('training');
  });

  it('the head of data needs a second roll to become director', () => {
    const career: CareerState = { stage: 'C6M', paydaysInStage: 8 };
    // a 6, then a 2: not confirmed
    const rolls = [6, 2];
    let i = 0;
    const rng = () => (rolls[i++] - 0.5) / 6;
    expect(rollCareer(career, track, rng)).toMatchObject({ kind: 'failed', confirmRoll: 2 });
  });

  it('the training moment makes the next roll succeed on a 5', () => {
    const career: CareerState = { stage: 'C5T', paydaysInStage: 6, boost: true };
    expect(rollCareer(career, track, fixed(5))).toMatchObject({ kind: 'promoted', to: 'C6T' });
  });

  it('a promotion raises the salary and the taxes, the lifestyle and the living standard - and the cash flow', () => {
    const before = start();
    const after = promote(before, 'C2');
    expect(after.state.livingStandard).toBe(1.1);
    expect(after.state.career).toMatchObject({ stage: 'C2', paydaysInStage: 0 });
    expect(netMonthlyMinor(after.state, after.subscriptions)).toBeGreaterThan(
      netMonthlyMinor(before.state, before.subscriptions),
    );
    expect(monthlyExpensesMinor(after.state, after.subscriptions)).toBeGreaterThan(
      monthlyExpensesMinor(before.state, before.subscriptions),
    );
    // every promotion increases the monthly cash flow
    expect(cashflow(after)).toBeGreaterThan(cashflow(before));
    const salary = after.subscriptions.find(
      (sub) => sub.title === after.state.gameSubscriptionTitles[0],
    )!;
    expect(salary.amountMinor).toBe(Math.round(5600000 / 12));
  });

  it('each stage up the ladder keeps raising the cash flow', () => {
    let books = start();
    let last = cashflow(books);
    for (const id of ['C2', 'C3', 'C4', 'C5T', 'C6T']) {
      books = promote(books, id);
      expect(cashflow(books)).toBeGreaterThan(last);
      last = cashflow(books);
    }
    let management = promote(promote(promote(start(), 'C2'), 'C3'), 'C4');
    for (const id of ['C5M', 'C6M', 'C7M']) management = promote(management, id);
    expect(management.state.life!.car).toBe(true);
    expect(management.state.possessions).toContain('car');
    expect(cashflow(management)).toBeGreaterThan(last);
  });

  it('a bonus comes every twelve Paydays', () => {
    let state = promote(promote(promote(start(), 'C2'), 'C3'), 'C4').state;
    let bonuses = 0;
    for (let payday = 0; payday < 24; payday += 1) {
      const tick = tickCareer(state, { date: '2027-01-15', lang: 'en' })!;
      state = tick.state;
      if (tick.bonus) bonuses += 1;
    }
    expect(bonuses).toBe(2);
    expect(state.career!.paydaysInStage).toBe(24);
  });

  it('the moments: a spot bonus pays, a merit raise lifts the salary, training boosts the next roll', () => {
    const books = start();
    const net = netMonthlyMinor(books.state, books.subscriptions);
    const bonus = applyCareerMoment(books, 'spotBonus', { date: '2026-12-15', lang: 'en' });
    expect(bonus.appendedTransactions[0].amountMinor).toBe(Math.round(net * 0.1));
    const raise = applyCareerMoment(books, 'meritRaise', { date: '2026-12-15', lang: 'en' });
    expect(raise.subscriptionUpserts[0].amountMinor).toBe(
      books.subscriptions[0].amountMinor + Math.round(net * 0.02),
    );
    const training = applyCareerMoment(books, 'training', { date: '2026-12-15', lang: 'en' });
    expect(training.state.career!.boost).toBe(true);
    expect(initialCareer(track).stage).toBe('C1');
  });
});
