'use strict';

// No query of the app may read every document of a database (JFK, 2026-11-04: nothing - browsing the community, the leaderboards,
// the saved games - may lag, however much is stored). CouchDB says "No matching index found" in the answer of a query that has to;
// each database's `find` is watched while the app's own queries run, and any such answer fails the test.
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const {
  getAuditDb,
  getAuthDb,
  getCommunityDb,
  getGameSavesDb,
  getGameStatsDb,
  getUsersDb,
} = require('../../config/db');
const { queryAuditEntries, findAuditEntryByIdempotencyKey } = require('../../config/audit');
const stats = require('../../repositories/game-stats-store');
const dreamStats = require('../../repositories/game-dream-stats-store');
const saves = require('../../repositories/game-save-store');

let dbAvailable = false;
const warnings = [];
const spied = [];

/** Watches the `find` of a database: an answer with a warning is a query without an index. */
function watch(name, db) {
  const original = db.find.bind(db);
  db.find = async (query) => {
    const result = await original(query);
    if (result && result.warning)
      warnings.push({ db: name, selector: query.selector, warning: result.warning });
    return result;
  };
  spied.push(() => {
    db.find = original;
  });
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;
  watch('gamestats', getGameStatsDb());
  watch('audit', getAuditDb());
  watch('community', getCommunityDb());
  watch('gamesaves', getGameSavesDb());
  watch('auth', getAuthDb());
  watch('users', getUsersDb());
});

afterAll(() => {
  for (const restore of spied) restore();
});

describe('every query is answered from an index', () => {
  it('the leaderboards, the audit trail and the saved games', async () => {
    if (!dbAvailable) return;
    const db = getGameStatsDb();
    await stats.findHumanProfile(db, 'nobody');
    await stats.findUnappliedResults(db);
    await stats.resultsOfPlayer(db, 'nobody');
    await stats.listProfiles(db);
    await stats.listBoard(db, { type: 'human', minGames: 1 });
    await stats.listBoard(db, { type: 'bot', minGames: 0 });
    await stats.listBoard(db, { minGames: 1, limit: 20, skip: 5 });
    await dreamStats.findHumanProfile(db, 'nobody');
    await dreamStats.resultsOfPlayer(db, 'nobody');
    await dreamStats.listProfiles(db);
    await queryAuditEntries(getAuditDb(), 'nobody');
    await queryAuditEntries(getAuditDb(), 'nobody', { resource: 'transactions', limit: 5 });
    await findAuditEntryByIdempotencyKey(getAuditDb(), 'nobody', 'transactions', 'key');
    await saves.storedGameSizes(getGameSavesDb(), 'nobody');
    expect(warnings).toEqual([]);
  });

  it('the community: the list of threads, a thread, a post and a deleted thread', async () => {
    if (!dbAvailable) return;
    const user = await registerTestUser();
    const auth = (req) => req.set('Authorization', `Bearer ${user.token}`);
    const made = await auth(request(app).post('/api/community/threads')).send({
      title: 'Indexes',
      body: 'Does anything here read every document?',
    });
    expect(made.status).toBe(201);
    const id = made.body.thread?.id ?? made.body.id;
    const list = await request(app).get('/api/community/threads?limit=5&skip=0');
    expect(list.status).toBe(200);
    expect(list.body.threads.length).toBeGreaterThan(0);
    expect(typeof list.body.total).toBe('number');
    await request(app).get(`/api/community/threads/${id}`);
    await auth(request(app).post(`/api/community/threads/${id}/posts`)).send({ body: 'A reply.' });
    await auth(request(app).delete(`/api/community/threads/${id}`));
    expect(warnings).toEqual([]);
  });
});
