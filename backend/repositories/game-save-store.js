'use strict';

/**
 * Where saved Cashflow games live (JFK, 2026-10-10: "I want to store hundreds of games"). Each saved game is its own
 * document in the `gamesaves` database - `_id` is `<userId>:<gameId>` - instead of a field inside the user's one
 * document, which CouchDB refuses above `max_document_size` (8 MiB) and which a long full save (about 0.8 MB) filled up
 * after roughly eight games. The user document keeps only the small `cashflowGames/index`.
 *
 * A stored game is exactly what the browser writes to `cashflowGames/games/<id>`: `{ schema, payload }`, both already
 * encrypted by the caller. The store adds `bytes` (its own size, summed for the per-user budget) and bookkeeping.
 *
 * Saves written before this change still sit inside the user document (`data.cashflowGames.games.<id>`).
 * `embeddedGameIds` finds them and `migrateEmbeddedGames` moves them over; reads fall back to the embedded copy until
 * then, so nothing is unreadable in between.
 */

/** What one account may keep in saved games, in bytes (the disk is the limit, not CouchDB's document size). */
const SAVES_BUDGET_BYTES = Number(process.env.GAME_SAVES_BUDGET_BYTES) || 1024 * 1024 * 1024;
const MAX_WRITE_RETRIES = 10;
const GAME_PATH = /^cashflowGames\/games\/([^/]+)$/;

const documentId = (userId, gameId) => `${userId}:${gameId}`;

/** The game id when `path` is the data path of one saved game (`cashflowGames/games/<id>`), else null. */
function gamePathId(path) {
  const match = GAME_PATH.exec(String(path ?? ''));
  return match ? match[1] : null;
}

async function getDocument(db, userId, gameId) {
  try {
    return await db.get(documentId(userId, gameId));
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

/** The stored game `{ schema, payload }`, or null when this store has none under that id. */
async function readStoredGame(db, userId, gameId) {
  const doc = await getDocument(db, userId, gameId);
  return doc ? { schema: doc.schema, payload: doc.payload } : null;
}

/** Stores a game (replacing any earlier copy of it). Returns its size in bytes. */
async function writeStoredGame(db, userId, gameId, value) {
  const bytes = Buffer.byteLength(JSON.stringify(value));
  let attempt = 0;
  for (;;) {
    const existing = await getDocument(db, userId, gameId);
    try {
      await db.insert({
        _id: documentId(userId, gameId),
        ...(existing ? { _rev: existing._rev } : {}),
        userId,
        gameId,
        schema: value.schema,
        payload: value.payload,
        bytes,
        updatedAt: new Date().toISOString(),
      });
      return bytes;
    } catch (error) {
      if (error.statusCode !== 409 || (attempt += 1) >= MAX_WRITE_RETRIES) throw error;
    }
  }
}

/** Removes a stored game; false when there was none. */
async function deleteStoredGame(db, userId, gameId) {
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    const existing = await getDocument(db, userId, gameId);
    if (!existing) return false;
    try {
      await db.destroy(existing._id, existing._rev);
      return true;
    } catch (error) {
      if (error.statusCode === 404) return false;
      if (error.statusCode !== 409) throw error;
    }
  }
  throw new Error('The saved game kept changing while it was deleted.');
}

/** Every stored game of the account: `{ id, bytes }` (the payload itself is not read). */
async function storedGameSizes(db, userId) {
  const sizes = [];
  let bookmark;
  for (;;) {
    const page = await db.find({
      selector: { userId },
      fields: ['gameId', 'bytes'],
      limit: 500,
      ...(bookmark ? { bookmark } : {}),
    });
    for (const doc of page.docs) sizes.push({ id: doc.gameId, bytes: doc.bytes ?? 0 });
    if (page.docs.length < 500) return sizes;
    bookmark = page.bookmark;
  }
}

/** Deletes every stored game of the account (the account itself is being deleted). Returns how many went. */
async function deleteAllStoredGames(db, userId) {
  let removed = 0;
  for (const { id } of await storedGameSizes(db, userId)) {
    if (await deleteStoredGame(db, userId, id)) removed += 1;
  }
  return removed;
}

// ── Saves written before this store: still inside the user document ───────────────────────────────

/** The ids of games that still sit inside the user document. */
function embeddedGameIds(data) {
  return Object.keys(data?.cashflowGames?.games ?? {});
}

/** The embedded copy of one game (`{ schema, payload }`), or null. */
function embeddedGame(data, gameId) {
  return data?.cashflowGames?.games?.[gameId] ?? null;
}

/** A user document's `data` without the embedded games `ids` (the index stays). */
function withoutEmbedded(data, ids) {
  const games = { ...data.cashflowGames?.games };
  for (const id of ids) delete games[id];
  const cashflowGames = { ...data.cashflowGames };
  if (Object.keys(games).length > 0) cashflowGames.games = games;
  else delete cashflowGames.games;
  return { ...data, cashflowGames };
}

/**
 * Moves the games embedded in the user document into this store. Every game is written, read back and compared before
 * the document drops its copy, and the copy is dropped last, in one write - a failure part-way leaves the embedded
 * copies in place (reads keep working), and running it again finishes the job. Returns the ids that moved.
 */
async function migrateEmbeddedGames({ usersDb, savesDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode === 404) return [];
    throw error;
  }
  const ids = embeddedGameIds(userDoc.data);
  if (ids.length === 0) return [];

  const moved = [];
  for (const id of ids) {
    const value = embeddedGame(userDoc.data, id);
    if (!value || value.payload == null) continue;
    // A copy already in the store is the newer one (every write goes there and drops the embedded copy): keep it.
    if (!(await readStoredGame(savesDb, userId, id))) {
      await writeStoredGame(savesDb, userId, id, value);
      const back = await readStoredGame(savesDb, userId, id);
      if (!back || back.payload !== value.payload) {
        throw new Error(`Saved game ${id} did not read back the same after it was copied.`);
      }
    }
    moved.push(id);
  }

  // Dropping the embedded copies is a read-modify-write on the live document: retried on a concurrent change, and only
  // ever removes games that were just verified (never one that arrived since).
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    const current = await usersDb.get(userId);
    const stillThere = moved.filter((id) => embeddedGame(current.data, id) !== null);
    if (stillThere.length === 0) return moved;
    try {
      await usersDb.insert({
        ...current,
        data: withoutEmbedded(current.data, stillThere),
        updatedAt: new Date().toISOString(),
      });
      return moved;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }
  throw new Error(
    'The account kept changing while its saved games were moved; run the move again.',
  );
}

module.exports = {
  SAVES_BUDGET_BYTES,
  gamePathId,
  readStoredGame,
  writeStoredGame,
  deleteStoredGame,
  storedGameSizes,
  deleteAllStoredGames,
  embeddedGameIds,
  embeddedGame,
  withoutEmbedded,
  migrateEmbeddedGames,
};
