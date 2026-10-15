#!/usr/bin/env node
'use strict';

/**
 * The Cashflow tournament (todo/cashflow-tournament-and-bots.md, A1/A2): plays whole multiplayer tables in memory - the real
 * table rules - with a strategy at every seat and a fixed profession at every seat, every strategy in every seat, and reports who
 * wins. Where the strategy lab measures how fast one player escapes alone, this measures who escapes first when they race.
 *
 *   node scripts/tournament-lab.js                          small first run (2 seats, guided, mirror, 8 professions, 4 rounds)
 *   node scripts/tournament-lab.js --players 2,4 --rules guided,strict --professions all --rounds 20 --write
 *
 *   --players   seats per table, comma list              (default 2)
 *   --rules     guided, strict, comma list               (default guided)
 *   --mode      mirror (everyone the same profession), mix (each seat another), comma list   (default mirror)
 *   --professions  all, or ids, comma list               (default: the first 8)
 *   --policies  ids, comma list                          (default: the presets and the search's best)
 *   --rounds    lineups per cell; each is played in every seat rotation   (default 4)
 *   --trading   players may offer property cards to each other
 *   --seed      base seed (default 5000)
 *   --write     write docs/domain/strategy/data/tournament.json and docs/domain/CASHFLOW_TOURNAMENT.md (otherwise just print)
 *
 * Needs the domain package built (`npm run build --workspace=packages/domain`). Same seeds, same rules, same numbers.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const domain = require('@money/domain');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

const root = path.resolve(__dirname, '..');

function loadSpecs() {
  // the bots a host can seat: the lab's presets, the solo search's best and the champion (the domain's bot catalog)
  return require('@money/domain/dist/cashflow-game/table/bot-catalog').botProfiles().map((profile) => profile.spec);
}

// ───────────────────────────── worker ─────────────────────────────
if (!isMainThread) {
  const specs = workerData.specs;
  const byId = new Map(specs.map((spec) => [spec.id, domain.policyFromSpec(spec)]));
  parentPort.on('message', (job) => {
    const results = [];
    for (const match of job.matches) {
      results.push(
        domain.playMatch({
          seed: match.seed,
          policies: match.lineup.map((id) => byId.get(id)),
          professionIds: match.professionIds,
          rulesBase: job.rulesBase,
          trading: job.trading,
          gameSetId: job.setId,
        }),
      );
    }
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

const opts = args();
const list = (value, fallback) =>
  value
    ? String(value)
        .split(',')
        .map((s) => s.trim())
    : fallback;
const setId = 'cashflow';
const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === setId);
const allProfessions = gameSet.professions.map((p) => p.id);
const specs = loadSpecs();
const config = {
  players: list(opts.players, ['2']).map(Number),
  rules: list(opts.rules, ['guided']),
  modes: list(opts.mode, ['mirror']),
  professions:
    opts.professions === 'all'
      ? allProfessions
      : list(opts.professions, allProfessions.slice(0, 8)),
  policies: list(
    opts.policies,
    specs.map((s) => s.id),
  ),
  rounds: Number(opts.rounds ?? 4),
  trading: Boolean(opts.trading),
  seedBase: Number(opts.seed ?? 5000),
};

/** One cell of the grid: a number of seats, a rules base, mirror or mix, one profession (mirror) or a rotation (mix). */
function cells() {
  const out = [];
  for (const players of config.players) {
    for (const rulesBase of config.rules) {
      for (const mode of config.modes) {
        if (mode === 'mirror') {
          for (const professionId of config.professions)
            out.push({ players, rulesBase, mode, professionId });
        } else {
          out.push({ players, rulesBase, mode, professionId: 'mixed' });
        }
      }
    }
  }
  return out;
}

function matchesFor(cell, index) {
  const lineups = domain.buildLineups(
    config.policies,
    cell.players,
    config.rounds,
    config.seedBase + index * 977,
  );
  return lineups.map((lineup, n) => {
    // mirror: everyone the same profession; mix: each seat another, the set rotating with the match
    const professionIds =
      cell.mode === 'mirror'
        ? lineup.map(() => cell.professionId)
        : lineup.map((_, seat) => config.professions[(n + seat * 3) % config.professions.length]);
    return { seed: config.seedBase + index * 100_000 + n, lineup, professionIds };
  });
}

function wilson(wins, n) {
  return domain.wilsonInterval(wins, n);
}

async function main() {
  const jobs = cells().map((cell, index) => ({
    jobId: index,
    cell,
    matches: matchesFor(cell, index),
    rulesBase: cell.rulesBase,
    trading: config.trading,
    setId,
  }));
  const total = jobs.reduce((sum, job) => sum + job.matches.length, 0);
  console.log(`${jobs.length} cells, ${total} tables, ${config.policies.length} strategies`);

  const workers = Math.max(1, Math.min(os.cpus().length - 1, jobs.length));
  const pool = Array.from(
    { length: workers },
    () => new Worker(__filename, { workerData: { specs } }),
  );
  const done = new Map();
  const started = Date.now();
  let next = 0;
  await new Promise((resolve, reject) => {
    const feed = (worker) => {
      if (next >= jobs.length) return;
      const job = jobs[next];
      next += 1;
      worker.postMessage(job);
    };
    for (const worker of pool) {
      worker.on('message', (message) => {
        done.set(message.jobId, message.results);
        process.stdout.write(
          `\r${done.size}/${jobs.length} cells  ${Math.round((Date.now() - started) / 1000)}s `,
        );
        if (done.size === jobs.length) resolve();
        else feed(worker);
      });
      worker.on('error', reject);
      feed(worker);
    }
  });
  pool.forEach((worker) => worker.terminate());
  console.log('');

  const cellResults = jobs.map((job) => {
    const results = done.get(job.jobId);
    return {
      ...job.cell,
      tables: results.length,
      problems: [...new Set(results.flatMap((r) => r.problems))],
      cutOff: results.filter((r) => r.cutOff).length,
      noWinner: results.filter((r) => r.winnerSeat === null).length,
      scores: domain.scoreMatches(results),
      winsBySeat: domain.winsBySeat(results),
      headToHead: domain.headToHead(results),
    };
  });

  const problems = cellResults.flatMap((c) => c.problems);
  if (problems.length) console.log('PROBLEMS:', [...new Set(problems)].slice(0, 5));

  // overall, by seats x rules x mode
  const groups = new Map();
  for (const cell of cellResults) {
    const key = `${cell.players} seats, ${cell.rulesBase}, ${cell.mode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cell);
  }
  const overall = [...groups.entries()].map(([key, group]) => {
    const merged = new Map();
    for (const cell of group) {
      for (const s of cell.scores) {
        const m = merged.get(s.policyId) ?? {
          policyId: s.policyId,
          appearances: 0,
          wins: 0,
          rankSum: 0,
          escapes: 0,
          bankrupt: 0,
          chance: 0,
        };
        m.appearances += s.appearances;
        m.wins += s.wins;
        m.rankSum += s.meanRank * s.appearances;
        m.escapes += s.escapes;
        m.bankrupt += s.bankrupt;
        m.chance += s.expectedWinRate * s.appearances;
        merged.set(s.policyId, m);
      }
    }
    const scores = [...merged.values()]
      .map((m) => ({
        policyId: m.policyId,
        appearances: m.appearances,
        winRate: m.wins / m.appearances,
        winInterval: wilson(m.wins, m.appearances),
        expectedWinRate: m.chance / m.appearances,
        meanRank: m.rankSum / m.appearances,
        escapeRate: m.escapes / m.appearances,
        bankruptRate: m.bankrupt / m.appearances,
      }))
      .sort((a, b) => b.winRate - a.winRate);
    return { key, tables: group.reduce((n, c) => n + c.tables, 0), scores };
  });

  for (const group of overall) {
    console.log(`\n${group.key} (${group.tables} tables)`);
    for (const s of group.scores) {
      console.log(
        `  ${s.policyId.padEnd(22)} wins ${(s.winRate * 100).toFixed(1).padStart(5)}% ` +
          `[${(s.winInterval.low * 100).toFixed(0)}-${(s.winInterval.high * 100).toFixed(0)}]  by luck ${(s.expectedWinRate * 100).toFixed(0)}%  ` +
          `rank ${s.meanRank.toFixed(2)}  escapes ${(s.escapeRate * 100).toFixed(0)}%  bankrupt ${(s.bankruptRate * 100).toFixed(0)}%`,
      );
    }
  }

  const rulesDigest = domain.strategyRulesDigest(CASHFLOW_GAME_SETS);
  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      rulesDigest,
      config,
      seconds: Math.round((Date.now() - started) / 1000),
      note: 'A table is won by the first player to escape the rat race. Win rate is wins per seat played; "by luck" is what a coin flip between the seats would give. Same seeds and rules give the same numbers.',
    },
    overall,
    cells: cellResults,
  };

  if (opts.write) {
    const dataFile = path.join(root, 'docs/domain/strategy/data/tournament.json');
    fs.writeFileSync(dataFile, JSON.stringify(output, null, 1) + '\n');
    fs.writeFileSync(path.join(root, 'docs/domain/CASHFLOW_TOURNAMENT.md'), report(output, specs));
    console.log(
      '\nwritten: docs/domain/strategy/data/tournament.json, docs/domain/CASHFLOW_TOURNAMENT.md',
    );
  }
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(overall))
    .digest('hex')
    .slice(0, 12);
  console.log(`result digest ${digest}`);
}

function report(output, policySpecs) {
  const label = (id) => (policySpecs.find((s) => s.id === id) || {}).label || id;
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const lines = [];
  lines.push('# Cashflow tournament - who wins a table');
  lines.push('');
  lines.push(
    `_Generated by \`node scripts/tournament-lab.js --write\` - do not edit by hand. ${output.meta.config.rounds} lineup rounds per cell, ` +
      `seeds from ${output.meta.config.seedBase}, ${output.meta.seconds}s. ${output.meta.note}_`,
  );
  lines.push('');
  for (const group of output.overall) {
    lines.push(`## ${group.key} (${group.tables} tables)`);
    lines.push('');
    lines.push('| Strategy | Wins | 95% range | By luck | Mean rank | Escapes | Bankrupt |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const s of group.scores) {
      lines.push(
        `| ${label(s.policyId)} | ${pct(s.winRate)} | ${pct(s.winInterval.low)}-${pct(s.winInterval.high)} | ${pct(s.expectedWinRate)} | ${s.meanRank.toFixed(2)} | ${pct(s.escapeRate)} | ${pct(s.bankruptRate)} |`,
      );
    }
    lines.push('');
  }
  const mirror = output.cells.filter((c) => c.mode === 'mirror');
  if (mirror.length) {
    lines.push('## Best strategy by profession (mirror tables)');
    lines.push('');
    lines.push(
      'Everyone at the table has the same profession. With only a few dozen tables per cell, a gap under about 15 points is noise: a ' +
        '"≈" means the best and the second best cannot be told apart yet (their 95% ranges overlap). More rounds sharpen it.',
    );
    lines.push('');
    lines.push('| Profession | Seats | Rules | Tables | Best | Wins | Second | Wins | |');
    lines.push('| --- | ---: | --- | ---: | --- | ---: | --- | ---: | --- |');
    for (const c of mirror) {
      const [a, b] = c.scores;
      const title =
        (CASHFLOW_GAME_SETS[0].professions.find((p) => p.id === c.professionId) || {}).title ||
        c.professionId;
      const tie = b && b.winInterval.high >= a.winInterval.low ? '≈' : '';
      lines.push(
        `| ${title} | ${c.players} | ${c.rulesBase} | ${c.tables} | ${label(a.policyId)} | ${pct(a.winRate)} | ${b ? label(b.policyId) : '-'} | ${b ? pct(b.winRate) : '-'} | ${tie} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
