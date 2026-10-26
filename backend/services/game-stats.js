'use strict';

/**
 * The leaderboard's recorder (todo/cashflow-leaderboard.md §3-§6): when a table is over it writes the table's result once and lets
 * the profiles of everybody who played take it up - counters for every game, rating changes for the games that count.
 *
 * Order of writes (CouchDB has no multi-document transactions): the result is created first (a second attempt for the same table
 * finds it and does nothing new), then each profile takes it up (a profile remembers the tables it applied, so a repeat changes
 * nothing), then the result is marked `applied`. A crash in between leaves `applied: false`, and `repair()` finishes the job.
 * The result records are the truth: `rebuild()` recomputes every profile from them.
 */

const crypto = require('crypto');
const {
  scoreTable,
  rankedEligibility,
  RATING_VERSION,
  START_RATING,
  RATING_FLOOR,
  LEAVE_LOSS_AFTER_ROUND,
} = require('@money/domain/dist/cashflow-game/table/rating');
const store = require('../repositories/game-stats-store');
const { present } = require('./game-profile-view');

/** The namespace of the bots' deterministic ids: the same bot has the same `playerId` on every environment. */
const BOT_NAMESPACE = '6f1d3c52-9a0e-4c1b-8d5e-2b7a4f9e0c31';
const MAX_RETRIES = 8;
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** A name-based UUID (version 5) - the id of a bot profile from its strategy id. */
function uuidV5(name, namespace = BOT_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(ns).update(name).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const botPlayerId = (botId) => uuidV5(`bot:${botId}`);

const emptyCounters = () => ({
  played: 0,
  rankedPlayed: 0,
  wins: 0,
  gaveUp: 0,
  bankruptcies: 0,
  escaped: 0,
  rankSum: 0,
  bestRank: null,
});

function createGameStats({
  db,
  nicknameOf = async () => '',
  botCatalog = () => require('@money/domain/dist/cashflow-game/table/bot-catalog'),
  botRatings = () => require('@money/domain/dist/cashflow-game/table/bot-ratings'),
  now = () => new Date(),
}) {
  let queue = Promise.resolve();
  /** One recording at a time: the profiles it touches are read, changed and written back. */
  const serial = (fn) => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => {});
    return run;
  };

  function botDisplayName(botId) {
    const catalog = botCatalog();
    const parts = catalog.splitBotId(botId);
    const profile = parts ? catalog.botProfile(botId) : null;
    const name = profile ? profile.name : botId;
    return parts && parts.level !== 'master' ? `${name} (${parts.level})` : name;
  }

  function newProfile(fields) {
    const stamp = now().toISOString();
    return {
      visible: false,
      createdAt: stamp,
      updatedAt: stamp,
      rating: START_RATING,
      peakRating: START_RATING,
      rated: 0,
      counters: emptyCounters(),
      applied: [],
      ...fields,
      // The base the rating is counted from (a person's 1500, a bot's measured start): rating = base + every change the games made.
      // Each base the profile ever had is kept, so the history can be shown on the current base (see baseAt in routes/game-stats.js).
      baseRating: fields.baseRating ?? START_RATING,
      baseHistory: [
        {
          baseRating: fields.baseRating ?? START_RATING,
          version: fields.baseVersion ?? 0,
          at: stamp,
        },
      ],
      baseVersion: fields.baseVersion ?? 0,
    };
  }

  /** The profile of a bot (a strategy at a level), made on first use. */
  async function ensureBotProfile(botId) {
    const playerId = botPlayerId(botId);
    const found = await store.getProfile(db, playerId);
    if (found) return found;
    const start = botRatings().botStartRating(botId);
    await store.createProfile(
      db,
      newProfile({
        playerId,
        type: 'bot',
        botId,
        displayName: botDisplayName(botId),
        visible: true,
        rating: start,
        peakRating: start,
        baseRating: start,
        baseVersion: botRatings().BOT_RATINGS_VERSION,
      }),
    );
    return store.getProfile(db, playerId);
  }

  /** The profile of an account, made on first use; the display name follows the account's nickname. */
  async function ensureHumanProfile(accountId, fallbackName) {
    const found = await store.findHumanProfile(db, accountId);
    const name = ((await nicknameOf(accountId)) || fallbackName || 'Player').slice(0, 24);
    if (found) {
      if (found.displayName !== name) {
        return mutateProfile(found.playerId, (profile) => {
          profile.displayName = name;
        });
      }
      return found;
    }
    const playerId = crypto.randomUUID();
    await store.createProfile(
      db,
      newProfile({ playerId, type: 'human', accountId, displayName: name, visible: false }),
    );
    return store.getProfile(db, playerId);
  }

  /** Reads a profile, lets `change` edit it, writes it back; on a concurrent change reads and tries again. */
  async function mutateProfile(playerId, change) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const profile = await store.getProfile(db, playerId);
      if (!profile) return null;
      const before = JSON.stringify(profile);
      const edited = change(profile);
      if (edited === false || JSON.stringify(profile) === before) return profile;
      profile.updatedAt = now().toISOString();
      try {
        return await store.saveProfile(db, profile);
      } catch (error) {
        if (!(error instanceof store.StatsConflictError)) throw error;
      }
    }
    throw new Error(`The profile ${playerId} keeps changing.`);
  }

  /**
   * The account was deleted: the profile stays (other players' ratings depend on the games it played) but loses its link to
   * the account and its name, and leaves the board.
   */
  async function forgetAccount(accountId) {
    const found = await store.findHumanProfile(db, accountId);
    if (!found) return null;
    return mutateProfile(found.playerId, (profile) => {
      delete profile.accountId;
      profile.displayName = 'Deleted player';
      profile.visible = false;
    });
  }

  /** The account changed its nickname: its profile shows the new name. */
  async function refreshName(accountId) {
    const found = await store.findHumanProfile(db, accountId);
    if (!found) return null;
    const name = ((await nicknameOf(accountId)) || found.displayName).slice(0, 24);
    return mutateProfile(found.playerId, (profile) => {
      profile.displayName = name;
    });
  }

  /**
   * The bots were measured again (JFK, 2026-10-19): a new deployment has other start ratings (`bot-ratings.ts`, `BOT_RATINGS_VERSION`).
   * Each bot's **base** moves to the new one and its rating moves with it - rating = base + every change its games made, and none of
   * those changes is touched: the history stays as played. A profile from before bases were kept (no `baseRating`) is taken to have
   * been counted from the start rating the table gave then, which is the table now. Safe to repeat: nothing changes when the base is
   * what the deployment says. Returns how many bases moved.
   */
  async function reconcileBases() {
    const ratings = botRatings();
    const version = ratings.BOT_RATINGS_VERSION;
    const rows = await store.listBoard(db, { type: 'bot', minGames: 0, limit: 2000 });
    let moved = 0;
    for (const row of rows) {
      const wanted = ratings.botStartRating(row.botId);
      if (row.baseRating !== undefined && row.baseRating === wanted && row.baseVersion === version)
        continue;
      await mutateProfile(row.playerId, (profile) => {
        const stamp = now().toISOString();
        const before = profile.baseRating ?? wanted;
        const shift = wanted - before;
        if (profile.baseRating === undefined) {
          // from before bases were kept: counted from the start rating it had when it was made
          profile.baseHistory = [{ baseRating: wanted, version, at: profile.createdAt ?? stamp }];
        } else if (shift !== 0) {
          profile.baseHistory = [
            ...(profile.baseHistory ?? []),
            { baseRating: wanted, version, at: stamp },
          ];
        }
        profile.baseRating = wanted;
        profile.baseVersion = version;
        if (shift !== 0) {
          profile.rating = Math.max(RATING_FLOOR, Math.round((profile.rating + shift) * 100) / 100);
          profile.peakRating = Math.round((profile.peakRating + shift) * 100) / 100;
        }
      });
      if (wanted !== (row.baseRating ?? wanted)) moved += 1;
    }
    return { moved, checked: rows.length };
  }

  /**
   * A rating is the base plus every change the rated games made (JFK, 2026-10-19: base 1700, two games of +0.86 and -2.64 cannot
   * end at 1761). A profile whose rating drifted from that - made under an older table of start ratings, or moved by a base that was
   * recorded wrongly - is set back to base + its games, replayed in the order they were played, the floor applied at each step.
   * Only done for a profile whose recorded results are all there (as many rated results as it counts), so it never guesses. Safe to
   * repeat. Returns how many ratings were corrected.
   */
  async function recomputeRatings() {
    const deltas = new Map();
    let after = '';
    for (;;) {
      const page = await store.listResults(db, { after, limit: 200 });
      if (page.length === 0) break;
      for (const result of page) {
        if (!result.counted) continue;
        for (const p of result.participants) {
          if (p.leftEarly) continue;
          if (!deltas.has(p.playerId)) deltas.set(p.playerId, []);
          deltas.get(p.playerId).push({ at: String(result.endedAt), delta: Number(p.delta) || 0 });
        }
      }
      after = page[page.length - 1]._id;
      if (page.length < 200) break;
    }
    let corrected = 0;
    for (const row of await store.listProfiles(db)) {
      const games = (deltas.get(row.playerId) ?? []).sort((a, b) => a.at.localeCompare(b.at));
      if (games.length !== row.rated) continue; // the record is not whole: do not guess
      let rating = row.baseRating ?? START_RATING;
      let peak = rating;
      for (const game of games) {
        rating = Math.max(RATING_FLOOR, Math.round((rating + game.delta) * 100) / 100);
        peak = Math.max(peak, rating);
      }
      if (Math.abs(rating - row.rating) < 0.005 && Math.abs(peak - row.peakRating) < 0.005)
        continue;
      await mutateProfile(row.playerId, (profile) => {
        profile.rating = rating;
        profile.peakRating = peak;
      });
      corrected += 1;
    }
    return { corrected };
  }

  /** The account set or removed its profile picture (`version`: when it was set; null: removed): its profile says so. */
  async function setPicture(accountId, version) {
    const found =
      version === null
        ? await store.findHumanProfile(db, accountId)
        : await ensureHumanProfile(accountId);
    if (!found) return null;
    return mutateProfile(found.playerId, (profile) => {
      if (version === null) delete profile.pictureVersion;
      else profile.pictureVersion = version;
    });
  }

  /** The player switches being listed on the leaderboard on or off. */
  async function setVisible(playerId, visible) {
    return mutateProfile(playerId, (profile) => {
      profile.visible = !!visible;
    });
  }

  /** Makes the profile of every bot (each strategy at each level) that is missing. Safe to repeat. */
  async function seedBots() {
    const catalog = botCatalog();
    const levels = ['master', 'strong', 'casual', 'beginner'];
    let made = 0;
    for (const base of catalog.botProfiles().filter((p) => !p.build)) {
      for (const level of levels) {
        const botId = catalog.botIdWithLevel(base.id, level);
        const exists = await store.getProfile(db, botPlayerId(botId));
        if (!exists) {
          await ensureBotProfile(botId);
          made += 1;
        }
      }
    }
    return { made };
  }

  /** How many earlier counted games the same set of humans played together in the last day. */
  async function repeatsOf(humanIds, endedAtMs) {
    if (humanIds.length < 2) return 0;
    const sorted = [...humanIds].sort().join(',');
    const earlier = await store.resultsOfPlayer(db, humanIds[0], 50);
    return earlier.filter((result) => {
      if (!result.counted || endedAtMs - Date.parse(result.endedAt) > REPEAT_WINDOW_MS)
        return false;
      const humans = result.participants
        .filter((p) => p.type === 'human')
        .map((p) => p.playerId)
        .sort()
        .join(',');
      return humans === sorted;
    }).length;
  }

  /**
   * Builds the result of a finished table (not yet written). Returns null for a table that is not over or has no standings.
   */
  async function buildResult(roomDoc) {
    const table = roomDoc.table;
    if (table.phase !== 'finished' || !table.result) return null;
    const endedAt = now().toISOString();
    const entries = new Map(table.result.ranking.map((entry) => [entry.playerId, entry]));
    const players = table.players.filter((p) => p.books && entries.has(p.id));
    if (players.length < 2) return null;

    const members = [];
    for (const player of players) {
      const entry = entries.get(player.id);
      const bot = !!player.bot;
      const profile = bot
        ? await ensureBotProfile(player.bot.policyId)
        : await ensureHumanProfile(player.id, player.name);
      // leaving is a loss from the moment play starts, unless the host gave some free rounds when opening the table
      const free = table.settings.leaveFreeRounds ?? LEAVE_LOSS_AFTER_ROUND;
      const leftEarly = player.status === 'left' && (player.leftRound ?? 0) <= free;
      members.push({ player, entry, profile, bot, leftEarly });
    }
    const rated = members.filter((m) => !m.leftEarly);
    const humans = rated.filter((m) => !m.bot);
    const eligibility = rankedEligibility({
      ranked: table.settings.ranked !== false,
      phase: table.phase,
      seats: rated.length,
      humans: humans.length,
      tableRound: table.tableRound,
      escaped: table.result.ranking.some((entry) => entry.outcome === 'escaped'),
      abandoned: members.some((m) => !m.bot && m.player.status === 'left' && !m.leftEarly),
    });
    const repeats = eligibility.counts
      ? await repeatsOf(
          humans.map((m) => m.profile.playerId),
          Date.parse(endedAt),
        )
      : 0;
    const changes = eligibility.counts
      ? scoreTable(
          rated.map((m) => ({
            playerId: m.profile.playerId,
            rating: m.profile.rating,
            ratedGames: m.profile.rated,
            bot: m.bot,
            botId: m.bot ? m.player.bot.policyId : undefined,
            rank: m.entry.rank,
            outcome: m.entry.outcome,
            leftLate: m.entry.outcome === 'left',
          })),
          { repeats },
        )
      : [];
    const changeOf = new Map(changes.map((c) => [c.playerId, c]));

    const participants = members.map((m) => {
      const change = changeOf.get(m.profile.playerId);
      return {
        playerId: m.profile.playerId,
        type: m.bot ? 'bot' : 'human',
        ...(m.bot ? { botId: m.player.bot.policyId } : {}),
        seat: table.players.indexOf(m.player),
        rank: m.entry.rank,
        outcome: m.entry.outcome,
        professionId: m.player.professionId,
        passiveIncomeMinor: m.entry.passiveIncomeMinor,
        monthlyCashflowMinor: m.entry.monthlyCashflowMinor,
        expensesMinor: m.entry.expensesMinor ?? 0,
        leftEarly: m.leftEarly,
        ratingBefore: change ? change.before : m.profile.rating,
        ratingAfter: change ? change.after : m.profile.rating,
        delta: change ? change.delta : 0,
      };
    });
    return {
      tableId: roomDoc.roomId,
      endedAt,
      reason: table.result.reason,
      rounds: table.tableRound,
      counted: eligibility.counts,
      rankedWhy: eligibility.why,
      scoringVersion: RATING_VERSION,
      settings: {
        name: table.settings.name,
        ranked: table.settings.ranked !== false,
        rulesBase: table.settings.rulesBase,
        endCondition: table.settings.endCondition,
        clockMode: table.settings.clock.mode,
        pace: table.settings.pace,
        seats: players.length,
        humans: members.filter((m) => !m.bot).length,
        bots: members.filter((m) => m.bot).length,
      },
      participants,
      playerIds: participants.map((p) => p.playerId),
      applied: false,
    };
  }

  /** Lets every profile of a result take it up (once each), then marks the result applied. */
  async function apply(result) {
    for (const p of result.participants) {
      await mutateProfile(p.playerId, (profile) => {
        if (profile.applied.includes(result.tableId)) return false;
        const c = profile.counters;
        c.played += 1;
        if (p.rank === 1 && !p.leftEarly) c.wins += 1;
        if (p.outcome === 'left') c.gaveUp += 1;
        if (p.outcome === 'bankrupt') c.bankruptcies += 1;
        if (p.outcome === 'escaped') c.escaped += 1;
        if (!p.leftEarly) {
          c.rankSum += p.rank;
          c.bestRank = c.bestRank === null ? p.rank : Math.min(c.bestRank, p.rank);
        }
        if (result.counted && !p.leftEarly) {
          c.rankedPlayed += 1;
          profile.rated += 1;
          profile.rating = Math.max(
            RATING_FLOOR,
            Math.round((profile.rating + p.delta) * 100) / 100,
          );
          profile.peakRating = Math.max(profile.peakRating, profile.rating);
        }
        profile.applied = [...profile.applied, result.tableId].slice(-store.APPLIED_MEMORY);
        return true;
      });
    }
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const fresh = await store.getResult(db, result.tableId);
      if (!fresh || fresh.applied) return;
      try {
        await store.saveResult(db, { ...fresh, applied: true });
        return;
      } catch (error) {
        if (!(error instanceof store.StatsConflictError)) throw error;
      }
    }
  }

  /**
   * Records a table that is over. Idempotent: a table that has a result is not recorded again (an unfinished application is
   * finished instead). Never throws into the game - the caller logs.
   */
  function record(roomDoc) {
    return serial(async () => {
      const existing = await store.getResult(db, roomDoc.roomId);
      if (existing) {
        if (!existing.applied) await apply(existing);
        return existing;
      }
      const result = await buildResult(roomDoc);
      if (!result) return null;
      const created = await store.createResult(db, result);
      if (!created) {
        const found = await store.getResult(db, roomDoc.roomId);
        if (found && !found.applied) await apply(found);
        return found;
      }
      await apply(result);
      return result;
    });
  }

  /** Finishes the applications a crash left half done. */
  function repair() {
    return serial(async () => {
      const open = await store.findUnappliedResults(db);
      for (const result of open) await apply(result);
      return { repaired: open.length };
    });
  }

  /** Recomputes every profile's counters and rating from the result records (the records are the truth). */
  function rebuild() {
    return serial(async () => {
      const seen = new Set();
      let after = '';
      const results = [];
      for (;;) {
        const page = await store.listResults(db, { after, limit: 200 });
        if (page.length === 0) break;
        results.push(...page);
        after = page[page.length - 1]._id;
        if (page.length < 200) break;
      }
      results.sort((a, b) => String(a.endedAt).localeCompare(String(b.endedAt)));
      const fresh = new Map();
      const start = (profile) => ({
        rating: profile.type === 'bot' ? botRatings().botStartRating(profile.botId) : START_RATING,
        peakRating: START_RATING,
        rated: 0,
        counters: emptyCounters(),
      });
      for (const result of results) {
        for (const p of result.participants) {
          if (!fresh.has(p.playerId)) {
            const profile = await store.getProfile(db, p.playerId);
            if (!profile) continue;
            fresh.set(p.playerId, start(profile));
          }
          const s = fresh.get(p.playerId);
          if (!s) continue;
          const c = s.counters;
          c.played += 1;
          if (p.rank === 1 && !p.leftEarly) c.wins += 1;
          if (p.outcome === 'left') c.gaveUp += 1;
          if (p.outcome === 'bankrupt') c.bankruptcies += 1;
          if (p.outcome === 'escaped') c.escaped += 1;
          if (!p.leftEarly) {
            c.rankSum += p.rank;
            c.bestRank = c.bestRank === null ? p.rank : Math.min(c.bestRank, p.rank);
          }
          if (result.counted && !p.leftEarly) {
            c.rankedPlayed += 1;
            s.rated += 1;
            s.rating = Math.max(RATING_FLOOR, Math.round((s.rating + p.delta) * 100) / 100);
            s.peakRating = Math.max(s.peakRating, s.rating);
          }
        }
        seen.add(result.tableId);
      }
      for (const [playerId, state] of fresh) {
        await mutateProfile(playerId, (profile) => {
          Object.assign(profile, state);
          profile.applied = [...seen].slice(-store.APPLIED_MEMORY);
        });
      }
      return { results: results.length, profiles: fresh.size };
    });
  }

  /** The current rating of each bot id (a strategy at a level): the board's, or the measured start while it has none. */
  async function currentBotRatings(botIds) {
    const out = {};
    for (const botId of botIds) {
      const profile = await store.getProfile(db, botPlayerId(botId));
      out[botId] = Math.round(profile ? profile.rating : botRatings().botStartRating(botId));
    }
    return out;
  }

  /**
   * Who sits at a table, for the lobby (JFK, 2026-10-25): each seat with the public profile of the person or the bot - the picture,
   * the rating and the numbers of their games, so a player knows who they play against and can open the leaderboard panel. A person
   * who is not listed on the leaderboard shows only their rating, picture and the number of games (they chose not to be a public
   * profile): `listed: false`, and no panel is opened for them.
   */
  async function seatsOf(table) {
    const out = [];
    for (const [seat, player] of table.players.entries()) {
      let profile;
      if (player.bot) {
        profile = await ensureBotProfile(player.bot.policyId);
      } else {
        profile = await store.findHumanProfile(db, player.id);
      }
      const base = {
        seat,
        name: player.name,
        color: player.color,
        bot: !!player.bot,
      };
      if (!profile) {
        // a person who has no profile yet (no game played): the starting rating
        out.push({
          ...base,
          listed: false,
          rating: START_RATING,
          ratedGames: 0,
          provisional: true,
        });
        continue;
      }
      const shown = present(profile);
      const listed = profile.type === 'bot' || profile.visible === true;
      out.push(
        listed
          ? { ...base, listed: true, ...shown, name: player.name }
          : {
              ...base,
              listed: false,
              playerId: shown.playerId,
              rating: shown.rating,
              ratedGames: shown.ratedGames,
              provisional: shown.provisional,
              ...(shown.pictureVersion ? { pictureVersion: shown.pictureVersion } : {}),
            },
      );
    }
    return out;
  }

  return {
    seatsOf,
    reconcileBases,
    recomputeRatings,
    setPicture,
    currentBotRatings,
    record,
    repair,
    rebuild,
    seedBots,
    setVisible,
    refreshName,
    forgetAccount,
    ensureHumanProfile,
    ensureBotProfile,
    botPlayerId,
  };
}

module.exports = { createGameStats, botPlayerId, uuidV5 };
