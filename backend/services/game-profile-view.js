'use strict';

const { PROVISIONAL_GAMES } = require('@money/domain/dist/cashflow-game/table/rating');

/**
 * How a profile of the leaderboard looks to others: no account id, the rating rounded, the counters with their derived figures.
 * Shared by the leaderboard routes and by the seats of a table (the lobby shows who sits there).
 */

/** The level a bot id carries; a plain id is a master. */
const levelOf = (botId) => {
  if (!botId) return undefined;
  const at = botId.lastIndexOf('--');
  return at < 0 ? 'master' : botId.slice(at + 2);
};

/**
 * The base a profile was counted from when a game ended: the last base that began before it (the first one for a game from
 * before any record). A game's rating is shown on the CURRENT base: `ratingAfter + (current base - the base it was played on)`, so
 * the history reads on one scale after the bots were measured again.
 */
function baseAt(profile, endedAt) {
  const history = profile.baseHistory ?? [];
  let found = history.length ? history[0].baseRating : (profile.baseRating ?? 1500);
  for (const entry of history) {
    if (String(entry.at) <= String(endedAt)) found = entry.baseRating;
  }
  return found;
}

/** A profile as the API shows it: no account id, the rating rounded, the counters with their derived figures. */
function present(profile) {
  const c = profile.counters;
  const ranked = profile.rated;
  return {
    playerId: profile.playerId,
    name: profile.displayName,
    type: profile.type,
    ...(profile.type === 'bot' ? { level: levelOf(profile.botId) } : {}),
    ...(profile.pictureVersion ? { pictureVersion: profile.pictureVersion } : {}),
    rating: Math.round(profile.rating),
    peakRating: Math.round(profile.peakRating),
    // what the rating is counted from (a person's 1500, a bot's measured start) and when that base was set
    baseRating: Math.round(profile.baseRating ?? 1500),
    ...(profile.baseHistory?.length
      ? { baseSince: profile.baseHistory[profile.baseHistory.length - 1].at }
      : {}),
    ratedGames: ranked,
    provisional: ranked < PROVISIONAL_GAMES,
    games: c.played,
    wins: c.wins,
    losses: Math.max(0, c.played - c.wins - c.gaveUp),
    gaveUp: c.gaveUp,
    bankruptcies: c.bankruptcies,
    escaped: c.escaped,
    winRate: c.played ? Math.round((c.wins / c.played) * 1000) / 10 : 0,
    avgPlace:
      c.played - c.gaveUp > 0 ? Math.round((c.rankSum / (c.played - c.gaveUp)) * 100) / 100 : null,
    bestPlace: c.bestRank,
  };
}

module.exports = { levelOf, baseAt, present };
