'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireScope, problem } = require('../middleware/api-auth');
const { requireGameAccount } = require('../middleware/game-account-guard');
const { dreamStats, nicknameOf } = require('./game-rooms');

/**
 * The Dreamfund leaderboard (todo/dreamfund-multiplayer.md, slice 8). Mounted by routes/api.js at `/api/v1/game/dreamfund`; game
 * accounts only. A world of its own - nothing of the classic board is read or shown. A player is known by the public `playerId` of their
 * profile, never by an account id; humans are listed only when they switched "show me" on, bots once they have played. One rating per
 * difficulty: `difficulty` easy, medium (default) or hard.
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
const LEVELS = ['easy', 'medium', 'hard'];

/** `GET /game/dreamfund/leaderboard` - the board at a difficulty, best rating first. */
router.get('/leaderboard', ...guard('r'), async (req, res, next) => {
  try {
    const { difficulty = 'medium', type, minGames, limit, after } = req.query;
    if (!LEVELS.includes(difficulty))
      return invalid(res, "difficulty must be 'easy', 'medium' or 'hard'.");
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
    const rows = await dreamStats().board({
      difficulty,
      type: type === 'all' ? undefined : type,
      minGames: min,
      limit: size + 1,
      skip,
    });
    const more = rows.length > size;
    return res.json({
      difficulty,
      items: rows.slice(0, size),
      next: more ? String(skip + size) : null,
    });
  } catch (error) {
    return next(error);
  }
});

/** `GET /game/dreamfund/players/me` - your own profile with a rating for each difficulty. */
router.get('/players/me', ...guard('r'), async (req, res, next) => {
  try {
    return res.json(await dreamStats().me(req.userId, await nicknameOf(req.userId)));
  } catch (error) {
    return next(error);
  }
});

/** `PUT /game/dreamfund/players/me {visible}` - show yourself on the board (or not). */
router.put('/players/me', ...guard('w'), async (req, res, next) => {
  try {
    if (!req.body || typeof req.body.visible !== 'boolean') {
      return invalid(res, 'visible must be true or false.');
    }
    return res.json(await dreamStats().setVisible(req.userId, req.body.visible));
  } catch (error) {
    return next(error);
  }
});

/** `GET /game/dreamfund/players/{playerId}` - a player of the board with every difficulty and the last results. */
router.get('/players/:playerId', ...guard('r'), async (req, res, next) => {
  try {
    const found = await dreamStats().player(req.params.playerId);
    if (!found)
      return problem(
        res,
        404,
        'player_not_found',
        'No such player',
        'That player is not on the board.',
      );
    return res.json(found);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
