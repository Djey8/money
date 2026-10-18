'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getGameRoomsDb,
  getGameStatsDb,
  getUsersDb,
  getAuthDb,
  getGameSavesDb,
} = require('../config/db');
const logger = require('../config/logger');
const { requireScope, problem } = require('../middleware/api-auth');
const { requireGameAccount } = require('../middleware/game-account-guard');
const {
  BOT_LEVELS,
  botIdWithLevel,
  botProfile,
  botProfiles,
  splitBotId,
} = require('@money/domain/dist/cashflow-game/table/bot-catalog');
const { createGameRoomService, problemFor } = require('../services/game-rooms');
const { createGameStats } = require('../services/game-stats');
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
let statsService = null;
/** The one name per account: its nickname (the users database keeps it unencrypted in the account's info). */
async function nicknameOf(userId) {
  try {
    const doc = await getUsersDb().get(userId);
    const name = doc?.data?.info?.username;
    return typeof name === 'string' ? name.trim().slice(0, 24) : '';
  } catch {
    return '';
  }
}
/** The leaderboard: profiles and the result of every finished table (services/game-stats.js). */
function stats() {
  if (!statsService) {
    statsService = createGameStats({
      db: getGameStatsDb(),
      nicknameOf,
      log: (message, meta) => logger.warn(message, meta),
    });
  }
  return statsService;
}
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
      filer: (userId, books, name, multiplayer) =>
        fileFinishedGame(
          { usersDb: getUsersDb(), authDb: getAuthDb(), savesDb: getGameSavesDb() },
          userId,
          { books, name, multiplayer },
        ),
      // one name per account: the nickname of the account is the name at every table
      nicknameOf,
      stats: stats(),
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
    if (body.nickname !== undefined && typeof body.nickname !== 'string') {
      return invalid(res, 'nickname must be a string.');
    }
    if (!isObject(body.settings))
      return invalid(res, 'settings must be an object with at least a name.');
    if (body.language !== undefined && typeof body.language !== 'string') {
      return invalid(res, 'language must be a string.');
    }
    if (body.color !== undefined && typeof body.color !== 'string') {
      return invalid(res, 'color must be a string.');
    }
    if (body.initials !== undefined && typeof body.initials !== 'string') {
      return invalid(res, 'initials must be a string.');
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
    if (body.nickname !== undefined && typeof body.nickname !== 'string') {
      return invalid(res, 'nickname must be a string.');
    }
    for (const field of ['code', 'roomId', 'color', 'initials']) {
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
  handle(async (req, res) => {
    const profiles = botProfiles();
    const levels = Object.keys(BOT_LEVELS);
    const botIdOf = (id, level) => (level === 'master' ? id : `${id}--${level}`);
    // what each bot is rated now at each level (the board's rating, or the measured start while it has none)
    let ratings = {};
    try {
      ratings = await stats().currentBotRatings(
        profiles.flatMap((p) => levels.map((level) => botIdOf(p.id, level))),
      );
    } catch (error) {
      logger.warn('Bot ratings could not be read', { error: error.message });
    }
    res.json({
      items: profiles.map(({ id, name, difficulty, description }) => ({
        id,
        name,
        difficulty,
        description,
        ratings: Object.fromEntries(
          levels
            .filter((level) => ratings[botIdOf(id, level)] !== undefined)
            .map((level) => [level, ratings[botIdOf(id, level)]]),
        ),
      })),
      levels: Object.entries(BOT_LEVELS).map(([id, mistakes]) => ({ id, mistakes })),
    });
  }),
);

const MAX_WAIT_SECONDS = () => Number(process.env.GAME_ROOMS_MAX_WAIT_SECONDS) || 30;

/** A finished table also says whether it counted for the rating and what it did to each seat (once recorded). */
async function withRating(view) {
  if (view.table.phase !== 'finished') return view;
  try {
    const result = await require('../repositories/game-stats-store').getResult(
      getGameStatsDb(),
      view.id,
    );
    if (!result) return view;
    return {
      ...view,
      rating: {
        ranked: result.counted,
        ...(result.counted ? {} : { why: result.rankedWhy }),
        changes: result.participants.map((p) => ({
          seat: p.seat,
          before: Math.round(p.ratingBefore),
          after: Math.round(p.ratingAfter),
          delta: Math.round(p.delta * 10) / 10,
        })),
      },
    };
  } catch {
    return view;
  }
}

/** The table as an agent needs it to play: the seats without their books, and only the reader's own books. */
function slimView(view) {
  const { table } = view;
  return {
    id: view.id,
    version: table.version,
    phase: table.phase,
    activeSeat: table.activeSeat,
    youSeat: table.youSeat,
    holdSeats: table.holdSeats,
    paused: table.clock ? table.clock.pausedAt !== null : false,
    legalActions: view.legalActions,
    ...(view.rating ? { rating: view.rating } : {}),
    players: table.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      bot: !!p.bot,
      away: !!p.away,
      ...(p.seat === table.youSeat ? { books: p.books } : {}),
    })),
  };
}

/** Does the reader have something to do (or has the game ended)? */
function readerHasMove(view) {
  const { table } = view;
  if (table.phase !== 'playing') return table.phase !== 'lobby';
  if (table.youSeat === null || table.youSeat === undefined) return false;
  if (table.clock && table.clock.pausedAt !== null) return false;
  return (
    table.activeSeat === table.youSeat ||
    (Array.isArray(table.holdSeats) && table.holdSeats.includes(table.youSeat)) ||
    view.legalActions.some((a) => a.action === 'sell_position' || a.action === 'vote_undo')
  );
}

/**
 * `GET /game/rooms/{roomId}` - the table as the reader may see it. With `wait` the read is held open (up to `timeoutSeconds`,
 * at most 30) until something happens, so an agent makes one cheap call per turn instead of polling:
 * `wait=my_turn` returns as soon as the reader has a move (their turn, a seat in `holdSeats`, a position to sell, an undo vote)
 * or the game is over; `wait=change` returns when `version` passes `since`. A timeout answers the current state with
 * `waited: true, timedOut: true`. `slim=true` leaves other players' books out.
 */
router.get(
  '/:roomId',
  ...guard('r'),
  handle(async (req, res) => {
    const { wait, since, timeoutSeconds, slim } = req.query;
    const service = rooms();
    const wanted = wait === 'my_turn' || wait === 'change' ? wait : null;
    const seconds = Math.min(Math.max(Number(timeoutSeconds) || 25, 1), MAX_WAIT_SECONDS());
    const deadline = Date.now() + seconds * 1000;
    const shape = (view, extra) =>
      slim === 'true' || slim === '1' ? { ...slimView(view), ...extra } : { ...view, ...extra };
    let view = await withRating(await service.getRoom(req.userId, req.params.roomId));
    if (!wanted) return res.json(shape(view, {}));
    const sinceVersion = since === undefined ? null : Number(since);
    const ready = (current) =>
      wanted === 'my_turn'
        ? readerHasMove(current)
        : sinceVersion !== null && current.table.version > sinceVersion;
    while (!ready(view)) {
      const left = deadline - Date.now();
      if (left <= 0) return res.json(shape(view, { waited: true, timedOut: true }));
      await hub.waitForChange(req.params.roomId, left);
      view = await withRating(await service.getRoom(req.userId, req.params.roomId));
    }
    return res.json(shape(view, { waited: true, timedOut: false }));
  }),
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

    // a comment keeps proxies from closing an idle line; the named `ping` is what a client can see (a line that goes quiet is dead)
    const beat = setInterval(() => {
      res.write(': heartbeat\n\n');
      res.write(frame('ping', undefined, { at: Date.now() }));
    }, heartbeatMs());
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
  if (body.level !== undefined && !Object.prototype.hasOwnProperty.call(BOT_LEVELS, body.level)) {
    return `level must be one of: ${Object.keys(BOT_LEVELS).join(', ')}.`;
  }
  const parts = splitBotId(body.policyId);
  if (!parts) return `Unknown bot '${body.policyId}': see GET /game/rooms/bots.`;
  // a level given on its own applies to a plain bot id; a bot id that already carries one keeps it
  const policyId =
    body.level !== undefined && parts.level === 'master'
      ? botIdWithLevel(parts.base, body.level)
      : body.policyId;
  const profile = botProfile(policyId);
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
 * `POST /game/rooms/{roomId}/rewind?confirm=true` - asks the table to go back to the start of the previous turn (a repair for a
 * mishap; the dice carry on, everyone sees it in the log). It happens when more than half of the people agree: this is the
 * `propose_undo` move, the others answer with `vote_undo`. Takes the same `clientCommandId` / `expectedVersion` as a move.
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

/** `POST /game/rooms/{roomId}/forget` - takes the table off my lists (a table I left, or that is over). */
router.post(
  '/:roomId/forget',
  ...guard('w'),
  handle(async (req, res) => res.json(await rooms().forgetRoom(req.userId, req.params.roomId))),
);

router.delete(
  '/:roomId',
  ...guard('w'),
  handle(async (req, res) => {
    if (req.query.confirm !== 'true') {
      return invalid(res, 'Closing a table ends it for everyone: send ?confirm=true.');
    }
    // `?remove=true`: the host takes the table away altogether (it is closed for everyone first, then deleted)
    if (req.query.remove === 'true') {
      return res.json(await rooms().removeRoom(req.userId, req.params.roomId));
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
module.exports.stats = stats;
module.exports.nicknameOf = nicknameOf;
/**
 * The account changed its nickname (the profile page or the settings API): the one name follows everywhere - the leaderboard
 * profile and the seat at every table. Never in the way of the change itself.
 */
/** The account was deleted: its leaderboard profile keeps the record but not the person. */
module.exports.afterAccountDeleted = async (userId) => {
  try {
    await stats().forgetAccount(userId);
  } catch (error) {
    logger.warn('account_forget_failed', { message: error.message });
  }
};
module.exports.afterNicknameChanged = async (userId, written) => {
  try {
    // the settings API keeps its own copy of the username; the nickname the app and the tables read is the account's info
    if (typeof written === 'string' && written.trim()) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const doc = await getUsersDb().get(userId);
        doc.data = doc.data || {};
        doc.data.info = { ...(doc.data.info || {}), username: written.trim().slice(0, 24) };
        try {
          await getUsersDb().insert(doc);
          break;
        } catch (error) {
          if (error.statusCode !== 409) throw error;
        }
      }
    }
    const name = await nicknameOf(userId);
    if (!name) return;
    await stats().refreshName(userId);
    await rooms().renamePlayer(userId, name);
  } catch (error) {
    logger.warn('nickname_sync_failed', { message: error.message });
  }
};
module.exports.clocks = clocks;
module.exports.bots = bots;
/** After a restart: arm the clock of every table being played. */
module.exports.startClocks = () => rooms().rearmAll();
