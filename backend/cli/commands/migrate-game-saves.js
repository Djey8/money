'use strict';

/**
 * `mm-admin migrate-game-saves --user <id> | --all` - moves saved Cashflow games that still sit inside a user's
 * document (`data.cashflowGames.games.<id>`, the layout before 2026-10-10) into documents of their own in the
 * `gamesaves` database. The API does the same for an account on its first saved-games request; this runs it up front,
 * for one account or all of them.
 *
 * Safe to run any time and as often as wanted: every game is written, read back and compared before the user document
 * drops its copy; a game that already has a document of its own is never overwritten with the embedded (older) copy.
 */

const { embeddedGameIds, migrateEmbeddedGames } = require('../../repositories/game-save-store');

async function allUserIds(usersDb) {
  const ids = [];
  let startkey;
  for (;;) {
    const page = await usersDb.list({
      limit: 500,
      ...(startkey ? { startkey, skip: 1 } : {}),
    });
    for (const row of page.rows) if (!row.id.startsWith('_design/')) ids.push(row.id);
    if (page.rows.length < 500) return ids;
    startkey = page.rows[page.rows.length - 1].id;
  }
}

async function migrateGameSaves(deps, { userId, all = false }) {
  if (!userId && !all) throw new Error('--user <id> or --all is required');
  const ids = all ? await allUserIds(deps.usersDb) : [userId];
  const moved = {};
  for (const id of ids) {
    let doc;
    try {
      doc = await deps.usersDb.get(id);
    } catch (error) {
      if (error.statusCode === 404) continue;
      throw error;
    }
    if (embeddedGameIds(doc.data).length === 0) continue;
    moved[id] = await migrateEmbeddedGames(deps, id);
  }
  return {
    accounts: Object.keys(moved).length,
    games: Object.values(moved).reduce((sum, list) => sum + list.length, 0),
    moved,
  };
}

module.exports = { migrateGameSaves };
