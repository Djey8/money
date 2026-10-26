import { droppedPremiumTitles } from './insurance';
import { emptyEffects, type BookSubscription, type GameEffects } from './effects';
import type { EmergencyLang } from './emergency-deck';
import {
  changeLife,
  resolveLifeEffect,
  type LifeContext,
  type LifeLine,
  type LifeOutcome,
} from './life-deck';
import { rollDie, systemRng, type Rng } from './rng';
import type { CashflowGameState, CashflowTransactionRecord } from './types';

/**
 * The life of a character in the books (JFK, 2026-10-26): what a resolved card does to the account - one payment, subscriptions for its
 * monthly lines, the game state - and what happens at the Paydays that follow (lines that run out, a baby that arrives, a job that is
 * found). Pure: it returns the game's usual effects, the app applies them like any other rule's.
 */

/** The expense lines taken from the gross salary: what the net income is after. */
export const DEDUCTION_KEYS = [
  'incomeTax',
  'pension',
  'healthInsurance',
  'careInsurance',
  'unemploymentInsurance',
];

export function lineSubscriptionTitle(line: LifeLine, lang: EmergencyLang): string {
  return `${line.title[lang]} (${line.id})`;
}

/** The salary less tax and social insurance, per month (0 for a game that has no salary subscription). */
export function netMonthlyMinor(
  state: Pick<CashflowGameState, 'gameSubscriptionTitles' | 'lineTitles'>,
  subscriptions: readonly { title: string; amountMinor: number }[],
): number {
  const salary = subscriptions.find((sub) => sub.title === state.gameSubscriptionTitles[0]);
  if (!salary) return 0;
  const taken = DEDUCTION_KEYS.map((key) => state.lineTitles?.[key])
    .filter((title): title is string => !!title)
    .map((title) => subscriptions.find((sub) => sub.title === title)?.amountMinor ?? 0)
    .reduce((sum, amount) => sum + Math.abs(amount), 0);
  return Math.max(0, salary.amountMinor - taken);
}

/** All the monthly expenses of the game (a positive number). */
export function monthlyExpensesMinor(
  state: Pick<CashflowGameState, 'gameSubscriptionTitles' | 'insurance'>,
  subscriptions: readonly { title: string; amountMinor: number }[],
): number {
  const dropped = droppedPremiumTitles(state);
  return subscriptions
    .filter(
      (sub) =>
        state.gameSubscriptionTitles.includes(sub.title) &&
        !dropped.has(sub.title) &&
        sub.amountMinor < 0,
    )
    .reduce((sum, sub) => sum + Math.abs(sub.amountMinor), 0);
}

export interface LifeBooks {
  state: CashflowGameState;
  subscriptions: readonly BookSubscription[];
}

/** What a card needs of the books to be resolved. */
export function lifeContext(books: LifeBooks, lang: EmergencyLang, rng?: Rng): LifeContext {
  const { state, subscriptions } = books;
  return {
    life: state.life!,
    netMonthlyMinor: netMonthlyMinor(state, subscriptions),
    expensesMonthlyMinor: monthlyExpensesMinor(state, subscriptions),
    livingStandard: state.livingStandard ?? 1,
    lang,
    rng,
  };
}

function lineSubscription(line: LifeLine, lang: EmergencyLang, date: string): BookSubscription {
  const title = lineSubscriptionTitle(line, lang);
  return {
    title,
    account: line.amountMinor > 0 ? 'Income' : 'Daily',
    amountMinor: line.amountMinor,
    startDate: date,
    endDate: '',
    category: `@${title}`,
    comment: '#dreamfund',
    frequency: 'monthly',
  };
}

function transaction(
  outcome: Pick<LifeOutcome, 'title'>,
  amountMinor: number,
  date: string,
  lang: EmergencyLang,
): CashflowTransactionRecord {
  return {
    account: amountMinor < 0 ? 'Daily' : 'Income',
    amountMinor,
    date,
    time: '',
    category: `@${outcome.title[lang]}`,
    comment: `${outcome.title[lang]}\n#dreamfund`,
  };
}

/**
 * Puts a resolved outcome into the books: the one-time payment becomes a transaction, each monthly line a subscription of the game
 * (paid at every Payday), the life state, the reward (two dice, the way Charity gives them) and what is scheduled for later.
 * Lines of a group that a move replaces are ended.
 */
export function applyLifeOutcome(
  books: LifeBooks,
  outcome: LifeOutcome,
  options: { date: string; lang: EmergencyLang },
): GameEffects {
  const { state } = books;
  const { date, lang } = options;
  const effects = emptyEffects(state, null);
  const existing = state.lifeLines ?? [];
  const ended = existing.filter((line) => line.group && outcome.removeGroups.includes(line.group));
  const kept = existing.filter((line) => !ended.includes(line));
  // a card can come twice: every line has an id of its own
  const taken = new Set(kept.map((line) => line.id));
  const added = outcome.lines.map((line) => {
    let id = line.id;
    let n = 1;
    while (taken.has(id)) id = `${line.id}~${(n += 1)}`;
    taken.add(id);
    return { ...line, id };
  });
  const titles = [...state.gameSubscriptionTitles];
  const endedTitles = ended.map((line) => lineSubscriptionTitle(line, lang));
  for (const title of endedTitles) {
    const at = titles.indexOf(title);
    if (at >= 0) titles.splice(at, 1);
  }
  for (const line of added) titles.push(lineSubscriptionTitle(line, lang));

  if (outcome.oneTimeMinor !== 0) {
    effects.appendedTransactions.push(transaction(outcome, outcome.oneTimeMinor, date, lang));
  }
  effects.subscriptionUpserts = added.map((line) => lineSubscription(line, lang, date));
  effects.subscriptionRemovals = endedTitles;
  effects.persist = { ...effects.persist, subscriptions: true };
  effects.state = {
    ...state,
    life: outcome.life,
    lifeLines: [...kept, ...added],
    gameSubscriptionTitles: titles,
    lifeScheduled: [...(state.lifeScheduled ?? []), ...outcome.scheduled],
    ...(outcome.jobSearch ? { jobSearch: outcome.jobSearch } : {}),
    ...(outcome.ongoingReward ? { sponsorship: true } : {}),
    charityRoundsLeft: Math.max(state.charityRoundsLeft, outcome.rewardTurns ?? 0),
    possessions: possessionsOf(outcome.life, state.possessions),
  };
  return effects;
}

/** What the character owns that cards ask for (a car, a pet), from the life state and what dreams gave. */
export function possessionsOf(
  life: { car: boolean; pet: string },
  before: readonly string[] | undefined,
): string[] {
  const others = (before ?? []).filter((item) => item !== 'car' && item !== 'pet');
  return [...others, ...(life.car ? ['car'] : []), ...(life.pet !== 'none' ? ['pet'] : [])];
}

/** The ids of the lines the player ends at a Payday, with what it costs (lifestyle creep). */
export function endLifeLine(
  books: LifeBooks,
  lineId: string,
  options: { date: string; lang: EmergencyLang },
): GameEffects | null {
  const { state } = books;
  const line = (state.lifeLines ?? []).find((candidate) => candidate.id === lineId);
  if (!line) return null;
  if (line.minPaydays !== undefined && (line.age ?? 0) < line.minPaydays) return null;
  const effects = emptyEffects(state, null);
  const title = lineSubscriptionTitle(line, options.lang);
  if (line.removeCostMinor) {
    effects.appendedTransactions.push(
      transaction({ title: line.title }, -line.removeCostMinor, options.date, options.lang),
    );
  }
  effects.subscriptionRemovals = [title];
  effects.persist = { ...effects.persist, subscriptions: true };
  effects.state = {
    ...state,
    lifeLines: (state.lifeLines ?? []).filter((candidate) => candidate.id !== lineId),
    gameSubscriptionTitles: state.gameSubscriptionTitles.filter((candidate) => candidate !== title),
  };
  return effects;
}

export interface LifePaydayEvent {
  kind: 'lineEnded' | 'arrived' | 'newJob' | 'jobFallback' | 'lent' | 'sponsorship';
  title: string;
}

/**
 * What a Payday brings to the life of a character, after the Payday has posted its subscriptions: lines that have run their
 * Paydays end, scheduled things arrive (a baby, lent money coming back), a job is looked for, a sponsorship rolls a reward.
 * The books are changed in `effects`; the Payday's own effects are merged by the caller.
 */
export function tickLife(
  books: LifeBooks,
  options: { date: string; lang: EmergencyLang; rng?: Rng },
): { effects: GameEffects; events: LifePaydayEvent[] } | null {
  const { state } = books;
  if (!state.life) return null;
  const rng = options.rng ?? systemRng;
  const { lang, date } = options;
  const events: LifePaydayEvent[] = [];
  const effects = emptyEffects(state, null);
  const titles = [...state.gameSubscriptionTitles];
  const removals: string[] = [];
  const upserts: BookSubscription[] = [];
  const transactions: CashflowTransactionRecord[] = [];
  const dropLine = (line: LifeLine) => {
    const title = lineSubscriptionTitle(line, lang);
    removals.push(title);
    const at = titles.indexOf(title);
    if (at >= 0) titles.splice(at, 1);
  };

  // 1. lines run their Paydays
  const lines: LifeLine[] = [];
  let life = state.life;
  for (const line of state.lifeLines ?? []) {
    const aged: LifeLine = { ...line, age: (line.age ?? 0) + 1 };
    if (aged.paydaysLeft !== undefined) {
      aged.paydaysLeft -= 1;
      if (aged.paydaysLeft <= 0) {
        dropLine(aged);
        events.push({ kind: 'lineEnded', title: aged.title[lang] });
        if (aged.group === 'employment' && life.employment === 'short_time') {
          life = { ...life, employment: 'employed' };
        }
        continue;
      }
    }
    lines.push(aged);
  }

  // 2. what was scheduled arrives
  const scheduled = [];
  let reward = state.charityRoundsLeft;
  for (const item of state.lifeScheduled ?? []) {
    const left = item.paydaysLeft - 1;
    if (left > 0) {
      scheduled.push({ ...item, paydaysLeft: left });
      continue;
    }
    const outcome =
      item.outcome ?? (item.roll && rollDie(rng) >= item.roll.from ? item.roll.success : undefined);
    events.push({ kind: item.roll ? 'lent' : 'arrived', title: item.title[lang] });
    if (!outcome) continue;
    if (outcome.oneTimeMinor !== 0) {
      transactions.push(transaction(outcome, outcome.oneTimeMinor, date, lang));
    }
    for (const line of outcome.lines) {
      lines.push(line);
      titles.push(lineSubscriptionTitle(line, lang));
      upserts.push(lineSubscription(line, lang, date));
    }
    life = changeLife(life, outcome.lifeChange);
    reward = Math.max(reward, outcome.rewardTurns ?? 0);
  }

  // 3. the job search
  let jobSearch = state.jobSearch;
  if (jobSearch) {
    const roll = rollDie(rng);
    if (roll >= jobSearch.rollFrom) {
      for (const line of lines.filter((candidate) => candidate.group === 'employment'))
        dropLine(line);
      for (let i = lines.length - 1; i >= 0; i -= 1)
        if (lines[i].group === 'employment') lines.splice(i, 1);
      life = { ...life, employment: 'employed' };
      events.push({ kind: 'newJob', title: jobSearch.title[lang] });
      jobSearch = undefined;
    } else if (jobSearch.paydaysLeft - 1 <= 0) {
      // the next offer pays less
      const net = netMonthlyMinor(
        { ...state, gameSubscriptionTitles: titles },
        books.subscriptions,
      );
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (lines[i].group === 'employment') {
          dropLine(lines[i]);
          lines.splice(i, 1);
        }
      }
      const cut: LifeLine = {
        id: `${state.lifeLines?.[0]?.cardId ?? 'job'}:fallback`,
        cardId: 'job',
        title: { en: 'A lower salary', de: 'Ein niedrigeres Gehalt' },
        amountMinor: -Math.round((net * Math.abs(jobSearch.fallbackPercent)) / 100),
        group: 'employment',
      };
      lines.push(cut);
      titles.push(lineSubscriptionTitle(cut, lang));
      upserts.push(lineSubscription(cut, lang, date));
      life = { ...life, employment: 'employed' };
      events.push({ kind: 'jobFallback', title: jobSearch.title[lang] });
      jobSearch = undefined;
    } else {
      jobSearch = { ...jobSearch, paydaysLeft: jobSearch.paydaysLeft - 1 };
    }
  }

  // 4. a sponsorship gives two dice for the first turn after each Payday
  if (state.sponsorship) {
    reward = Math.max(reward, 1);
    events.push({ kind: 'sponsorship', title: '' });
  }

  const next: CashflowGameState = {
    ...state,
    life,
    lifeLines: lines,
    lifeScheduled: scheduled,
    gameSubscriptionTitles: titles,
    charityRoundsLeft: reward,
    jobSearch,
    possessions: possessionsOf(life, state.possessions),
  };
  if (!jobSearch) delete (next as { jobSearch?: unknown }).jobSearch;
  effects.state = next;
  effects.subscriptionRemovals = removals;
  effects.subscriptionUpserts = upserts;
  effects.appendedTransactions = transactions;
  effects.persist = {
    ...effects.persist,
    subscriptions: removals.length > 0 || upserts.length > 0,
  };
  return { effects, events };
}

export { resolveLifeEffect };
