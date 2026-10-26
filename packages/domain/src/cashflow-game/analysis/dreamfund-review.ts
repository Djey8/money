import { cashOnHandMinor } from '../cash';
import type { GameSnapshot } from '../history';
import { summarizeGameFinances } from '../saved-games';
import type { CashflowGameSet } from '../types';
import { booksFromSnapshot } from './books-from-snapshot';
import type { ReviewEntry } from './review';

/**
 * The analyst for a Dreamfund game (JFK, 2026-10-26: "I want to save a game and then ask my chat to judge and analyze my last game and
 * get feedback what I should have done differently"). The classic analyst plays a position on many times with a strategy and compares
 * the chances; a Dreamfund game has dice cards, markets and a long list of goals, so this one reads the story of the game instead:
 * the position before every step (the undo history) and the position now give the timeline, the milestones, what was bought and what
 * it paid, the loans, the emergencies and the chances that were missed - and they are set beside what the simulation of thousands of
 * games found (docs/DREAMFUND_GAME.md). Pure: snapshots in, a report out.
 */

/** When the best strategies of the simulation reached each goal, in months (Jonas, Medium: the informed investor and the Sapling builder). */
export const DREAMFUND_BENCHMARK = {
  reserveMonth: 17,
  debtsMonth: 22,
  dreamMonth: 39,
  independenceMonth: 52,
  freeSavingCards: 6,
  firstIncomeMonth: 4,
};

export type FindingTone = 'good' | 'bad' | 'tip';

export interface DreamfundFinding {
  id: string;
  tone: FindingTone;
  text: string;
  /** The month (the round of the game) it is about. */
  month?: number;
}

export interface DreamfundTimelinePoint {
  month: number;
  rolls: number;
  cashMinor: number;
  reserveMinor: number;
  bankLoanMinor: number;
  passiveMinor: number;
  expensesMinor: number;
  cashflowMinor: number;
  holdings: number;
}

export interface DreamfundPurchase {
  month: number;
  title: string;
  cardId: string;
  paidMinor: number;
  monthlyMinor: number;
}

export interface DreamfundReview {
  kind: 'dreamfund';
  outcome: 'playing' | 'bankrupt' | 'won';
  /** Months (Paydays) and rolls played. */
  months: number;
  rolls: number;
  steps: number;
  /** The month each goal was first met (undefined: not yet). */
  milestones: {
    firstIncome?: number;
    reserveFull?: number;
    debtsRepaid?: number;
    dreamLived?: number;
    independence?: number;
  };
  timeline: DreamfundTimelinePoint[];
  purchases: DreamfundPurchase[];
  /** The free saving cards of the game that were taken (the simulation found all of them in every won game). */
  savingCards: number;
  loans: { peakMinor: number; times: number };
  emergencies: { count: number };
  missedChances: string[];
  /** Capital in holdings that pay nothing every month, as a share of all capital put into holdings. */
  idleCapitalShare: number;
  final: {
    cashMinor: number;
    reserveMinor: number;
    passiveMinor: number;
    expensesMinor: number;
    livingCostsMinor: number;
    monthlyCashflowMinor: number;
    bankLoanMinor: number;
  };
  findings: DreamfundFinding[];
}

type Loose = Record<string, unknown>;
const list = (value: unknown): Loose[] => (Array.isArray(value) ? (value as Loose[]) : []);
const num = (value: unknown): number => Number(value) || 0;

interface Position {
  month: number;
  rolls: number;
  cashMinor: number;
  reserveMinor: number;
  reserveTargetMinor: number;
  bankLoanMinor: number;
  passiveMinor: number;
  expensesMinor: number;
  livingMinor: number;
  cashflowMinor: number;
  holdings: Loose[];
  debtsOpen: boolean;
  dreamLived: boolean;
  independent: boolean;
  bankrupt: boolean;
  /** How much of the dreams that are open is funded (0 to 1). */
  dreamShare: number;
}

function dreamShareOf(snapshot: Omit<GameSnapshot, 'step'>): number {
  let target = 0;
  let saved = 0;
  for (const project of list(snapshot.allSmileProjects)) {
    if (!project['dreamCardId']) continue;
    for (const bucket of list(project['buckets'])) {
      target += num(bucket['target']);
      saved += num(bucket['amount']);
    }
  }
  return target > 0 ? Math.min(1, saved / target) : 0;
}

const DEBT_TAGS = /eltern|parents|autokredit|car loan/i;

function positionOf(
  snapshot: Omit<GameSnapshot, 'step'>,
  gameSet: CashflowGameSet | undefined,
): Position {
  const books = booksFromSnapshot(snapshot, { gameSet });
  const finances = summarizeGameFinances(books.state, books.subscriptions);
  const mojo = (snapshot.mojo ?? {}) as Loose;
  const bank = books.liabilities.find((liability) => /bank loan/i.test(liability.tag));
  const dreams = (snapshot.cashflowGame as unknown as { dreams?: { lived?: unknown[] } }).dreams;
  return {
    month: snapshot.cashflowGame.round,
    rolls: snapshot.cashflowGame.turn?.count ?? 0,
    cashMinor: Math.max(0, cashOnHandMinor(books.transactions, books.allocation)),
    reserveMinor: Math.round(num(mojo['amount']) * 100),
    reserveTargetMinor: Math.round(num(mojo['target']) * 100),
    bankLoanMinor: bank?.amountMinor ?? 0,
    passiveMinor: finances.passiveIncomeMinor,
    expensesMinor: finances.expensesMinor,
    livingMinor: finances.expensesMinor - finances.salaryLinkedMinor,
    cashflowMinor: finances.monthlyCashflowMinor,
    holdings: list((snapshot.cashflowGame as unknown as Loose)['holdings']).filter(
      (holding) => !holding['ended'],
    ),
    debtsOpen: books.liabilities.some((l) => DEBT_TAGS.test(l.tag) && l.amountMinor > 0),
    dreamLived: (dreams?.lived?.length ?? 0) > 0,
    independent: finances.escapedRatRace,
    bankrupt: finances.bankrupt,
    dreamShare: dreamShareOf(snapshot),
  };
}

export function reviewDreamfund(
  stack: readonly ReviewEntry[],
  live: Omit<GameSnapshot, 'step'>,
  options: { gameSets: CashflowGameSet[] },
): DreamfundReview {
  const gameSet = options.gameSets.find((set) => set.id === live.cashflowGame.gameSetId);
  const positions = [
    ...stack.map((entry) => positionOf(entry, gameSet)),
    positionOf(live, gameSet),
  ];
  const last = positions[positions.length - 1];

  const milestones: DreamfundReview['milestones'] = {};
  const timeline: DreamfundTimelinePoint[] = [];
  const purchases: DreamfundPurchase[] = [];
  let peakLoan = 0;
  let loanTimes = 0;
  let before: Position | undefined;
  let idleRounds = 0;
  for (const position of positions) {
    if (milestones.firstIncome === undefined && position.passiveMinor > 0) {
      milestones.firstIncome = position.month;
    }
    if (
      milestones.reserveFull === undefined &&
      position.reserveTargetMinor > 0 &&
      position.reserveMinor >= position.reserveTargetMinor
    ) {
      milestones.reserveFull = position.month;
    }
    if (milestones.debtsRepaid === undefined && !position.debtsOpen && position.month > 0) {
      const had = positions.some((p) => p.debtsOpen);
      if (had) milestones.debtsRepaid = position.month;
    }
    if (milestones.dreamLived === undefined && position.dreamLived)
      milestones.dreamLived = position.month;
    if (milestones.independence === undefined && position.independent) {
      milestones.independence = position.month;
    }
    peakLoan = Math.max(peakLoan, position.bankLoanMinor);
    if (before && position.bankLoanMinor > before.bankLoanMinor) loanTimes += 1;
    if (
      position.livingMinor > 0 &&
      position.cashMinor > position.livingMinor * 3 &&
      position.passiveMinor < position.livingMinor
    ) {
      idleRounds += 1;
    }
    // what was bought since the last position
    if (before) {
      const known = new Set(before.holdings.map((holding) => String(holding['title'])));
      for (const holding of position.holdings) {
        const title = String(holding['title']);
        if (known.has(title)) continue;
        purchases.push({
          month: position.month,
          title,
          cardId: String(holding['cardId'] ?? ''),
          paidMinor: num(holding['paidMinor']),
          monthlyMinor: num(holding['cashflowMinor']),
        });
      }
    }
    if (timeline.length === 0 || position.month > timeline[timeline.length - 1].month) {
      timeline.push({
        month: position.month,
        rolls: position.rolls,
        cashMinor: position.cashMinor,
        reserveMinor: position.reserveMinor,
        bankLoanMinor: position.bankLoanMinor,
        passiveMinor: position.passiveMinor,
        expensesMinor: position.expensesMinor,
        cashflowMinor: position.cashflowMinor,
        holdings: position.holdings.length,
      });
    }
    before = position;
  }

  const emergencies = stack.filter(
    (entry) => entry.step?.deck === 'emergency' || entry.step?.kind === 'emergencyProject',
  ).length;
  const savingCards = last.holdings.filter(
    (holding) => num(holding['monthlySavingsMinor']) > 0,
  ).length;
  const missedChances = list(live.allGrowProjects)
    .filter((project) =>
      list(project['notes']).some((note) =>
        /chance missed|chance verpasst/i.test(String(note['text'])),
      ),
    )
    .map((project) => String(project['title']));
  const paid = last.holdings.reduce((sum, holding) => sum + num(holding['paidMinor']), 0);
  const idle = last.holdings
    .filter((holding) => num(holding['cashflowMinor']) <= 0 && !num(holding['monthlySavingsMinor']))
    .reduce((sum, holding) => sum + num(holding['paidMinor']), 0);
  const idleCapitalShare = paid > 0 ? idle / paid : 0;

  const goalsDone =
    !last.debtsOpen &&
    last.dreamLived &&
    last.independent &&
    last.reserveTargetMinor > 0 &&
    last.reserveMinor >= last.reserveTargetMinor;
  const outcome: DreamfundReview['outcome'] = last.bankrupt
    ? 'bankrupt'
    : goalsDone
      ? 'won'
      : 'playing';

  const review: DreamfundReview = {
    kind: 'dreamfund',
    outcome,
    months: last.month,
    rolls: last.rolls,
    steps: stack.length,
    milestones,
    timeline: thin(timeline, 24),
    purchases,
    savingCards,
    loans: { peakMinor: peakLoan, times: loanTimes },
    emergencies: { count: emergencies },
    missedChances,
    idleCapitalShare,
    final: {
      cashMinor: last.cashMinor,
      reserveMinor: last.reserveMinor,
      passiveMinor: last.passiveMinor,
      expensesMinor: last.expensesMinor,
      livingCostsMinor: last.livingMinor,
      monthlyCashflowMinor: last.cashflowMinor,
      bankLoanMinor: last.bankLoanMinor,
    },
    findings: [],
  };
  review.findings = findingsOf(review, positions, idleRounds);
  return review;
}

/** At most `n` evenly spread points (the first and the last always). */
function thin<T>(points: T[], n: number): T[] {
  if (points.length <= n) return points;
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) out.push(points[Math.round((i * (points.length - 1)) / (n - 1))]);
  return out;
}

function findingsOf(
  review: DreamfundReview,
  positions: Position[],
  idleRounds: number,
): DreamfundFinding[] {
  const bench = DREAMFUND_BENCHMARK;
  const out: DreamfundFinding[] = [];
  const m = review.milestones;
  const add = (id: string, tone: FindingTone, text: string, month?: number) =>
    out.push({ id, tone, text, ...(month !== undefined ? { month } : {}) });

  if (review.outcome === 'bankrupt') {
    add(
      'bankrupt',
      'bad',
      'The game ended in bankruptcy: the monthly cash flow turned negative. Look at the last two or three cards before it - monthly costs from Life cards and loans are what break a game, a single emergency rarely does.',
    );
  }
  // the free savings
  if (review.savingCards >= bench.freeSavingCards - 1) {
    add(
      'savings',
      'good',
      `You took ${review.savingCards} of the ${bench.freeSavingCards} free saving cards - every won game of the simulation took all of them.`,
    );
  } else {
    add(
      'savings',
      'tip',
      `Only ${review.savingCards} of the ${bench.freeSavingCards} free saving cards were taken. They cost nothing, are worth 40-50 a month together, and every won game of the simulation had all of them: take each one the moment it is offered (they are in the Seed pile).`,
    );
  }
  // the first income
  if (m.firstIncome === undefined) {
    add(
      'first-income',
      'bad',
      'No investment ever paid you a monthly cash flow. Without passive income the game cannot be won: the first hustle or dividend share is the start.',
    );
  } else if (m.firstIncome > bench.firstIncomeMonth + 4) {
    add(
      'first-income',
      'tip',
      `The first monthly income came in month ${m.firstIncome}; the best simulated games had one by about month ${bench.firstIncomeMonth}. A small hustle from the Seed pile (tutoring, freelancing, a courier) is cheap and starts the compounding.`,
      m.firstIncome,
    );
  } else {
    add(
      'first-income',
      'good',
      `The first monthly income came early, in month ${m.firstIncome}.`,
      m.firstIncome,
    );
  }
  // reserve, debts, dream, independence against the benchmark
  const goal = (id: string, name: string, month: number | undefined, benchmark: number) => {
    if (month === undefined) {
      if (review.months > benchmark + 6) {
        add(
          id,
          'tip',
          `${name} is not done yet in month ${review.months}; the best simulated games had it by month ${benchmark}.`,
        );
      }
    } else if (month <= benchmark) {
      add(
        id,
        'good',
        `${name} was done in month ${month} (the best simulated games: about month ${benchmark}).`,
        month,
      );
    } else {
      add(
        id,
        'tip',
        `${name} was done in month ${month}, later than the best simulated games (about month ${benchmark}).`,
        month,
      );
    }
  };
  goal('reserve', 'The emergency reserve', m.reserveFull, bench.reserveMonth);
  goal('debts', 'Paying back the parents and the car loan', m.debtsRepaid, bench.debtsMonth);
  goal('dream', 'The life dream', m.dreamLived, bench.dreamMonth);
  goal('independence', 'Financial independence', m.independence, bench.independenceMonth);
  // the dream before income
  const early = positions.find((p) => p.passiveMinor < p.livingMinor * 0.2 && p.dreamShare > 0.5);
  if (early && m.independence === undefined) {
    add(
      'dream-first',
      'tip',
      `More than half of the dream was funded in month ${early.month}, while the passive income was still below a fifth of the cost of living. The simulation's winners started the dream only once their income carried part of it - the dream chaser, who funded it first, won almost never.`,
      early.month,
    );
  }
  // loans
  if (review.loans.peakMinor > 0) {
    const worst = positions.reduce((a, b) => (b.bankLoanMinor > a.bankLoanMinor ? b : a));
    add(
      'loans',
      review.loans.times > 3 ? 'bad' : 'tip',
      `The Bank loan peaked at ${amount(review.loans.peakMinor)} in month ${worst.month} and was taken ${review.loans.times} time(s). It costs 10% of the loan every month, so it only pays for something that earns more than that.`,
      worst.month,
    );
  } else {
    add('loans', 'good', 'You never needed the Bank loan.');
  }
  // idle cash
  if (idleRounds >= 4) {
    add(
      'idle-cash',
      'tip',
      `In ${idleRounds} positions you held more than three months of living costs in cash while the passive income was below the costs. Cash waiting around earns nothing: a payment plan for the reserve or a card from the Sapling pile puts it to work.`,
    );
  }
  // capital in things that pay nothing
  if (review.idleCapitalShare > 0.5 && review.purchases.length > 2) {
    add(
      'idle-capital',
      'tip',
      `${Math.round(review.idleCapitalShare * 100)}% of what you invested sits in holdings that pay no monthly cash flow (coins, collectibles, crypto). They only pay when a market card opens a window or brings a buyer; otherwise the Sell button gives the market price less a discount. Income cards move you towards independence, appreciation cards only hope for it.`,
    );
  }
  // chances missed
  if (review.missedChances.length > 0) {
    add(
      'missed',
      'tip',
      `You planned ${review.missedChances.length} card(s) and did not buy them in time: ${review.missedChances.slice(0, 5).join(', ')}. A planned card is only buyable in the turn it is in hand (a setting can give more turns).`,
    );
  }
  // emergencies
  if (review.emergencies.count > 0 && review.final.reserveMinor < review.final.livingCostsMinor) {
    add(
      'reserve-low',
      'tip',
      `${review.emergencies.count} emergency card(s) hit you and the reserve now holds less than one month of living costs.`,
    );
  }
  // the end
  if (
    review.final.passiveMinor >= review.final.livingCostsMinor &&
    review.final.livingCostsMinor > 0
  ) {
    add(
      'independent-now',
      'good',
      'The passive income covers the cost of living (without the taxes that stop with the salary): financial independence is reached.',
    );
  } else if (review.final.livingCostsMinor > 0) {
    add(
      'gap',
      'tip',
      `The passive income of ${amount(review.final.passiveMinor)} covers ${Math.round((100 * review.final.passiveMinor) / review.final.livingCostsMinor)}% of the cost of living of ${amount(review.final.livingCostsMinor)} a month.`,
    );
  }
  return out;
}

const amount = (minor: number) => (minor / 100).toLocaleString('en', { maximumFractionDigits: 0 });

/** The review in words: a short report an agent turns into feedback in the player's language. */
export function describeDreamfundReview(review: DreamfundReview): string {
  const lines: string[] = [];
  const money = (minor: number) => amount(minor);
  lines.push(
    `# Dreamfund game review`,
    '',
    `Played: ${review.months} months (${review.rolls} rolls, ${review.steps} steps). Outcome: **${review.outcome}**.`,
    '',
    '## Where the game stands',
    '',
    `- Cash ${money(review.final.cashMinor)}, reserve ${money(review.final.reserveMinor)}, Bank loan ${money(review.final.bankLoanMinor)}.`,
    `- Passive income ${money(review.final.passiveMinor)} a month against a cost of living of ${money(review.final.livingCostsMinor)} (expenses ${money(review.final.expensesMinor)} including taxes that stop with the salary).`,
    `- Monthly cash flow ${money(review.final.monthlyCashflowMinor)}.`,
    '',
    '## Milestones (month of the game)',
    '',
    `- First monthly income: ${review.milestones.firstIncome ?? 'not yet'}`,
    `- Reserve full: ${review.milestones.reserveFull ?? 'not yet'} (best simulated games: ~${DREAMFUND_BENCHMARK.reserveMonth})`,
    `- Debts repaid: ${review.milestones.debtsRepaid ?? 'not yet'} (~${DREAMFUND_BENCHMARK.debtsMonth})`,
    `- Life dream lived: ${review.milestones.dreamLived ?? 'not yet'} (~${DREAMFUND_BENCHMARK.dreamMonth})`,
    `- Financial independence: ${review.milestones.independence ?? 'not yet'} (~${DREAMFUND_BENCHMARK.independenceMonth})`,
    '',
    '## What was bought',
    '',
    ...(review.purchases.length
      ? review.purchases.map(
          (p) =>
            `- Month ${p.month}: ${p.title} (${p.cardId}) for ${money(p.paidMinor)}, pays ${money(p.monthlyMinor)} a month`,
        )
      : ['- nothing']),
    '',
    '## Findings',
    '',
    ...review.findings.map(
      (finding) =>
        `- ${finding.tone === 'good' ? '✔' : finding.tone === 'bad' ? '✘' : '→'} ${finding.text}`,
    ),
    '',
    'Compare with docs: explain_concept dreamfund_game_en (the benchmark is the simulation of 2,400 games of Jonas, Medium).',
  );
  return lines.join('\n');
}
