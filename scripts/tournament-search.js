#!/usr/bin/env node
'use strict';

/**
 * Searches for strategies that win tables (todo/cashflow-tournament-and-bots.md, A3/A4). A candidate is a set of the strategy's
 * knobs - including the race-aware ones that read how far the rivals are from escaping - and is scored by how often it WINS A
 * TABLE against a field of the best known strategies, over every profession. The best are kept and varied, generation after
 * generation. The finalists are then played again on **fresh seeds** the search never saw, so a champion is not fitted to the
 * games that picked it.
 *
 *   node scripts/tournament-search.js                     a modest search (24 candidates, 4 generations)
 *   node scripts/tournament-search.js --candidates 60 --generations 6 --matches 6 --write
 *
 *   --field        strategy ids that make up the opposition      (default: all-rounder, best-found, big-deals-when-rich, mlm-then-properties)
 *   --players      seats per table, comma list                    (default 2,4)
 *   --rules        guided or strict                               (default guided)
 *   --matches      tables per profession and seat count per candidate, per generation   (default 4)
 *   --verify       fresh tables per finalist for the verdict      (default 600)
 *   --seed         base seed of the search (default 70000); the verdict uses seeds from 9000000
 *   --write        write docs/domain/strategy/data/tournament-search.json
 *
 * Needs the domain package built. Same seeds, same numbers.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');

const domain = require('@money/domain');
// the domain package does not carry the printed catalog: the tables it plays use this one
domain.setDefaultTableGameSets(require('@money/domain/dist/cashflow-content').CASHFLOW_GAME_SETS);
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

const root = path.resolve(__dirname, '..');

function loadSpecs() {
  return require('@money/domain/dist/cashflow-game/table/bot-catalog')
    .botProfiles()
    .map((profile) => profile.spec);
}

// ───────────────────────────── worker ─────────────────────────────
if (!isMainThread) {
  const field = workerData.field.map((spec) => domain.policyFromSpec(spec));
  parentPort.on('message', (job) => {
    const candidate = domain.policyFromSpec(job.spec);
    let wins = 0;
    let tables = 0;
    let escapes = 0;
    let bankrupt = 0;
    for (const t of job.tables) {
      const rng = domain.seededRng(t.seed ^ 0x9e3779b9);
      const seat = t.seed % t.players;
      const policies = [];
      for (let s = 0; s < t.players; s += 1) {
        policies.push(s === seat ? candidate : field[Math.floor(rng() * field.length)]);
      }
      const result = domain.playMatch({
        seed: t.seed,
        policies,
        professionIds: policies.map(() => t.professionId),
        rulesBase: job.rulesBase,
      });
      tables += 1;
      if (result.winnerSeat === seat) wins += 1;
      const mine = result.seats[seat];
      if (mine.outcome === 'escaped') escapes += 1;
      if (mine.outcome === 'bankrupt') bankrupt += 1;
    }
    parentPort.postMessage({ jobId: job.jobId, wins, tables, escapes, bankrupt });
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
const specs = loadSpecs();
const setId = 'cashflow';
const professions = CASHFLOW_GAME_SETS.find((s) => s.id === setId).professions.map((p) => p.id);
const config = {
  field: list(opts.field, [
    'all-rounder',
    'best-found',
    'big-deals-when-rich',
    'mlm-then-properties',
  ]),
  players: list(opts.players, ['2', '4']).map(Number),
  rulesBase: opts.rules === 'strict' ? 'strict' : 'guided',
  candidates: Number(opts.candidates ?? 24),
  generations: Number(opts.generations ?? 4),
  matches: Number(opts.matches ?? 4),
  verify: Number(opts.verify ?? 600),
  seedBase: Number(opts.seed ?? 70000),
};
const fieldSpecs = config.field.map((id) => specs.find((s) => s.id === id)).filter(Boolean);
const rng = domain.seededRng(config.seedBase);
const pick = (items) => items[Math.floor(rng() * items.length)];

// ── the space of strategies ──
const RETURNS = [0.01, 0.015, 0.02, 0.03, 0.04];
const RESERVES = [0, 50000, 100000, 150000, 300000];
const COVERAGES = [1, 1.5, 2, 3];
const BIG = [null, 0, 1000000, 2000000, 3000000, 5000000];
const SHARES = [
  null,
  { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.4 },
  { buyBelowMinor: 1500, sellAboveMinor: 2000, maxLotShare: 0.3 },
];
const SELL = [null, 12, 24, 36];
const GAPS = [0.1, 0.2, 0.3];
const catchUp = () => ({
  gap: pick(GAPS),
  minMonthlyReturnFactor: pick([0.4, 0.6, 0.8]),
  loanCoverageFactor: pick([0.5, 0.75, 1]),
  reserveFactor: pick([0, 0.3, 0.6]),
});
const protect = () => ({
  gap: pick(GAPS),
  minMonthlyReturnFactor: pick([1.25, 1.5, 2]),
  loanCoverageFactor: pick([1, 1.5, 2]),
  reserveFactor: pick([1, 1.5, 2]),
});

const FIELDS = {
  minMonthlyReturn: () => pick(RETURNS),
  reserveMinor: () => pick(RESERVES),
  loans: () => pick(['never', 'bridge']),
  loanCoverage: () => pick(COVERAGES),
  bigDealFromCashMinor: () => pick(BIG),
  buyMlm: () => rng() < 0.6,
  buyGambles: () => rng() < 0.3,
  shares: () => pick(SHARES),
  sellWhenProfitMonths: () => pick(SELL),
  repayLoans: () => rng() < 0.6,
  catchUp: () => (rng() < 0.5 ? catchUp() : null),
  protectLead: () => (rng() < 0.4 ? protect() : null),
};

const randomOverrides = () =>
  Object.fromEntries(Object.entries(FIELDS).map(([k, make]) => [k, make()]));
function mutate(overrides) {
  const next = { ...overrides };
  const keys = Object.keys(FIELDS);
  const changes = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < changes; i += 1) {
    const key = pick(keys);
    next[key] = FIELDS[key]();
  }
  return next;
}
const describe = (o) =>
  [
    `properties paying at least ${(o.minMonthlyReturn * 100).toFixed(1)}% a month`,
    o.reserveMinor ? `${o.reserveMinor / 100} kept in reserve` : 'no reserve',
    o.loans === 'bridge' ? `borrows when covered ${o.loanCoverage}x` : 'no loans',
    o.bigDealFromCashMinor === null
      ? 'Small Deals only'
      : `Big Deals from ${o.bigDealFromCashMinor / 100} cash`,
    o.buyMlm ? 'Multi-Level-Marketing' : null,
    o.shares ? 'trades stocks' : null,
    o.sellWhenProfitMonths ? `sells at ${o.sellWhenProfitMonths} months of profit` : null,
    o.catchUp ? `takes more risk when ${o.catchUp.gap * 100}+ points behind` : null,
    o.protectLead ? `plays safe when ${o.protectLead.gap * 100}+ points ahead` : null,
  ]
    .filter(Boolean)
    .join(', ');

let nextId = 1;
const spec = (overrides, base = 'cand') => ({
  id: `${base}-${nextId++}`,
  label: 'Candidate',
  description: describe({ ...overrides }),
  overrides,
});

async function main() {
  const workers = Math.max(1, os.cpus().length - 1);
  const pool = Array.from(
    { length: workers },
    () => new Worker(__filename, { workerData: { field: fieldSpecs } }),
  );
  const idle = [...pool];
  const waiting = [];
  const handlers = new Map();
  for (const w of pool) {
    w.on('message', (m) => {
      handlers.get(m.jobId)(m);
      handlers.delete(m.jobId);
      const next = waiting.shift();
      if (next) w.postMessage(next);
      else idle.push(w);
    });
    w.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
  }
  let jobCounter = 0;
  const run = (job) =>
    new Promise((resolve) => {
      const full = { ...job, jobId: jobCounter++ };
      handlers.set(full.jobId, resolve);
      const w = idle.pop();
      if (w) w.postMessage(full);
      else waiting.push(full);
    });

  /** A candidate's tables: every profession, every seat count, `matches` each, on seeds from `seedFrom`. */
  const tablesFor = (seedFrom, matches) => {
    const out = [];
    let n = 0;
    for (const players of config.players) {
      for (const professionId of professions) {
        for (let m = 0; m < matches; m += 1)
          out.push({ seed: seedFrom + n++, players, professionId });
      }
    }
    return out;
  };

  async function score(candidate, seedFrom, matches) {
    const results = [];
    const all = tablesFor(seedFrom, matches);
    const chunk = 20;
    for (let i = 0; i < all.length; i += chunk) {
      results.push(
        run({ spec: candidate, tables: all.slice(i, i + chunk), rulesBase: config.rulesBase }),
      );
    }
    const done = await Promise.all(results);
    const wins = done.reduce((s, r) => s + r.wins, 0);
    const tables = done.reduce((s, r) => s + r.tables, 0);
    return {
      wins,
      tables,
      winRate: wins / tables,
      escapeRate: done.reduce((s, r) => s + r.escapes, 0) / tables,
      bankruptRate: done.reduce((s, r) => s + r.bankrupt, 0) / tables,
    };
  }

  const started = Date.now();
  // generation 0: the field itself (the bar to beat), and random candidates
  let population = [];
  for (const f of fieldSpecs) population.push({ spec: f, known: true });
  for (let i = 0; i < config.candidates; i += 1) population.push({ spec: spec(randomOverrides()) });

  const history = [];
  for (let gen = 0; gen < config.generations; gen += 1) {
    const seedFrom = config.seedBase + gen * 1_000_000; // a fresh draw of tables each generation: no fitting to one set
    const scored = [];
    for (const entry of population) {
      const s = await score(entry.spec, seedFrom, config.matches);
      scored.push({ ...entry, score: s });
    }
    scored.sort((a, b) => b.score.winRate - a.score.winRate);
    history.push({
      generation: gen,
      best: scored
        .slice(0, 5)
        .map((e) => ({ id: e.spec.id, winRate: e.score.winRate, tables: e.score.tables })),
    });
    console.log(
      `generation ${gen}: best ${scored[0].spec.id} ${(scored[0].score.winRate * 100).toFixed(1)}% of ${scored[0].score.tables} tables ` +
        `(${Math.round((Date.now() - started) / 1000)}s)`,
    );
    const keep = scored.slice(0, Math.max(4, Math.floor(config.candidates / 4)));
    population = keep.map((e) => ({ spec: e.spec, known: e.known }));
    while (population.length < config.candidates) {
      const parent = pick(keep);
      population.push({ spec: spec(mutate({ ...domain_defaults(), ...parent.spec.overrides })) });
    }
    if (gen === config.generations - 1)
      population = keep.map((e) => ({ spec: e.spec, known: e.known }));
  }

  // the verdict: the finalists and the known best, on fresh seeds the search never used
  const verdictSeed = 9_000_000;
  const finalists = population.filter((e) => !e.known).slice(0, 3);
  const bar = fieldSpecs.map((f) => ({ spec: f, known: true }));
  const verdict = [];
  const perCell = Math.max(
    1,
    Math.round(config.verify / (config.players.length * professions.length)),
  );
  for (const entry of [...finalists, ...bar]) {
    const s = await score(entry.spec, verdictSeed, perCell);
    verdict.push({
      id: entry.spec.id,
      known: Boolean(entry.known),
      description: entry.spec.description,
      overrides: entry.spec.overrides,
      ...s,
      interval: domain.wilsonInterval(s.wins, s.tables),
    });
  }
  verdict.sort((a, b) => b.winRate - a.winRate);
  console.log(
    '\nVerdict on fresh seeds (a candidate against a field of ' + config.field.join(', ') + '):',
  );
  for (const v of verdict) {
    console.log(
      `  ${v.id.padEnd(22)} wins ${(v.winRate * 100).toFixed(1).padStart(5)}% [${(v.interval.low * 100).toFixed(0)}-${(v.interval.high * 100).toFixed(0)}] ` +
        `of ${v.tables}  escapes ${(v.escapeRate * 100).toFixed(0)}%  bankrupt ${(v.bankruptRate * 100).toFixed(0)}%${v.known ? '  (known)' : ''}`,
    );
  }
  const champion = verdict.find((v) => !v.known);
  if (champion) console.log(`\nbest new strategy: ${champion.description}`);

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      config,
      seconds: Math.round((Date.now() - started) / 1000),
      note: 'Score = share of tables won by the candidate against a random draw of the field at the other seats, over every profession (mirror tables). The verdict uses seeds the search never played.',
    },
    history,
    verdict,
  };
  if (opts.write) {
    fs.writeFileSync(
      path.join(root, 'docs/domain/strategy/data/tournament-search.json'),
      JSON.stringify(output, null, 1) + '\n',
    );
    console.log('written: docs/domain/strategy/data/tournament-search.json');
  }
  pool.forEach((w) => w.terminate());
}

/** The strategy's defaults, so a mutation of a partial spec is complete. */
function domain_defaults() {
  return {
    minMonthlyReturn: 0.02,
    reserveMinor: 0,
    loans: 'never',
    loanCoverage: 2,
    bigDealFromCashMinor: null,
    buyMlm: false,
    buyGambles: false,
    shares: null,
    sellWhenProfitMonths: null,
    repayLoans: false,
    catchUp: null,
    protectLead: null,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
