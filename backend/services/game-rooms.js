'use strict';

const crypto = require('crypto');
const {
  applyCommand,
  createTable,
  projectFor,
  systemClock,
  TableCommandError,
} = require('@money/domain');
const store = require('../repositories/game-room-store');
const { RoomError } = require('./game-room-errors');
const { eventSeat, projectLog } = require('./game-room-stream');
const { createGameText } = require('./game-text');
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
    retentionMs: number('GAME_ROOMS_RETENTION_MS', 7 * DAY_MS),
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

const contexts = new Map();
/** What the domain needs from outside for a table played in `language`. */
function contextFor(language) {
  if (!contexts.has(language)) {
    const money = moneyFormat(language);
    contexts.set(language, {
      clock: systemClock,
      text: createGameText(language),
      money,
      plainMoney: money,
      cards: createCardTextSource(language),
    });
  }
  return contexts.get(language);
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
  };
}

/** The table and its events as the account `userId` may see them. */
function roomView(doc, userId) {
  const member = doc.table.players.some((p) => p.id === userId);
  return {
    id: doc.roomId,
    ...(member ? { inviteCode: doc.inviteCode } : {}),
    language: doc.language,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    table: projectFor(doc.table, userId),
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
    gameSetId: settings.gameSetId,
    rulesBase: settings.rulesBase,
    professions: settings.professions,
    turnOrder: settings.turnOrder,
    clock: settings.clock,
    endCondition: settings.endCondition,
    language: doc.language,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    joined: doc.table.players.some((p) => p.id === userId),
  };
}

/** Who holds a seat now, for the markers: an account id -> hosts. Closed rooms hold none. */
function desiredMarkers(table) {
  const wanted = new Map();
  if (!OPEN_PHASES.includes(table.phase)) return wanted;
  for (const player of table.players) {
    if (player.status === 'active') wanted.set(player.id, player.id === table.hostId);
  }
  return wanted;
}

/** The service over a database handle (the real one in production, a fake in tests). */
function createGameRoomService({ db, clock = systemClock, log = () => {}, hub = null }) {
  let lastSweep = -Infinity;
  const nowIso = () => clock.nowIso();
  const nowMs = () => Date.parse(clock.nowIso());

  /**
   * Saves `table` as the next state of `doc` (or a new room), then its events and the seat markers, then tells whoever is
   * connected. `previous` is the table before the change (null for a new room).
   */
  async function persist(doc, table, events, previous = null) {
    const firstSeq = (doc.eventSeq || 0) + 1;
    const saved = await store.saveRoom(db, {
      ...doc,
      ...listingFields(table),
      table,
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
    } catch (error) {
      // The table is saved - it is the truth; a missing event or marker is repaired by the next change and the sweep.
      log('game_room_side_write_failed', { roomId: doc.roomId, message: error.message });
    }
    if (hub) {
      hub.publish(doc.roomId, {
        previous,
        table,
        events: events.map((event, index) => ({ seq: firstSeq + index, event })),
      });
    }
    return saved;
  }

  async function assertCanSit(userId, { hosting }) {
    const cap = limits();
    const markers = await store.seatMarkers(db, userId);
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
    const { table, events } = createTable(
      {
        id: roomId,
        hostId: userId,
        hostName: input.nickname,
        hostColor: input.color,
        settings: input.settings,
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

  /** The table, as `userId` may see it (a stranger sees a public table as a spectator). */
  async function getRoom(userId, roomId) {
    return roomView(await loadFor(userId, roomId), userId);
  }

  /**
   * Applies one command for `userId` to a room and saves it. `command` is a command or a function of the current table that
   * returns one (a kick names a seat). With `expectedVersion` the table must still be at that version.
   */
  async function runCommand(userId, roomId, command, { expectedVersion, joining = false } = {}) {
    for (let attempt = 0; attempt < MAX_COMMAND_ATTEMPTS; attempt += 1) {
      const doc = await loadFor(userId, roomId, { joining });
      if (expectedVersion !== undefined && doc.table.version !== expectedVersion) {
        throw new RoomError(
          'room_conflict',
          409,
          `The table is at version ${doc.table.version}, not ${expectedVersion}.`,
        );
      }
      const next = typeof command === 'function' ? command(doc.table) : command;
      const result = applyCommand(doc.table, userId, next, contextFor(doc.language));
      try {
        const saved = await persist(doc, result.table, result.events, doc.table);
        return roomView(saved, userId);
      } catch (error) {
        if (!(error instanceof store.RoomConflictError)) throw error;
      }
    }
    throw new RoomError('room_conflict', 409, 'The table keeps changing: try again.');
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
    return runCommand(
      userId,
      doc.roomId,
      { type: 'join', name: input.nickname, color: input.color },
      { joining: true },
    );
  }

  /** The public tables with a free seat, or the tables `userId` sits at. */
  async function listRooms(userId, { scope = 'open', limit = 50 } = {}) {
    await maybeSweep();
    if (scope === 'mine') {
      const markers = await store.seatMarkers(db, userId);
      const docs = await store.getRooms(
        db,
        markers.map((m) => m.roomId),
      );
      return docs
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, limit)
        .map((doc) => roomSummary(doc, userId));
    }
    const docs = await store.listPublicRooms(db, 'lobby', limit);
    return docs
      .filter((doc) => doc.seatsTaken < doc.maxSeats)
      .map((doc) => roomSummary(doc, userId));
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
    const seated = first.table.players.some((p) => p.id === userId);
    if (!seated && !(first.visibility === 'public' && first.table.settings.spectators)) {
      throw new RoomError('room_forbidden', 403, 'This table does not allow spectators.');
    }
    const subscription = hub.subscribe(roomId, userId, hub.seatOf(first.table, userId));
    try {
      const doc = await loadFor(userId, roomId);
      const after = Number.isInteger(lastEventId) && lastEventId > 0 ? lastEventId : 0;
      const missed = after > 0 ? await store.readEvents(db, roomId, after, 200) : [];
      return {
        snapshot: (() => {
          const { table, ...room } = roomView(doc, userId);
          return { id: doc.eventSeq || 0, room, view: table };
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
      } else if (age > cap.retentionMs) {
        await store.deleteRoom(db, doc.roomId);
        done.deleted += 1;
      }
    }
    return done;
  }

  return { createRoom, getRoom, runCommand, joinRoom, listRooms, openStream, sweep };
}

module.exports = {
  createGameRoomService,
  RoomError,
  problemFor,
  limits,
  LANGUAGES,
};
