'use strict';

const crypto = require('crypto');
const {
  systemClock,
  SAVED_GAME_SCHEMA,
  SAVED_GAME_AGENT_KEEP,
  sortSavedGames,
  savedGameStatus,
  summarizeGameFinances,
  cashOnHandMinor,
  isGameSnapshot,
  blankGameData,
  encodeUndoChain,
  isEncodedUndoChain,
  decodeUndoChain,
  buildLiveHistory,
  snapshotFromBooks,
  textOrFallback,
} = require('@money/domain');
const { encodeGameState } = require('../services/game-state-codec');
const { readBooks } = require('../services/game-writer');
const {
  readSnapshot,
  writeSnapshot,
  buildHistoryDocument,
  packJson,
  unpackJson,
} = require('../services/game-snapshot');
const { loadGameSets } = require('./game-repository');
const {
  SAVES_BUDGET_BYTES,
  readStoredGame,
  writeStoredGame,
  deleteStoredGame,
  storedGameSizes,
  embeddedGame,
  embeddedGameIds,
  migrateEmbeddedGames,
} = require('./game-save-store');
const { GameActionError, loadContext } = require('./game-play');

/**
 * Saved games through the API (todo/cashflow-game-pro.md slice D4). The small list of summaries lives where the browser
 * keeps it - `data.cashflowGames.index` in the user's document - and each game is a document of its own in the
 * `gamesaves` database (repositories/game-save-store.js), the same `{ schema, payload }` the browser writes to
 * `cashflowGames/games/<id>` (the payload is the JSON, gzipped, base64-encoded and encrypted as one string), so a game
 * saved in the app loads here and the other way round. What an account may keep is limited by a byte budget over all of
 * its saved games (`SAVES_BUDGET_BYTES`, 1 GiB unless set), and one game by what CouchDB accepts as a document.
 * Games saved before the move still sit inside the user's document; the first operation here moves them over.
 */

const COUCHDB_MAX_DOCUMENT_BYTES = Number(process.env.COUCHDB_MAX_DOCUMENT_BYTES) || 8388608;
const ONE_GAME_FRACTION = 0.9;
const MAX_WRITE_RETRIES = 10;

const refuse = (code, message) => new GameActionError(code, message);

function documentBytes(data) {
  return Buffer.byteLength(JSON.stringify(data));
}

/**
 * The storage report: `sizes` is every stored game's `{ id, bytes }`. `documentBytes` is the user's own document (the
 * index, the settings, the running game); `limitBytes` is what CouchDB accepts for one document - and so for one game.
 */
function storageOf(data, savedGames, sizes) {
  const gamesBytes = sizes.reduce((sum, entry) => sum + entry.bytes, 0);
  return {
    documentBytes: documentBytes(data),
    budgetBytes: SAVES_BUDGET_BYTES,
    remainingBytes: Math.max(0, SAVES_BUDGET_BYTES - gamesBytes),
    limitBytes: COUCHDB_MAX_DOCUMENT_BYTES,
    gamesBytes,
    gameCount: savedGames.length,
    keepAtMost: SAVED_GAME_AGENT_KEEP,
    overKeepBy: Math.max(0, savedGames.length - SAVED_GAME_AGENT_KEEP),
  };
}

// ── The stored form ───────────────────────────────────────────────────────────────────────────────

function readPacked(stored, session) {
  if (!stored || stored.payload == null) return null;
  const packed = session ? session.decrypt(stored.payload) : stored.payload;
  return unpackJson(packed);
}

function writePacked(value, session) {
  const payload = packJson(value);
  return {
    schema: session ? session.encrypt(String(SAVED_GAME_SCHEMA)) : SAVED_GAME_SCHEMA,
    payload: session ? session.encrypt(payload) : payload,
  };
}

function readIndex(data, session) {
  return readPacked(data.cashflowGames?.index, session)?.games ?? [];
}

function writeIndex(data, games, session) {
  return {
    ...data,
    cashflowGames: {
      ...data.cashflowGames,
      index: writePacked({ schema: SAVED_GAME_SCHEMA, games: sortSavedGames(games) }, session),
    },
  };
}

/** One saved game: from its own document, or - until the move has reached it - from the user's document. */
async function readBlob(deps, userId, data, id, session) {
  const stored = (await readStoredGame(deps.savesDb, userId, id)) ?? embeddedGame(data, id) ?? null;
  const blob = readPacked(stored, session);
  if (!blob || !blob.snapshot) return null;
  if (blob.schema > SAVED_GAME_SCHEMA)
    throw refuse('GAME_RULE_REFUSED', 'This game was saved by a newer version.');
  return blob;
}

/** The stored form of a blob, ready for the games store, and its size. */
function packedBlob(blob, session) {
  const value = writePacked(blob, session);
  return { value, bytes: Buffer.byteLength(JSON.stringify(value)) };
}

// ── Building a save ───────────────────────────────────────────────────────────────────────────────

function newGameId() {
  return `game_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
}

function defaultName(context, state) {
  const gameSet = loadGameSets().find((candidate) => candidate.id === state.gameSetId);
  const profession = gameSet?.professions.find((candidate) => candidate.id === state.professionId);
  const title = textOrFallback(
    context.gameDeps.text,
    `CashflowGame.profession.${state.professionId}.title`,
    profession?.title ?? 'Cashflow',
  );
  const date = new Date();
  const day = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  return `${title} · ${day}`;
}

/** The summary of the running game: what the games list shows without opening the snapshot. */
function liveSummary(books, settings) {
  const finances = summarizeGameFinances(books.state, books.subscriptions);
  const bankLoan = books.liabilities.find((liability) => liability.tag === 'Bank loan');
  return {
    gameSetId: books.state.gameSetId,
    professionId: books.state.professionId,
    round: books.state.round,
    virtualDate: books.state.virtualDate,
    cashMinor: cashOnHandMinor(books.transactions, books.allocation),
    salaryMinor: finances.salaryMinor,
    passiveIncomeMinor: finances.passiveIncomeMinor,
    expensesMinor: finances.expensesMinor,
    monthlyCashflowMinor: finances.monthlyCashflowMinor,
    bankLoanMinor: bankLoan?.amountMinor ?? 0,
    children: books.state.children,
    transactionCount: books.transactions.length,
    escapedRatRace: finances.escapedRatRace,
    bankrupt: finances.bankrupt,
    language: settings.language,
  };
}

function stepLog(stack, live, context) {
  return buildLiveHistory(
    stack,
    live,
    { text: context.gameDeps.text, money: context.gameDeps.money },
    systemClock.nowIso(),
  ).steps;
}

/**
 * Saves the running game into its slot (the first save gives it one). Returns the new data (the state and the index -
 * the game itself is not in it), the list entry and the `blob` to store under `summary.id`.
 */
function saveRunning(data, context, options = {}) {
  const { session, settings, state, history } = context;
  let id = state.gameId;
  let name = options.name ?? state.gameName;
  let nextState = state;
  let next = data;
  if (!id || !name) {
    id = id ?? newGameId();
    name = name ?? defaultName(context, state);
  }
  if (state.gameId !== id || state.gameName !== name) {
    nextState = { ...state, gameId: id, gameName: name };
    next = { ...next, cashflowGame: encodeGameState(nextState, session) };
  }
  const gameSet = loadGameSets().find((candidate) => candidate.id === state.gameSetId);
  const books = readBooks(next, session, {
    state: nextState,
    allocation: settings.allocation,
    gameSet,
  });
  const now = systemClock.nowIso();
  const games = readIndex(next, session);
  const existing = games.find((candidate) => candidate.id === id);
  const live = readSnapshot(next, session);
  const summary = {
    ...liveSummary(books, settings),
    id,
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(options.ended ? { endedAt: now } : {}),
  };
  const blob = {
    schema: SAVED_GAME_SCHEMA,
    summary,
    steps: stepLog(history.stack, live, context),
    snapshot: live,
    // A compact save keeps the plain step log but not the undo chain, which is most of a save's size.
    ...(options.compact ? {} : { undo: encodeUndoChain(history.stack) }),
  };
  next = writeIndex(next, [...games.filter((candidate) => candidate.id !== id), summary], session);
  return { data: next, summary, state: nextState, blob };
}

// ── Running an operation on the stored document ──────────────────────────────────────────────────

/** The context of the account, with any game still inside the user's document moved to its own document first. */
async function loadSavesContext(deps, userId) {
  const context = await loadContext(deps, userId);
  if (embeddedGameIds(context.data).length === 0) return context;
  await migrateEmbeddedGames(deps, userId);
  return loadContext(deps, userId);
}

/**
 * Loads the account, lets `operate` change it and stores the result - retried on a concurrent change. `operate`
 * returns the new user-document `data` and, for the games it changed, `blobs`: `{ id, blob }` (save this game) or
 * `{ id, blob: null }` (delete it). Games are stored before the document is written and deleted after it, so a failure
 * in between never leaves the index pointing at a game that is not there.
 */
async function withSaves(deps, userId, operate) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    const context = await loadSavesContext(deps, userId);
    const sizes = await storedGameSizes(deps.savesDb, userId);
    const outcome = await operate({ ...context, sizes });
    if (!outcome.data) return outcome.result;

    const packed = new Map();
    for (const { id, blob } of outcome.blobs ?? []) {
      if (blob !== null) packed.set(id, packedBlob(blob, context.session));
    }
    assertRoom(sizes, outcome.blobs ?? [], packed);

    for (const [id, { value }] of packed) await writeStoredGame(deps.savesDb, userId, id, value);
    try {
      await deps.usersDb.insert({
        ...context.userDoc,
        data: outcome.data,
        updatedAt: systemClock.nowIso(),
      });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
      continue;
    }
    for (const { id, blob } of outcome.blobs ?? []) {
      if (blob === null) await deleteStoredGame(deps.savesDb, userId, id);
    }
    const after = new Map(sizes.map((entry) => [entry.id, entry.bytes]));
    for (const { id, blob } of outcome.blobs ?? []) {
      if (blob === null) after.delete(id);
      else after.set(id, packed.get(id).bytes);
    }
    return {
      ...outcome.result,
      storage: storageOf(
        outcome.data,
        readIndex(outcome.data, context.session),
        [...after].map(([id, bytes]) => ({ id, bytes })),
      ),
    };
  }
  throw refuse('GAME_WRITE_CONFLICT', 'The account kept changing; try again.');
}

/** Refuses a save that would not fit: one game above what CouchDB accepts, or the account's games above the budget. */
function assertRoom(sizes, blobs, packed) {
  const oneGameLimit = Math.floor(COUCHDB_MAX_DOCUMENT_BYTES * ONE_GAME_FRACTION);
  for (const [id, { bytes }] of packed) {
    if (bytes > oneGameLimit) {
      throw refuse(
        'GAME_STORAGE_FULL',
        `Saved game ${id} is too large to store (${bytes} of ${oneGameLimit} bytes allowed for one game). ` +
          'Save it compact (the undo history left out) instead.',
      );
    }
  }
  const sizeOf = new Map(sizes.map((entry) => [entry.id, entry.bytes]));
  for (const { id, blob } of blobs) {
    if (blob === null) sizeOf.delete(id);
    else sizeOf.set(id, packed.get(id).bytes);
  }
  const used = [...sizeOf.values()].reduce((sum, bytes) => sum + bytes, 0);
  if (used > SAVES_BUDGET_BYTES) {
    throw refuse(
      'GAME_STORAGE_FULL',
      `The account has no room for another saved game (${used} of ${SAVES_BUDGET_BYTES} bytes used). ` +
        'Delete saved games that are no longer needed (DELETE /game/saves/{id}, or POST /game/saves/prune), then save again.',
    );
  }
}

function requireRunning(state) {
  if (!state.professionId) throw refuse('GAME_NOT_STARTED', 'No game is running.');
}

// ── The operations ────────────────────────────────────────────────────────────────────────────────

/**
 * Files the final books of a finished multiplayer game in the player's own saved games (todo/cashflow-multiplayer.md slice S5):
 * the same `{ schema, payload }` a solo save is, encrypted with the account's key, so it opens in the games list and loads
 * like any other - as a game that has ended, without an undo history (a table has none to give). `books` are the player's
 * books at the table; nothing about the other players or the table goes into it.
 */
async function fileFinishedGame(deps, userId, { books, name, multiplayer }) {
  return withSaves(deps, userId, async (context) => {
    const { session, settings, data } = context;
    const id = newGameId();
    const now = systemClock.nowIso();
    const named = { ...books, state: { ...books.state, gameId: id, gameName: name } };
    const summary = {
      ...liveSummary(named, settings),
      id,
      name,
      createdAt: now,
      updatedAt: now,
      endedAt: now,
      ...(multiplayer ? { multiplayer } : {}),
    };
    const blob = {
      schema: SAVED_GAME_SCHEMA,
      summary,
      steps: [],
      snapshot: snapshotFromBooks(named),
    };
    const games = readIndex(data, session);
    return {
      data: writeIndex(data, [...games, summary], session),
      blobs: [{ id, blob }],
      result: { id, summary: { ...summary, status: savedGameStatus(summary) } },
    };
  });
}

async function listSaves(deps, userId) {
  const context = await loadSavesContext(deps, userId);
  const games = readIndex(context.data, context.session);
  const sizes = await storedGameSizes(deps.savesDb, userId);
  const sizeOf = new Map(sizes.map((entry) => [entry.id, entry.bytes]));
  return {
    games: sortSavedGames(games).map((game) => ({
      ...game,
      status: savedGameStatus(game),
      sizeBytes: sizeOf.get(game.id) ?? 0,
    })),
    currentGameId: context.state.gameId ?? null,
    storage: storageOf(context.data, games, sizes),
  };
}

async function getSave(deps, userId, id) {
  const context = await loadContext(deps, userId);
  const blob = await readBlob(deps, userId, context.data, id, context.session);
  if (!blob) throw refuse('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
  return { ...blob.summary, status: savedGameStatus(blob.summary), steps: blob.steps ?? [] };
}

async function saveGame(deps, userId, options = {}) {
  return withSaves(deps, userId, async (context) => {
    requireRunning(context.state);
    const saved = saveRunning(context.data, context, options);
    return {
      data: saved.data,
      blobs: [{ id: saved.summary.id, blob: saved.blob }],
      result: {
        game: {
          ...saved.summary,
          status: savedGameStatus(saved.summary),
          sizeBytes: packedBlob(saved.blob, context.session).bytes,
        },
      },
    };
  });
}

/** Ends the running game on purpose: saved with an "ended" mark, the account cleared for the next one. */
async function endGame(deps, userId, options = {}) {
  return withSaves(deps, userId, async (context) => {
    requireRunning(context.state);
    const saved = saveRunning(context.data, context, { ...options, ended: true });
    const cleared = writeSnapshot(saved.data, blankGameData(), context.session);
    const withEmptyHistory = {
      ...cleared,
      cashflowGameHistory: buildHistoryDocument(
        [],
        readSnapshot(cleared, context.session),
        { text: context.gameDeps.text, money: context.gameDeps.money },
        systemClock.nowIso(),
        context.session,
      ),
    };
    return {
      data: withEmptyHistory,
      blobs: [{ id: saved.summary.id, blob: saved.blob }],
      result: { game: { ...saved.summary, status: savedGameStatus(saved.summary) } },
    };
  });
}

/** Makes a saved game the live game; the running one (if it is another game) is saved first. */
async function loadSave(deps, userId, id) {
  return withSaves(deps, userId, async (context) => {
    const { session, state } = context;
    const blob = await readBlob(deps, userId, context.data, id, session);
    if (!blob) throw refuse('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
    if (!isGameSnapshot(blob.snapshot))
      throw refuse('GAME_RULE_REFUSED', 'This saved game is damaged.');

    let data = context.data;
    const blobs = [];
    if (state.professionId && state.gameId !== id) {
      const running = saveRunning(data, context);
      data = running.data;
      blobs.push({ id: running.summary.id, blob: running.blob });
    }
    const games = readIndex(data, session);
    const listed = games.find((candidate) => candidate.id === id);
    const snapshot = {
      ...blob.snapshot,
      cashflowGame: {
        ...blob.snapshot.cashflowGame,
        gameId: id,
        gameName: listed?.name ?? blob.summary.name,
      },
    };
    let restored = writeSnapshot(data, snapshot, session);
    const stack = isEncodedUndoChain(blob.undo) ? decodeUndoChain(blob.undo) : [];
    restored = {
      ...restored,
      cashflowGameHistory: buildHistoryDocument(
        stack,
        readSnapshot(restored, session),
        { text: context.gameDeps.text, money: context.gameDeps.money },
        systemClock.nowIso(),
        session,
      ),
    };
    // Continuing an ended game makes it a playing one again: its "ended" mark goes.
    const { endedAt: _ended, ...playing } = listed ?? blob.summary;
    const entry = { ...playing, updatedAt: systemClock.nowIso() };
    restored = writeIndex(
      restored,
      [...games.filter((candidate) => candidate.id !== id), entry],
      session,
    );
    return { data: restored, blobs, result: { loaded: entry } };
  });
}

async function renameSave(deps, userId, id, name) {
  return withSaves(deps, userId, async (context) => {
    const { session } = context;
    const games = readIndex(context.data, session);
    if (!games.some((game) => game.id === id)) {
      throw refuse('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
    }
    let data = writeIndex(
      context.data,
      games.map((game) => (game.id === id ? { ...game, name } : game)),
      session,
    );
    if (context.state.gameId === id) {
      data = {
        ...data,
        cashflowGame: encodeGameState({ ...context.state, gameName: name }, session),
      };
    }
    return { data, result: { renamed: { id, name } } };
  });
}

/** Removes saved games from the index; a running game that sat in one of the slots forgets its slot. */
function dropSaves(context, ids) {
  const { session, state } = context;
  const removed = new Set(ids);
  let data = context.data;
  const games = readIndex(data, session);
  data = writeIndex(
    data,
    games.filter((game) => !removed.has(game.id)),
    session,
  );
  if (state.gameId && removed.has(state.gameId)) {
    const { gameId: _id, gameName: _name, ...rest } = state;
    data = { ...data, cashflowGame: encodeGameState(rest, session) };
  }
  return data;
}

async function deleteSave(deps, userId, id) {
  return withSaves(deps, userId, async (context) => {
    const games = readIndex(context.data, context.session);
    if (!games.some((game) => game.id === id)) {
      throw refuse('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
    }
    return {
      data: dropSaves(context, [id]),
      blobs: [{ id, blob: null }],
      result: { deleted: [id] },
    };
  });
}

/**
 * The clean-up an agent owes after a session of analysis: keeps the saves named in `keepIds` and the `keepLatest` newest
 * ones, deletes the rest. Returns what went. Never touches the running game itself.
 */
async function pruneSaves(deps, userId, { keepIds = [], keepLatest = 0 }) {
  return withSaves(deps, userId, async (context) => {
    const games = sortSavedGames(readIndex(context.data, context.session));
    const keep = new Set([...keepIds, ...games.slice(0, keepLatest).map((game) => game.id)]);
    const doomed = games.filter((game) => !keep.has(game.id)).map((game) => game.id);
    if (doomed.length === 0) return { result: { deleted: [] } };
    return {
      data: dropSaves(context, doomed),
      blobs: doomed.map((id) => ({ id, blob: null })),
      result: { deleted: doomed },
    };
  });
}

module.exports = {
  fileFinishedGame,
  listSaves,
  getSave,
  saveGame,
  endGame,
  loadSave,
  renameSave,
  deleteSave,
  pruneSaves,
  storageOf,
  readBlob,
};
