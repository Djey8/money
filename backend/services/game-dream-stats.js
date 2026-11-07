'use strict';

const crypto = require('crypto');
const store = require('../repositories/game-dream-stats-store');
const { uuidV5 } = require('./game-stats');
const rating = require('@money/domain/dist/cashflow-game/dreamfund/table/rating');
const { factsOfLife, addFacts } = require('@money/domain/dist/cashflow-game/dreamfund/table/facts');
const { splitDreamBotId } = require('@money/domain/dist/cashflow-game/dreamfund/table/bot-levels');
const { DREAM_POLICIES } = require('@money/domain/dist/cashflow-game/dreamfund-sim/policies');

/**
 * The Dreamer leaderboard's service (todo/dreamfund-multiplayer.md, slice 8): when a Dreamer table finishes, its result is filed
 * once and - if it counts - every player's rating moves (`rateTable`, the domain's pure scoring; a harder game pays more for a gain). A
 * person has one rating; so has each bot (a strategy at a skill level), starting where the tournaments put it. Humans are listed only when they switched "show me" on; bots always, once they have played. A world of its own: nothing is read
 * from or written to the classic board.
 */

// the board has one rating for everybody; the difficulty of a game is its stake (rating.DIFFICULTY_STAKE)
const LEVELS = ['overall'];
const OVERALL = 'overall';
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MAX_RETRIES = 8;

const botPlayerId = (botId) => uuidV5(`dream-bot:${botId}`);

const emptyCounters = () => ({
  games: 0,
  tableWins: 0,
  places: 0,
  bestPlace: null,
  won: 0,
  bankrupt: 0,
  left: 0,
  goalsMet: 0,
  dreamPoints: 0,
});

function emptyLevel(start) {
  return { rating: start, peak: start, base: start, rated: 0, counters: emptyCounters() };
}

function createDreamStats({
  db,
  nicknameOf = async () => '',
  pictureOf = async () => null,
  now = () => new Date(),
}) {
  let queue = Promise.resolve();
  /** One recording at a time: the profiles it touches are read, changed and written back. */
  const serial = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  const botName = (botId) => {
    const parts = splitDreamBotId(botId);
    const policy = parts && DREAM_POLICIES.find((p) => p.id === parts.base);
    const name = policy ? policy.name : botId;
    return parts && parts.level !== 'master' ? `${name} (${parts.level})` : name;
  };

  function newProfile(fields) {
    const stamp = now().toISOString();
    return {
      visible: false,
      createdAt: stamp,
      updatedAt: stamp,
      ratings: Object.fromEntries(
        LEVELS.map((level) => [
          level,
          emptyLevel(
            fields.type === 'bot' ? rating.botStartRating(fields.botId) : rating.DREAM_START_RATING,
          ),
        ]),
      ),
      applied: [],
      ...fields,
    };
  }

  async function ensureBotProfile(botId) {
    const playerId = botPlayerId(botId);
    const found = await store.getProfile(db, playerId);
    if (found) return found;
    await store.createProfile(
      db,
      newProfile({ playerId, type: 'bot', botId, displayName: botName(botId), visible: true }),
    );
    return store.getProfile(db, playerId);
  }

  async function ensureHumanProfile(accountId, fallbackName) {
    const found = await store.findHumanProfile(db, accountId);
    const name = ((await nicknameOf(accountId)) || fallbackName || 'Player').slice(0, 24);
    if (found) {
      if (found.displayName !== name) {
        return mutate(found.playerId, (profile) => {
          profile.displayName = name;
        });
      }
      return found;
    }
    const playerId = crypto.randomUUID();
    await store.createProfile(
      db,
      newProfile({ playerId, type: 'human', accountId, displayName: name }),
    );
    return store.getProfile(db, playerId);
  }

  /** Reads, changes and writes a profile again when somebody else wrote first. */
  async function mutate(playerId, change) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const profile = await store.getProfile(db, playerId);
      if (!profile) return null;
      change(profile);
      profile.updatedAt = now().toISOString();
      try {
        return await store.saveProfile(db, profile);
      } catch (error) {
        if (!(error instanceof store.DreamStatsConflictError)) throw error;
      }
    }
    throw new Error('The profile keeps changing.');
  }

  /**
   * A finished Dreamer table (the saved room document): its result is filed, and the ratings move when it counts. Safe to call twice
   * (the result is written once). `tournament: true` counts a table of bots only (the tournaments of slice 9).
   */
  function record(room, { tournament = false } = {}) {
    return serial(() => recordNow(room, tournament));
  }

  async function recordNow(room, tournament) {
    const table = room.table;
    if (!table || table.kind !== 'dreamfund' || table.phase !== 'finished' || !table.result)
      return null;
    const tableId = room.roomId;
    if (await store.getResult(db, tableId)) return null;
    const level = OVERALL;
    const difficulty = DIFFICULTIES.includes(table.settings.difficulty)
      ? table.settings.difficulty
      : 'medium';
    const humans = table.players.filter((p) => !p.bot && p.life).length;
    const someoneWon = table.finishers.some((f) => f.outcome === 'won');
    const verdict = rating.countsForRating({
      ranked: table.settings.ranked === true,
      phase: table.phase,
      players: table.players.filter((p) => p.life).length,
      humans,
      tableRound: table.tableRound,
      someoneWon,
      tournament,
    });

    // who played: a profile for each, and where each stood
    const participants = [];
    for (const standing of table.result.ranking) {
      const seat = table.players.find((p) => p.id === standing.playerId);
      if (!seat) continue;
      const profile = seat.bot
        ? await ensureBotProfile(seat.bot.policyId)
        : await ensureHumanProfile(seat.id, seat.name);
      participants.push({ seat, standing, profile, index: table.players.indexOf(seat) });
    }
    const seats = participants.map(({ standing, profile, seat }) => ({
      playerId: profile.playerId,
      type: profile.type,
      rating: profile.ratings[level].rating,
      ratedGames: profile.ratings[level].rated,
      character: seat.professionId,
      rank: standing.rank,
      outcome: standing.outcome,
    }));
    const changes = verdict.counted ? rating.rateTable(seats, difficulty) : [];
    const change = (playerId) => changes.find((c) => c.playerId === playerId);

    const doc = {
      tableId,
      kind: 'dresult',
      version: rating.DREAM_RATING_VERSION,
      endedAt: now().toISOString(),
      name: table.settings.name,
      difficulty,
      shape: table.settings.shape,
      size: table.settings.size,
      endCondition: table.settings.endCondition,
      rounds: table.tableRound,
      reason: table.result.reason,
      counted: verdict.counted,
      ...(verdict.counted ? {} : { why: verdict.why }),
      playerIds: participants.map((p) => p.profile.playerId),
      participants: participants.map(({ standing, profile, seat, index }) => ({
        seat: index,
        // the fact table of the game: what this life came to in Grow, Fire, Smile and the income
        ...(seat.life ? { facts: factsOf(seat, table.tableRound) } : {}),
        playerId: profile.playerId,
        name: profile.displayName,
        type: profile.type,
        character: seat.professionId,
        rank: standing.rank,
        outcome: standing.outcome,
        score: standing.score,
        goalsMet: standing.goalsMet,
        dreamPoints: standing.dreamPoints,
        ...(change(profile.playerId)
          ? {
              ratingBefore: Math.round(change(profile.playerId).before),
              ratingAfter: Math.round(change(profile.playerId).after),
              delta: change(profile.playerId).delta,
            }
          : {}),
      })),
    };
    const created = await store.createResult(db, doc);
    const factsBy = new Map(doc.participants.map((entry) => [entry.playerId, entry.facts]));
    if (!created) return null;
    if (!verdict.counted) return doc;
    for (const { profile, standing } of participants) {
      const moved = change(profile.playerId);
      const facts = factsBy.get(profile.playerId);
      await mutate(profile.playerId, (p) => {
        if ((p.applied || []).includes(tableId)) return;
        const l = p.ratings[level];
        l.rating = moved.after;
        l.peak = Math.max(l.peak, moved.after);
        l.rated += 1;
        const c = l.counters;
        c.games += 1;
        if (standing.rank === 1) c.tableWins += 1;
        c.places += standing.rank;
        c.bestPlace = c.bestPlace === null ? standing.rank : Math.min(c.bestPlace, standing.rank);
        if (standing.outcome === 'won') c.won += 1;
        if (standing.outcome === 'bankrupt') c.bankrupt += 1;
        if (standing.outcome === 'left') c.left += 1;
        c.goalsMet += standing.goalsMet;
        c.dreamPoints += standing.dreamPoints;
        if (facts) {
          l.facts = addFacts(l.facts || {}, facts);
          l.factGames = (l.factGames || 0) + 1;
        }
        p.applied = [...(p.applied || []), tableId].slice(-store.APPLIED_MEMORY);
      });
    }
    return doc;
  }

  /** How a profile is shown (never an account id). */
  function present(profile, level) {
    const l = profile.ratings[level];
    const c = l.counters;
    return {
      playerId: profile.playerId,
      name: profile.displayName,
      type: profile.type,
      ...(profile.botId ? { botId: profile.botId } : {}),
      rating: Math.round(l.rating),
      peakRating: Math.round(l.peak),
      baseRating: Math.round(l.base),
      ratedGames: l.rated,
      provisional: l.rated < rating.PROVISIONAL_GAMES,
      games: c.games,
      wins: c.tableWins,
      won: c.won,
      bankruptcies: c.bankrupt,
      left: c.left,
      avgPlace: c.games ? Math.round((c.places / c.games) * 100) / 100 : null,
      bestPlace: c.bestPlace,
      avgGoals: c.games ? Math.round((c.goalsMet / c.games) * 100) / 100 : null,
      avgDreamPoints: c.games ? Math.round((c.dreamPoints / c.games) * 10) / 10 : null,
    };
  }

  /** The board: players with at least `minGames` rated games (bots appear as they play), best rating first. */
  async function board({ type, minGames = 1, limit = 50, skip = 0 } = {}) {
    const level = OVERALL;
    const profiles = await store.listProfiles(db);
    const rows = profiles
      .filter((p) => p.visible && (type === 'human' || type === 'bot' ? p.type === type : true))
      .filter((p) => p.ratings[level].rated >= minGames)
      .sort(
        (a, b) =>
          b.ratings[level].rating - a.ratings[level].rating ||
          String(a.playerId).localeCompare(String(b.playerId)),
      )
      .slice(skip, skip + limit)
      .map((p, index) => ({ place: skip + index + 1, p }));
    // a person's picture is the account's, kept with the classic profile: the row says where to fetch it
    return Promise.all(
      rows.map(async ({ place, p }) => ({
        place,
        ...present(p, level),
        ...(await pictureRef(p)),
      })),
    );
  }

  async function pictureRef(profile) {
    if (profile.type !== 'human' || !profile.accountId) return {};
    const ref = await pictureOf(profile.accountId);
    return ref ? { pictureId: ref.playerId, pictureVersion: ref.pictureVersion } : {};
  }

  async function pictureRefOfAccount(accountId) {
    const ref = await pictureOf(accountId);
    return ref ? { playerId: ref.playerId, pictureVersion: ref.pictureVersion } : {};
  }

  /** Whether a person is on the Dreamer board (the picture of such a person may be seen by everybody). */
  async function isListed(accountId) {
    const profile = await store.findHumanProfile(db, accountId);
    return !!profile && profile.visible === true;
  }

  /** A player of the board with the last results. */
  async function player(playerId) {
    const profile = await store.getProfile(db, playerId);
    if (!profile || (!profile.visible && profile.type === 'human')) return null;
    return { ...(await playerOf(profile)), ...(await pictureRef(profile)) };
  }

  const pickOwn = (result, playerId) => {
    const own = result.participants.find((p) => p.playerId === playerId);
    return own
      ? {
          place: own.rank,
          outcome: own.outcome,
          score: own.score,
          character: own.character,
          ...(own.delta !== undefined
            ? { ratingChange: own.delta, ratingAfter: own.ratingAfter }
            : {}),
        }
      : {};
  };

  /** The account's own profile (made on first use). */
  async function me(accountId, fallbackName) {
    const profile = await ensureHumanProfile(accountId, fallbackName);
    return {
      ...(await playerOf(profile)),
      ...(await pictureRef(profile)),
      visible: profile.visible === true,
    };
  }

  /** The fact table of a life, never failing a record (a life that cannot be read gives none). */
  function factsOf(seat, rounds) {
    try {
      return factsOfLife(seat.life, rounds);
    } catch {
      return undefined;
    }
  }

  /** How the rating moved over the last counted games, oldest first (the first point is the rating before the first of them). */
  function historyOf(results, playerId) {
    const points = [];
    for (const r of [...results].reverse()) {
      if (!r.counted) continue;
      const own = r.participants.find((p) => p.playerId === playerId);
      if (!own || own.ratingAfter === undefined) continue;
      if (points.length === 0) points.push({ endedAt: null, rating: own.ratingBefore });
      points.push({
        endedAt: r.endedAt,
        rating: own.ratingAfter,
        delta: own.delta,
        place: own.rank,
        outcome: own.outcome,
        difficulty: r.difficulty,
        players: r.participants.length,
      });
    }
    return points;
  }

  async function playerOf(profile) {
    const results = await store.resultsOfPlayer(db, profile.playerId, 120);
    const level = profile.ratings[OVERALL];
    return {
      playerId: profile.playerId,
      name: profile.displayName,
      type: profile.type,
      ...(profile.botId ? { botId: profile.botId } : {}),
      rating: present(profile, OVERALL),
      history: historyOf(results, profile.playerId),
      // the sums of the fact table over the games that have one, with how many those are
      facts: { games: level.factGames || 0, totals: level.facts || {} },
      recent: results.slice(0, 15).map((r) => ({
        tableId: r.tableId,
        name: r.name,
        difficulty: r.difficulty,
        endedAt: r.endedAt,
        counted: r.counted,
        ...(r.why ? { why: r.why } : {}),
        players: r.participants.length,
        ...pickOwn(r, profile.playerId),
      })),
    };
  }

  async function setVisible(accountId, visible) {
    const profile = await ensureHumanProfile(accountId);
    await mutate(profile.playerId, (p) => {
      p.visible = !!visible;
    });
    return me(accountId);
  }

  /**
   * A bot's rating is its base (where the tournaments put it) plus what its games made of it. When the tournaments say a new base,
   * the bot moves with it and keeps what it earned since: returns how many levels moved.
   */
  async function reconcileBase(botId) {
    const profile = await store.getProfile(db, botPlayerId(botId));
    if (!profile) return 0;
    const wanted = { [OVERALL]: rating.botStartRating(botId) };
    if (LEVELS.every((level) => Math.round(profile.ratings[level].base) === wanted[level]))
      return 0;
    let moved = 0;
    await mutate(profile.playerId, (p) => {
      for (const level of LEVELS) {
        const l = p.ratings[level];
        const shift = wanted[level] - l.base;
        if (Math.abs(shift) < 0.5) continue;
        l.rating += shift;
        l.peak += shift;
        l.base = wanted[level];
        moved += 1;
      }
    });
    return moved;
  }

  /** Makes the profile of every bot (each strategy at each skill level) that is missing: the board knows them before they have played. */
  async function seedBots() {
    let made = 0;
    let moved = 0;
    for (const policy of DREAM_POLICIES) {
      for (const level of ['master', 'strong', 'casual', 'beginner']) {
        const botId = level === 'master' ? policy.id : `${policy.id}--${level}`;
        if (!(await store.getProfile(db, botPlayerId(botId)))) {
          await ensureBotProfile(botId);
          made += 1;
        } else {
          moved += await reconcileBase(botId);
        }
      }
    }
    return { made, moved };
  }

  /**
   * Who sits at a Dreamer table, for the lobby (the same shape as the classic board's `seatsOf`): the rating of each seat at the
   * table's difficulty. A person who has not played yet shows the starting rating; no pictures, no stats panel for now.
   */
  async function seatsOf(table) {
    const level = OVERALL;
    const out = [];
    for (const [seat, player] of table.players.entries()) {
      const profile = player.bot
        ? await ensureBotProfile(player.bot.policyId)
        : await store.findHumanProfile(db, player.id);
      const own = profile && profile.ratings[level];
      const rated = own ? own.rated : 0;
      const picture = player.bot ? {} : await pictureRefOfAccount(player.id);
      const parts = player.bot && splitDreamBotId(player.bot.policyId);
      out.push({
        seat,
        name: player.name,
        color: player.color,
        bot: !!player.bot,
        listed: !!profile && (profile.type === 'bot' || profile.visible === true),
        rating: own ? Math.round(own.rating) : rating.DREAM_START_RATING,
        ratedGames: rated,
        provisional: rated < rating.PROVISIONAL_GAMES,
        ...picture,
        ...(parts && parts.level !== 'master' ? { level: parts.level } : {}),
      });
    }
    return out;
  }

  /** What each bot (an id with its skill level) is rated now: its profile's rating, or its starting rating. */
  async function botRatings(botIds) {
    const level = OVERALL;
    const out = {};
    for (const botId of botIds) {
      const profile = await store.getProfile(db, botPlayerId(botId));
      out[botId] = profile
        ? Math.round(profile.ratings[level].rating)
        : rating.botStartRating(botId);
    }
    return out;
  }

  return {
    isListed,
    botRatings,
    seatsOf,
    record,
    board,
    player,
    me,
    setVisible,
    seedBots,
    botPlayerId,
    ensureBotProfile,
    ensureHumanProfile,
  };
}

module.exports = { createDreamStats, botPlayerId };
