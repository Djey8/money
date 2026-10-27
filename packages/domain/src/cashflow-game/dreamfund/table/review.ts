import { benchmarkOf } from '../../analysis/dreamfund-review';
import { DreamPlayer } from '../player';
import { dreamStandings } from './reducer';
import type { DreamTable } from './types';

/**
 * A look at a running Dreamfund table for somebody who is watching it - a person, or an agent that has been asked "how are we doing?"
 * (todo/dreamfund-multiplayer.md, slice 6). Small on purpose: an agent pays for every token it reads, so this is the whole picture of a
 * table in a page - where each player stands on the four goals, what they have and what they owe, how they compare with what the
 * best strategies of the simulation reach in the same time, and what to watch - and an agent never has to read the history or the
 * books. Amounts are whole units of the game's money. Pure.
 */

export interface PlayerReview {
  seat: number;
  name: string;
  /** The strategy of a bot; absent for a person. */
  strategy?: string;
  character: string;
  months: number;
  rolls: number;
  outcome: 'won' | 'playing' | 'bankrupt' | 'left';
  rank: number;
  score: number;
  /** Each goal in percent: reserve of three months, debts repaid, the dream lived, passive income against the cost of living. */
  goals: { reserve: number; debts: number; dream: number; independence: number };
  goalsMet: number;
  dreamPoints: number;
  cash: number;
  reserve: number;
  passiveIncome: number;
  costOfLiving: number;
  monthlyCashflow: number;
  netWorth: number;
  bankLoan: number;
  holdings: number;
  /** Progress compared with the best strategies of the simulation for this character and level: 100 is their pace at this month. */
  pace: number | null;
  watch: string[];
}

export interface DreamTableReview {
  tableRound: number;
  phase: DreamTable['phase'];
  difficulty: string;
  endCondition: string;
  roundLimit?: number;
  /** The market's indices that have moved most from 1.00. */
  markets: { market: string; index: number }[];
  /** A card on offer at the table, if any. */
  trade: { sellerSeat: number; holding: string; priceMinor: number } | null;
  players: PlayerReview[];
  /** What to say about the table in a few lines. */
  summary: string[];
}

const unit = (minor: number) => Math.round(minor / 100);
const percent = (share: number) => Math.round(share * 100);

export function reviewDreamTable(table: DreamTable): DreamTableReview {
  const standings = dreamStandings(table);
  const players: PlayerReview[] = [];
  table.players.forEach((seat, index) => {
    if (!seat.life) return;
    const standing = standings.find((s) => s.playerId === seat.id);
    if (!standing) return;
    const p = DreamPlayer.restore(seat.life, () => 0.5, { sharedMarkets: true });
    const finances = p.finances();
    const months = p.state.round;
    const level = table.settings.difficulty;
    const profession = `${seat.professionId}${level === 'medium' ? '' : `~${level}`}`;
    const bench = benchmarkOf(profession).bench;
    const progress =
      (standing.goals.reserve +
        standing.goals.debts +
        standing.goals.dream +
        standing.goals.independence) /
      4;
    const expected = months / Math.max(1, bench.independenceMonth);
    const bankLoan = p.books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0;
    const living = finances.expensesMinor - (finances.salaryLinkedMinor ?? 0);
    const watch: string[] = [];
    if (standing.outcome === 'playing') {
      if (finances.monthlyCashflowMinor < finances.expensesMinor * 0.05) {
        watch.push('The month is thin: a new monthly cost could tip the cash flow negative.');
      }
      if (bankLoan > 0) watch.push(`A Bank loan of ${unit(bankLoan)} is open (10% a month).`);
      if (months >= 12 && standing.goals.reserve < 0.34) {
        watch.push('No real reserve after a year: one emergency becomes a loan.');
      }
      if (months >= 8 && finances.passiveIncomeMinor === 0) {
        watch.push('No monthly income from any card yet: the game cannot be won without it.');
      }
      if (
        p.dreamLived === false &&
        standing.goals.dream > 0.5 &&
        standing.goals.independence < 0.2
      ) {
        watch.push(
          'Most of the dream is funded while the passive income is still small: the dream before the income has rarely won.',
        );
      }
    }
    players.push({
      seat: index,
      name: seat.name,
      ...(seat.bot ? { strategy: seat.bot.policyId } : {}),
      character: seat.professionId ?? '',
      months,
      rolls: p.turns,
      outcome: standing.outcome,
      rank: standing.rank,
      score: standing.score,
      goals: {
        reserve: percent(standing.goals.reserve),
        debts: percent(standing.goals.debts),
        dream: percent(standing.goals.dream),
        independence: percent(standing.goals.independence),
      },
      goalsMet: standing.goalsMet,
      dreamPoints: standing.dreamPoints,
      cash: unit(p.cash()),
      reserve: unit(p.reserveMinor),
      passiveIncome: unit(finances.passiveIncomeMinor),
      costOfLiving: unit(living),
      monthlyCashflow: unit(finances.monthlyCashflowMinor),
      netWorth: unit(standing.netWorthMinor),
      bankLoan: unit(bankLoan),
      holdings: (p.state.holdings ?? []).filter((h) => !h.ended).length,
      pace: months >= 6 ? Math.round((progress / Math.min(1, expected)) * 100) : null,
      watch,
    });
  });
  players.sort((a, b) => a.rank - b.rank);
  const summary: string[] = [];
  const leader = players[0];
  if (leader) {
    summary.push(
      `Round ${table.tableRound}: ${leader.name} (${leader.character}) leads with a score of ${leader.score}, ${leader.goalsMet} of 4 goals met.`,
    );
  }
  for (const player of players) {
    if (player.outcome === 'won') summary.push(`${player.name} has won.`);
    else if (player.outcome === 'bankrupt') summary.push(`${player.name} is bankrupt.`);
  }
  const behind = players.filter((p) => p.outcome === 'playing' && p.pace !== null && p.pace < 60);
  if (behind.length > 0) {
    summary.push(`Well behind the simulation's pace: ${behind.map((p) => p.name).join(', ')}.`);
  }
  const markets = Object.entries(table.markets)
    .map(([market, index]) => ({ market, index: Math.round(index * 100) / 100 }))
    .filter((m) => Math.abs(m.index - 1) >= 0.1)
    .sort((a, b) => Math.abs(b.index - 1) - Math.abs(a.index - 1))
    .slice(0, 5);
  return {
    tableRound: table.tableRound,
    phase: table.phase,
    difficulty: table.settings.difficulty,
    endCondition: table.settings.endCondition,
    ...(table.settings.roundLimit ? { roundLimit: table.settings.roundLimit } : {}),
    markets,
    trade: table.trade
      ? {
          sellerSeat: table.players.findIndex((p) => p.id === table.trade!.sellerId),
          holding: table.trade.holding,
          priceMinor: table.trade.priceMinor,
        }
      : null,
    players,
    summary,
  };
}
