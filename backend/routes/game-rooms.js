'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getGameRoomsDb, getUsersDb, getAuthDb, getGameSavesDb } = require('../config/db');
const logger = require('../config/logger');
const { requireScope, problem } = require('../middleware/api-auth');
const { requireGameAccount } = require('../middleware/game-account-guard');
const { botProfiles, botProfile } = require('@money/domain/dist/cashflow-game/table/bot-catalog');
const { createGameRoomService, problemFor } = require('../services/game-rooms');
const { fileFinishedGame } = require('../repositories/game-saves');
const { GameActionError } = require('../repositories/game-play');
const { createGameRoomHub } = require('../services/game-room-hub');
const { createRoomClocks } = require('../services/game-room-clocks');
const { createBotDriver } = require('../services/game-room-bots');
const { parseCommand, parseGuards } = require('../services/game-room-commands');

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
const hub = createGameRoomHub();
// One timer per table that is being played with a clock; when it rings the service decides (services/game-room-clocks.js).
const clocks = createRoomClocks({
  onDue: (roomId) => rooms().runTimeout(roomId),
  log: (message, meta) => logger.warn(message, meta),
});
// One small timer per table with bots: after a change they take their next move (services/game-room-bots.js).
const bots = createBotDriver({
  run: (roomId) => rooms().runBots(roomId),
  log: (message, meta) => logger.warn(message, meta),
});
function rooms() {
  if (!service) {
    service = createGameRoomService({
      hub,
      clocks,
      bots,
      // A finished game is filed in a player's own saved games through the saved-games store (slice S5).
      filer: (userId, books, name) =>
        fileFinishedGame(
          { usersDb: getUsersDb(), authDb: getAuthDb(), savesDb: getGameSavesDb() },
          userId,
          { books, name },
        ),
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
    if (error instanceof GameActionError) {
      return problem(
        res,
        409,
        error.code.toLowerCase(),
        'Saved-game request refused',
        error.message,
      );
    }
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
    if (!['open', 'mine', 'recent'].includes(scope)) {
      return invalid(res, "scope must be 'open', 'mine' or 'recent'.");
    }
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

/**
 * `GET /game/rooms/bots` - the bots a host can seat: each with an id (the `policyId` to send), a name, a difficulty and a line on
 * how it plays. Declared before `/:roomId` so "bots" is not taken for a table id.
 */
router.get(
  '/bots',
  ...guard('r'),
  handle(async (req, res) =>
    res.json({
      items: botProfiles().map(({ id, name, difficulty, description }) => ({
        id,
        name,
        difficulty,
        description,
      })),
    }),
  ),
);

router.get(
  '/:roomId',
  ...guard('r'),
  handle(async (req, res) => res.json(await rooms().getRoom(req.userId, req.params.roomId))),
);

// ── The live channel ───────────────────────────────────────────────────────────────────────────────

const heartbeatMs = () => Number(process.env.GAME_ROOMS_HEARTBEAT_MS) || 25000;

/** One server-sent event: the name, the log position it brings the client to (`id`, so a reconnect can resume), the JSON. */
function frame(name, id, data) {
  const head = id === undefined ? '' : `id: ${id}\n`;
  return `${head}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * `GET /game/rooms/{roomId}/events` (text/event-stream). Sends, in this order: `snapshot` (the whole table as this viewer may
 * see it), `log` lines for events missed since `Last-Event-ID` (a reconnect), then live `update`s (the change's events and the
 * table, with books only for the players whose books changed) and `presence` (which seats are connected). A comment line
 * every 25 seconds keeps proxies from closing an idle stream. The channel answers errors as ordinary Problem Details before it
 * starts; once it has started, an ended connection is simply reconnected by the client.
 */
router.get(
  '/:roomId/events',
  ...guard('r'),
  handle(async (req, res) => {
    const raw = req.headers['last-event-id'] ?? req.query.lastEventId;
    const lastEventId = raw === undefined || raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(lastEventId) || lastEventId < 0) {
      return invalid(res, 'Last-Event-ID must be a whole number of zero or more.');
    }
    const stream = await rooms().openStream(req.userId, req.params.roomId, { lastEventId });

    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');
    res.write(
      frame('snapshot', stream.snapshot.id, {
        room: stream.snapshot.room,
        view: stream.snapshot.view,
        legalActions: stream.snapshot.legalActions,
      }),
    );
    for (const line of stream.log) res.write(frame('log', line.seq, line));

    const beat = setInterval(() => res.write(': heartbeat\n\n'), heartbeatMs());
    const finish = () => {
      clearInterval(beat);
      stream.close();
    };
    req.on('close', finish);
    res.on('error', finish);
    stream.attach({
      send: (name, id, data) => res.write(frame(name, id, data)),
      end: () => {
        finish();
        res.end();
      },
    });
    return undefined;
  }),
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
      const guards = parseGuards(body);
      if (guards.error) return invalid(res, guards.error);
      const built = build(body, req);
      if (typeof built === 'string') return invalid(res, built);
      const done = await rooms().runCommand(req.userId, req.params.roomId, built, {
        expectedVersion: version.value,
        clientCommandId: guards.clientCommandId,
      });
      return res.json(done.view);
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

/**
 * `POST /game/rooms/{roomId}/bots {policyId, name?, professionId?, color?}` - the host seats a bot in the lobby (remove it with the
 * kick of its seat). The bot plays by one of the strategies of `GET /game/rooms/bots`; it is always ready and picks its own
 * profession. Its moves are made by the server, through the same rules and the same log as anyone's.
 */
lobbyRoute('post', '/:roomId/bots', (body) => {
  if (typeof body.policyId !== 'string')
    return 'policyId must be the id of a bot (see GET /game/rooms/bots).';
  const profile = botProfile(body.policyId);
  if (!profile) return `Unknown bot '${body.policyId}': see GET /game/rooms/bots.`;
  if (body.name !== undefined && typeof body.name !== 'string') return 'name must be a string.';
  if (body.professionId !== undefined && typeof body.professionId !== 'string') {
    return 'professionId must be a profession id or "random".';
  }
  if (body.color !== undefined && typeof body.color !== 'string') return 'color must be a string.';
  return {
    type: 'add_bot',
    name: body.name !== undefined ? body.name : profile.name,
    policyId: profile.id,
    ...(body.professionId ? { professionId: body.professionId } : {}),
    ...(body.color ? { color: body.color } : {}),
  };
});

lobbyRoute('put', '/:roomId/profession', (body) =>
  typeof body.professionId === 'string' && body.professionId
    ? { type: 'pick_profession', professionId: body.professionId }
    : 'professionId must be a profession id, or "random".',
);

// ── Play ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * `POST /game/rooms/{roomId}/commands` - one move of play: `{ command, clientCommandId?, expectedVersion? }`. The command is one
 * of the types in `services/game-room-commands.js`; whether it is allowed now (your turn, the card in hand, the clock, a pause)
 * is the domain's rule. `clientCommandId` makes a retry safe (applied at most once), `expectedVersion` refuses a move on a
 * table that has moved on. Answers the table as you may see it, the events the move caused and your `legalActions`.
 */
router.post(
  '/:roomId/commands',
  ...guard('w'),
  handle(async (req, res) => {
    const body = req.body;
    if (!isObject(body)) return invalid(res, 'Send a JSON object.');
    const parsed = parseCommand(body.command);
    if (parsed.error) return invalid(res, parsed.error);
    const guards = parseGuards(body);
    if (guards.error) return invalid(res, guards.error);
    const done = await rooms().runCommand(req.userId, req.params.roomId, parsed.build, {
      expectedVersion: guards.expectedVersion,
      clientCommandId: guards.clientCommandId,
    });
    return res.json({
      ...done.view,
      events: done.events,
      replayed: done.replayed,
      appliedVersion: done.appliedVersion,
    });
  }),
);

/**
 * `POST /game/rooms/{roomId}/rewind?confirm=true` - the host puts the table back to the start of the previous turn (a repair for a
 * mishap; the dice carry on, everyone sees it in the log). Takes the same `clientCommandId` / `expectedVersion` as a move.
 */
router.post(
  '/:roomId/rewind',
  ...guard('w'),
  handle(async (req, res) => {
    if (req.query.confirm !== 'true') {
      return invalid(res, 'Rewinding undoes the last turn for everyone: send ?confirm=true.');
    }
    const body = isObject(req.body) ? req.body : {};
    const guards = parseGuards(body);
    if (guards.error) return invalid(res, guards.error);
    const done = await rooms().rewind(req.userId, req.params.roomId, {
      expectedVersion: guards.expectedVersion,
      clientCommandId: guards.clientCommandId,
    });
    return res.json({
      ...done.view,
      events: done.events,
      replayed: done.replayed,
      appliedVersion: done.appliedVersion,
    });
  }),
);

// ── After the game ─────────────────────────────────────────────────────────────────────────────────

/**
 * `POST /game/rooms/{roomId}/save {name?}` - a player files the final books of a finished (or closed) game in their own saved
 * games, once. Only someone who played at the table; the result is an ordinary saved game that ended. A repeat is answered with
 * the game already filed.
 */
router.post(
  '/:roomId/save',
  ...guard('w'),
  handle(async (req, res) => {
    const body = isObject(req.body) ? req.body : {};
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 120)) {
      return invalid(res, 'name must be a string of at most 120 characters.');
    }
    return res.json(await rooms().fileGame(req.userId, req.params.roomId, { name: body.name }));
  }),
);

/**
 * `GET /game/rooms/{roomId}/log?after=&limit=` - the record of a table: its events by seat, oldest first, from a log position.
 * Same access as the live channel.
 */
router.get(
  '/:roomId/log',
  ...guard('r'),
  handle(async (req, res) => {
    const after = req.query.after === undefined ? 0 : Number(req.query.after);
    const limit = req.query.limit === undefined ? 200 : Number(req.query.limit);
    if (!Number.isInteger(after) || after < 0)
      return invalid(res, 'after must be a whole number of zero or more.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      return invalid(res, 'limit must be a whole number from 1 to 1000.');
    }
    return res.json(await rooms().readLog(req.userId, req.params.roomId, { after, limit }));
  }),
);

router.delete(
  '/:roomId',
  ...guard('w'),
  handle(async (req, res) => {
    if (req.query.confirm !== 'true') {
      return invalid(res, 'Closing a table ends it for everyone: send ?confirm=true.');
    }
    const closed = await rooms().runCommand(req.userId, req.params.roomId, { type: 'close' });
    return res.json(closed.view);
  }),
);

module.exports = router;
module.exports.resetServiceForTests = () => {
  service = null;
};
module.exports.hub = hub;
module.exports.clocks = clocks;
module.exports.bots = bots;
/** After a restart: arm the clock of every table being played. */
module.exports.startClocks = () => rooms().rearmAll();
