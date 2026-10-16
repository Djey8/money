#!/usr/bin/env node
'use strict';

/**
 * Finds the best strategy for each profession (todo/cashflow-tournament-and-bots.md, "a champion per profession"). A candidate sits
 * at a table with ITS profession; the rivals are drawn from a field of the best known strategies, each with a random profession of
 * the same game set; the table is 2, 4 or 6 seats, under the guided or the strict rules (alternating). Its score is how often it
 * WINS THE TABLE. Candidates are varied and re-scored on ever more tables, generation after generation; the best are then played
 * again on **fresh seeds** the search never used, together with the current champion, and a profession only gets a champion of its
 * own when the finalist beats the current champion's verdict - otherwise the champion stands. Reproducible: same seeds, same numbers.
 *
 *   node scripts/champion-search.js --profession all            every profession of every playable game set
 *   node scripts/champion-search.js --profession lehrer --candidates 24 --generations 4 --verify 400   a quick look
 *   node scripts/champion-search.js --profession all --write-book    also write the champion book into the domain package
 *
 *   --style        search for a CHARACTER instead: the best version of one style of play (investor, trader, marketer, banker,
 *                  gambler, cautious, chaser), over every profession; results go to --out (default .../characters)
 *   --write-characters   write the characters found into the domain package (table/characters.ts)
 *   --profession   a profession id, a comma list, or `all`                   (default all)
 *   --candidates   strategies per generation                                 (default 36)
 *   --generations  rounds of selection                                       (default 8)
 *   --matches      tables per seat count (2, 4, 6) per candidate, first generation; grows every second generation   (default 10)
 *   --verify       fresh tables per finalist for the verdict                 (default 1000)
 *   --seed         base seed (default 410000); the verdict uses seeds from 30,000,000
 *   --out          directory for the per-profession results                  (default docs/domain/strategy/data/champions)
 *   --write-book   after the search, write docs/domain/strategy/data/champion-book.json and the domain's champion-book.ts
 *   --book-only    do not search: rebuild the book from the results already in --out
 *
 * Needs the domain package built (`npm run build --workspace=packages/domain`). Results are written after every profession, so a
 * long run can be stopped and continued (a profession with a result file is skipped unless --again).
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');

const domain = require('@money/domain');
const catalog = require('@money/domain/dist/cashflow-game/table/bot-catalog');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

const root = path.resolve(__dirname, '..');
const SEAT_COUNTS = [2, 4, 6];

// ───────────────────────────── worker ─────────────────────────────
if (!isMainThread) {
  const field = workerData.field.map((spec) => domain.policyFromSpec(spec));
  const setProfessions = new Map(workerData.sets.map((s) => [s.id, s.professions]));
  parentPort.on('message', (job) => {
    const candidate = domain.policyFromSpec(job.spec);
    let wins = 0;
    let tables = 0;
    let escapes = 0;
    let bankrupt = 0;
    for (const t of job.tables) {
      const rng = domain.seededRng(t.seed ^ 0x9e3779b9);
      const seat = t.seed % t.players;
      const pool = setProfessions.get(t.setId);
      const ownProfession =
        t.professionId === '*' ? pool[Math.floor(rng() * pool.length)] : t.professionId;
      const policies = [];
      const professionIds = [];
      for (let s = 0; s < t.players; s += 1) {
        policies.push(s === seat ? candidate : field[Math.floor(rng() * field.length)]);
        professionIds.push(s === seat ? ownProfession : pool[Math.floor(rng() * pool.length)]);
      }
      const result = domain.playMatch({
        seed: t.seed,
        policies,
        professionIds,
        rulesBase: t.rulesBase,
        gameSetId: t.setId,
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
const playable = CASHFLOW_GAME_SETS.filter((s) => s.id === 'cashflow' || s.id === 'custom-jfk');
const everyProfession = playable.flatMap((set) =>
  set.professions.map((p) => ({ setId: set.id, id: p.id, title: p.title })),
);
const wanted =
  opts.profession && opts.profession !== 'all' ? String(opts.profession).split(',') : null;
/**
 * A character is the best strategy of one STYLE: some choices are fixed by the style, the search finds the rest. `apply` takes a
 * complete set of knobs and returns it with the style's constraints enforced.
 */
const STYLES = {
  any: {
    name: 'Champion',
    summary: 'The best strategy over every profession.',
    apply: (o) => o,
  },
  investor: {
    name: 'Investor Ines',
    summary: 'Only properties: no marketing, no stocks, no gambles.',
    apply: (o) => ({ ...o, buyMlm: false, buyGambles: false, shares: null }),
  },
  trader: {
    name: 'Stock Sasha',
    summary: 'Trades stocks alongside properties.',
    apply: (o) => ({
      ...o,
      buyMlm: false,
      buyGambles: false,
      shares: o.shares || { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.4 },
    }),
  },
  marketer: {
    name: 'Network Nils',
    summary: 'Builds on Multi-Level-Marketing cards.',
    apply: (o) => ({ ...o, buyMlm: true, buyGambles: false, shares: null }),
  },
  banker: {
    name: 'Leverage Leo',
    summary: 'Borrows early and often to buy faster.',
    apply: (o) => ({
      ...o,
      loans: 'bridge',
      loanCoverage: Math.min(o.loanCoverage, 1.25),
      bigDealFromCashMinor:
        o.bigDealFromCashMinor === null ? 1000000 : Math.min(o.bigDealFromCashMinor, 1500000),
    }),
  },
  gambler: {
    name: 'Lucky Lena',
    summary: 'Takes the dice cards and the marketing cards: fast when luck is on her side.',
    apply: (o) => ({ ...o, buyGambles: true, buyMlm: true, loans: 'bridge' }),
  },
  cautious: {
    name: 'Prudent Paula',
    summary: 'No loans, a reserve in the bank, and plays safe when she leads.',
    apply: (o) => ({
      ...o,
      loans: 'never',
      buyGambles: false,
      reserveMinor: Math.max(o.reserveMinor, 150000),
      protectLead: o.protectLead || {
        gap: 0.1,
        minMonthlyReturnFactor: 1.25,
        loanCoverageFactor: 1.25,
        reserveFactor: 1.5,
      },
    }),
  },
  chaser: {
    name: 'Chaser Chen',
    summary: 'Takes more and more risk the further a rival gets ahead.',
    apply: (o) => ({
      ...o,
      catchUp: {
        gap: Math.min((o.catchUp && o.catchUp.gap) || 0.05, 0.1),
        minMonthlyReturnFactor: Math.min(
          (o.catchUp && o.catchUp.minMonthlyReturnFactor) || 0.5,
          0.7,
        ),
        loanCoverageFactor: Math.min((o.catchUp && o.catchUp.loanCoverageFactor) || 0.5, 0.75),
        reserveFactor: 0.3,
      },
    }),
  },
};
const STYLE = opts.style ? STYLES[opts.style] : null;
if (opts.style && !STYLE) {
  console.error(`unknown style '${opts.style}'; known: ${Object.keys(STYLES).join(', ')}`);
  process.exit(1);
}
const targets = opts['write-characters']
  ? [] // only writes what the style searches found
  : STYLE
    ? [{ setId: 'cashflow', id: '*', title: STYLE.name }]
    : everyProfession.filter((p) => !wanted || wanted.includes(p.id));
const config = {
  candidates: Number(opts.candidates ?? 36),
  generations: Number(opts.generations ?? 8),
  matches: Number(opts.matches ?? 10),
  verify: Number(opts.verify ?? 1000),
  seedBase: Number(opts.seed ?? 410000),
  field: [
    'champion-v1',
    'all-rounder',
    'best-found',
    'big-deals-when-rich',
    'mlm-then-properties',
    'bridge-loans',
  ],
};
const outDir = path.resolve(
  root,
  opts.out ??
    (opts.style || opts['write-characters']
      ? 'docs/domain/strategy/data/characters'
      : 'docs/domain/strategy/data/champions'),
);
const profiles = catalog.botProfiles();
const specOf = (id) => profiles.find((p) => p.id === id).spec;
const fieldSpecs = config.field.map(specOf);
const baseId =
  opts.base && profiles.some((p) => p.id === opts.base) ? String(opts.base) : 'champion-v1';
const CHAMPION = specOf(baseId);

// ── the space of strategies (finer than the first search) ──
let rng = domain.seededRng(config.seedBase);
const pick = (items) => items[Math.floor(rng() * items.length)];
const RETURNS = [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05];
const RESERVES = [0, 25000, 50000, 100000, 150000, 250000, 400000];
const COVERAGES = [1, 1.25, 1.5, 2, 2.5, 3];
const BIG = [null, 0, 500000, 1000000, 1500000, 2000000, 3000000, 5000000, 8000000];
const SHARES = [
  null,
  { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.4 },
  { buyBelowMinor: 1500, sellAboveMinor: 2000, maxLotShare: 0.3 },
  { buyBelowMinor: 800, sellAboveMinor: 3000, maxLotShare: 0.5 },
  { buyBelowMinor: 2000, sellAboveMinor: 3500, maxLotShare: 0.25 },
];
const SELL = [null, 6, 12, 18, 24, 36];
const GAPS = [0.05, 0.1, 0.15, 0.2, 0.3];
const catchUp = () => ({
  gap: pick(GAPS),
  minMonthlyReturnFactor: pick([0.3, 0.5, 0.7, 0.8, 0.9]),
  loanCoverageFactor: pick([0.5, 0.75, 1]),
  reserveFactor: pick([0, 0.3, 0.6, 1]),
});
const protect = () => ({
  gap: pick(GAPS),
  minMonthlyReturnFactor: pick([1.1, 1.25, 1.5, 2]),
  loanCoverageFactor: pick([1, 1.25, 1.5, 2]),
  reserveFactor: pick([1, 1.5, 2, 3]),
});
const FIELDS = {
  minMonthlyReturn: () => pick(RETURNS),
  reserveMinor: () => pick(RESERVES),
  loans: () => pick(['never', 'bridge', 'bridge']),
  loanCoverage: () => pick(COVERAGES),
  bigDealFromCashMinor: () => pick(BIG),
  buyMlm: () => rng() < 0.6,
  buyGambles: () => rng() < 0.3,
  shares: () => pick(SHARES),
  sellWhenProfitMonths: () => pick(SELL),
  repayLoans: () => rng() < 0.6,
  charityTwoDice: () => rng() < 0.7,
  skipDoodadsAboveMinor: () => null, // inert at a table: a Doodad cannot be passed
  countShares: () =>
    rng() < 0.5
      ? null
      : {
          minGain: pick([2, 3, 5]),
          maxWaitDraws: pick([6, 12, 24]),
          maxLotShare: pick([0.2, 0.4, 0.6]),
          sellAboveMinor: pick([1500, 2500, 3500]),
        },
  pileByCount: () => rng() < 0.5,
  countReturnFactor: () => pick([0, 0, 0.5, 1, 2]),
  speculate: () =>
    rng() < 0.5 ? null : { maxWaitDraws: pick([4, 8, 16]), minEvRatio: pick([0.3, 0.5, 1]) },
  catchUp: () => (rng() < 0.6 ? catchUp() : null),
  protectLead: () => (rng() < 0.4 ? protect() : null),
};
const complete = (o) => ({ ...domain.POLICY_DEFAULTS, ...o });
const randomOverrides = () =>
  Object.fromEntries(Object.entries(FIELDS).map(([k, make]) => [k, make()]));
function mutate(overrides) {
  const next = complete(overrides);
  const keys = Object.keys(FIELDS);
  const changes = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < changes; i += 1) {
    const key = pick(keys);
    next[key] = FIELDS[key]();
  }
  return next;
}
function crossover(a, b) {
  const x = complete(a);
  const y = complete(b);
  return Object.fromEntries(Object.keys(FIELDS).map((k) => [k, rng() < 0.5 ? x[k] : y[k]]));
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
    o.buyGambles ? 'dice gambles' : null,
    o.countShares
      ? `buys shares only when a ${o.countShares.minGain}x card is still in the pile`
      : null,
    o.pileByCount ? 'draws from the pile with the better cards left' : null,
    o.countReturnFactor
      ? `scales its bar by what is left in the pile (${o.countReturnFactor})`
      : null,
    o.speculate ? 'buys a flat property when buyers are still in the Market pile' : null,
    o.shares ? 'trades stocks' : null,
    o.sellWhenProfitMonths ? `sells at ${o.sellWhenProfitMonths} months of profit` : null,
    o.catchUp ? `takes more risk when ${Math.round(o.catchUp.gap * 100)}+ points behind` : null,
    o.protectLead ? `plays safe when ${Math.round(o.protectLead.gap * 100)}+ points ahead` : null,
  ]
    .filter(Boolean)
    .join(', ');

let nextId = 1;
const spec = (overrides, profession) => {
  const styled = STYLE ? STYLE.apply(complete(overrides)) : overrides;
  return {
    id: `cand-${profession}-${nextId++}`,
    label: 'Candidate',
    description: describe(complete(styled)),
    overrides: styled,
  };
};

/** The id of the strategy a search hands out: a character's own, or a champion of the profession (versioned when it replaces one). */
function newId(target) {
  if (opts.style === 'any') {
    const version = Number((String(CHAMPION.id).match(/-v(\d+)$/) || [0, 1])[1]) + 1;
    return `champion-v${version}`;
  }
  if (STYLE) return `character-${opts.style}`;
  const current = previousBook()[target.id];
  const version =
    current && current.spec
      ? Number((String(current.spec.id).match(/-v(\d+)$/) || [0, 1])[1]) + 1
      : 1;
  return `champion-${target.id}-v${version}`;
}

/** The champion book as it stands (docs/domain/strategy/data/champion-book.json), to be beaten by a refresh. */
let bookCache = null;
function previousBook() {
  if (bookCache) return bookCache;
  try {
    bookCache =
      JSON.parse(
        fs.readFileSync(path.join(root, 'docs/domain/strategy/data/champion-book.json'), 'utf8'),
      ).entries || {};
  } catch {
    bookCache = {};
  }
  return bookCache;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const workers = Math.max(1, os.cpus().length - 1);
  const pool = Array.from(
    { length: workers },
    () =>
      new Worker(__filename, {
        workerData: {
          field: fieldSpecs,
          sets: playable.map((s) => ({ id: s.id, professions: s.professions.map((p) => p.id) })),
        },
      }),
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

  /** The tables of one candidate: every seat count, `matches` each, rules alternating, from `seedFrom`. */
  const tablesFor = (target, seedFrom, matches) => {
    const out = [];
    let n = 0;
    for (const players of SEAT_COUNTS) {
      for (let m = 0; m < matches; m += 1) {
        const seed = seedFrom + n++;
        out.push({
          seed,
          players,
          professionId: target.id,
          setId: target.setId,
          rulesBase: seed % 2 === 0 ? 'guided' : 'strict',
        });
      }
    }
    return out;
  };

  async function score(candidate, target, seedFrom, matches) {
    const all = tablesFor(target, seedFrom, matches);
    const chunk = 12;
    const jobs = [];
    for (let i = 0; i < all.length; i += chunk)
      jobs.push(run({ spec: candidate, tables: all.slice(i, i + chunk) }));
    const done = await Promise.all(jobs);
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

  /** Scores a whole population at once (the pool is kept busy across candidates). */
  const scoreAll = (entries, target, seedFrom, matches) =>
    Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        score: await score(entry.spec, target, seedFrom, matches),
      })),
    );

  const done = [];
  for (const target of targets) {
    const fileId = opts.style || target.id;
    const file = path.join(outDir, `${fileId}.json`);
    if (fs.existsSync(file) && !opts.again && !opts['book-only']) {
      console.log(`${target.id}: already done, skipped`);
      continue;
    }
    if (opts['book-only']) continue;
    // seeds depend on the profession, so two professions never share a game
    const profIndex = STYLE
      ? 100 + Object.keys(STYLES).indexOf(opts.style)
      : everyProfession.findIndex((p) => p.id === target.id) + 1;
    rng = domain.seededRng(config.seedBase + profIndex * 7919);
    const started = Date.now();
    console.log(`\n== ${target.title} (${target.id}, set ${target.setId})`);

    const currentBook = !STYLE && previousBook()[target.id];
    // a character is searched for its own style: the all-round champions are not in the running, only the bar
    let population = STYLE
      ? []
      : [
          { spec: CHAMPION, known: true },
          { spec: specOf('all-rounder'), known: true },
          { spec: specOf('best-found'), known: true },
        ];
    // a refresh starts from the champion the book already has, and has to beat it
    if (currentBook && currentBook.adopted)
      population.push({ spec: currentBook.spec, known: true });
    for (let i = 0; i < Math.floor(config.candidates / 4); i += 1) {
      population.push({ spec: spec(mutate(CHAMPION.overrides), target.id) });
    }
    while (population.length < config.candidates)
      population.push({ spec: spec(randomOverrides(), target.id) });

    const history = [];
    for (let gen = 0; gen < config.generations; gen += 1) {
      const seedFrom = config.seedBase + profIndex * 1_000_000 + gen * 50_000;
      const matches = config.matches * (1 + Math.floor(gen / 2));
      const scored = (await scoreAll(population, target, seedFrom, matches)).sort(
        (a, b) => b.score.winRate - a.score.winRate,
      );
      history.push({
        generation: gen,
        tables: scored[0].score.tables,
        best: scored
          .slice(0, 3)
          .map((e) => ({ id: e.spec.id, known: Boolean(e.known), winRate: e.score.winRate })),
      });
      console.log(
        `  gen ${gen}: best ${scored[0].spec.id}${scored[0].known ? ' (known)' : ''} ${(scored[0].score.winRate * 100).toFixed(1)}% of ${scored[0].score.tables}` +
          `  ${Math.round((Date.now() - started) / 1000)}s`,
      );
      const keep = scored.slice(0, Math.max(6, Math.floor(config.candidates / 5)));
      if (gen === config.generations - 1) {
        population = keep;
        break;
      }
      population = [...keep];
      while (population.length < config.candidates) {
        const roll = rng();
        const a = pick(keep).spec.overrides;
        if (roll < 0.15) population.push({ spec: spec(randomOverrides(), target.id) });
        else if (roll < 0.45)
          population.push({ spec: spec(crossover(a, pick(keep).spec.overrides), target.id) });
        else population.push({ spec: spec(mutate(a), target.id) });
      }
    }

    // the verdict: the finalists and the champion on fresh seeds
    const verdictSeed = 30_000_000 + profIndex * 100_000;
    const finalists = population.filter((e) => !e.known).slice(0, 4);
    const current = !STYLE && previousBook()[target.id];
    const barSpec = current && current.adopted ? current.spec : CHAMPION;
    const bar = population.filter((e) => e.known && e.spec.id === barSpec.id);
    const verdict = (
      await scoreAll(
        [...finalists, ...(bar.length ? bar : [{ spec: barSpec, known: true }])],
        target,
        verdictSeed,
        Math.round(config.verify / SEAT_COUNTS.length),
      )
    ).map((e) => ({
      id: e.spec.id,
      known: Boolean(e.known),
      description: e.spec.description,
      overrides: e.spec.overrides,
      ...e.score,
      interval: domain.wilsonInterval(e.score.wins, e.score.tables),
    }));
    verdict.sort((a, b) => b.winRate - a.winRate);
    const champion = verdict.find((v) => v.id === barSpec.id);
    const best = verdict.find((v) => !v.known);
    // a character is always the best of its style; the global champion must beat the one we have
    const adopted =
      STYLE && opts.style !== 'any'
        ? true
        : Boolean(best && champion && best.interval.low > champion.winRate);
    const result = {
      ...(STYLE ? { style: opts.style, character: STYLE.name, summary: STYLE.summary } : {}),
      profession: target,
      meta: {
        generatedAt: new Date().toISOString(),
        rulesDigest: domain.championRulesDigest(playable),
        config,
        seconds: Math.round((Date.now() - started) / 1000),
      },
      history,
      verdict,
      champion: adopted
        ? {
            id: newId(target),
            source: best.id,
            spec: {
              id: newId(target),
              label: STYLE ? STYLE.name : `Champion (${target.title})`,
              description: best.description,
              overrides: best.overrides,
            },
            winRate: best.winRate,
            interval: best.interval,
            tables: best.tables,
            againstChampionV1: champion.winRate,
          }
        : {
            id: barSpec.id,
            source: barSpec.id,
            spec: barSpec,
            winRate: champion.winRate,
            interval: champion.interval,
            tables: champion.tables,
            againstChampionV1: champion.winRate,
          },
      adopted,
    };
    fs.writeFileSync(file, JSON.stringify(result, null, 1) + '\n');
    console.log(
      `  verdict: champion-v1 ${(champion.winRate * 100).toFixed(1)}% [${(champion.interval.low * 100).toFixed(0)}-${(champion.interval.high * 100).toFixed(0)}]  ` +
        `best new ${(best.winRate * 100).toFixed(1)}% [${(best.interval.low * 100).toFixed(0)}-${(best.interval.high * 100).toFixed(0)}]  -> ${adopted ? 'ADOPTED' : 'champion-v1 stands'}  (${result.meta.seconds}s)`,
    );
    done.push(target.id);
  }
  pool.forEach((w) => w.terminate());

  if (opts['write-characters']) writeCharacters();
  else if (opts['write-book'] || opts['book-only']) writeBook();
  if (opts['write-characters'] || opts['write-book'] || opts['book-only']) writeReport();
}

/** docs/domain/CASHFLOW_CHAMPIONS.md: the champion of every profession and the characters, readable (and read by agents). */
function writeReport() {
  const dataDir = path.join(root, 'docs/domain/strategy/data');
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const lines = [];
  lines.push('# Cashflow champions - the best strategies, by profession and by style');
  lines.push('');
  let book = null;
  try {
    book = JSON.parse(fs.readFileSync(path.join(dataDir, 'champion-book.json'), 'utf8'));
  } catch {
    book = null;
  }
  lines.push(
    '_Generated by `scripts/champion-search.js` - do not edit by hand. ' +
      (book
        ? `Rules version \`${book.meta.rulesDigest}\`, ${book.meta.generatedAt.slice(0, 10)}. `
        : '') +
      'Every figure is the share of fresh tables the strategy won: 2, 4 and 6 seats, the guided and the strict rules alternating, rivals from a field of the best known strategies with random professions - games the search never played._',
  );
  lines.push('');
  if (book) {
    lines.push('## A champion for every profession');
    lines.push('');
    lines.push(
      'A profession gets a champion of its own only when the lower end of its 95% range beats the champion it had; otherwise the all-round champion stands.',
    );
    lines.push('');
    lines.push('| Profession | Champion | Own | Wins | 95% range | The old champion | Tables |');
    lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: |');
    for (const [id, e] of Object.entries(book.entries)) {
      lines.push(
        `| ${e.title} | ${e.spec.id} | ${e.adopted ? 'yes' : 'no'} | ${pct(e.winRate)} | ${pct(e.interval.low)}-${pct(e.interval.high)} | ${pct(e.championV1WinRate)} | ${e.tables} |`,
      );
    }
    lines.push('');
    lines.push('### The strategies');
    lines.push('');
    const seen = new Set();
    for (const [id, e] of Object.entries(book.entries)) {
      if (seen.has(e.spec.id)) continue;
      seen.add(e.spec.id);
      lines.push(`- **${e.spec.id}**: ${e.spec.description}`);
    }
    lines.push('');
  }
  const chars = [];
  const charDir = path.join(dataDir, 'characters');
  if (fs.existsSync(charDir)) {
    for (const f of fs.readdirSync(charDir).filter((x) => x.endsWith('.json'))) {
      const r = JSON.parse(fs.readFileSync(path.join(charDir, f), 'utf8'));
      if (r.style) chars.push(r);
    }
  }
  if (chars.length) {
    lines.push('## Characters: the best of each style');
    lines.push('');
    lines.push('| Character | Style | Wins | 95% range | Strategy |');
    lines.push('| --- | --- | ---: | ---: | --- |');
    for (const r of chars.sort((a, b) => b.champion.winRate - a.champion.winRate)) {
      lines.push(
        `| ${r.character} | ${r.summary} | ${pct(r.champion.winRate)} | ${pct(r.champion.interval.low)}-${pct(r.champion.interval.high)} | ${r.champion.spec.description} |`,
      );
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(root, 'docs/domain/CASHFLOW_CHAMPIONS.md'), lines.join('\n') + '\n');
  console.log('report written: docs/domain/CASHFLOW_CHAMPIONS.md');
}

/** The characters found (one file per style in --out): written into the domain package for the bot catalog. */
function writeCharacters() {
  const entries = {};
  for (const style of Object.keys(STYLES)) {
    const file = path.join(outDir, `${style}.json`);
    if (!fs.existsSync(file)) continue;
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    entries[style] = {
      name: STYLES[style].name,
      summary: STYLES[style].summary,
      winRate: r.champion.winRate,
      interval: r.champion.interval,
      tables: r.champion.tables,
      championV1WinRate: r.champion.againstChampionV1,
      spec: r.champion.spec,
    };
  }
  const ts = `// GENERATED by scripts/champion-search.js --write-characters - do not edit by hand.
// The characters of the bot catalog (todo/cashflow-tournament-and-bots.md): the best strategy of one style of play, found by the
// search with the style's choices fixed. \`winRate\` is the share of fresh verdict tables it won against the field (2, 4 and 6 seats,
// guided and strict rules, every profession); the catalog derives the difficulty from it.
import type { PolicySpec } from '../simulation/strategies';

export interface CharacterEntry {
  name: string;
  summary: string;
  winRate: number;
  interval: { low: number; high: number };
  tables: number;
  /** The champion it had to beat (the old champion): its share on the same tables, for comparison. */
  championV1WinRate: number;
  spec: PolicySpec;
}

export const CHARACTERS: Record<string, CharacterEntry> = ${JSON.stringify(entries, null, 2)};
`;
  fs.writeFileSync(path.join(root, 'packages/domain/src/cashflow-game/table/characters.ts'), ts);
  console.log(`\ncharacters written: ${Object.keys(entries).length}`);
}

/** The book: every profession's champion (its own, or champion-v1), from the per-profession results in --out. */
function writeBook() {
  const entries = {};
  for (const target of everyProfession) {
    const file = path.join(outDir, `${target.id}.json`);
    if (!fs.existsSync(file)) continue;
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    entries[target.id] = {
      setId: target.setId,
      title: target.title,
      adopted: r.adopted,
      winRate: r.champion.winRate,
      interval: r.champion.interval,
      tables: r.champion.tables,
      championV1WinRate: r.champion.againstChampionV1,
      spec: r.champion.spec,
    };
  }
  const book = {
    meta: {
      generatedAt: new Date().toISOString(),
      rulesDigest: domain.championRulesDigest(playable),
      note: 'A champion per profession. winRate: the share of fresh verdict tables (2, 4 and 6 seats, guided and strict rules, rivals from the field with random professions) the champion won; championV1WinRate: the same for champion-v1. A profession has its own champion only when its lower 95% bound beat champion-v1.',
      field: config.field,
    },
    entries,
  };
  fs.writeFileSync(
    path.join(root, 'docs/domain/strategy/data/champion-book.json'),
    JSON.stringify(book, null, 1) + '\n',
  );
  const ts = `// GENERATED by scripts/champion-search.js --write-book - do not edit by hand.
// A champion per profession (todo/cashflow-tournament-and-bots.md): the strategy that won most tables for that profession, measured on
// fresh games the search never played. \`rulesDigest\` is the fingerprint of the rules it was measured on; a test fails when the rules move.
import type { PolicySpec } from '../simulation/strategies';

export interface ChampionEntry {
  /** The game set the profession belongs to. */
  setId: string;
  title: string;
  /** Its own champion (true), or the all-round champion because no candidate beat it. */
  adopted: boolean;
  /** Share of verdict tables won, and its 95% range. */
  winRate: number;
  interval: { low: number; high: number };
  tables: number;
  /** The champion it had to beat (the old champion): its share on the same tables, for comparison. */
  championV1WinRate: number;
  spec: PolicySpec;
}

export const CHAMPION_BOOK_DIGEST = ${JSON.stringify(book.meta.rulesDigest)};

export const CHAMPION_BOOK: Record<string, ChampionEntry> = ${JSON.stringify(entries, null, 2)};
`;
  fs.writeFileSync(path.join(root, 'packages/domain/src/cashflow-game/table/champion-book.ts'), ts);
  // and the in-app manual's copy of it (src/assets/i18n/cashflow-manual/tournament-lab.json, written by tournament-lab.js)
  const manualFile = path.join(root, 'src/assets/i18n/cashflow-manual/tournament-lab.json');
  let manual = {};
  try {
    manual = JSON.parse(fs.readFileSync(manualFile, 'utf8'));
  } catch {
    manual = {};
  }
  manual.champions = Object.fromEntries(
    Object.entries(entries).map(([id, e]) => [
      id,
      {
        setId: e.setId,
        title: e.title,
        adopted: e.adopted,
        winRate: Number(e.winRate.toFixed(4)),
        interval: {
          low: Number(e.interval.low.toFixed(4)),
          high: Number(e.interval.high.toFixed(4)),
        },
        tables: e.tables,
        championV1WinRate: Number(e.championV1WinRate.toFixed(4)),
      },
    ]),
  );
  fs.writeFileSync(manualFile, JSON.stringify(manual, null, 1) + '\n');
  console.log(`\nbook written: ${Object.keys(entries).length} professions`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
