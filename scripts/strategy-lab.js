#!/usr/bin/env node
'use strict';

/**
 * The Cashflow strategy lab (todo/cashflow-game-analysis.md, E2): plays thousands of whole solo games in memory - the same
 * rules the app and the Pro API run - for every profession and a set of strategies, and writes down what happened: how
 * often a strategy escapes the rat race or goes bankrupt, how fast, how rich.
 *
 *   node scripts/strategy-lab.js                       presets x all professions, 200 games each
 *   node scripts/strategy-lab.js --games 500 --search  also search the strategy knobs for the best one
 *
 * Needs the domain package built (`npm run build --workspace=packages/domain`). Writes
 *   docs/domain/strategy/data/results.json         every figure, with the seeds that reproduce it
 *   src/assets/i18n/cashflow-manual/strategy-lab.json   the same, for the in-app manual (self-hosted only)
 *   docs/domain/CASHFLOW_STRATEGY_LAB.md           the readable report (the MCP explain_concept topic cashflow_strategy_lab)
 * Same seeds, same rules, same numbers: a run is reproducible.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const domain = require('@money/domain');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

// ───────────────────────────── worker ─────────────────────────────
if (!isMainThread) {
  parentPort.on('message', (job) => {
    const policy = domain.policyFromSpec(job.spec);
    const records = [];
    for (const seed of job.seeds) {
      records.push(
        domain.simulateGame({
          gameSets: CASHFLOW_GAME_SETS,
          gameSetId: job.setId,
          professionId: job.professionId,
          policy,
          seed,
          maxTurns: job.maxTurns,
        }),
      );
    }
    const escaped = records.filter((record) => record.outcome === 'escaped');
    const by = (list, key, direction) =>
      list.length ? [...list].sort((a, b) => direction * (a[key] - b[key]))[0] : null;
    const pick = (record) =>
      record
        ? {
            seed: record.seed,
            turns: record.turns,
            rounds: record.rounds,
            passiveIncomeMinor: record.passiveIncomeMinor,
          }
        : null;
    parentPort.postMessage({
      jobId: job.jobId,
      stats: domain.summarizeGames(records),
      examples: {
        fastest: pick(by(escaped, 'turns', 1)),
        slowest: pick(by(escaped, 'turns', -1)),
        richest: pick(by(records, 'peakPassiveIncomeMinor', -1)),
        bankrupt: pick(records.find((record) => record.outcome === 'bankrupt') ?? null),
      },
    });
  });
  return;
}

// ───────────────────────────── main ─────────────────────────────
function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

const GAMES = Number(argument('games', 200));
const MAX_TURNS = Number(argument('max-turns', 400));
const SEED_BASE = Number(argument('seed-base', 1000));
const WORKERS = Number(argument('workers', Math.max(1, os.cpus().length - 1)));
const SEARCH = argument('search', false) === true || argument('search-only', false) === true;
const SEARCH_GAMES = Number(argument('search-games', 30));
const ONLY_PROFESSIONS = argument('professions', null);
const SEARCH_ONLY = argument('search-only', false) === true;
const OUT_DOCS = path.join(__dirname, '..', 'docs', 'domain', 'strategy');
const OUT_REPORT = path.join(__dirname, '..', 'docs', 'domain', 'CASHFLOW_STRATEGY_LAB.md');
const OUT_APP = path.join(
  __dirname,
  '..',
  'src',
  'assets',
  'i18n',
  'cashflow-manual',
  'strategy-lab.json',
);

const playableSets = CASHFLOW_GAME_SETS.filter(
  (set) => set.id === 'cashflow' || set.id === 'custom-jfk',
);
const professions = playableSets.flatMap((set) =>
  set.professions
    .filter(
      (profession) =>
        !ONLY_PROFESSIONS || String(ONLY_PROFESSIONS).split(',').includes(profession.id),
    )
    .map((profession) => ({
      setId: set.id,
      id: profession.id,
      title: profession.title,
      salaryMinor: profession.salaryMinor,
      expensesMinor: profession.expenses.reduce((sum, line) => sum + line.amountMinor, 0),
      savingsMinor: profession.savingsMinor,
    })),
);

/** The rules the numbers were measured on: the game sets (cards, professions, loan rule), the board, the simulator version. */
function rulesDigest() {
  return domain.strategyRulesDigest(playableSets);
}

function runJobs(jobs) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0;
    let done = 0;
    if (jobs.length === 0) return resolve(results);
    const size = Math.min(WORKERS, jobs.length);
    const workers = [];
    const feed = (worker) => {
      if (next >= jobs.length) return;
      worker.postMessage({ ...jobs[next], jobId: next });
      next += 1;
    };
    for (let i = 0; i < size; i += 1) {
      const worker = new Worker(__filename);
      workers.push(worker);
      worker.on('message', (message) => {
        results[message.jobId] = message;
        done += 1;
        if (done % 25 === 0 || done === jobs.length) {
          process.stderr.write(`\r  ${done}/${jobs.length} jobs`);
        }
        if (done === jobs.length) {
          process.stderr.write('\n');
          workers.forEach((w) => w.terminate());
          resolve(results);
        } else feed(worker);
      });
      worker.on('error', reject);
      feed(worker);
    }
  });
}

const seedsFor = (count) => Array.from({ length: count }, (_, index) => SEED_BASE + index);

/** How good a strategy is on a profession: escape first, then speed; bankruptcies count against it. */
function score(stats) {
  const speed = stats.turnsToEscape ? stats.turnsToEscape.median : MAX_TURNS * 2;
  return stats.escapeRate - 0.25 * stats.bankruptRate - speed / 100000;
}

function gridSpecs() {
  const specs = [];
  for (const minMonthlyReturn of [0, 0.02, 0.04])
    for (const reserveMinor of [0, 100000, 300000])
      for (const loans of ['never', 'bridge'])
        for (const bigDealFromCashMinor of [null, 2000000, 0])
          for (const buyMlm of [false, true])
            for (const shares of [
              null,
              { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.5 },
            ]) {
              const overrides = {
                minMonthlyReturn,
                reserveMinor,
                loans,
                bigDealFromCashMinor,
                buyMlm,
                shares,
              };
              if (loans === 'bridge')
                Object.assign(overrides, { repayLoans: true, loanCoverage: 1.5 });
              const id = `grid-${crypto.createHash('sha1').update(JSON.stringify(overrides)).digest('hex').slice(0, 8)}`;
              specs.push({
                id,
                label: 'Searched strategy',
                description: describe(overrides),
                overrides,
              });
            }
  return specs;
}

/** What each setting of each knob does on average over every combination that has it - the readable answer of the search. */
function knobEffectsOf(ranked, bySpec) {
  const describeValue = (name, value) =>
    value === null ? 'none' : typeof value === 'object' ? 'on' : String(value);
  const knobs = [
    'minMonthlyReturn',
    'reserveMinor',
    'loans',
    'bigDealFromCashMinor',
    'buyMlm',
    'shares',
  ];
  const groups = new Map();
  for (const row of ranked) {
    const overrides = bySpec.get(row.id).overrides;
    for (const knob of knobs) {
      const key = `${knob}=${describeValue(knob, overrides[knob])}`;
      const entry = groups.get(key) ?? {
        knob,
        value: describeValue(knob, overrides[knob]),
        n: 0,
        escape: 0,
        bankrupt: 0,
        turns: [],
      };
      entry.n += 1;
      entry.escape += row.escapeRate;
      entry.bankrupt += row.bankruptRate;
      if (row.medianTurnsToEscape !== null) entry.turns.push(row.medianTurnsToEscape);
      groups.set(key, entry);
    }
  }
  return [...groups.values()].map((entry) => ({
    knob: entry.knob,
    value: entry.value,
    combinations: entry.n,
    escapeRate: entry.escape / entry.n,
    bankruptRate: entry.bankrupt / entry.n,
    medianTurnsToEscape: entry.turns.length
      ? entry.turns.reduce((a, b) => a + b, 0) / entry.turns.length
      : null,
  }));
}

function money(minor) {
  return Math.round(minor / 100).toLocaleString('en-US');
}

function describe(overrides) {
  const parts = [];
  parts.push(
    overrides.minMonthlyReturn
      ? `properties paying at least ${Math.round(overrides.minMonthlyReturn * 100)}% a month`
      : 'any property',
  );
  parts.push(
    overrides.reserveMinor ? `${money(overrides.reserveMinor)} kept in reserve` : 'no reserve',
  );
  parts.push(overrides.loans === 'bridge' ? 'borrows when the card pays for it' : 'never borrows');
  parts.push(
    overrides.bigDealFromCashMinor === null
      ? 'Small Deals only'
      : overrides.bigDealFromCashMinor === 0
        ? 'Big Deals only'
        : `Big Deals from ${money(overrides.bigDealFromCashMinor)} cash`,
  );
  if (overrides.buyMlm) parts.push('buys Multi-Level-Marketing');
  if (overrides.shares) parts.push('trades stocks');
  return parts.join(', ');
}

async function evaluate(specs, targetProfessions, games, label) {
  const jobs = [];
  for (const profession of targetProfessions) {
    for (const spec of specs) {
      jobs.push({
        setId: profession.setId,
        professionId: profession.id,
        spec,
        seeds: seedsFor(games),
        maxTurns: MAX_TURNS,
      });
    }
  }
  process.stderr.write(`${label}: ${jobs.length} jobs x ${games} games\n`);
  const results = await runJobs(jobs);
  const table = {};
  jobs.forEach((job, index) => {
    (table[job.professionId] ??= {})[job.spec.id] = results[index];
  });
  return table;
}

function overall(table, specs, targetProfessions) {
  // every strategy over every profession, each profession weighing the same
  return specs.map((spec) => {
    const rows = targetProfessions.map((profession) => table[profession.id][spec.id].stats);
    const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
    const turns = rows
      .map((row) => row.turnsToEscape?.median)
      .filter((value) => value !== undefined);
    return {
      id: spec.id,
      escapeRate: mean((row) => row.escapeRate),
      bankruptRate: mean((row) => row.bankruptRate),
      timeoutRate: mean((row) => row.timeoutRate),
      medianTurnsToEscape: turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : null,
      meanPeakPassiveIncomeMinor: mean((row) => row.peakPassiveIncomeMinor?.mean ?? 0),
    };
  });
}

async function main() {
  if (argument('report-only', false) === true) {
    const existing = JSON.parse(
      fs.readFileSync(path.join(OUT_DOCS, 'data', 'results.json'), 'utf8'),
    );
    fs.writeFileSync(OUT_REPORT, report(existing));
    console.error('report rewritten from the existing results');
    return;
  }
  const started = Date.now();
  const digest = rulesDigest();
  console.error(
    `rules ${digest}; ${professions.length} professions; ${GAMES} games each; ${WORKERS} workers`,
  );

  let specs = [...domain.PRESET_SPECS];

  let searched = null;
  if (SEARCH) {
    const representative = ['hausmeister', 'lehrer', 'manager', 'pilot', 'arzt']
      .map((id) => professions.find((profession) => profession.id === id))
      .filter(Boolean);
    const grid = gridSpecs();
    const table = await evaluate(grid, representative, SEARCH_GAMES, 'search');
    const ranked = overall(table, grid, representative)
      .map((row) => ({
        ...row,
        score:
          row.escapeRate -
          0.25 * row.bankruptRate -
          (row.medianTurnsToEscape ?? MAX_TURNS * 2) / 100000,
      }))
      .sort((a, b) => b.score - a.score);
    const bySpec = new Map(grid.map((spec) => [spec.id, spec]));
    const bySpecAll = new Map(grid.map((spec) => [spec.id, spec]));
    const knobEffects = knobEffectsOf(ranked, bySpecAll);
    searched = {
      knobEffects,
      all: ranked.map((row) => ({
        id: row.id,
        escapeRate: row.escapeRate,
        bankruptRate: row.bankruptRate,
        medianTurnsToEscape: row.medianTurnsToEscape,
        overrides: bySpecAll.get(row.id).overrides,
      })),
      tried: grid.length,
      gamesPerProfession: SEARCH_GAMES,
      professions: representative.map((profession) => profession.id),
      top: ranked.slice(0, 5).map((row) => ({ ...row, spec: bySpec.get(row.id) })),
      worst: ranked.slice(-3).map((row) => ({ ...row, spec: bySpec.get(row.id) })),
    };
    const best = bySpec.get(ranked[0].id);
    specs = [
      ...specs,
      {
        ...best,
        id: 'best-found',
        label: 'Best strategy found by the search',
        description: best.description,
      },
    ];
    console.error(`search best: ${best.description}`);
  }

  if (SEARCH_ONLY) {
    const file = path.join(OUT_DOCS, 'data', 'results.json');
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    existing.search = searched;
    const json = JSON.stringify(existing, null, 1);
    fs.writeFileSync(file, json + '\n');
    fs.writeFileSync(OUT_APP, json + '\n');
    fs.writeFileSync(OUT_REPORT, report(existing));
    console.error('search merged into the existing results');
    return;
  }

  const table = await evaluate(specs, professions, GAMES, 'lab');
  const summary = overall(table, specs, professions);

  const results = {
    meta: {
      generatedAt: new Date().toISOString(),
      rulesDigest: digest,
      gamesPerGroup: GAMES,
      maxTurns: MAX_TURNS,
      seedBase: SEED_BASE,
      seconds: Math.round((Date.now() - started) / 1000),
      note: 'Each group is the same seeds for every strategy. A strategy is judged by how often it escapes the rat race, then how fast (rolls = turns, Paydays = months); bankruptcies count against it.',
    },
    policies: specs.map((spec) => ({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      overrides: spec.overrides,
    })),
    professions,
    summary,
    results: Object.fromEntries(
      professions.map((profession) => [
        profession.id,
        Object.fromEntries(
          specs.map((spec) => [
            spec.id,
            {
              ...table[profession.id][spec.id].stats,
              examples: table[profession.id][spec.id].examples,
            },
          ]),
        ),
      ]),
    ),
    ...(searched ? { search: searched } : {}),
  };

  fs.mkdirSync(path.join(OUT_DOCS, 'data'), { recursive: true });
  const json = JSON.stringify(results, null, 1);
  fs.writeFileSync(path.join(OUT_DOCS, 'data', 'results.json'), json + '\n');
  fs.writeFileSync(OUT_APP, json + '\n');
  fs.writeFileSync(OUT_REPORT, report(results));
  console.error(`done in ${results.meta.seconds}s -> ${path.relative(process.cwd(), OUT_DOCS)}`);
}

// ───────────────────────────── the readable report ─────────────────────────────
/** A knob and its setting in plain words, for the report. */
function knobWords(effect) {
  const value = effect.value;
  switch (effect.knob) {
    case 'minMonthlyReturn':
      return {
        knob: 'Smallest return a property must pay',
        setting:
          value === '0'
            ? 'any property'
            : `${Math.round(Number(value) * 100)}% a month on the deposit`,
      };
    case 'reserveMinor':
      return {
        knob: 'Cash kept after a purchase',
        setting: value === '0' ? 'none' : money(Number(value)),
      };
    case 'loans':
      return {
        knob: 'Bank loans',
        setting: value === 'bridge' ? 'borrows when the card pays for it' : 'never borrows',
      };
    case 'bigDealFromCashMinor':
      return {
        knob: 'Which deals to draw',
        setting:
          value === 'none'
            ? 'Small Deals only'
            : value === '0'
              ? 'Big Deals only'
              : `Big Deals from ${money(Number(value))} cash`,
      };
    case 'buyMlm':
      return {
        knob: 'Multi-Level-Marketing',
        setting: value === 'true' ? 'buys it' : 'ignores it',
      };
    case 'shares':
      return {
        knob: 'Stocks',
        setting: value === 'on' ? 'trades them for deposit money' : 'ignores them',
      };
    default:
      return { knob: effect.knob, setting: value };
  }
}

const pct = (value) => `${Math.round(value * 1000) / 10}%`;
const turns = (spread) => (spread ? `${Math.round(spread.median)}` : '-');

function report(results) {
  const lines = [];
  const { meta } = results;
  lines.push('# Cashflow strategy lab - what thousands of simulated games show');
  lines.push('');
  lines.push(
    `_Generated by \`node scripts/strategy-lab.js\` - do not edit by hand. Rules version \`${meta.rulesDigest}\`, ${meta.gamesPerGroup} games for every profession and strategy (seeds ${meta.seedBase}-${meta.seedBase + meta.gamesPerGroup - 1}), at most ${meta.maxTurns} rolls a game. The same seeds are used for every strategy, so the strategies are compared on the same dice._`,
  );
  lines.push('');
  lines.push(
    'A game is **won** when passive income covers every monthly expense (escaping the rat race) and **lost** when the monthly cashflow turns negative (bankruptcy). A game that has not ended after the roll limit is a timeout. "Turns" are rolls; "months" are Paydays.',
  );
  lines.push('');
  lines.push('## The strategies, over every profession');
  lines.push('');
  lines.push(
    '| Strategy | Escapes | Bankrupt | Timeout | Median rolls to escape | Mean best passive income |',
  );
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  const label = new Map(results.policies.map((policy) => [policy.id, policy]));
  for (const row of [...results.summary].sort((a, b) => b.escapeRate - a.escapeRate)) {
    lines.push(
      `| ${label.get(row.id).label} | ${pct(row.escapeRate)} | ${pct(row.bankruptRate)} | ${pct(row.timeoutRate)} | ${row.medianTurnsToEscape === null ? '-' : Math.round(row.medianTurnsToEscape)} | ${money(row.meanPeakPassiveIncomeMinor)} |`,
    );
  }
  lines.push('');
  for (const policy of results.policies)
    lines.push(`- **${policy.label}** (\`${policy.id}\`): ${policy.description}`);
  lines.push('');
  lines.push('## Profession by profession');
  lines.push('');
  lines.push(
    'For each profession: the best, the median and the worst strategy (by escape rate, then speed), and the fastest and slowest escape of the best one.',
  );
  lines.push('');
  lines.push(
    '| Profession | Salary | Expenses | Best strategy | Escapes | Median rolls | Median strategy | Escapes | Worst strategy | Escapes |',
  );
  lines.push('| --- | ---: | ---: | --- | ---: | ---: | --- | ---: | --- | ---: |');
  for (const profession of results.professions) {
    const group = results.results[profession.id];
    const ranked = results.policies
      .map((policy) => ({ policy, stats: group[policy.id] }))
      .sort(
        (a, b) =>
          b.stats.escapeRate - a.stats.escapeRate ||
          (a.stats.turnsToEscape?.median ?? 1e9) - (b.stats.turnsToEscape?.median ?? 1e9),
      );
    const best = ranked[0];
    const median = ranked[Math.floor(ranked.length / 2)];
    const worst = ranked[ranked.length - 1];
    lines.push(
      `| ${profession.title} | ${money(profession.salaryMinor)} | ${money(profession.expensesMinor)} | ${best.policy.label} | ${pct(best.stats.escapeRate)} | ${turns(best.stats.turnsToEscape)} | ${median.policy.label} | ${pct(median.stats.escapeRate)} | ${worst.policy.label} | ${pct(worst.stats.escapeRate)} |`,
    );
  }
  lines.push('');
  if (results.search) {
    lines.push('## The search for a better strategy');
    lines.push('');
    lines.push(
      `${results.search.tried} combinations of the strategy knobs were each played ${results.search.gamesPerProfession} times on ${results.search.professions.join(', ')}. The best five:`,
    );
    lines.push('');
    for (const row of results.search.top) {
      lines.push(
        `- ${pct(row.escapeRate)} escape, ${pct(row.bankruptRate)} bankrupt, median ${row.medianTurnsToEscape === null ? '-' : Math.round(row.medianTurnsToEscape)} rolls: ${row.spec.description}`,
      );
    }
    lines.push('');
    lines.push('"Best" means best among what was tried, not proven best.');
    if (results.search.knobEffects) {
      lines.push('');
      lines.push('### What each setting does on average');
      lines.push('');
      lines.push(
        'Every setting of every knob, averaged over all combinations that contain it (the same professions and dice for all).',
      );
      lines.push('');
      lines.push('| Knob | Setting | Combinations | Escapes | Bankrupt | Median rolls to escape |');
      lines.push('| --- | --- | ---: | ---: | ---: | ---: |');
      const sorted = [...results.search.knobEffects].sort(
        (x, y) => x.knob.localeCompare(y.knob) || y.escapeRate - x.escapeRate,
      );
      for (const effect of sorted) {
        const words = knobWords(effect);
        lines.push(
          `| ${words.knob} | ${words.setting} | ${effect.combinations} | ${pct(effect.escapeRate)} | ${pct(effect.bankruptRate)} | ${effect.medianTurnsToEscape === null ? '-' : Math.round(effect.medianTurnsToEscape)} |`,
        );
      }
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
