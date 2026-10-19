'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getGameStatsDb, getUsersDb } = require('../config/db');
const profilePicture = require('../repositories/profile-picture');
const { requireScope, problem } = require('../middleware/api-auth');
const { requireGameAccount } = require('../middleware/game-account-guard');
const store = require('../repositories/game-stats-store');
const { stats, nicknameOf } = require('./game-rooms');
const {
  PROVISIONAL_GAMES,
  RATING_FLOOR,
} = require('@money/domain/dist/cashflow-game/table/rating');

/**
 * The Cashflow leaderboard (todo/cashflow-leaderboard.md §9). Mounted by routes/api.js at `/api/v1/game`; game accounts only.
 * A player is known by the public `playerId` of their profile - never by an account id. Humans are listed only when they
 * switched "show me on the leaderboard" on; bots always are.
 */

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GAME_ROOMS_RATE_LIMIT) || 3000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    crypto
      .createHash('sha256')
      .update(String(req.userId || req.ip))
      .digest('hex'),
  skip: () => process.env.SKIP_RATE_LIMIT === 'true',
});

const guard = (level) => [requireScope(`game:${level}`), requireGameAccount, limiter];
const invalid = (res, detail) =>
  problem(res, 400, 'validation_invalid', 'Invalid leaderboard request', detail);

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

/** `GET /game/leaderboard` - the board, best rating first; players with at least `minGames` rated games. */
router.get('/leaderboard', ...guard('r'), async (req, res, next) => {
  try {
    const { type, minGames, limit, after } = req.query;
    if (type !== undefined && !['all', 'human', 'bot'].includes(type)) {
      return invalid(res, "type must be 'all', 'human' or 'bot'.");
    }
    const min = minGames === undefined ? 1 : Number(minGames);
    const size = limit === undefined ? 50 : Number(limit);
    const skip = after === undefined ? 0 : Number(after);
    if (!Number.isInteger(min) || min < 0) return invalid(res, 'minGames must be a whole number.');
    if (!Number.isInteger(size) || size < 1 || size > 200) {
      return invalid(res, 'limit must be between 1 and 200.');
    }
    if (!Number.isInteger(skip) || skip < 0) return invalid(res, 'after must be a position.');
    const rows = await store.listBoard(getGameStatsDb(), {
      type: type === 'all' ? undefined : type,
      minGames: min,
      limit: size + 1,
      skip,
    });
    const items = rows.slice(0, size).map((profile, index) => ({
      place: skip + index + 1,
      ...present(profile),
    }));
    return res.json({ items, next: rows.length > size ? String(skip + size) : null });
  } catch (error) {
    return next(error);
  }
});

/** The profile of the signed-in account (made on first look). */
async function myProfile(req) {
  return stats().ensureHumanProfile(req.userId, await nicknameOf(req.userId));
}

router.get('/players/me', ...guard('r'), async (req, res, next) => {
  try {
    const profile = await myProfile(req);
    return res.json({ ...present(profile), visible: profile.visible });
  } catch (error) {
    return next(error);
  }
});

router.put('/players/me', ...guard('w'), async (req, res, next) => {
  try {
    if (typeof req.body?.visible !== 'boolean')
      return invalid(res, 'visible must be true or false.');
    const profile = await myProfile(req);
    const updated = await stats().setVisible(profile.playerId, req.body.visible);
    return res.json({ ...present(updated), visible: updated.visible });
  } catch (error) {
    return next(error);
  }
});

/** One player: the counters and their last 20 results. A human who is not listed is not found (except to themselves). */
router.get('/players/:playerId', ...guard('r'), async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const profile = await store.getProfile(getGameStatsDb(), playerId);
    const mine = profile && profile.type === 'human' && profile.accountId === req.userId;
    if (!profile || (profile.type === 'human' && !profile.visible && !mine)) {
      return problem(res, 404, 'player_not_found', 'No such player', 'No player with that id.');
    }
    const all = await store.resultsOfPlayer(getGameStatsDb(), playerId, 500);
    // The rating after each game is the current base plus every change up to it (a rating is base + games, JFK 2026-10-19). Only when
    // the record is whole; otherwise the rating as it was recorded, on the current base.
    const chronological = [...all].reverse();
    const counted = (r) =>
      r.counted && !r.participants.find((p) => p.playerId === playerId).leftEarly;
    const whole = chronological.filter(counted).length === profile.rated;
    const running = new Map();
    let rating = profile.baseRating ?? 1500;
    for (const result of chronological) {
      if (counted(result)) {
        const mineIn = result.participants.find((p) => p.playerId === playerId);
        rating = Math.max(RATING_FLOOR, Math.round((rating + mineIn.delta) * 100) / 100);
      }
      running.set(result.tableId, rating);
    }
    const results = all.slice(0, 20);
    const recent = results.map((result) => {
      const own = result.participants.find((p) => p.playerId === playerId);
      return {
        table: result.settings.name,
        endedAt: result.endedAt,
        players: result.participants.length,
        place: own.rank,
        outcome: own.outcome,
        ranked: result.counted,
        ...(result.counted ? {} : { notRankedBecause: result.rankedWhy }),
        ratingChange: own.delta,
        ratingAfter: whole
          ? Math.round(running.get(result.tableId))
          : Math.round(
              own.ratingAfter + ((profile.baseRating ?? 1500) - baseAt(profile, result.endedAt)),
            ),
      };
    });
    return res.json({ ...present(profile), recent });
  } catch (error) {
    return next(error);
  }
});

/**
 * `GET /game/players/{playerId}/picture` - the player's profile picture as an image (a person who set one and is listed, or the
 * person themselves). Cached by the browser; the leaderboard adds `?v=<pictureVersion>` so a new picture is fetched.
 */
router.get('/players/:playerId/picture', ...guard('r'), async (req, res, next) => {
  try {
    const profile = await store.getProfile(getGameStatsDb(), req.params.playerId);
    const mine = profile && profile.type === 'human' && profile.accountId === req.userId;
    if (!profile || profile.type !== 'human' || !profile.accountId || (!profile.visible && !mine)) {
      return problem(
        res,
        404,
        'player_not_found',
        'No such picture',
        'No picture for that player.',
      );
    }
    const picture = await profilePicture.getPicture(getUsersDb(), profile.accountId);
    if (!picture) {
      return problem(
        res,
        404,
        'player_not_found',
        'No such picture',
        'No picture for that player.',
      );
    }
    res.set('Cache-Control', 'private, max-age=86400');
    return res.type(picture.mime).send(Buffer.from(picture.data, 'base64'));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
