import { DREAM_POLICIES } from '../../dreamfund-sim/policies';
import type { DreamfundLevel } from '../../analysis/dreamfund-benchmarks';
import { seededRng } from '../../rng';
import { runDreamBots } from './bot';
import { DREAM_BOT_LEVELS, dreamBotId, type DreamBotLevel } from './bot-levels';
import { rateTable, DREAM_START_RATING, type RatedSeat } from './rating';
import { applyDreamCommand, createDreamTable, dreamCharacterIds } from './reducer';
import type { DreamTable } from './types';

/**
 * The bot tournaments of the Dreamfund (todo/dreamfund-multiplayer.md, slice 9): tables of bots only, played headless and rated with the
 * same pairwise Elo as the board (`rateTable`, with the character's handicap). Every table seats a random mix of strategies at skill
 * levels on random characters; many tables later every bot has a rating per difficulty that says where it stands - the starting
 * rating of the board. Pure and seeded: the same seed gives the same tournament.
 */

export interface TournamentOptions {
  difficulty: DreamfundLevel;
  /** Tables to play. */
  tables: number;
  seats?: number;
  roundLimit?: number;
  seed?: number;
  /** The strategies at the tournament (default: all of the simulation's). */
  strategies?: string[];
  levels?: DreamBotLevel[];
  /** How strongly a table moves a bot (Elo K; the board's own is 8, a tournament needs to travel further). */
  k?: number;
}

export interface TournamentBot {
  botId: string;
  rating: number;
  games: number;
  tableWins: number;
  places: number;
}

const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };

/** One table of bots, played to its end (the first win, or the round limit). */
export function playBotTable(input: {
  id: string;
  seed: number;
  difficulty: DreamfundLevel;
  roundLimit: number;
  bots: { botId: string; character: string }[];
}): DreamTable {
  let table = createDreamTable(
    {
      id: input.id,
      hostId: 'host',
      hostName: 'Host',
      seed: input.seed,
      settings: {
        name: input.id,
        difficulty: input.difficulty,
        endCondition: 'round-limit',
        roundLimit: input.roundLimit,
        turnOrder: 'seat',
        professions: 'duplicates',
        maxSeats: Math.max(input.bots.length, 2),
      },
    },
    ctx,
  ).table;
  // the host seat is a bot as well: nobody sits at a tournament table
  const [first, ...rest] = input.bots;
  table = {
    ...table,
    players: table.players.map((p) => ({
      ...p,
      bot: { policyId: first.botId, professionId: first.character },
    })),
  };
  for (const bot of rest) {
    table = applyDreamCommand(
      table,
      'host',
      { type: 'add_bot', name: 'Bot', policyId: bot.botId, professionId: bot.character },
      ctx,
    ).table;
  }
  table = applyDreamCommand(table, 'host', { type: 'start' }, ctx).table;
  // the bots have picked as they were seated; the host's own pick, repeated, lets the table reveal
  table = applyDreamCommand(
    table,
    'host',
    { type: 'pick_profession', professionId: first.character },
    ctx,
  ).table;
  for (let guard = 0; guard < input.roundLimit * 400 && table.phase !== 'finished'; guard += 1) {
    const next = runDreamBots(table, ctx).table;
    if (next.version === table.version) break;
    table = next;
  }
  return table;
}

/** Plays the tournament and returns every bot with its rating at the difficulty (the best master is not re-based here). */
export function runBotTournament(options: TournamentOptions): TournamentBot[] {
  const seats = options.seats ?? 4;
  const roundLimit = options.roundLimit ?? 60;
  const rng = seededRng((options.seed ?? 1) >>> 0);
  const strategies = options.strategies ?? DREAM_POLICIES.map((p) => p.id);
  const levels = options.levels ?? (Object.keys(DREAM_BOT_LEVELS) as DreamBotLevel[]);
  const k = options.k ?? 24;
  const characters = dreamCharacterIds();
  const pool = strategies.flatMap((s) => levels.map((l) => dreamBotId(s, l)));
  const bots = new Map<string, TournamentBot>(
    pool.map((botId) => [
      botId,
      { botId, rating: DREAM_START_RATING, games: 0, tableWins: 0, places: 0 },
    ]),
  );
  // a shuffled deck of the pool, dealt `seats` at a time, so everybody plays about as often
  let deck: string[] = [];
  const deal = (): string[] => {
    const hand: string[] = [];
    while (hand.length < seats) {
      if (!deck.length) deck = shuffle(pool, rng);
      const next = deck.pop() as string;
      if (!hand.includes(next)) hand.push(next);
      else deck.unshift(next);
    }
    return hand;
  };
  for (let n = 0; n < options.tables; n += 1) {
    const hand = deal();
    const table = playBotTable({
      id: `tournament-${n}`,
      seed: Math.floor(rng() * 2 ** 31),
      difficulty: options.difficulty,
      roundLimit,
      bots: hand.map((botId) => ({
        botId,
        character: characters[Math.floor(rng() * characters.length)],
      })),
    });
    if (!table.result) continue;
    const ranked: RatedSeat[] = [];
    for (const standing of table.result.ranking) {
      const seat = table.players.find((p) => p.id === standing.playerId);
      const bot = seat?.bot && bots.get(seat.bot.policyId);
      if (!seat || !bot) continue;
      ranked.push({
        playerId: bot.botId,
        type: 'human', // the tournament's own K (kOf takes a human's)
        rating: bot.rating,
        ratedGames: 99,
        character: seat.professionId,
        rank: standing.rank,
        outcome: standing.outcome,
      });
    }
    // the table's own K: a tournament rates with `k` for everybody
    const changes = rateTable(ranked, options.difficulty);
    for (const change of changes) {
      const bot = bots.get(change.playerId) as TournamentBot;
      const seat = ranked.find((r) => r.playerId === change.playerId) as RatedSeat;
      bot.rating += (change.delta * k) / 24;
      bot.games += 1;
      bot.places += seat.rank;
      if (seat.rank === 1) bot.tableWins += 1;
    }
  }
  return [...bots.values()].sort((a, b) => b.rating - a.rating);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
