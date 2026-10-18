import { identityText } from '../game-text';
import { seededRng, type Rng } from '../rng';
import type { Policy } from '../simulation/policy';
import { spreadOf, wilsonInterval, type Spread } from '../simulation/stats';
import type { TableContext } from './reducer';
import { simulateTable } from './simulate';
import type { Table, TableSettingsInput } from './types';

/**
 * The tournament (todo/cashflow-tournament-and-bots.md, slice A1): whole multiplayer tables in memory, one policy per seat and a
 * fixed profession per seat, played again and again with every policy in every seat, and what that says about who wins.
 * Pure and seeded: the same lineups and seeds give the same results, so a table of numbers can be checked later.
 */

/** What a simulated table needs from outside (the clock is the simulation's own). Plain money, untranslated text. */
export function simulationContext(): Omit<TableContext, 'clock'> {
  return {
    text: identityText,
    money: (minor) => `${minor / 100}`,
    plainMoney: (minor) => `${minor / 100}`,
    cards: {
      textFor: () => ({}),
      symbolFor: (symbol: string | undefined) => symbol,
      sharedText: () => '',
      groupName: (group: string) => group,
    },
  };
}

export interface MatchConfig {
  seed: number;
  /** One policy per seat. */
  policies: Policy[];
  /** One profession per seat (a game set's profession id); omitted or 'random': the table draws. */
  professionIds?: string[];
  rulesBase?: 'guided' | 'strict';
  /** How many of a player's rolls a Market buyer's offer stays open. */
  sellOfferRolls?: number;
  /** Players may offer property cards to each other (the simulation's simple trade rule). */
  trading?: boolean;
  /** `all-done` plays on until everyone is out; the default stops at the first escape, which is the race. */
  endCondition?: 'first-escape' | 'all-done';
  gameSetId?: string;
  maxCommands?: number;
}

export interface SeatOutcome {
  seat: number;
  policyId: string;
  professionId: string | null;
  /** The table's own ranking: 1 is the winner. */
  rank: number;
  outcome: 'escaped' | 'playing' | 'bankrupt' | 'left';
  /** Rolls this player made. */
  rolls: number;
  passiveIncomeMinor: number;
  monthlyCashflowMinor: number;
}

export interface MatchResult {
  seed: number;
  seats: SeatOutcome[];
  /** The seat that won (first to escape), or null when nobody escaped. */
  winnerSeat: number | null;
  reason: string | null;
  tableRound: number;
  commands: number;
  /** Invariant or leak problems the table reported - empty is the point. */
  problems: string[];
  cutOff: boolean;
}

/** Plays one table and says who finished where. */
export function playMatch(config: MatchConfig): MatchResult {
  const players = config.policies.length;
  const settings: TableSettingsInput = {
    rulesBase: config.rulesBase ?? 'guided',
    endCondition: config.endCondition ?? 'first-escape',
    clock: { mode: 'none' },
    ...(config.gameSetId ? { gameSetId: config.gameSetId } : {}),
    ...(config.sellOfferRolls !== undefined
      ? { rules: { sellOfferRolls: config.sellOfferRolls } }
      : {}),
  };
  const run = simulateTable({
    players,
    seed: config.seed,
    settings,
    policies: config.policies,
    professionIds: config.professionIds,
    trading: config.trading,
    maxCommands: config.maxCommands ?? 40_000,
    context: simulationContext(),
  });
  return resultOf(run.table, config, run.commands, run.problems, run.cutOff);
}

function resultOf(
  table: Table,
  config: MatchConfig,
  commands: number,
  problems: string[],
  cutOff: boolean,
): MatchResult {
  const ranking = table.result?.ranking ?? [];
  const seats: SeatOutcome[] = table.players.map((player, seat) => {
    const standing = ranking.find((entry) => entry.playerId === player.id);
    const state = player.books?.state;
    return {
      seat,
      policyId: config.policies[seat].id,
      professionId: state?.professionId ?? null,
      rank: standing?.rank ?? table.players.length,
      outcome: standing?.outcome ?? 'playing',
      rolls: state?.turn?.count ?? 0,
      passiveIncomeMinor: standing?.passiveIncomeMinor ?? 0,
      monthlyCashflowMinor: standing?.monthlyCashflowMinor ?? 0,
    };
  });
  const winner = seats.find((seat) => seat.rank === 1 && seat.outcome === 'escaped');
  return {
    seed: config.seed,
    seats,
    winnerSeat: winner ? winner.seat : null,
    reason: table.result?.reason ?? null,
    tableRound: table.tableRound,
    commands,
    problems,
    cutOff,
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────────────────────────────

export interface PolicyScore {
  policyId: string;
  /** Seats this policy played. */
  appearances: number;
  wins: number;
  /** Share of its tables it won, and how far to trust it. */
  winRate: number;
  winInterval: { low: number; high: number };
  /** What a policy would win by luck alone: the average of 1/seats over its tables. */
  expectedWinRate: number;
  meanRank: number;
  escapes: number;
  bankrupt: number;
  /** Rolls to escape, over the games it escaped in. */
  rollsToEscape: Spread | null;
}

/** Per policy: how often it won, finished where, escaped or went bankrupt, and how fast. */
export function scoreMatches(results: MatchResult[]): PolicyScore[] {
  const by = new Map<
    string,
    {
      seats: number;
      wins: number;
      rankSum: number;
      escapes: number;
      bankrupt: number;
      chance: number;
      rolls: number[];
    }
  >();
  for (const match of results) {
    for (const seat of match.seats) {
      const entry = by.get(seat.policyId) ?? {
        seats: 0,
        wins: 0,
        rankSum: 0,
        escapes: 0,
        bankrupt: 0,
        chance: 0,
        rolls: [],
      };
      entry.seats += 1;
      entry.chance += 1 / match.seats.length;
      entry.rankSum += seat.rank;
      if (match.winnerSeat === seat.seat) entry.wins += 1;
      if (seat.outcome === 'escaped') {
        entry.escapes += 1;
        entry.rolls.push(seat.rolls);
      }
      if (seat.outcome === 'bankrupt') entry.bankrupt += 1;
      by.set(seat.policyId, entry);
    }
  }
  return [...by.entries()]
    .map(([policyId, e]) => ({
      policyId,
      appearances: e.seats,
      wins: e.wins,
      winRate: e.seats ? e.wins / e.seats : 0,
      winInterval: wilsonInterval(e.wins, e.seats),
      expectedWinRate: e.seats ? e.chance / e.seats : 0,
      meanRank: e.seats ? e.rankSum / e.seats : 0,
      escapes: e.escapes,
      bankrupt: e.bankrupt,
      rollsToEscape: spreadOf(e.rolls),
    }))
    .sort((a, b) => b.winRate - a.winRate || a.meanRank - b.meanRank);
}

/** Whether the first seat of the table has an edge: wins by seat (seat order is random at a table; this checks that it is fair). */
export function winsBySeat(
  results: MatchResult[],
): { seat: number; tables: number; wins: number }[] {
  const seats = new Map<number, { tables: number; wins: number }>();
  for (const match of results) {
    match.seats.forEach((seat) => {
      const entry = seats.get(seat.seat) ?? { tables: 0, wins: 0 };
      entry.tables += 1;
      if (match.winnerSeat === seat.seat) entry.wins += 1;
      seats.set(seat.seat, entry);
    });
  }
  return [...seats.entries()].sort((a, b) => a[0] - b[0]).map(([seat, e]) => ({ seat, ...e }));
}

/** Head to head: for every pair of policies that met, how often each won the tables they shared. */
export function headToHead(
  results: MatchResult[],
): { a: string; b: string; tables: number; aWins: number; bWins: number }[] {
  const pairs = new Map<
    string,
    { a: string; b: string; tables: number; aWins: number; bWins: number }
  >();
  for (const match of results) {
    const ids = [...new Set(match.seats.map((seat) => seat.policyId))].sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = `${ids[i]}|${ids[j]}`;
        const entry = pairs.get(key) ?? { a: ids[i], b: ids[j], tables: 0, aWins: 0, bWins: 0 };
        entry.tables += 1;
        const winner = match.winnerSeat === null ? null : match.seats[match.winnerSeat].policyId;
        if (winner === ids[i]) entry.aWins += 1;
        if (winner === ids[j]) entry.bWins += 1;
        pairs.set(key, entry);
      }
    }
  }
  return [...pairs.values()];
}

// ── Lineups ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Which policies sit at which seats, over and over. Every policy gets every seat equally often: `rounds` times through a
 * rotation of seat positions, each round with a fresh draw of opponents (seeded). With as many policies as seats, a round is
 * every rotation of one fixed group; with more, the group is drawn without repeats.
 */
export function buildLineups(
  policyIds: string[],
  seats: number,
  rounds: number,
  seed: number,
): string[][] {
  const rng: Rng = seededRng(seed);
  const lineups: string[][] = [];
  for (let round = 0; round < rounds; round += 1) {
    const pool = [...policyIds];
    const group: string[] = [];
    while (group.length < seats && pool.length > 0) {
      group.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    // a policy may sit twice when there are fewer policies than seats: pad from the start
    for (let i = 0; group.length < seats; i += 1) group.push(policyIds[i % policyIds.length]);
    for (let rotation = 0; rotation < seats; rotation += 1) {
      lineups.push(group.map((_, seat) => group[(seat + rotation) % seats]));
    }
  }
  return lineups;
}
