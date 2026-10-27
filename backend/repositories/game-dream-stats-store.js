'use strict';

/**
 * Where the Dreamfund leaderboard lives (todo/dreamfund-multiplayer.md, slice 8): the same `gamestats` database as the classic board, under
 * prefixes of its own - nothing of the two worlds is shared, read or counted together. Game accounts only.
 *
 *  - `dprofile:<playerId>`  a player of the Dreamfund board, human or bot: the public `playerId` (never an account id), the display name,
 *                           and a rating with its counters for each difficulty (`ratings.easy|medium|hard`).
 *  - `dresult:<tableId>`    what one finished table came to - who played, how they placed, how the ratings moved. Written once (a second
 *                           write of the same table is refused: that is what makes recording idempotent).
 */

const PROFILE_PREFIX = 'dprofile:';
const RESULT_PREFIX = 'dresult:';
/** How many applied tables a profile remembers, so applying a result twice (after a crash) changes nothing. */
const APPLIED_MEMORY = 60;

const profileId = (id) => `${PROFILE_PREFIX}${id}`;
const resultId = (id) => `${RESULT_PREFIX}${id}`;
const notFound = (error) => error && error.statusCode === 404;

class DreamStatsConflictError extends Error {
  constructor() {
    super('The document was changed by someone else at the same time.');
    this.name = 'DreamStatsConflictError';
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

async function createProfile(db, doc) {
  try {
    await db.insert({ ...doc, _id: profileId(doc.playerId), kind: 'dprofile' });
    return true;
  } catch (error) {
    if (error.statusCode === 409) return false;
    throw error;
  }
}

async function saveProfile(db, doc) {
  try {
    const result = await db.insert({ ...doc, _id: profileId(doc.playerId) });
    return { ...doc, _rev: result.rev };
  } catch (error) {
    if (error.statusCode === 409) throw new DreamStatsConflictError();
    throw error;
  }
}

/** The human profile of an account, or null. */
async function findHumanProfile(db, accountId) {
  const found = await db.find({ selector: { kind: 'dprofile', accountId }, limit: 1 });
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
    await db.insert({ ...doc, _id: resultId(doc.tableId), kind: 'dresult' });
    return true;
  } catch (error) {
    if (error.statusCode === 409) return false;
    throw error;
  }
}

/** The recent results one player took part in, newest first. */
async function resultsOfPlayer(db, playerId, limit = 20) {
  const found = await db.find({
    selector: { kind: 'dresult', playerIds: { $elemMatch: { $eq: playerId } } },
    limit: 500,
  });
  return found.docs
    .sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))
    .slice(0, limit);
}

/** Every profile of the board, visible or not. */
async function listProfiles(db) {
  const found = await db.find({ selector: { kind: 'dprofile' }, limit: 20000 });
  return found.docs;
}

module.exports = {
  APPLIED_MEMORY,
  DreamStatsConflictError,
  getProfile,
  createProfile,
  saveProfile,
  findHumanProfile,
  getResult,
  createResult,
  resultsOfPlayer,
  listProfiles,
};
