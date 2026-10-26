import { emptyEffects, type BookSubscription, type GameEffects } from './effects';
import type { EmergencyLang, Localized } from './emergency-deck';
import {
  DEDUCTION_KEYS,
  monthlyExpensesMinor,
  netMonthlyMinor,
  type LifeBooks,
} from './life-books';
import { rollDie, systemRng, type Rng } from './rng';
import type { CashflowGameState, CashflowTransactionRecord } from './types';

/**
 * The career of a character (JFK, 2026-10-26, temp_cards/dreamfund-career-dual-student.md v0.2): a fixed ladder of stages, each with
 * its salary, taxes, lifestyle and living standard. The Career tile is not a card to draw: it asks whether the next stage is due
 * (enough Paydays in this one) and rolls for the promotion. Every profession has a ladder of its own; only the Dual Student has one yet.
 */

export type CareerBranch = 'technical' | 'management';

export interface CareerNext {
  /** The stage that follows: one, or two to choose between (the branch). */
  stages: string[];
  /** Paydays in the stage before the tile can promote. */
  minPaydays: number;
  /** The roll that promotes: this or higher. */
  rollFrom: number;
  /** A second roll that has to confirm the first (the head of data becomes director). */
  confirmFrom?: number;
  /** A 5 on a "needs a 6" roll is a small career moment. */
  momentOnFive?: boolean;
  /** What a failed roll costs (the thesis exam can be retaken for a fee). */
  onFail?: { upTo: number; oneTimeMinor: number; label: Localized };
}

export interface CareerStage {
  id: string;
  stage: number;
  branch?: CareerBranch;
  title: Localized;
  story: Localized;
  grossYearMinor: number;
  netMonthMinor: number;
  taxMonthMinor: number;
  socialMonthMinor: number;
  /** The lifestyle grows with the salary: this much more is spent every month. */
  expensesDeltaMinor: number;
  oneTimeMinor?: number;
  bonus?: { percent: number; netMinor: number; everyPaydays: number };
  livingStandard: number;
  companyCar?: boolean;
  next: CareerNext | null;
  links: { label: Localized; url: string }[];
}

export interface CareerTrack {
  start: string;
  stages: CareerStage[];
}

/** Where the character stands on the ladder. */
export interface CareerState {
  stage: string;
  paydaysInStage: number;
  /** The next roll promotes on a 5 (a training paid by the company). */
  boost?: boolean;
  bonus?: { netMinor: number; everyPaydays: number };
  sinceBonus?: number;
}

/** The numbers of a character's month, for the comparison a promotion shows. */
export interface CareerSnapshot {
  stage: string;
  salaryMinor: number;
  netMinor: number;
  expensesMinor: number;
  cashflowMinor: number;
}

/** The salary, the net income after taxes, all expenses and what is left, per month. */
export function careerSnapshot(books: LifeBooks): CareerSnapshot {
  const { state, subscriptions } = books;
  const salary = subscriptions.find((sub) => sub.title === state.gameSubscriptionTitles[0]);
  const owned = subscriptions.filter((sub) => state.gameSubscriptionTitles.includes(sub.title));
  return {
    stage: state.career?.stage ?? '',
    salaryMinor: salary?.amountMinor ?? 0,
    netMinor: netMonthlyMinor(state, subscriptions),
    expensesMinor: monthlyExpensesMinor(state, subscriptions),
    cashflowMinor: owned.reduce((sum, sub) => sum + sub.amountMinor, 0),
  };
}

export function findStage(track: CareerTrack, id: string): CareerStage | undefined {
  return track.stages.find((stage) => stage.id === id);
}

export function initialCareer(track: CareerTrack): CareerState {
  return { stage: track.start, paydaysInStage: 0 };
}

/** What landing on the Career tile comes to. */
export type CareerResult =
  | { kind: 'top' }
  | { kind: 'waiting'; paydaysLeft: number }
  | { kind: 'promoted'; to: string; roll: number; confirmRoll?: number }
  /** The next stage is two: the player picks the branch (then it is a promotion). */
  | { kind: 'branch'; options: string[]; roll: number }
  | {
      kind: 'failed';
      roll: number;
      confirmRoll?: number;
      retakeMinor?: number;
      retakeLabel?: Localized;
    }
  | { kind: 'moment'; roll: number; moment: CareerMoment; momentRoll: number };

export type CareerMoment = 'spotBonus' | 'meritRaise' | 'training';

/** The small moments of a near miss: a second die decides. */
export function momentOf(roll: number): CareerMoment {
  return roll <= 2 ? 'spotBonus' : roll <= 4 ? 'meritRaise' : 'training';
}

/**
 * Lands on the Career tile: too early, nothing happens; on time, a die decides. A promotion that needs a 6 and rolls a 5 is a
 * small career moment; the exam of the first stage can be retaken for a fee. Nothing is applied here.
 */
export function rollCareer(
  career: CareerState,
  track: CareerTrack,
  rng: Rng = systemRng,
): CareerResult {
  const stage = findStage(track, career.stage);
  if (!stage?.next) return { kind: 'top' };
  const next = stage.next;
  if (career.paydaysInStage < next.minPaydays) {
    return { kind: 'waiting', paydaysLeft: next.minPaydays - career.paydaysInStage };
  }
  const roll = rollDie(rng);
  const need = career.boost ? Math.min(next.rollFrom, 5) : next.rollFrom;
  if (roll >= need) {
    let confirmRoll: number | undefined;
    if (next.confirmFrom !== undefined) {
      confirmRoll = rollDie(rng);
      if (confirmRoll < next.confirmFrom) return { kind: 'failed', roll, confirmRoll };
    }
    return next.stages.length > 1
      ? { kind: 'branch', options: next.stages, roll }
      : { kind: 'promoted', to: next.stages[0], roll, ...(confirmRoll ? { confirmRoll } : {}) };
  }
  if (next.momentOnFive && roll === 5) {
    const momentRoll = rollDie(rng);
    return { kind: 'moment', roll, moment: momentOf(momentRoll), momentRoll };
  }
  if (next.onFail && roll <= next.onFail.upTo) {
    return {
      kind: 'failed',
      roll,
      retakeMinor: next.onFail.oneTimeMinor,
      retakeLabel: next.onFail.label,
    };
  }
  return { kind: 'failed', roll };
}

function lineTitle(state: Pick<CashflowGameState, 'lineTitles'>, key: string): string | undefined {
  return state.lineTitles?.[key];
}

function payment(
  title: Localized,
  amountMinor: number,
  date: string,
  lang: EmergencyLang,
): CashflowTransactionRecord {
  return {
    account: amountMinor < 0 ? 'Daily' : 'Income',
    amountMinor,
    date,
    time: '',
    category: `@${title[lang]}`,
    comment: `${title[lang]}\n#dreamfund`,
  };
}

/**
 * The character takes a stage: the salary and the tax and social lines are set to the stage's, the lifestyle grows by its delta (a
 * line of its own), the living standard changes (and with it what emergencies and children cost), the bonus is scheduled, a company
 * car is a car. Salary and expense lines keep their subscriptions, only their amounts change.
 */
export function applyCareerStage(
  books: LifeBooks,
  stage: CareerStage,
  options: { date: string; lang: EmergencyLang },
): GameEffects {
  const { state, subscriptions } = books;
  const { date, lang } = options;
  const effects = emptyEffects(state, null);
  const upserts: BookSubscription[] = [];
  const titles = [...state.gameSubscriptionTitles];
  const sub = (title: string | undefined) =>
    subscriptions.find((candidate) => candidate.title === title);
  const set = (title: string | undefined, amountMinor: number) => {
    const found = sub(title);
    if (found && found.amountMinor !== amountMinor) upserts.push({ ...found, amountMinor });
  };

  // the salary: the stage's gross, per month
  set(state.gameSubscriptionTitles[0], Math.round(stage.grossYearMinor / 12));
  // the taxes: the stage's; the social insurances share the stage's total as they shared the old one
  set(lineTitle(state, 'incomeTax'), -stage.taxMonthMinor);
  const social = DEDUCTION_KEYS.filter((key) => key !== 'incomeTax')
    .map((key) => ({ key, title: lineTitle(state, key) }))
    .filter((item) => sub(item.title));
  const socialNow =
    social.reduce((sum, item) => sum + Math.abs(sub(item.title)!.amountMinor), 0) || 1;
  let left = stage.socialMonthMinor;
  social.forEach((item, index) => {
    const share =
      index === social.length - 1
        ? left
        : Math.round((stage.socialMonthMinor * Math.abs(sub(item.title)!.amountMinor)) / socialNow);
    left -= share;
    set(item.title, -share);
  });

  // the lifestyle grows: one line, a little more at every stage
  const lifestyleTitle = `${lang === 'de' ? 'Lebensstil' : 'Lifestyle'} (${stage.id})`;
  if (stage.expensesDeltaMinor) {
    upserts.push({
      title: lifestyleTitle,
      account: 'Daily',
      amountMinor: -stage.expensesDeltaMinor,
      startDate: date,
      endDate: '',
      category: `@${lifestyleTitle}`,
      comment: '#dreamfund',
      frequency: 'monthly',
    });
    titles.push(lifestyleTitle);
  }
  if (stage.oneTimeMinor) {
    effects.appendedTransactions.push(payment(stage.title, stage.oneTimeMinor, date, lang));
  }
  effects.subscriptionUpserts = upserts;
  effects.persist = { ...effects.persist, subscriptions: upserts.length > 0 };
  effects.state = {
    ...state,
    gameSubscriptionTitles: titles,
    livingStandard: stage.livingStandard,
    career: {
      stage: stage.id,
      paydaysInStage: 0,
      ...(stage.bonus
        ? {
            bonus: { netMinor: stage.bonus.netMinor, everyPaydays: stage.bonus.everyPaydays },
            sinceBonus: 0,
          }
        : {}),
    },
    ...(stage.companyCar && state.life
      ? {
          life: { ...state.life, car: true },
          possessions: [...(state.possessions ?? []).filter((p) => p !== 'car'), 'car'],
        }
      : {}),
  };
  return effects;
}

/** The small moments of a near miss. Returns the effects and what was done, to tell. */
export function applyCareerMoment(
  books: LifeBooks,
  moment: CareerMoment,
  options: { date: string; lang: EmergencyLang },
): GameEffects {
  const { state, subscriptions } = books;
  const { date, lang } = options;
  const effects = emptyEffects(state, null);
  const net = netMonthlyMinor(state, subscriptions);
  if (moment === 'spotBonus') {
    effects.appendedTransactions.push(
      payment({ en: 'Spot bonus', de: 'Sonderprämie' }, Math.round(net * 0.1), date, lang),
    );
  } else if (moment === 'meritRaise') {
    const salaryTitle = state.gameSubscriptionTitles[0];
    const salary = subscriptions.find((sub) => sub.title === salaryTitle);
    if (salary) {
      effects.subscriptionUpserts = [
        { ...salary, amountMinor: salary.amountMinor + Math.round(net * 0.02) },
      ];
      effects.persist = { ...effects.persist, subscriptions: true };
    }
  }
  effects.state = {
    ...state,
    ...(moment === 'training' && state.career ? { career: { ...state.career, boost: true } } : {}),
  };
  return effects;
}

/** A Payday in the stage; and the bonus when it is due: a one-time net payment every 12 Paydays. */
export function tickCareer(
  state: CashflowGameState,
  options: { date: string; lang: EmergencyLang },
): { state: CashflowGameState; bonus?: CashflowTransactionRecord } | null {
  const career = state.career;
  if (!career) return null;
  const sinceBonus = (career.sinceBonus ?? 0) + 1;
  let bonus: CashflowTransactionRecord | undefined;
  let nextSince = sinceBonus;
  if (career.bonus && sinceBonus >= career.bonus.everyPaydays) {
    bonus = payment(
      { en: 'Annual bonus', de: 'Jahresbonus' },
      career.bonus.netMinor,
      options.date,
      options.lang,
    );
    nextSince = 0;
  }
  return {
    state: {
      ...state,
      career: { ...career, paydaysInStage: career.paydaysInStage + 1, sinceBonus: nextSince },
    },
    ...(bonus ? { bonus } : {}),
  };
}
