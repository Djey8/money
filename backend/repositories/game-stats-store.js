'use strict';

/**
 * Where the Cashflow leaderboard lives (todo/cashflow-leaderboard.md §3): the `gamestats` database. Game accounts only; nothing
 * here belongs to a personal account's books.
 *
 *  - `profile:<playerId>`  a player of the board, human or bot: the public `playerId` (a UUID, never an account id), the display
 *                          name, the rating and the counters. A human's `accountId` is stored here and never leaves the backend.
 *  - `result:<tableId>`    what one finished table came to - who played, how they placed, how the ratings moved. Written once
 *                          (a second write of the same table is refused: that is what makes recording idempotent), `applied` says
 *                          whether the profiles have taken it up.
 */

const PROFILE_PREFIX = 'profile:';
const RESULT_PREFIX = 'result:';
/** How many applied tables a profile remembers, so applying a result twice (after a crash) changes nothing. */
const APPLIED_MEMORY = 60;

const profileId = (id) => `${PROFILE_PREFIX}${id}`;
const resultId = (id) => `${RESULT_PREFIX}${id}`;
const notFound = (error) => error && error.statusCode === 404;

class StatsConflictError extends Error {
  constructor() {
    super('The document was changed by someone else at the same time.');
    this.name = 'StatsConflictError';
  }
}

async function getProfile(db, playerId) {
  try {
    return await db.get(profileId(playerId));
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/** Creates a profile; false when one with that id exists already. */
async function createProfile(db, doc) {
  try {
    await db.insert({ ...doc, _id: profileId(doc.playerId), kind: 'profile' });
    return true;
  } catch (error) {
    if (error.statusCode === 409) return false;
    throw error;
  }
}

/** Writes a profile that was read (its `_rev` must still be the newest). */
async function saveProfile(db, doc) {
  try {
    const result = await db.insert({ ...doc, _id: profileId(doc.playerId) });
    return { ...doc, _rev: result.rev };
  } catch (error) {
    if (error.statusCode === 409) throw new StatsConflictError();
    throw error;
  }
}

/** The human profile of an account, or null. */
async function findHumanProfile(db, accountId) {
  const found = await db.find({ selector: { kind: 'profile', accountId }, limit: 1 });
  return found.docs[0] || null;
}

async function getResult(db, tableId) {
  try {
    return await db.get(resultId(tableId));
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/** Creates the result of a table; false when that table has a result already. */
async function createResult(db, doc) {
  try {
    await db.insert({ ...doc, _id: resultId(doc.tableId), kind: 'result' });
    return true;
  } catch (error) {
    if (error.statusCode === 409) return false;
    throw error;
  }
}

async function saveResult(db, doc) {
  try {
    const result = await db.insert({ ...doc, _id: resultId(doc.tableId) });
    return { ...doc, _rev: result.rev };
  } catch (error) {
    if (error.statusCode === 409) throw new StatsConflictError();
    throw error;
  }
}

/** Results whose profiles have not all taken them up (a crash between the writes), oldest first. */
async function findUnappliedResults(db, limit = 50) {
  const found = await db.find({
    selector: { kind: 'result', applied: false },
    limit,
  });
  return found.docs.sort((a, b) => String(a.endedAt).localeCompare(String(b.endedAt)));
}

/** Every result, oldest first, in pages (for a rebuild). */
async function listResults(db, { after = '', limit = 200 } = {}) {
  const result = await db.list({
    startkey: after ? `${after}\u0000` : RESULT_PREFIX,
    endkey: `${RESULT_PREFIX}￿`,
    include_docs: true,
    limit,
  });
  return result.rows.map((row) => row.doc).filter(Boolean);
}

/** The recent results one player took part in, newest first. */
async function resultsOfPlayer(db, playerId, limit = 20) {
  const found = await db.find({
    selector: { kind: 'result', playerIds: { $elemMatch: { $eq: playerId } } },
    limit: 500,
  });
  return found.docs
    .sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))
    .slice(0, limit);
}

/** Every profile, visible or not (for the checks that look at all of them). */
async function listProfiles(db) {
  const found = await db.find({ selector: { kind: 'profile' }, limit: 20000 });
  return found.docs;
}

/** The board: profiles of a type that are visible, best rating first. */
async function listBoard(db, { type, minGames = 0, limit = 50, skip = 0 } = {}) {
  const selector = { kind: 'profile', visible: true, rated: { $gte: minGames } };
  if (type === 'human' || type === 'bot') selector.type = type;
  const found = await db.find({ selector, limit: 5000 });
  return found.docs
    .sort((a, b) => b.rating - a.rating || String(a.playerId).localeCompare(String(b.playerId)))
    .slice(skip, skip + limit);
}

module.exports = {
  APPLIED_MEMORY,
  StatsConflictError,
  getProfile,
  createProfile,
  saveProfile,
  findHumanProfile,
  getResult,
  createResult,
  saveResult,
  findUnappliedResults,
  listResults,
  resultsOfPlayer,
  listBoard,
  listProfiles,
};
