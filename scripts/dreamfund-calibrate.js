#!/usr/bin/env node
/**
 * The calibration of the Dreamfund bots (JFK, 2026-11-06): find the best way to play for every type of bot, then rate them all against each
 * other. It can be run again at any time and learns from the run before it:
 *
 *   node scripts/dreamfund-calibrate.js --mode fast      (minutes: a look at whether anything changed)
 *   node scripts/dreamfund-calibrate.js --mode medium    (about an hour)
 *   node scripts/dreamfund-calibrate.js --mode full      (hours: the deep calibration)
 *
 * What a run does:
 *  1. capabilities  every bot plays some games and the script counts which capabilities of the game it used (capabilities.ts): nothing
 *                   may be left out of the test bed;
 *  2. relearn       for each type of bot the search starts from the champion of the last run (docs/dreamfund-balance/champions.json) and
 *                   moves a few knobs at a time over random games (every character, level and map); a new champion replaces the old one
 *                   only when it is clearly better on games neither has seen;
 *  3. tournament    all bots - every type at every skill level - play tables against each other on every difficulty, rated with the
 *                   board's own Elo, starting from the ratings of the last run (a new bot starts at 1500 and travels to its place);
 *  4. gauntlet      the best masters meet again on fresh seeds: the one that wins most tables is the champion of the champions;
 *  5. write         champions.generated.ts, bot-ratings.generated.ts, runs.json and CALIBRATION.md (the history of the runs).
 *
 * Options: --types a,b (only these types), --skip-search, --skip-tournament, --fresh (start the search from the strategies as written),
 * --seed N, --workers N, --no-write (do not touch the domain), --generations/--mutants/--games/--verify/--tables to override a mode.
 * Needs `npm run build:domain` first (the script builds it again after it has written new champions).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { spawn, execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'packages/domain/dist/cashflow-game');
const outDir = path.join(root, 'docs/dreamfund-balance');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

function loadDomain() {
  const { setDefaultTableGameSets } = require(path.join(dist, 'table/default-game-sets'));
  const { CASHFLOW_GAME_SETS } = require(path.join(dist, '../cashflow-content'));
  setDefaultTableGameSets(CASHFLOW_GAME_SETS);
  return {
    search: require(path.join(dist, 'dreamfund-sim/search')),
    policies: require(path.join(dist, 'dreamfund-sim/policies')),
    world: require(path.join(dist, 'dreamfund-sim/world')),
    capabilities: require(path.join(dist, 'dreamfund-sim/capabilities')),
    tournament: require(path.join(dist, 'dreamfund/table/tournament')),
    levels: require(path.join(dist, 'dreamfund/table/bot-levels')),
  };
}

// ── a worker: plays games of a knob set on a list of scenarios and answers with the compact result ──
if (!isMainThread && workerData && workerData.role === 'eval') {
  const domain = loadDomain();
  parentPort.on('message', (job) => {
    const policy = domain.policies.baseById(job.type).retune(job.knobs);
    const games = job.scenarios.map((scenario) => {
      const record = domain.search.playScenario(policy, scenario);
      return {
        s: domain.search.scoreGame(record),
        o: record.outcome === 'won' ? 'w' : record.outcome === 'bankrupt' ? 'b' : 't',
        t: record.wonTurn || 0,
        u: job.wantUsed ? record.used : undefined,
      };
    });
    parentPort.postMessage({ id: job.id, games });
  });
  return;
}

// ── a tournament process: one slice of the tables of a difficulty ──
if (arg('role') === 'tournament') {
  const domain = loadDomain();
  const initial = arg('initial') ? JSON.parse(fs.readFileSync(arg('initial'), 'utf8')) : undefined;
  const tables = Number(arg('tables'));
  const bots = domain.tournament.runBotTournament({
    difficulty: arg('difficulty'),
    tables,
    seats: 4,
    roundLimit: Number(arg('rounds', 40)),
    seed: Number(arg('seed')),
    k: Number(arg('k', 24)),
    kEnd: Number(arg('k-end', 8)),
    initial,
    bots: arg('bots') ? arg('bots').split(',') : undefined,
    onTable: (n) => {
      if (n % 25 === 0) process.stdout.write(`progress ${n}\n`);
    },
  });
  fs.writeFileSync(arg('out'), JSON.stringify(bots));
  process.exit(0);
}

const MODES = {
  fast: { generations: 2, mutants: 3, games: 40, verify: 120, tables: 300, gauntlet: 60 },
  medium: { generations: 5, mutants: 4, games: 60, verify: 300, tables: 1200, gauntlet: 200 },
  full: { generations: 10, mutants: 5, games: 80, verify: 600, tables: 3000, gauntlet: 600 },
};
const mode = arg('mode', 'fast');
if (!MODES[mode]) throw new Error(`mode is one of ${Object.keys(MODES).join(', ')}`);
const plan = {
  ...MODES[mode],
  ...(arg('generations') && { generations: Number(arg('generations')) }),
  ...(arg('mutants') && { mutants: Number(arg('mutants')) }),
  ...(arg('games') && { games: Number(arg('games')) }),
  ...(arg('verify') && { verify: Number(arg('verify')) }),
  ...(arg('tables') && { tables: Number(arg('tables')) }),
};
const seed = Number(arg('seed', Date.now() % 1000000));
const workers = Number(arg('workers', Math.max(1, os.cpus().length - 1)));
const LEVELS = ['easy', 'medium', 'hard'];
const started = Date.now();
const log = (line) =>
  console.log(`[${((Date.now() - started) / 60000).toFixed(1).padStart(6)} min] ${line}`);

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

// ── the pool ──
function makePool(size) {
  const idle = [];
  const waiting = [];
  const pending = new Map();
  let next = 1;
  const all = Array.from({ length: size }, () => {
    const worker = new Worker(__filename, { workerData: { role: 'eval' } });
    worker.on('message', (message) => {
      const done = pending.get(message.id);
      pending.delete(message.id);
      done(message.games);
      const task = waiting.shift();
      if (task) worker.postMessage(task);
      else idle.push(worker);
    });
    worker.on('error', (error) => {
      console.error(error);
      process.exit(1);
    });
    idle.push(worker);
    return worker;
  });
  return {
    run(job) {
      const id = next++;
      const task = { ...job, id };
      return new Promise((resolve) => {
        pending.set(id, resolve);
        const worker = idle.pop();
        if (worker) worker.postMessage(task);
        else waiting.push(task);
      });
    },
    close: () => all.forEach((worker) => worker.terminate()),
  };
}

function summarize(games) {
  const n = Math.max(1, games.length);
  const wins = games.filter((g) => g.o === 'w');
  const turns = wins.map((g) => g.t).sort((a, b) => a - b);
  return {
    scores: games.map((g) => g.s),
    mean: games.reduce((a, g) => a + g.s, 0) / n,
    winRate: wins.length / n,
    bankruptRate: games.filter((g) => g.o === 'b').length / n,
    winTurn: turns.length ? turns[Math.floor(turns.length / 2)] : null,
  };
}

/** The evaluator of the search: each knob set on the scenarios, cut into slices for the workers. */
function evaluator(pool) {
  return async (type, knobSets, scenarios) => {
    const slice = Math.max(1, Math.ceil(scenarios.length / workers));
    return Promise.all(
      knobSets.map(async (knobs) => {
        const parts = [];
        for (let at = 0; at < scenarios.length; at += slice) {
          parts.push(pool.run({ type, knobs, scenarios: scenarios.slice(at, at + slice) }));
        }
        return summarize((await Promise.all(parts)).flat());
      }),
    );
  };
}

const pct = (value) => `${(value * 100).toFixed(0)}%`;

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const domain = loadDomain();
  const championsFile = path.join(outDir, 'champions.json');
  const champions = readJson(championsFile, { version: 1, updated: null, types: {} });
  const types = (
    arg('types') ? arg('types').split(',') : domain.policies.BASE_POLICIES.map((p) => p.id)
  ).filter((id) => domain.policies.BASE_POLICIES.some((p) => p.id === id));
  const runId = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const run = {
    id: runId,
    date: new Date().toISOString(),
    mode,
    seed,
    plan,
    types: {},
    tournament: {},
    gauntlet: null,
  };
  log(`run ${runId}: ${mode}, ${types.length} types, ${workers} workers, seed ${seed}`);
  log(`plan ${JSON.stringify(plan)}`);

  // 0. the list of capabilities
  const open = domain.capabilities.CAPABILITIES.filter((c) => c.status === 'open').map((c) => c.id);
  log(
    `capabilities: ${domain.capabilities.CAPABILITIES.length} listed, ${open.length} no bot makes yet (${open.join(', ') || 'none'})`,
  );
  const missing = domain.capabilities.unlistedCommands();
  if (missing.length) throw new Error(`commands without a capability: ${missing.join(', ')}`);

  const pool = makePool(workers);
  const evaluate = evaluator(pool);

  // 1+2. capabilities in use, and the search
  if (!flag('skip-search')) {
    for (const type of types) {
      const previous = flag('fresh') ? undefined : champions.types[type];
      const start = previous ? previous.knobs : undefined;
      // the capabilities the champion actually exercises, over the same spread of games
      const proofScenarios = domain.search.makeScenarios(Math.max(workers * 2, 48), seed + 17);
      const proofParts = [];
      const slice = Math.ceil(proofScenarios.length / workers);
      for (let at = 0; at < proofScenarios.length; at += slice) {
        proofParts.push(
          pool.run({
            type,
            knobs: start ?? {},
            scenarios: proofScenarios.slice(at, at + slice),
            wantUsed: true,
          }),
        );
      }
      const proof = (await Promise.all(proofParts)).flat();
      const used = {};
      for (const game of proof)
        for (const [id, n] of Object.entries(game.u || {}))
          used[id] = (used[id] || 0) + n / proof.length;
      const result = await domain.search.relearnType({
        type,
        start,
        generations: plan.generations,
        mutants: plan.mutants,
        games: plan.games,
        verifyGames: plan.verify,
        seed: seed + type.length * 131,
        evaluate,
        onProgress: (line) => log(line),
      });
      const verdict = result.verdict;
      log(
        `${type}: ${verdict.changed ? 'NEW champion' : 'kept'} - win ${pct(verdict.oldWinRate)} -> ${pct(verdict.newWinRate)}, ` +
          `bankrupt ${pct(verdict.oldBankrupt)} -> ${pct(verdict.newBankrupt)}, score ${verdict.oldMean.toFixed(3)} -> ${verdict.newMean.toFixed(3)} (z ${verdict.z.toFixed(1)}, ${verdict.games} games)`,
      );
      const resolved = domain.policies.baseById(type).retune(result.knobs).resolved;
      const entry = champions.types[type] || { history: [] };
      champions.types[type] = {
        knobs: result.knobs,
        resolved,
        winRate: verdict.changed ? verdict.newWinRate : verdict.oldWinRate,
        bankruptRate: verdict.changed ? verdict.newBankrupt : verdict.oldBankrupt,
        score: verdict.changed ? verdict.newMean : verdict.oldMean,
        since: verdict.changed ? runId : (entry.since ?? runId),
        history: [
          ...(entry.history || []).slice(-19),
          {
            run: runId,
            changed: verdict.changed,
            winRate: verdict.newWinRate,
            oldWinRate: verdict.oldWinRate,
            z: verdict.z,
          },
        ],
      };
      run.types[type] = { ...verdict, used, steps: result.steps.length };
      champions.updated = new Date().toISOString();
      // a checkpoint after every type: an interrupted run loses at most one
      fs.writeFileSync(championsFile, JSON.stringify(champions, null, 1));
    }
  }
  pool.close();

  // write the champions into the domain and build it, so that the tournament plays with them
  if (!flag('no-write')) {
    const knobs = Object.fromEntries(
      Object.entries(champions.types).map(([id, c]) => [id, c.knobs]),
    );
    fs.writeFileSync(
      path.join(root, 'packages/domain/src/cashflow-game/dreamfund-sim/champions.generated.ts'),
      `// Generated by scripts/dreamfund-calibrate.js --write from docs/dreamfund-balance/champions.json. Do not edit.\n` +
        `import type { DreamKnobs } from './policies';\n\n` +
        `export const DREAM_CHAMPION_KNOBS: Record<string, DreamKnobs> = ${JSON.stringify(knobs, null, 2)};\n`,
    );
    log('building the domain with the new champions');
    execSync('npm run build:domain', { cwd: root, stdio: 'ignore' });
  }

  // 3. the tournament
  if (!flag('skip-tournament')) {
    const perDifficulty = Math.max(1, Math.floor(workers / LEVELS.length));
    const slices = [];
    for (const difficulty of LEVELS) {
      const before = readJson(path.join(outDir, `bot-ratings-${difficulty}.json`), null);
      const initialFile = path.join(os.tmpdir(), `dream-initial-${difficulty}.json`);
      fs.writeFileSync(
        initialFile,
        JSON.stringify(Object.fromEntries((before?.bots || []).map((b) => [b.botId, b.rating]))),
      );
      const each = Math.ceil(plan.tables / perDifficulty);
      for (let s = 0; s < perDifficulty; s += 1) {
        const out = path.join(os.tmpdir(), `dream-tour-${difficulty}-${s}.json`);
        slices.push({
          difficulty,
          out,
          each,
          initialFile,
          seed: seed * 31 + s * 977 + difficulty.length,
          previous: before,
        });
      }
    }
    log(
      `tournament: ${plan.tables} tables on each of ${LEVELS.length} difficulties, ${slices.length} processes`,
    );
    await Promise.all(
      slices.map(
        (slice) =>
          new Promise((resolve, reject) => {
            const child = spawn(
              process.execPath,
              [
                __filename,
                '--role',
                'tournament',
                '--difficulty',
                slice.difficulty,
                '--tables',
                String(slice.each),
                '--seed',
                String(slice.seed),
                '--initial',
                slice.initialFile,
                '--out',
                slice.out,
              ],
              { stdio: ['ignore', 'pipe', 'inherit'] },
            );
            child.stdout.on('data', () => undefined);
            child.on('exit', (code) =>
              code === 0 ? resolve() : reject(new Error(`tournament process failed (${code})`)),
            );
          }),
      ),
    );
    for (const difficulty of LEVELS) {
      const parts = slices
        .filter((s) => s.difficulty === difficulty)
        .map((s) => readJson(s.out, []));
      const ids = parts[0].map((b) => b.botId);
      // the processes rated the same bots from the same start on different tables: the rating is their mean
      const merged = ids.map((botId) => {
        const mine = parts.map((part) => part.find((b) => b.botId === botId));
        const sum = (key) => mine.reduce((a, b) => a + b[key], 0);
        return {
          botId,
          rating: sum('rating') / mine.length,
          games: sum('games'),
          tableWins: sum('tableWins'),
          places: sum('places'),
        };
      });
      // a tournament only moves points between the bots: the mean stays 1500, and the best sit well above it
      const mean = merged.reduce((a, b) => a + b.rating, 0) / merged.length;
      for (const bot of merged) bot.rating = Math.round((bot.rating - mean + 1500) * 10) / 10;
      merged.sort((a, b) => b.rating - a.rating);
      const previous = slices.find((s) => s.difficulty === difficulty).previous;
      run.tournament[difficulty] = {
        tables: plan.tables,
        top: merged
          .slice(0, 12)
          .map((b) => ({ botId: b.botId, rating: Math.round(b.rating), games: b.games })),
        moved: previous
          ? merged
              .filter((b) => previous.bots.some((p) => p.botId === b.botId))
              .map((b) => ({
                botId: b.botId,
                change: Math.round(
                  b.rating - previous.bots.find((p) => p.botId === b.botId).rating,
                ),
              }))
              .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
              .slice(0, 6)
          : [],
        newBots: previous
          ? merged.filter((b) => !previous.bots.some((p) => p.botId === b.botId)).length
          : merged.length,
      };
      fs.writeFileSync(
        path.join(outDir, `bot-ratings-${difficulty}.json`),
        JSON.stringify({ difficulty, tables: plan.tables, run: runId, bots: merged }, null, 1),
      );
      log(
        `${difficulty}: ${merged
          .slice(0, 5)
          .map((b) => `${b.botId} ${Math.round(b.rating)}`)
          .join(', ')}`,
      );
    }
    if (!flag('no-write')) {
      execSync('node scripts/dreamfund-tournament.js --write', { cwd: root, stdio: 'ignore' });
      execSync('npm run build:domain', { cwd: root, stdio: 'ignore' });
    }

    // 4. the gauntlet: the best masters on fresh seeds
    const average = {};
    for (const difficulty of LEVELS) {
      for (const bot of readJson(path.join(outDir, `bot-ratings-${difficulty}.json`), { bots: [] })
        .bots) {
        if (bot.botId.includes('--')) continue;
        average[bot.botId] = (average[bot.botId] || 0) + bot.rating / LEVELS.length;
      }
    }
    const finalists = Object.entries(average)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id);
    log(`gauntlet: ${finalists.join(', ')} - ${plan.gauntlet} tables on each difficulty`);
    const wins = Object.fromEntries(finalists.map((id) => [id, { wins: 0, games: 0 }]));
    const gauntletParts = [];
    for (const difficulty of LEVELS) {
      for (let s = 0; s < perDifficulty; s += 1) {
        const out = path.join(os.tmpdir(), `dream-gauntlet-${difficulty}-${s}.json`);
        gauntletParts.push(
          new Promise((resolve, reject) => {
            const child = spawn(
              process.execPath,
              [
                __filename,
                '--role',
                'tournament',
                '--difficulty',
                difficulty,
                '--tables',
                String(Math.ceil(plan.gauntlet / perDifficulty)),
                '--seed',
                String(seed * 17 + s * 313 + 5),
                '--bots',
                finalists.join(','),
                '--out',
                out,
                '--k',
                '0',
                '--k-end',
                '0',
              ],
              { stdio: ['ignore', 'pipe', 'inherit'] },
            );
            child.stdout.on('data', () => undefined);
            child.on('exit', (code) => {
              if (code !== 0) return reject(new Error('gauntlet failed'));
              for (const bot of readJson(out, [])) {
                wins[bot.botId].wins += bot.tableWins;
                wins[bot.botId].games += bot.games;
              }
              resolve();
            });
          }),
        );
      }
    }
    await Promise.all(gauntletParts);
    const table = finalists
      .map((id) => ({
        botId: id,
        winShare: wins[id].games ? wins[id].wins / wins[id].games : 0,
        games: wins[id].games,
        rating: Math.round(average[id]),
      }))
      .sort((a, b) => b.winShare - a.winShare);
    run.gauntlet = { finalists: table, champion: table[0].botId };
    log(`champion of the champions: ${table[0].botId} (${pct(table[0].winShare)} of its tables)`);
  }

  // 5. the history
  run.minutes = Math.round((Date.now() - started) / 600) / 100;
  const runsFile = path.join(outDir, 'runs.json');
  const runs = readJson(runsFile, []);
  runs.push(run);
  fs.writeFileSync(runsFile, JSON.stringify(runs, null, 1));
  fs.writeFileSync(path.join(outDir, 'CALIBRATION.md'), reportMarkdown(runs));
  log(`done in ${run.minutes} min - docs/dreamfund-balance/CALIBRATION.md`);
}

function reportMarkdown(runs) {
  const last = runs[runs.length - 1];
  const lines = [
    '# Dreamfund bot calibration',
    '',
    'Written by `scripts/dreamfund-calibrate.js` (the runs below, newest last). A run relearns each type of bot from the champion of the run before it, rates all bots on tables of bots only, and plays the best masters against each other. Read `docs/domain/DREAMFUND_BOTS.md` for how it works.',
    '',
    `## Latest run: ${last.id} (${last.mode}, ${last.minutes} min)`,
    '',
  ];
  const types = Object.entries(last.types);
  if (types.length) {
    lines.push(
      '### Types',
      '',
      '| type | verdict | win rate (old -> new) | bankrupt (old -> new) | score | games | capabilities used per game |',
      '|---|---|---|---|---|---|---|',
    );
    for (const [id, t] of types) {
      const used = Object.entries(t.used || {})
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v.toFixed(1)}`)
        .join(', ');
      lines.push(
        `| ${id} | ${t.changed ? '**new champion**' : 'kept'} (z ${t.z.toFixed(1)}) | ${pct(t.oldWinRate)} -> ${pct(t.newWinRate)} | ${pct(t.oldBankrupt)} -> ${pct(t.newBankrupt)} | ${t.oldMean.toFixed(3)} -> ${t.newMean.toFixed(3)} | ${t.games} | ${used} |`,
      );
    }
    lines.push('');
  }
  for (const [difficulty, t] of Object.entries(last.tournament || {})) {
    lines.push(
      `### Tournament, ${difficulty} (${t.tables} tables, ${t.newBots} new bots)`,
      '',
      t.top.map((b, i) => `${i + 1}. ${b.botId} ${b.rating}`).join('  \n'),
      '',
    );
  }
  if (last.gauntlet) {
    lines.push(
      '### Gauntlet - the champion of the champions',
      '',
      `**${last.gauntlet.champion}**`,
      '',
      '| bot | share of its tables won | rating (average of the difficulties) |',
      '|---|---|---|',
    );
    for (const f of last.gauntlet.finalists)
      lines.push(`| ${f.botId} | ${pct(f.winShare)} (${f.games} seats) | ${f.rating} |`);
    lines.push('');
  }
  lines.push(
    '## History',
    '',
    '| run | mode | minutes | new champions | champion of the champions |',
    '|---|---|---|---|---|',
  );
  for (const r of runs) {
    const changed =
      Object.entries(r.types || {})
        .filter(([, t]) => t.changed)
        .map(([id]) => id)
        .join(', ') || '-';
    lines.push(
      `| ${r.id} | ${r.mode} | ${r.minutes} | ${changed} | ${r.gauntlet ? r.gauntlet.champion : '-'} |`,
    );
  }
  return lines.join('\n') + '\n';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
