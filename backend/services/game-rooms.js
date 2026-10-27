'use strict';

const crypto = require('crypto');
const {
  applyCommand,
  botFallbackCommand,
  nextBotCommand,
  canAnswerTrade,
  seededRng,
  rewindTable,
  systemClock,
  TableCommandError,
} = require('@money/domain');
// the catalog of bots is data kept out of the domain package's barrel (the browser bundle must not carry it)
const { botPolicy } = require('@money/domain/dist/cashflow-game/table/bot-catalog');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');
const store = require('../repositories/game-room-store');
const { RoomError } = require('./game-room-errors');
const { createRoomQueue } = require('./room-queue');
const { eventSeat, projectLog, publicEvent } = require('./game-room-stream');
const { createGameText } = require('./game-text');
const { kindOf, kindNamed } = require('./game-room-kinds');
const { createCardTextSource } = require('./game-card-text');

/**
 * Multiplayer Cashflow rooms (todo/cashflow-multiplayer.md slice S1, docs/adr/0010): create, find, join and run a table's
 * lobby on the server. The rules are the domain's - this layer only loads the table, hands one command to `applyCommand`,
 * and saves the result with its events; nothing here reads or writes a personal account.
 *
 * Every change is one command on one room document, saved against the document's revision: if someone else saved first the
 * command is simply applied again to the newer table (commands are pure), so two players pressing at once never lose a move.
 */

const LANGUAGES = ['en', 'de', 'es', 'fr', 'cn', 'ar'];
const OPEN_PHASES = ['lobby', 'picking', 'playing'];
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;
const MAX_COMMAND_ATTEMPTS = 6;
/** When only bots are left: the moves played in one go before the table is saved, and the clock's step between two of them. */
const FAST_BATCH = 400;
const FAST_TICK_MS = 5000;
const COMMAND_LOG_SIZE = 200;
const FILING_STALE_MS = 60 * 1000;
const SWEEP_EVERY_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** What one account and the server allow; environment overrides are read at call time so a test can lower them. */
function limits() {
  return {
    maxHosted: number('GAME_ROOMS_MAX_HOSTED', 3),
    maxSeated: number('GAME_ROOMS_MAX_SEATED', 5),
    maxOpen: number('GAME_ROOMS_MAX_OPEN', 200),
    lobbyIdleMs: number('GAME_ROOMS_LOBBY_IDLE_MS', DAY_MS),
    playingIdleMs: number('GAME_ROOMS_PLAYING_IDLE_MS', 7 * DAY_MS),
    // a finished table stays readable for the people who played it, and from the leaderboard, for three months
    retentionMs: number('GAME_ROOMS_RETENTION_MS', 90 * DAY_MS),
  };
}

const notFound = () => new RoomError('room_not_found', 404, 'No table with that id or code.');

/** How a table rule refusal reads over HTTP. */
const TABLE_STATUS = {
  NOT_A_MEMBER: 403,
  NOT_HOST: 403,
  CANNOT_KICK_HOST: 403,
  UNKNOWN_PLAYER: 404,
  INVALID_NAME: 400,
  INVALID_SETTINGS: 400,
  UNKNOWN_PROFESSION: 400,
  UNKNOWN_COMMAND: 400,
  ILLEGAL_MOVE: 422,
};

/** Problem Details fields for any error this service throws, or null when it is not one of ours. */
function problemFor(error) {
  if (error instanceof RoomError) {
    return {
      status: error.status,
      code: error.code,
      title: 'Table request refused',
      detail: error.message,
    };
  }
  if (error instanceof TableCommandError) {
    return {
      status: TABLE_STATUS[error.code] || 409,
      code: `table_${error.code.toLowerCase()}`,
      title: 'Table request refused',
      detail: error.message,
    };
  }
  if (error instanceof store.RoomTooLargeError) {
    return { status: 413, code: 'room_too_large', title: 'Table too large', detail: error.message };
  }
  return null;
}

function moneyFormat(language) {
  const european = ['de', 'es', 'fr'].includes(language);
  return (amountMinor) => `${(amountMinor / 100).toLocaleString(european ? 'de-DE' : 'en-US')} €`;
}

function randomInviteCode() {
  const bytes = crypto.randomBytes(INVITE_LENGTH);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}

/** The fields the lobby list reads without opening the table. */
function listingFields(table) {
  const host = table.players.find((p) => p.id === table.hostId);
  return {
    name: table.settings.name,
    visibility: table.settings.visibility,
    phase: table.phase,
    maxSeats: table.settings.maxSeats,
    seatsTaken: table.players.filter((p) => p.status === 'active').length,
    hostName: host ? host.name : '',
    result: table.result
      ? {
          reason: table.result.reason,
          winnerName:
            (table.players.find((p) => p.id === table.result.winnerId) || {}).name ?? null,
        }
      : null,
  };
}

/** The table and its events as the account `userId` may see them. */
/** A finished table somebody saved is their record of the game (view, history, every player's books): it is kept. */
function isKept(doc) {
  return Object.values(doc.filed || {}).some((entry) => entry && (entry.id || entry.pending));
}

function roomView(doc, userId) {
  const member = doc.table.players.some((p) => p.id === userId);
  return {
    id: doc.roomId,
    ...(member ? { inviteCode: doc.inviteCode } : {}),
    language: doc.language,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    table: kindOf(doc.table).project(doc.table, userId),
    legalActions: kindOf(doc.table).legal(doc.table, userId),
  };
}

function roomSummary(doc, userId) {
  const { settings } = doc.table;
  return {
    id: doc.roomId,
    name: doc.name,
    hostName: doc.hostName,
    phase: doc.phase,
    visibility: doc.visibility,
    seatsTaken: doc.seatsTaken,
    maxSeats: doc.maxSeats,
    kind: doc.table.kind === 'dreamfund' ? 'dreamfund' : 'classic',
    ...(doc.table.kind === 'dreamfund'
      ? {
          difficulty: settings.difficulty,
          shape: settings.shape,
          size: settings.size,
          mode: settings.mode,
        }
      : {}),
    gameSetId: settings.gameSetId,
    rulesBase: settings.rulesBase,
    ranked: settings.ranked,
    professions: settings.professions,
    turnOrder: settings.turnOrder,
    clock: settings.clock,
    endCondition: settings.endCondition,
    language: doc.language,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    result: doc.result ?? null,
    joined: doc.table.players.some((p) => p.id === userId),
    hosting: doc.table.hostId === userId,
    humans: doc.table.players.filter((p) => !p.bot && p.status === 'active').length,
  };
}

/** Who holds a seat now, for the markers: an account id -> hosts. Closed rooms hold none. */
function desiredMarkers(table) {
  const wanted = new Map();
  if (OPEN_PHASES.includes(table.phase)) {
    for (const player of table.players) {
      if (player.status === 'active' && !player.bot) {
        wanted.set(player.id, { host: player.id === table.hostId, closed: false });
      }
    }
    return wanted;
  }
  // A table that is over keeps a marker for everyone who sat at it, flagged closed: the "recent tables" list reads them, the
  // limits do not count them, and they go with the room when it is deleted.
  for (const player of table.players) {
    if (!player.bot) wanted.set(player.id, { host: player.id === table.hostId, closed: true });
  }
  return wanted;
}

/** The service over a database handle (the real one in production, a fake in tests). */
function createGameRoomService({
  db,
  clock = systemClock,
  log = () => {},
  hub = null,
  stats = null,
  dreamStats = null,
  nicknameOf = async () => '',
  clocks = null,
  bots = null,
  filer = null,
}) {
  let lastSweep = -Infinity;
  /** Everything that changes a table waits in this line, in the order it arrived (services/room-queue.js). */
  const queue = createRoomQueue();

  const contexts = new Map();
  /** What the domain needs from outside for a table played in `language` (with this service's clock). */
  function contextFor(language) {
    if (!contexts.has(language)) {
      const money = moneyFormat(language);
      contexts.set(language, {
        clock,
        text: createGameText(language),
        money,
        plainMoney: money,
        cards: createCardTextSource(language),
        // the printed catalog is the server's: the domain package does not carry it
        gameSets: CASHFLOW_GAME_SETS,
      });
    }
    return contexts.get(language);
  }

  const nowIso = () => clock.nowIso();
  const nowMs = () => Date.parse(clock.nowIso());

  /**
   * Saves `table` as the next state of `doc` (or a new room), then its events, the seat markers and - when a turn has just
   * started - the snapshot the host's rewind goes back to; then tells whoever is connected and arms the table's clock.
   * `previous` is the table before the change (null for a new room). `options.turnSeq` sets the turn counter explicitly (a
   * rewind goes back one).
   */
  async function persist(doc, table, events, previous = null, options = {}) {
    const firstSeq = (doc.eventSeq || 0) + 1;
    const startsTurn = events.some((e) => e.type === 'turn_started' || e.type === 'play_started');
    const turnSeq =
      options.turnSeq !== undefined ? options.turnSeq : (doc.turnSeq || 0) + (startsTurn ? 1 : 0);
    const saved = await store.saveRoom(db, {
      ...doc,
      ...listingFields(table),
      table,
      turnSeq,
      eventSeq: firstSeq - 1 + events.length,
      updatedAt: nowIso(),
    });
    try {
      await store.appendEvents(
        db,
        doc.roomId,
        firstSeq,
        events.map((event) => ({ ...event, seat: eventSeat(previous, table, event) })),
      );
      await store.syncMarkers(db, doc.roomId, desiredMarkers(table));
      if (startsTurn && options.turnSeq === undefined) {
        await store.putSnapshot(db, doc.roomId, turnSeq, table);
      }
    } catch (error) {
      // The table is saved - it is the truth; a missing event, marker or snapshot is repaired by the next change.
      log('game_room_side_write_failed', { roomId: doc.roomId, message: error.message });
    }
    if (hub) {
      hub.publish(doc.roomId, {
        previous,
        table,
        events: events.map((event, index) => ({ seq: firstSeq + index, event })),
      });
    }
    // a game that has just ended goes onto the leaderboard (never in the way of the game itself)
    if (
      stats &&
      table.kind !== 'dreamfund' &&
      table.phase === 'finished' &&
      (!previous || previous.phase !== 'finished')
    ) {
      stats
        .record(saved)
        .catch((error) =>
          log('game_stats_record_failed', { roomId: doc.roomId, message: error.message }),
        );
    }
    // a Dreamfund game that has just ended goes onto its own board
    if (
      dreamStats &&
      table.kind === 'dreamfund' &&
      table.phase === 'finished' &&
      (!previous || previous.phase !== 'finished')
    ) {
      dreamStats
        .record(saved)
        .catch((error) =>
          log('game_dream_stats_record_failed', { roomId: doc.roomId, message: error.message }),
        );
    }
    if (clocks) clocks.arm(doc.roomId, kindOf(table).deadline(table));
    if (bots) bots.touch(doc.roomId, table);
    return saved;
  }

  async function assertCanSit(userId, { hosting }) {
    const cap = limits();
    const markers = (await store.seatMarkers(db, userId)).filter((m) => !m.closed);
    if (hosting && markers.filter((m) => m.host).length >= cap.maxHosted) {
      throw new RoomError(
        'room_limit',
        429,
        `You already host ${cap.maxHosted} open tables: finish or close one first.`,
      );
    }
    if (markers.length >= cap.maxSeated) {
      throw new RoomError(
        'room_limit',
        429,
        `You already sit at ${cap.maxSeated} open tables: leave one first.`,
      );
    }
    return markers;
  }

  async function maybeSweep() {
    if (nowMs() - lastSweep < SWEEP_EVERY_MS) return;
    lastSweep = nowMs();
    try {
      await sweep();
    } catch (error) {
      log('game_room_sweep_failed', { message: error.message });
    }
  }

  /** A new table with `userId` as host. */
  async function createRoom(userId, input) {
    await maybeSweep();
    if (!input || typeof input !== 'object') {
      throw new RoomError('validation_invalid', 400, 'A table needs a nickname and settings.');
    }
    const language = LANGUAGES.includes(input.language) ? input.language : 'en';
    await assertCanSit(userId, { hosting: true });
    if ((await store.countOpenRooms(db)) >= limits().maxOpen) {
      throw new RoomError('room_limit', 429, 'The server has no room for another table right now.');
    }
    const roomId = crypto.randomUUID();
    const kind = kindNamed(input.kind);
    const { table, events } = kind.create(
      {
        id: roomId,
        hostId: userId,
        // one name per account: the nickname, whatever the request says
        hostName: (await nicknameOf(userId)) || input.nickname || 'Player',
        hostColor: input.color,
        hostInitials: input.initials,
        // a table people create waits for everybody to say Continue after each turn, unless the host switched that off
        // the strict rules are the table's: nothing is added, changed or bought without a card (the solo game's strict mode)
        settings:
          kind.id === 'dreamfund'
            ? { turnGate: true, ...input.settings }
            : { turnGate: true, rulesBase: 'strict', ...input.settings },
        seed: crypto.randomInt(0, 2 ** 32),
      },
      contextFor(language),
    );
    let inviteCode = randomInviteCode();
    while (await store.findByInviteCode(db, inviteCode)) inviteCode = randomInviteCode();
    const created = nowIso();
    const doc = {
      kind: 'room',
      schema: 1,
      roomId,
      inviteCode,
      language,
      createdAt: created,
      eventSeq: 0,
    };
    const saved = await persist(doc, table, events, null);
    return roomView({ ...saved, roomId, inviteCode, language, createdAt: created }, userId);
  }

  async function loadFor(userId, roomId, { joining = false } = {}) {
    const doc = await store.getRoom(db, roomId);
    if (!doc) throw notFound();
    const member = doc.table.players.some((p) => p.id === userId);
    // A private table does not exist for anyone who is not at it - unless they came with its invite code.
    if (!member && doc.visibility === 'private' && !joining) throw notFound();
    return doc;
  }

  /**
   * A short review of a Dreamfund table for somebody who watches it (a person, or an agent asked "how are we doing?"): where every
   * player stands on the goals, what they have and owe, the pace against the simulation and what to watch. Anybody who may look at the
   * table may ask; nothing is saved. A classic table has no such review.
   */
  async function reviewRoom(userId, roomId) {
    const doc = await loadFor(userId, roomId);
    if (doc.table.kind !== 'dreamfund') {
      throw new RoomError(
        'review_not_available',
        400,
        'Only a Dreamfund table can be reviewed this way.',
      );
    }
    return { id: doc.roomId, version: doc.table.version, ...kindOf(doc.table).review(doc.table) };
  }

  /** The table, as `userId` may see it (a stranger sees a public table as a spectator). */
  async function getRoom(userId, roomId) {
    return roomView(await loadFor(userId, roomId), userId);
  }

  /**
   * Runs one change to a room for `userId`: loads it, lets `compute(doc)` produce `{ result, persistOptions? }` (a domain result
   * with the next table and its events), and saves it against the document's revision - if someone else saved first the whole
   * thing is applied again to the newer table. With `expectedVersion` the table must still be at that version. With
   * `clientCommandId` the change is applied **at most once**: the id is recorded in the same document write as the change, so a
   * retry - after a lost response, or two identical requests at once - finds it and gets `replayed: true` instead of a second
   * move. Returns `{ view, events, replayed, appliedVersion }`.
   */
  function execute(userId, roomId, compute, options = {}) {
    return queue.run(roomId, () => executeNow(userId, roomId, compute, options));
  }

  async function executeNow(
    userId,
    roomId,
    compute,
    { expectedVersion, joining = false, clientCommandId } = {},
  ) {
    const key = clientCommandId ? `${userId}:${clientCommandId}` : null;
    for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
      const doc = await loadFor(userId, roomId, { joining });
      const done = key && (doc.commandLog || []).find((entry) => entry.key === key);
      if (done) {
        return {
          view: roomView(doc, userId),
          events: [],
          replayed: true,
          appliedVersion: done.version,
        };
      }
      if (expectedVersion !== undefined && doc.table.version !== expectedVersion) {
        throw new RoomError(
          'room_conflict',
          409,
          `The table is at version ${doc.table.version}, not ${expectedVersion}.`,
        );
      }
      const { result, persistOptions } = await compute(doc);
      const commandLog = key
        ? [...(doc.commandLog || []), { key, version: result.table.version }].slice(
            -COMMAND_LOG_SIZE,
          )
        : doc.commandLog;
      try {
        const saved = await persist(
          { ...doc, commandLog },
          result.table,
          result.events,
          doc.table,
          persistOptions,
        );
        const firstSeq = saved.eventSeq - result.events.length + 1;
        return {
          view: roomView(saved, userId),
          events: result.events.map((event, index) =>
            publicEvent(firstSeq + index, eventSeat(doc.table, result.table, event), event),
          ),
          replayed: false,
          appliedVersion: result.table.version,
        };
      } catch (error) {
        if (!(error instanceof store.RoomConflictError)) throw error;
      }
    }
    throw new RoomError('room_conflict', 409, 'The table keeps changing: try again.');
  }

  /**
   * One command by `userId`: a command or a function of the current table that returns one (a kick names a seat). The rules
   * are the domain's `applyCommand`.
   */
  function runCommand(userId, roomId, command, options) {
    return execute(
      userId,
      roomId,
      async (doc) => {
        const next = typeof command === 'function' ? command(doc.table) : command;
        const ctx = contextFor(doc.language);
        if (next.type === 'propose_undo') {
          // asking is refused up front when there is no earlier turn to go back to
          const turnSeq = doc.turnSeq || 0;
          const snapshot = turnSeq >= 2 ? await store.getSnapshot(db, roomId, turnSeq - 1) : null;
          if (!snapshot) {
            throw new TableCommandError('ILLEGAL_MOVE', 'There is no earlier turn to go back to.');
          }
        }
        const result = kindOf(doc.table).apply(doc.table, userId, next, ctx);
        if (!result.events.some((event) => event.type === 'undo_approved')) return { result };
        // the table has voted to undo: go back to the start of the previous turn, in the same save
        const turnSeq = doc.turnSeq || 0;
        const snapshot = turnSeq >= 2 ? await store.getSnapshot(db, roomId, turnSeq - 1) : null;
        if (!snapshot) {
          throw new TableCommandError('ILLEGAL_MOVE', 'There is no earlier turn to go back to.');
        }
        const rewound = rewindTable(result.table, snapshot.table, result.table.hostId, ctx);
        return {
          result: { table: rewound.table, events: [...result.events, ...rewound.events] },
          persistOptions: { turnSeq: turnSeq - 1 },
        };
      },
      options,
    );
  }

  /**
   * Asks the table to go back one turn (`POST .../rewind`): the same as the `propose_undo` command - it happens when more than
   * half of the people at the table agree, at once when the asker is the only person (todo/cashflow-multiplayer-solo-ui.md).
   * The dice carry on; one step only - until another turn has begun there is nothing earlier to go back to.
   */
  function rewind(userId, roomId, options) {
    return runCommand(userId, roomId, { type: 'propose_undo' }, options);
  }

  /**
   * A table's clock rang (services/game-room-clocks.js): if the player on the move really is out of time the most passive turn is
   * played for them, saved and told to everyone like any other change; if not (they moved, the game is paused, the timer was a
   * hair early) the table just arms for the deadline it has. Safe to call at any time.
   */
  function runTimeout(roomId) {
    return queue.run(roomId, () => runTimeoutNow(roomId));
  }

  async function runTimeoutNow(roomId) {
    for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
      const doc = await store.getRoom(db, roomId);
      if (!doc || doc.table.phase !== 'playing') {
        if (clocks) clocks.disarm(roomId);
        return { fired: false };
      }
      let result;
      try {
        result = kindOf(doc.table).timeout(doc.table, contextFor(doc.language));
      } catch (error) {
        if (!(error instanceof TableCommandError)) throw error;
        if (clocks) clocks.arm(roomId, kindOf(doc.table).deadline(doc.table));
        return { fired: false };
      }
      try {
        await persist(doc, result.table, result.events, doc.table);
        return { fired: true };
      } catch (error) {
        if (!(error instanceof store.RoomConflictError)) throw error;
      }
    }
    throw new RoomError('room_conflict', 409, 'The table keeps changing: try again.');
  }

  /**
   * The bots of a table take their next move (services/game-room-bots.js calls this a moment after every change): the first
   * bot that has something to do plays ONE command - through the same rules, the same save and the same announcement as a
   * person's move - and the save wakes the driver again for the next. A move the rules refuse is replaced by the most passive
   * legal one; if even that is refused the bots wait for the table to change. Returns whether a bot moved.
   */
  /** The next move of the first bot that has one (the player on the move first), played through the rules; null when none has. */
  function botStep(table, ctx, now, roomId) {
    if (table.kind === 'dreamfund') return kindOf(table).botStep(table, ctx);
    const order = [
      ...table.players.filter((p) => p.id === table.activePlayerId),
      ...table.players.filter((p) => p.id !== table.activePlayerId),
    ].filter((p) => p.bot && p.status === 'active');
    for (const bot of order) {
      const policy = botPolicy(bot.bot.policyId);
      if (!policy) continue;
      const coin = seededRng((table.version * 2654435761) >>> 0);
      const command = nextBotCommand(table, bot.id, policy, coin, now);
      if (!command) continue;
      try {
        return applyCommand(table, bot.id, command, ctx);
      } catch (error) {
        if (!(error instanceof TableCommandError)) throw error;
        const fallback = botFallbackCommand(table, bot.id);
        if (!fallback) continue;
        try {
          return applyCommand(table, bot.id, fallback, ctx);
        } catch (again) {
          if (!(again instanceof TableCommandError)) throw again;
          log('game_room_bot_stuck', { roomId, bot: bot.name, message: again.message });
        }
      }
    }
    return null;
  }

  /**
   * Only bots are left in the game (every person escaped, went bankrupt or left): they play it to its end at once, no waiting between
   * moves - time is moved on with every move, so a bot waiting for answers to its offer is not waited for in real time. The moves are saved in
   * batches, so a table of ten bots is over in seconds, and the result is recorded like any other.
   */
  async function runBotsFast(doc, roomId) {
    let table = doc.table;
    const ctx = contextFor(doc.language);
    const events = [];
    let moved = false;
    const startedAt = Date.now();
    for (let step = 0; step < FAST_BATCH && table.phase === 'playing'; step += 1) {
      // time moves on with every move, so a bot waiting for answers to its offer is not waited for in real time
      const result = botStep(table, ctx, startedAt + step * FAST_TICK_MS, roomId);
      if (!result) break;
      table = result.table;
      events.push(...result.events);
      moved = true;
    }
    if (!moved) return { moved: false };
    try {
      await persist(doc, table, events, doc.table);
      return { moved: true };
    } catch (error) {
      if (!(error instanceof store.RoomConflictError)) throw error;
      // somebody moved meanwhile: look at the table again a moment later
      return { moved: false, waiting: true };
    }
  }

  function runBots(roomId) {
    return queue.run(roomId, () => runBotsNow(roomId));
  }

  async function runBotsNow(roomId) {
    for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
      const doc = await store.getRoom(db, roomId);
      if (!doc || doc.table.phase !== 'playing') return { moved: false };
      const table = doc.table;
      if (!table.players.some((p) => p.bot)) return { moved: false };
      if (kindOf(table).humansOut(table)) return runBotsFast(doc, roomId);
      const ctx = contextFor(doc.language);
      if (table.kind === 'dreamfund') {
        // one step of the first bot that has one (a step may be several commands of one decision), saved like any other change
        const stepped = kindOf(table).botStep(table, ctx);
        if (!stepped || stepped.table.version === table.version) return { moved: false };
        try {
          await persist(doc, stepped.table, stepped.events, table);
          return { moved: true };
        } catch (error) {
          if (!(error instanceof store.RoomConflictError)) throw error;
          continue;
        }
      }
      // the player on the move first, then the others (selling off turn, answering a trade offer)
      const order = [
        ...table.players.filter((p) => p.id === table.activePlayerId),
        ...table.players.filter((p) => p.id !== table.activePlayerId),
      ].filter((p) => p.bot && p.status === 'active');
      let result = null;
      for (const bot of order) {
        const policy = botPolicy(bot.bot.policyId);
        if (!policy) continue;
        const coin = seededRng((table.version * 2654435761) >>> 0);
        const command = nextBotCommand(table, bot.id, policy, coin, Date.now());
        if (!command) continue;
        try {
          result = applyCommand(table, bot.id, command, ctx);
        } catch (error) {
          if (!(error instanceof TableCommandError)) throw error;
          const fallback = botFallbackCommand(table, bot.id);
          if (!fallback) continue;
          try {
            result = applyCommand(table, bot.id, fallback, ctx);
          } catch (again) {
            if (!(again instanceof TableCommandError)) throw again;
            log('game_room_bot_stuck', { roomId, bot: bot.name, message: again.message });
            continue;
          }
        }
        break;
      }
      if (!result) {
        // a bot that has put a card to the table waits for the answers: it looks again a little later, nothing else wakes it
        const trade = table.trade;
        // a bot is also waiting while it lets an offer be before it answers (a person gets the first chance)
        const waiting =
          !!trade &&
          table.players.some(
            (p) =>
              p.bot &&
              p.status === 'active' &&
              (p.id === trade.sellerId || canAnswerTrade(table, p.id)),
          );
        return { moved: false, waiting };
      }
      try {
        await persist(doc, result.table, result.events, table);
        return { moved: true };
      } catch (error) {
        if (!(error instanceof store.RoomConflictError)) throw error;
      }
    }
    return { moved: false };
  }

  /** After a restart: arms the clock of every table that is being played, and wakes the bots at tables that have any. */
  async function rearmAll() {
    if (!clocks && !bots) return 0;
    const docs = await store.listPlayingRooms(db);
    for (const doc of docs) {
      if (clocks) clocks.arm(doc.roomId, kindOf(doc.table).deadline(doc.table));
      if (bots) bots.touch(doc.roomId, doc.table);
    }
    return docs.length;
  }

  /** Takes a seat at a public table by id, or at any table by invite code. */
  async function joinRoom(userId, input) {
    await maybeSweep();
    if (!input || typeof input !== 'object' || (!input.code && !input.roomId)) {
      throw new RoomError('validation_invalid', 400, 'Give the invite code or the table id.');
    }
    let doc;
    if (input.code) {
      doc = await store.findByInviteCode(db, String(input.code).trim().toUpperCase());
      if (!doc) throw notFound();
    } else {
      doc = await store.getRoom(db, String(input.roomId));
      if (
        !doc ||
        (doc.visibility === 'private' && !doc.table.players.some((p) => p.id === userId))
      ) {
        throw notFound();
      }
    }
    if (!doc.table.players.some((p) => p.id === userId))
      await assertCanSit(userId, { hosting: false });
    const joined = await runCommand(
      userId,
      doc.roomId,
      {
        type: 'join',
        name: (await nicknameOf(userId)) || input.nickname || 'Player',
        color: input.color,
        initials: input.initials,
      },
      { joining: true },
    );
    return joined.view;
  }

  /** The leaderboard service of a table's game: each game has a board of its own. */
  const boardOf = (table) => (table.kind === 'dreamfund' ? dreamStats : stats);

  /** Who sits at a table, for the lobby: the public profile of every seat (picture, rating, numbers) - for those who may see the table. */
  async function seatsOfRoom(userId, roomId) {
    const doc = await loadFor(userId, roomId);
    const board = boardOf(doc.table);
    return board ? board.seatsOf(doc.table) : [];
  }

  /** Whether both accounts sit at this table (a table-mate may see the other's picture, listed or not). */
  async function sitTogether(roomId, accountA, accountB) {
    const doc = await store.getRoom(db, roomId);
    if (!doc) return false;
    const ids = doc.table.players.map((p) => p.id);
    return ids.includes(accountA) && ids.includes(accountB);
  }

  /** The lobby lists carry who sits at each table (a short preview: name, picture, rating), so a player sees who is there before joining. */
  async function withSeats(summaries, docs) {
    if (!stats && !dreamStats) return summaries;
    const byId = new Map(docs.map((doc) => [doc.roomId, doc]));
    const out = [];
    for (const summary of summaries) {
      const doc = byId.get(summary.id);
      let seats = [];
      try {
        const board = doc && boardOf(doc.table);
        seats = board ? await board.seatsOf(doc.table) : [];
      } catch (error) {
        log('game_room_seats_failed', { roomId: summary.id, message: error.message });
      }
      out.push({
        ...summary,
        seats: seats.map((seat) => ({
          seat: seat.seat,
          name: seat.name,
          bot: seat.bot,
          listed: seat.listed,
          rating: seat.rating,
          ratedGames: seat.ratedGames,
          ...(seat.level ? { level: seat.level } : {}),
          ...(seat.playerId ? { playerId: seat.playerId } : {}),
          ...(seat.pictureVersion ? { pictureVersion: seat.pictureVersion } : {}),
        })),
      });
    }
    return out;
  }

  /** The public tables with a free seat, or the tables `userId` sits at. */
  async function listRooms(userId, { scope = 'open', limit = 50, kind = 'classic' } = {}) {
    await maybeSweep();
    // the two games are worlds of their own: a list shows one (the classic by default) or, asked for, both
    const ofKind = (doc) =>
      kind === 'all' || (doc.table.kind === 'dreamfund') === (kind === 'dreamfund');
    if (scope === 'mine' || scope === 'recent') {
      const wantClosed = scope === 'recent';
      const markers = (await store.seatMarkers(db, userId)).filter(
        (m) => Boolean(m.closed) === wantClosed,
      );
      const docs = await store.getRooms(
        db,
        markers.map((m) => m.roomId),
      );
      const picked = docs
        .filter((doc) => OPEN_PHASES.includes(doc.phase) !== wantClosed)
        .filter(ofKind)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, limit);
      return withSeats(
        picked.map((doc) => roomSummary(doc, userId)),
        picked,
      );
    }
    const docs = (await store.listPublicRooms(db, 'lobby', limit))
      .filter((doc) => doc.seatsTaken < doc.maxSeats)
      .filter(ofKind);
    return withSeats(
      docs.map((doc) => roomSummary(doc, userId)),
      docs,
    );
  }

  /** Who may follow a table: a seated player, or anyone with a game account at a public table that allows spectators. */
  function assertCanWatch(doc, userId) {
    const seated = doc.table.players.some((p) => p.id === userId);
    // a game that is over can be read by anyone with a game account (it opens from the leaderboard), at a public table
    const over = doc.table.phase === 'finished';
    if (!seated && !(doc.visibility === 'public' && (doc.table.settings.spectators || over))) {
      throw new RoomError('room_forbidden', 403, 'This table does not allow spectators.');
    }
  }

  /**
   * Opens the live channel to a table for `userId`: who may watch (a seated player; anyone with a game account at a public table
   * that allows spectators), the snapshot of the table as they may see it, and the log lines they missed since `lastEventId`.
   * The connection is registered before the table is read, so nothing that happens in between is lost. Returns
   * `{ snapshot, log, attach(sink), close() }`; `sink` is `{ send(name, id, data), end() }`.
   */
  async function openStream(userId, roomId, { lastEventId = 0 } = {}) {
    if (!hub) throw new RoomError('stream_unavailable', 503, 'Live tables are not available.');
    const first = await loadFor(userId, roomId);
    assertCanWatch(first, userId);
    const subscription = hub.subscribe(roomId, userId, hub.seatOf(first.table, userId));
    try {
      const doc = await loadFor(userId, roomId);
      const after = Number.isInteger(lastEventId) && lastEventId > 0 ? lastEventId : 0;
      // The room is saved before its events are appended: a connection that arrives in between would be given a table whose newest
      // events it can never read (the update that carries them is skipped, being at or below the snapshot's version). So the log is
      // read again, for a moment, until it reaches what the room says it holds.
      let missed = [];
      if (after > 0) {
        const wanted = doc.eventSeq || 0;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          missed = await store.readEvents(db, roomId, after, 200);
          const have = missed.length ? missed[missed.length - 1].seq : after;
          if (have >= wanted || missed.length >= 200) break;
          await new Promise((resolve) => setTimeout(resolve, 75));
        }
      }
      return {
        snapshot: (() => {
          const { table, legalActions, ...room } = roomView(doc, userId);
          return { id: doc.eventSeq || 0, room, view: table, legalActions };
        })(),
        log: projectLog(missed.filter((event) => event.seq <= (doc.eventSeq || 0))),
        attach: (sink) => subscription.attach(sink, doc.table.version),
        close: subscription.close,
      };
    } catch (error) {
      subscription.close();
      throw error;
    }
  }

  /**
   * A player files the final books of a finished game in their own saved games (slice S5). Only someone who played at the
   * table (they have books), only once it is over, and only once: the filing is reserved on the room document before it is made,
   * so two requests at once file one game, and a repeat is answered with the game already filed. `filer(userId, books, name)` is
   * the saved-games store (routes/game-rooms.js wires it); a table never touches an account itself.
   */
  async function fileGame(userId, roomId, { name } = {}) {
    if (!filer) throw new RoomError('filing_unavailable', 503, 'Filing games is not available.');
    for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
      const doc = await loadFor(userId, roomId);
      const player = doc.table.players.find((p) => p.id === userId);
      if (!player || !player.books) {
        throw new RoomError(
          'room_forbidden',
          403,
          'Only a player of this table can file its game.',
        );
      }
      if (doc.table.phase !== 'finished' && doc.table.phase !== 'abandoned') {
        throw new RoomError(
          'room_not_over',
          409,
          'The game is still being played: file it when it is over.',
        );
      }
      const filed = doc.filed || {};
      const earlier = filed[userId];
      if (earlier && earlier.id) return { id: earlier.id, alreadyFiled: true };
      if (earlier && earlier.pending && nowMs() - Date.parse(earlier.at) < FILING_STALE_MS) {
        throw new RoomError('filing_in_progress', 409, 'This game is being filed right now.');
      }
      try {
        await store.saveRoom(db, {
          ...doc,
          filed: { ...filed, [userId]: { pending: true, at: nowIso() } },
        });
      } catch (error) {
        if (error instanceof store.RoomConflictError) continue;
        throw error;
      }
      const gameSet = player.books.gameSet;
      const profession = gameSet?.professions?.find((p) => p.id === player.professionId);
      const label = `${doc.table.settings.name} · ${profession ? profession.title : 'Cashflow'}`;
      let result;
      try {
        // the game remembers it was played with others: the table, how many, and the place won
        const ranked = (doc.table.result?.ranking ?? []).find((entry) => entry.playerId === userId);
        result = await filer(
          userId,
          player.books,
          typeof name === 'string' && name.trim() ? name.trim() : label,
          {
            table: doc.table.settings.name,
            roomId: doc.roomId,
            players: doc.table.players.length,
            rank: ranked ? ranked.rank : null,
            outcome: ranked ? ranked.outcome : undefined,
          },
        );
      } catch (error) {
        await release(roomId, userId);
        throw error;
      }
      await record(roomId, userId, { id: result.id });
      return { ...result, alreadyFiled: false };
    }
    throw new RoomError('room_conflict', 409, 'The table keeps changing: try again.');
  }

  /** Writes one account's filing entry on the room document (retried on a concurrent change); `null` removes it. */
  async function record(roomId, userId, entry) {
    for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
      const doc = await store.getRoom(db, roomId);
      if (!doc) return;
      const filed = { ...(doc.filed || {}) };
      if (entry === null) delete filed[userId];
      else filed[userId] = entry;
      try {
        await store.saveRoom(db, { ...doc, filed });
        return;
      } catch (error) {
        if (!(error instanceof store.RoomConflictError)) throw error;
      }
    }
  }
  const release = (roomId, userId) => record(roomId, userId, null).catch(() => {});

  /**
   * The log of a table: its events by seat, oldest first, from after `after` (a log position) - the record of the game for a
   * viewer or an agent. Same access as the live channel.
   */
  async function readLog(userId, roomId, { after = 0, limit = 200 } = {}) {
    const doc = await loadFor(userId, roomId);
    assertCanWatch(doc, userId);
    const events = projectLog(await store.readEvents(db, roomId, after, limit));
    const last = events.length > 0 ? events[events.length - 1].seq : after;
    return { events, next: last, end: last >= (doc.eventSeq || 0) };
  }

  /**
   * The host takes the table away again (a table opened by mistake, a game that is not wanted any more): it is closed for
   * everyone who is at it - they are told, like any close - and then removed with its log and its snapshots, so it is gone from
   * every list. Only the host; whatever the phase. (Rules for what an owner may do come later: for now the owner may.)
   */
  async function removeRoom(userId, roomId) {
    const doc = await loadFor(userId, roomId);
    if (doc.table.hostId !== userId) {
      throw new TableCommandError('NOT_HOST', 'Only the host can remove the table.');
    }
    // other people are at it: it is not the host's to take away - they leave the game instead (resign)
    const others = doc.table.players.filter(
      (p) => !p.bot && p.status === 'active' && p.id !== userId,
    );
    if (OPEN_PHASES.includes(doc.table.phase) && others.length > 0) {
      throw new RoomError(
        'room_has_players',
        409,
        'Other players are at this table: leave the game instead of removing it.',
      );
    }
    if (isKept(doc)) {
      throw new RoomError(
        'room_kept',
        409,
        'Players saved this game: the table stays as their record and cannot be removed.',
      );
    }
    if (OPEN_PHASES.includes(doc.table.phase)) {
      const version = doc.table.version + 1;
      const closed = {
        ...doc.table,
        version,
        phase: 'abandoned',
        activePlayerId: null,
        hold: null,
      };
      await persist(doc, closed, [
        {
          version,
          at: nowIso(),
          type: 'table_closed',
          playerId: userId,
          data: { reason: 'host' },
        },
      ]).catch((error) => {
        // someone moved at the same moment: the removal goes on all the same
        if (!(error instanceof store.RoomConflictError)) throw error;
      });
    }
    if (clocks) clocks.disarm(roomId);
    if (bots) bots.clear(roomId);
    await store.deleteRoom(db, roomId);
    return { removed: true };
  }

  /**
   * The account changed its nickname: its seat in every table it sits at (or sat at and somebody saved) shows the new name. The
   * name stays unique at a table (a second "Anna" is "Anna (2)"). Nothing is added to the log; the next update carries the name.
   */
  async function renamePlayer(userId, name) {
    const markers = await store.seatMarkers(db, userId);
    let renamed = 0;
    for (const marker of markers) {
      for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
        const doc = await store.getRoom(db, marker.roomId);
        if (!doc) break;
        const me = doc.table.players.find((p) => p.id === userId);
        if (!me) break;
        const others = new Set(
          doc.table.players.filter((p) => p !== me).map((p) => p.name.toLowerCase()),
        );
        let next = name;
        for (let n = 2; others.has(next.toLowerCase()); n += 1) next = `${name} (${n})`;
        if (me.name === next) break;
        const players = doc.table.players.map((p) => (p === me ? { ...p, name: next } : p));
        try {
          await store.saveRoom(db, {
            ...doc,
            table: { ...doc.table, players },
            ...(doc.table.hostId === userId ? { hostName: next } : {}),
          });
          renamed += 1;
          break;
        } catch (error) {
          if (!(error instanceof store.RoomConflictError)) throw error;
        }
      }
    }
    return { renamed };
  }

  /**
   * Takes a table off the account's own lists (My tables, Recent tables) - nothing of the table itself changes. Not while the
   * account still plays at an open table (it leaves, or resigns, first).
   */
  async function forgetRoom(userId, roomId) {
    const doc = await store.getRoom(db, roomId);
    const me = doc ? doc.table.players.find((p) => p.id === userId) : null;
    if (doc && me && me.status === 'active' && OPEN_PHASES.includes(doc.table.phase)) {
      throw new RoomError(
        'room_still_playing',
        409,
        'You are still playing at this table: leave the game first.',
      );
    }
    await store.dropMarker(db, userId, roomId);
    return { forgotten: true };
  }

  /** Closes tables nobody has touched for too long and deletes old finished ones. Returns what it did. */
  async function sweep() {
    const cap = limits();
    const now = nowMs();
    const smallest = Math.min(cap.lobbyIdleMs, cap.playingIdleMs, cap.retentionMs);
    const idle = await store.findIdleRooms(db, new Date(now - smallest).toISOString());
    const done = { closed: 0, deleted: 0 };
    for (const doc of idle) {
      const age = now - Date.parse(doc.updatedAt);
      if (OPEN_PHASES.includes(doc.phase)) {
        const limit = doc.phase === 'playing' ? cap.playingIdleMs : cap.lobbyIdleMs;
        if (age <= limit) continue;
        const version = doc.table.version + 1;
        const closed = { ...doc.table, version, phase: 'abandoned', activePlayerId: null };
        try {
          await persist(doc, closed, [
            {
              version,
              at: nowIso(),
              type: 'table_closed',
              playerId: null,
              data: { reason: 'idle' },
            },
          ]);
          done.closed += 1;
        } catch (error) {
          if (!(error instanceof store.RoomConflictError)) throw error;
        }
      } else if (age > cap.retentionMs && !isKept(doc)) {
        if (clocks) clocks.disarm(doc.roomId);
        await store.deleteRoom(db, doc.roomId);
        done.deleted += 1;
      }
    }
    return done;
  }

  return {
    createRoom,
    getRoom,
    reviewRoom,
    seatsOfRoom,
    sitTogether,
    runCommand,
    removeRoom,
    forgetRoom,
    renamePlayer,
    rewind,
    runTimeout,
    runBots,
    rearmAll,
    fileGame,
    readLog,
    joinRoom,
    listRooms,
    openStream,
    sweep,
  };
}

module.exports = {
  createGameRoomService,
  RoomError,
  problemFor,
  limits,
  LANGUAGES,
};
