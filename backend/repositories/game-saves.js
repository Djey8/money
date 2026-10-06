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
const { GameActionError, loadContext } = require('./game-play');

/**
 * Saved games through the API (todo/cashflow-game-pro.md slice D4). They live exactly where the browser keeps them -
 * `data.cashflowGames.index` and `data.cashflowGames.games.<id>`, each `{ schema, payload }` with the payload the JSON,
 * gzipped, base64-encoded and encrypted as one string - so a game saved in the app loads here and the other way round.
 * Every saved game sits inside the user's one database document, so the document's size is watched: a save that would
 * fill more than `STORAGE_BUDGET_FRACTION` of what CouchDB accepts is refused until something is deleted.
 */

const COUCHDB_MAX_DOCUMENT_BYTES = Number(process.env.COUCHDB_MAX_DOCUMENT_BYTES) || 8388608;
const STORAGE_BUDGET_FRACTION = 0.8;
const MAX_WRITE_RETRIES = 10;

const refuse = (code, message) => new GameActionError(code, message);

function budgetBytes() {
  return Math.floor(COUCHDB_MAX_DOCUMENT_BYTES * STORAGE_BUDGET_FRACTION);
}

function documentBytes(data) {
  return Buffer.byteLength(JSON.stringify(data));
}

/** What one stored save takes up in the document, in bytes. */
function saveBytes(data, id) {
  const stored = data.cashflowGames?.games?.[id];
  return stored ? Buffer.byteLength(JSON.stringify(stored)) : 0;
}

function storageOf(data, savedGames) {
  const used = documentBytes(data);
  return {
    documentBytes: used,
    budgetBytes: budgetBytes(),
    remainingBytes: Math.max(0, budgetBytes() - used),
    limitBytes: COUCHDB_MAX_DOCUMENT_BYTES,
    gamesBytes: documentBytes(data.cashflowGames ?? {}),
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

function readBlob(data, id, session) {
  const blob = readPacked(data.cashflowGames?.games?.[id], session);
  if (!blob || !blob.snapshot) return null;
  if (blob.schema > SAVED_GAME_SCHEMA)
    throw refuse('GAME_RULE_REFUSED', 'This game was saved by a newer version.');
  return blob;
}

function writeBlob(data, id, blob, session) {
  const games = { ...data.cashflowGames?.games };
  if (blob === null) delete games[id];
  else games[id] = writePacked(blob, session);
  return { ...data, cashflowGames: { ...data.cashflowGames, games } };
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

/** Saves the running game into its slot (the first save gives it one). Returns the new data and the list entry. */
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
  next = writeBlob(next, id, blob, session);
  next = writeIndex(next, [...games.filter((candidate) => candidate.id !== id), summary], session);
  return { data: next, summary, state: nextState };
}

// ── Running an operation on the stored document ──────────────────────────────────────────────────

/** Loads the document, lets `operate` change it, stores it - retried on a concurrent change. */
async function withSaves(deps, userId, operate) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    const context = await loadContext(deps, userId);
    const outcome = await operate(context);
    if (!outcome.data) return outcome.result;
    try {
      await deps.usersDb.insert({
        ...context.userDoc,
        data: outcome.data,
        updatedAt: systemClock.nowIso(),
      });
      return {
        ...outcome.result,
        storage: storageOf(outcome.data, readIndex(outcome.data, context.session)),
      };
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw refuse('GAME_WRITE_CONFLICT', 'The account kept changing; try again.');
}

function assertRoom(data, session) {
  const used = documentBytes(data);
  if (used > budgetBytes()) {
    throw refuse(
      'GAME_STORAGE_FULL',
      `The account has no room for another saved game (${used} of ${budgetBytes()} bytes used). ` +
        `Delete saved games that are no longer needed (DELETE /game/saves/{id}, or POST /game/saves/prune), then save again.`,
    );
  }
  return readIndex(data, session);
}

function requireRunning(state) {
  if (!state.professionId) throw refuse('GAME_NOT_STARTED', 'No game is running.');
}

// ── The operations ────────────────────────────────────────────────────────────────────────────────

async function listSaves(deps, userId) {
  const context = await loadContext(deps, userId);
  const games = readIndex(context.data, context.session);
  return {
    games: sortSavedGames(games).map((game) => ({
      ...game,
      status: savedGameStatus(game),
      sizeBytes: saveBytes(context.data, game.id),
    })),
    currentGameId: context.state.gameId ?? null,
    storage: storageOf(context.data, games),
  };
}

async function getSave(deps, userId, id) {
  const context = await loadContext(deps, userId);
  const blob = readBlob(context.data, id, context.session);
  if (!blob) throw refuse('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
  return { ...blob.summary, status: savedGameStatus(blob.summary), steps: blob.steps ?? [] };
}

async function saveGame(deps, userId, options = {}) {
  return withSaves(deps, userId, async (context) => {
    requireRunning(context.state);
    const saved = saveRunning(context.data, context, options);
    assertRoom(saved.data, context.session);
    return {
      data: saved.data,
      result: {
        game: {
          ...saved.summary,
          status: savedGameStatus(saved.summary),
          sizeBytes: saveBytes(saved.data, saved.summary.id),
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
    assertRoom(saved.data, context.session);
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
      result: { game: { ...saved.summary, status: savedGameStatus(saved.summary) } },
    };
  });
}

/** Makes a saved game the live game; the running one (if it is another game) is saved first. */
async function loadSave(deps, userId, id) {
  return withSaves(deps, userId, async (context) => {
    const { session, state } = context;
    const blob = readBlob(context.data, id, session);
    if (!blob) throw refuse('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
    if (!isGameSnapshot(blob.snapshot))
      throw refuse('GAME_RULE_REFUSED', 'This saved game is damaged.');

    let data = context.data;
    if (state.professionId && state.gameId !== id) {
      data = saveRunning(data, context).data;
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
    assertRoom(restored, session);
    return { data: restored, result: { loaded: entry } };
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

/** Removes saved games; a running game that sat in one of the slots forgets its slot. */
function dropSaves(context, ids) {
  const { session, state } = context;
  const removed = new Set(ids);
  let data = context.data;
  const games = readIndex(data, session);
  for (const id of removed) data = writeBlob(data, id, null, session);
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
    return { data: dropSaves(context, [id]), result: { deleted: [id] } };
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
    return { data: dropSaves(context, doomed), result: { deleted: doomed } };
  });
}

module.exports = {
  listSaves,
  getSave,
  saveGame,
  endGame,
  loadSave,
  renameSave,
  deleteSave,
  pruneSaves,
  storageOf,
};
