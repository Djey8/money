import type { GamePlayer, TableSeat } from './tables-api.service';

/**
 * What the leaderboard stats panel needs, from what a seat of a table knows (the panel asks the server for the rest). Null: nothing
 * public to show - a person who is not on the leaderboard keeps their numbers to themselves.
 */
export function seatToPlayer(seat: TableSeat): GamePlayer | null {
  if (!seat.playerId || (!seat.listed && !seat.bot)) return null;
  return {
    playerId: seat.playerId,
    name: seat.name,
    type: seat.bot ? 'bot' : 'human',
    level: seat.level,
    pictureVersion: seat.pictureVersion,
    rating: seat.rating,
    peakRating: seat.peakRating ?? seat.rating,
    baseRating: seat.baseRating,
    ratedGames: seat.ratedGames,
    provisional: !!seat.provisional,
    games: seat.games ?? 0,
    wins: seat.wins ?? 0,
    losses: seat.losses ?? 0,
    gaveUp: seat.gaveUp ?? 0,
    bankruptcies: seat.bankruptcies ?? 0,
    escaped: seat.escaped ?? 0,
    winRate: seat.winRate ?? 0,
    avgPlace: seat.avgPlace ?? null,
    bestPlace: seat.bestPlace ?? null,
  };
}
