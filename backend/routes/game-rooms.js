'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getGameRoomsDb } = require('../config/db');
const logger = require('../config/logger');
const { requireScope, problem } = require('../middleware/api-auth');
const { requireGameAccount } = require('../middleware/game-account-guard');
const { createGameRoomService, problemFor } = require('../services/game-rooms');

/**
 * Multiplayer Cashflow tables: the lobby (todo/cashflow-multiplayer.md slice S1, docs/adr/0010). Mounted by routes/api.js at
 * `/api/v1/game/rooms`, behind the API authentication; game accounts only. The rules live in the domain package and the
 * handling in services/game-rooms.js - a handler here checks the shape of the request and maps the result.
 *
 * Reads need `game:r`, everything that changes a table needs `game:w`. These routes have a rate-limit bucket of their own
 * (per account), so a table can neither use up nor be starved by the normal API's budget.
 */

const router = express.Router();

const roomsLimiter = rateLimit({
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

let service = null;
function rooms() {
  if (!service) {
    service = createGameRoomService({
      db: getGameRoomsDb(),
      log: (message, meta) => logger.warn(message, meta),
    });
  }
  return service;
}

/** Wraps a handler: our own refusals become Problem Details, anything else goes to the error middleware. */
const handle = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (error) {
    const refusal = problemFor(error);
    if (refusal) return problem(res, refusal.status, refusal.code, refusal.title, refusal.detail);
    return next(error);
  }
};

const invalid = (res, detail) =>
  problem(res, 400, 'validation_invalid', 'Invalid table request', detail);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The optional optimistic-concurrency guard: the table version the caller last saw. */
function expectedVersionOf(body) {
  if (body.expectedVersion === undefined) return { value: undefined };
  return Number.isInteger(body.expectedVersion) && body.expectedVersion >= 0
    ? { value: body.expectedVersion }
    : { error: 'expectedVersion must be a whole number of zero or more.' };
}

const guard = (level) => [requireScope(`game:${level}`), requireGameAccount, roomsLimiter];

// ── Finding and creating tables ────────────────────────────────────────────────────────────────────

router.get(
  '/',
  ...guard('r'),
  handle(async (req, res) => {
    const scope = req.query.scope === undefined ? 'open' : req.query.scope;
    if (scope !== 'open' && scope !== 'mine')
      return invalid(res, "scope must be 'open' or 'mine'.");
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return invalid(res, 'limit must be a whole number from 1 to 200.');
    }
    return res.json({ items: await rooms().listRooms(req.userId, { scope, limit }) });
  }),
);

router.post(
  '/',
  ...guard('w'),
  handle(async (req, res) => {
    const body = req.body;
    if (!isObject(body)) return invalid(res, 'Send a JSON object.');
    if (typeof body.nickname !== 'string') return invalid(res, 'nickname must be a string.');
    if (!isObject(body.settings))
      return invalid(res, 'settings must be an object with at least a name.');
    if (body.language !== undefined && typeof body.language !== 'string') {
      return invalid(res, 'language must be a string.');
    }
    if (body.color !== undefined && typeof body.color !== 'string') {
      return invalid(res, 'color must be a string.');
    }
    const room = await rooms().createRoom(req.userId, body);
    return res.status(201).json(room);
  }),
);

router.post(
  '/join',
  ...guard('w'),
  handle(async (req, res) => {
    const body = req.body;
    if (!isObject(body)) return invalid(res, 'Send a JSON object.');
    if (typeof body.nickname !== 'string') return invalid(res, 'nickname must be a string.');
    for (const field of ['code', 'roomId', 'color']) {
      if (body[field] !== undefined && typeof body[field] !== 'string') {
        return invalid(res, `${field} must be a string.`);
      }
    }
    return res.json(await rooms().joinRoom(req.userId, body));
  }),
);

router.get(
  '/:roomId',
  ...guard('r'),
  handle(async (req, res) => res.json(await rooms().getRoom(req.userId, req.params.roomId))),
);

// ── The lobby, before play ─────────────────────────────────────────────────────────────────────────

/** A route that is one table command by the caller; `build` turns the request into it (or an error text). */
function lobbyRoute(method, path, build) {
  router[method](
    path,
    ...guard('w'),
    handle(async (req, res) => {
      const body = isObject(req.body) ? req.body : {};
      const version = expectedVersionOf(body);
      if (version.error) return invalid(res, version.error);
      const built = build(body, req);
      if (typeof built === 'string') return invalid(res, built);
      return res.json(
        await rooms().runCommand(req.userId, req.params.roomId, built, {
          expectedVersion: version.value,
        }),
      );
    }),
  );
}

lobbyRoute('post', '/:roomId/leave', () => ({ type: 'leave' }));

lobbyRoute('put', '/:roomId/ready', (body) =>
  typeof body.ready === 'boolean'
    ? { type: 'set_ready', ready: body.ready }
    : 'ready must be true or false.',
);

lobbyRoute('post', '/:roomId/kick', (body) => {
  if (!Number.isInteger(body.seat) || body.seat < 0) return 'seat must be a whole number from 0.';
  const seat = body.seat;
  // The seat is the public name of a player; the table knows them by account.
  return (table) => ({ type: 'kick', target: table.players[seat] ? table.players[seat].id : '' });
});

lobbyRoute('put', '/:roomId/settings', (body) =>
  isObject(body.settings)
    ? { type: 'update_settings', settings: body.settings }
    : 'settings must be an object.',
);

lobbyRoute('post', '/:roomId/start', () => ({ type: 'start' }));

lobbyRoute('put', '/:roomId/profession', (body) =>
  typeof body.professionId === 'string' && body.professionId
    ? { type: 'pick_profession', professionId: body.professionId }
    : 'professionId must be a profession id, or "random".',
);

router.delete(
  '/:roomId',
  ...guard('w'),
  handle(async (req, res) => {
    if (req.query.confirm !== 'true') {
      return invalid(res, 'Closing a table ends it for everyone: send ?confirm=true.');
    }
    return res.json(await rooms().runCommand(req.userId, req.params.roomId, { type: 'close' }));
  }),
);

module.exports = router;
module.exports.resetServiceForTests = () => {
  service = null;
};
