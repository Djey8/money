#!/usr/bin/env node
'use strict';

/**
 * Calibrates the starting rating of every bot profile (todo/cashflow-leaderboard.md §7): each persona at each level plays tables of
 * four against a field of three other bots drawn from the catalog, in every seat rotation, and its share of won tables becomes a
 * rating (`ratingFromWinShare`: 25% is par, 1500). The numbers are only the starting point - a bot's rating then moves with real games.
 *
 *   node scripts/calibrate-bot-ratings.js                    quick run (60 tables per bot), prints
 *   node scripts/calibrate-bot-ratings.js --tables 400 --write
 *
 *   --tables  tables per bot (default 60)       --seed  base seed (default 9100)
 *   --rules   guided | strict (default strict: the rules the multiplayer tables run with)
 *   --write   write packages/domain/src/cashflow-game/table/bot-ratings.ts and docs/domain/CASHFLOW_BOT_RATINGS.md
 *
 * Needs the domain package built (`npm run build:domain`). Same seeds, same numbers.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');

const domain = require('@money/domain');
// the domain package does not carry the printed catalog: the tables it plays use this one
domain.setDefaultTableGameSets(require('@money/domain/dist/cashflow-content').CASHFLOW_GAME_SETS);
const catalog = require('@money/domain/dist/cashflow-game/table/bot-catalog');

const root = path.resolve(__dirname, '..');
const LEVELS = ['master', 'strong', 'casual', 'beginner'];

// ───────────────────────────── worker ─────────────────────────────
if (!isMainThread) {
  parentPort.on('message', (job) => {
    const results = job.matches.map((match) => {
      const policies = match.lineup.map((id) => catalog.botPolicy(id));
      const result = domain.playMatch({
        seed: match.seed,
        policies,
        rulesBase: job.rules,
        maxCommands: 40000,
      });
      return {
        id: match.id,
        seat: match.seat,
        winnerSeat: result.winnerSeat,
        cutOff: result.cutOff,
      };
    });
    parentPort.postMessage({ jobId: job.jobId, results });
  });
  return;
}

// ───────────────────────────── main ─────────────────────────────
function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** A small seeded generator so the field of each table is the same on every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const a = args();
  const tables = Number(a.tables) || 60;
  const baseSeed = Number(a.seed) || 9100;
  const rules = a.rules === 'guided' ? 'guided' : 'strict';

  // the personas a host can seat (the profession dispatcher is no strategy of its own)
  const personas = catalog
    .botProfiles()
    .filter((profile) => !profile.build)
    .map((profile) => profile.id);
  const everyBot = personas.flatMap((base) =>
    LEVELS.map((level) => catalog.botIdWithLevel(base, level)),
  );
  // the field: the other personas at master level plus a sprinkle of lower levels, so no bot only meets perfect play
  const fieldPool = personas.flatMap((base) => [
    base,
    catalog.botIdWithLevel(base, 'strong'),
    catalog.botIdWithLevel(base, 'casual'),
  ]);

  const matches = [];
  for (const id of everyBot) {
    const pick = rng(
      baseSeed + id.length * 7919 + [...id].reduce((s, c) => s + c.charCodeAt(0), 0),
    );
    for (let t = 0; t < tables; t += 1) {
      const others = [];
      let guard = 0;
      while (others.length < 3 && guard++ < 100) {
        const candidate = fieldPool[Math.floor(pick() * fieldPool.length)];
        if (candidate !== id && !others.includes(candidate)) others.push(candidate);
      }
      const seat = t % 4;
      const lineup = [...others];
      lineup.splice(seat, 0, id);
      matches.push({ id, seat, seed: baseSeed + t * 31 + others.length, lineup });
    }
  }

  const cpus = Math.max(1, os.cpus().length - 1);
  const workers = Array.from({ length: cpus }, () => new Worker(__filename));
  const chunks = Array.from({ length: cpus * 6 }, () => []);
  matches.forEach((match, i) => chunks[i % chunks.length].push(match));
  const tally = new Map(everyBot.map((id) => [id, { played: 0, won: 0, cutOff: 0 }]));
  let done = 0;
  const started = Date.now();
  await new Promise((resolve) => {
    let next = 0;
    const feed = (worker) => {
      if (next >= chunks.length) return;
      const jobId = next++;
      worker.postMessage({ jobId, matches: chunks[jobId], rules });
    };
    workers.forEach((worker) => {
      worker.on('message', ({ results }) => {
        for (const r of results) {
          const t = tally.get(r.id);
          t.played += 1;
          if (r.cutOff) t.cutOff += 1;
          if (r.winnerSeat === r.seat) t.won += 1;
        }
        done += 1;
        if (done % 10 === 0) {
          process.stderr.write(
            `\r${done}/${chunks.length} chunks, ${Math.round((Date.now() - started) / 1000)}s`,
          );
        }
        if (done === chunks.length) resolve();
        else feed(worker);
      });
      feed(worker);
    });
  });
  process.stderr.write('\n');
  workers.forEach((worker) => worker.terminate());

  const rows = everyBot.map((id) => {
    const t = tally.get(id);
    const share = t.played ? t.won / t.played : 0;
    return {
      id,
      played: t.played,
      won: t.won,
      share,
      rating: require('@money/domain/dist/cashflow-game/table/rating').ratingFromWinShare(share, 4),
    };
  });
  rows.sort((x, y) => y.rating - x.rating || x.id.localeCompare(y.id));
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(34)} ${String(r.rating).padStart(5)}  ${(r.share * 100).toFixed(1).padStart(5)}%  (${r.won}/${r.played})`,
    );
  }

  if (a.write) {
    const commit = require('child_process')
      .execSync('git rev-parse --short HEAD', { cwd: root })
      .toString()
      .trim();
    const body = rows.map((r) => `  '${r.id}': ${r.rating},`).join('\n');
    fs.writeFileSync(
      path.join(root, 'packages/domain/src/cashflow-game/table/bot-ratings.ts'),
      `// Written by scripts/calibrate-bot-ratings.js - do not edit by hand.\n` +
        `// ${tables} tables per bot, four seats, ${rules} rules, base seed ${baseSeed}, at commit ${commit}.\n` +
        `// The starting rating of every bot profile (persona at level); a bot's rating then moves with real games.\n\n` +
        `export const BOT_RATINGS_VERSION = 1;\n\n` +
        `export const BOT_START_RATINGS: Record<string, number> = {\n${body}\n};\n\n` +
        `/** The calibrated starting rating of a bot (persona plus level), or the par rating for one that was not measured. */\n` +
        `export function botStartRating(botId: string): number {\n  return BOT_START_RATINGS[botId] ?? 1500;\n}\n`,
    );
    const table = rows
      .map(
        (r) => `| ${r.id} | ${r.rating} | ${(r.share * 100).toFixed(1)}% | ${r.won}/${r.played} |`,
      )
      .join('\n');
    fs.writeFileSync(
      path.join(root, 'docs/domain/CASHFLOW_BOT_RATINGS.md'),
      `# Bot starting ratings\n\nWritten by \`scripts/calibrate-bot-ratings.js\` (${tables} tables per bot, four seats, ${rules} rules, commit ${commit}).\n` +
        `Each bot played tables of four against three other bots; its share of won tables becomes the rating (25% is par = 1500, about +120 per doubling of the odds, floor 1000, cap 2200). These are only the starting points: a bot's rating then moves slowly with the games it really plays.\n\n` +
        `| Bot (persona--level) | Rating | Won | Tables |\n| --- | ---: | ---: | ---: |\n${table}\n`,
    );
    console.log('written: bot-ratings.ts and CASHFLOW_BOT_RATINGS.md');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
