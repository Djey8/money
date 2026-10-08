#!/usr/bin/env node
'use strict';

/**
 * The Cashflow card lab (JFK, 2026-10-07): what each card is worth. The strategy lab asks which *strategy* wins; this asks
 * which *cards* help, which ruin you, and what the dice cards really cost. Every card is put in front of many real
 * positions - drawn out of whole simulated games at four stages, for every profession - and the position is played out
 * twice with the same dice: once with the card taken (a Deal bought, a Doodad paid, a Market card played) and once
 * without. The difference in how often the game escapes the rat race, goes bankrupt and how many rolls it takes is that
 * card's effect. A second study plays thousands of whole games and records where they stood at fixed rolls, so a game
 * can be set beside the games that escaped; a third looks at what the last cards were before a bankruptcy.
 *
 *   node scripts/card-lab.js                           the full study (about an hour on 16 cores)
 *   node scripts/card-lab.js --quick                   a small run to see it work
 *   node scripts/card-lab.js --report-only             write the report again from data/card-results.json
 *
 * Needs the domain package built. Writes
 *   docs/domain/strategy/data/card-results.json        every figure
 *   src/assets/i18n/cashflow-manual/card-lab.json      the figures the in-app manual shows (self-hosted only)
 *   docs/domain/CASHFLOW_CARD_LAB.md                   the readable report (for agents)
 */

const { Worker, isMainThread, parentPort } = require('worker_threads');
const fs = require('fs');
const os = require('os');
const path = require('path');

const domain = require('@money/domain');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

const DEFAULT_POLICY = 'all-rounder';
const STAGES = [3, 10, 20, 32];
/** The built-up games: the best strategy found, deep into the game, with properties to sell, boost and lose. */
const BUILDER_STAGES = [20, 40, 60];
const MILESTONES = [10, 20, 30, 40, 60];

const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow');
// the presets, and the best strategy the strategy lab's search found (the one to compare a game with)
const searchResults = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'domain', 'strategy', 'data', 'results.json'),
    'utf8',
  ),
);
const policies = Object.fromEntries(
  [...domain.PRESET_SPECS, { ...searchResults.search.top[0].spec, id: 'best-found' }].map(
    (spec) => [spec.id, domain.policyFromSpec(spec)],
  ),
);

// ───────────────────────────── worker ─────────────────────────────
function actionDeps(seed) {
  return {
    clock: domain.fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
    text: domain.identityText,
    money: (minor) => `${minor / 100}`,
    plainMoney: (minor) => `${minor / 100}`,
    cards: {
      textFor: () => ({}),
      symbolFor: (symbol) => symbol,
      sharedText: () => '',
      groupName: (group) => group,
    },
    rng: domain.seededRng(seed),
  };
}

const settled = (books) => {
  if (domain.currentTurn(books.state).phase !== 'decide') return books;
  return {
    ...books,
    state: domain.settleDecision(books.state, 'done', books.subscriptions).state,
  };
};

const onSpace = (books, kind) => ({
  ...books,
  state: {
    ...books.state,
    turn: { ...books.state.turn, phase: 'decide', pending: { kind, spaceIndex: 4 } },
  },
});

const apply = (books, plan) => plan.effects.reduce(domain.applyEffectsToBooks, books);

/** The two positions to compare for one card at one position: the card taken, and the card not taken. */
function alternativesFor(books, deck, card, deps) {
  const cash = domain.cashOnHandMinor(books.transactions, books.allocation);
  if (deck === 'dealSmall' || deck === 'dealBig') {
    const onTheSpace = onSpace(books, 'deal');
    let quantity;
    if (card.assetKind === 'share') {
      quantity = Math.max(1, Math.min(1000, Math.floor((cash * 0.5) / (card.priceMinor || 1))));
    }
    const taken = settled(
      apply(onTheSpace, domain.buyDealAction(onTheSpace, { cardId: card.id, quantity }, deps)),
    );
    const costMinor =
      card.assetKind === 'share'
        ? quantity * (card.priceMinor || 0)
        : (card.depositMinor ?? card.costMinor ?? 0);
    return { taken, other: settled(domain.afterPass(onTheSpace)), applies: true, costMinor, cash };
  }
  if (deck === 'doodad') {
    const onTheSpace = onSpace(books, 'doodad');
    const taken = settled(
      apply(onTheSpace, domain.payDoodadAction(onTheSpace, { cardId: card.id }, deps)),
    );
    return { taken, other: settled(onTheSpace), applies: true, costMinor: card.costMinor, cash };
  }
  const onTheSpace = onSpace(books, 'market');
  const plan = domain.playMarketAction(onTheSpace, { cardId: card.id }, deps);
  const result = plan.result || {};
  const applies =
    (Array.isArray(result.matched) && result.matched.length > 0) ||
    (Array.isArray(result.changed) && result.changed.length > 0) ||
    (result.kind === 'cost' && result.property !== null && result.property !== undefined) ||
    (result.kind === 'split' && result.share != null);
  return {
    taken: settled(apply(onTheSpace, plan)),
    other: settled(onTheSpace),
    applies,
    costMinor: 0,
    cash,
  };
}

function summarize(evaluation) {
  return {
    escape: evaluation.escapeRate,
    bankrupt: evaluation.bankruptRate,
    rolls: evaluation.turnsToEscape ? evaluation.turnsToEscape.median : null,
  };
}

function positionFeatures(books) {
  const finances = domain.summarizeGameFinances(books.state, books.subscriptions);
  return {
    cashMinor: domain.cashOnHandMinor(books.transactions, books.allocation),
    passiveIncomeMinor: finances.passiveIncomeMinor,
    expensesMinor: finances.expensesMinor,
    monthlyCashflowMinor: finances.monthlyCashflowMinor,
    bankLoanMinor: books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0,
    holdings: books.investments.length + books.shares.length,
    children: books.state.children,
  };
}

function runCardStudy(job) {
  const generator = policies[job.policyId];
  // the position is built with one strategy and played on with another when the card needs it (shares are only worth
  // something to a strategy that sells them)
  const policy = policies[job.evalPolicyId || job.policyId];
  const game = new domain.SimGame({
    gameSets: CASHFLOW_GAME_SETS,
    gameSetId: job.setId,
    professionId: job.professionId,
    policy: generator,
    seed: job.seed,
  });
  while (game.view().turn < job.stage && game.phase !== 'over') game.playTurn();
  if (game.phase === 'over') return { skipped: 'ended' };
  const books = game.books;
  const deps = actionDeps(job.seed);
  const options = {
    gameSets: CASHFLOW_GAME_SETS,
    policy,
    rollouts: job.rollouts,
    horizon: 300,
    seedBase: job.seed * 1000 + 1,
  };
  // the position itself is the same for every card: its baseline is evaluated once
  const rows = [];
  const cache = new Map();
  const evaluate = (key, position) => {
    if (!cache.has(key)) cache.set(key, summarize(domain.evaluatePosition(position, options)));
    return cache.get(key);
  };
  for (const deck of ['dealSmall', 'dealBig', 'doodad', 'market']) {
    for (const card of gameSet.decks[deck]) {
      if (job.cardFilter === 'shares' && !(deck === 'dealSmall' && card.assetKind === 'share'))
        continue;
      let pair;
      try {
        pair = alternativesFor(books, deck, card, deps);
      } catch {
        continue; // the rules refuse it here (nothing to pay it with): not a position this card can be tested in
      }
      if (!pair.applies) {
        rows.push({ id: card.id, deck, applies: false });
        continue;
      }
      const taken = summarize(domain.evaluatePosition(pair.taken, options));
      const other = evaluate(`${deck}-other`, pair.other);
      rows.push({
        id: card.id,
        deck,
        applies: true,
        taken,
        other,
        fromCash: pair.costMinor <= pair.cash,
      });
    }
  }
  return { features: positionFeatures(books), rows };
}

function runGames(job) {
  const policy = policies[job.policyId];
  const out = [];
  for (const seed of job.seeds) {
    const game = new domain.SimGame({
      gameSets: CASHFLOW_GAME_SETS,
      gameSetId: job.setId,
      professionId: job.professionId,
      policy,
      seed,
      keepDecisions: true,
      maxTurns: 400,
    });
    const marks = {};
    while (game.phase !== 'over' && game.view().turn < 400) {
      game.playTurn();
      const turn = game.view().turn;
      if (MILESTONES.includes(turn) && !marks[turn]) {
        const view = game.view();
        const finances = view.finances;
        marks[turn] = {
          passive: finances.passiveIncomeMinor,
          expenses: finances.expensesMinor,
          cash: view.cashMinor,
          monthly: finances.monthlyCashflowMinor,
          loan: view.bankLoanMinor,
        };
      }
    }
    const record = game.finish();
    out.push({
      outcome: record.outcome,
      turns: record.turns,
      marks,
      landings: record.landings,
      children: record.children,
      last: record.outcome === 'bankrupt' ? (record.decisions || []).slice(-4) : undefined,
    });
  }
  return out;
}

if (!isMainThread) {
  parentPort.on('message', (job) => {
    const result = job.type === 'card' ? runCardStudy(job) : { games: runGames(job) };
    parentPort.postMessage({ jobId: job.jobId, job: { ...job, seeds: undefined }, ...result });
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

const QUICK = argument('quick', false) === true;
const REPORT_ONLY = argument('report-only', false) === true;
const GAMES_ONLY = argument('games-only', false) === true;
/** Further studies added to the results of the main one: built-up games (rich in properties), and shares traded. */
const FAMILY = argument('family', 'typical');
const ROLLOUTS = Number(argument('rollouts', QUICK ? 6 : 20));
const SEEDS_PER_STAGE = Number(argument('seeds', QUICK ? 1 : 2));
const GAMES = Number(argument('games', QUICK ? 40 : 1000));
const WORKERS = Number(argument('workers', Math.max(1, os.cpus().length - 1)));
const ONLY = argument('professions', QUICK ? 'hausmeister,pilot' : null);
const ROOT = path.join(__dirname, '..');
const OUT_DATA = path.join(ROOT, 'docs', 'domain', 'strategy', 'data', 'card-results.json');
const OUT_APP = path.join(ROOT, 'src', 'assets', 'i18n', 'cashflow-manual', 'card-lab.json');
const OUT_REPORT = path.join(ROOT, 'docs', 'domain', 'CASHFLOW_CARD_LAB.md');

const professions = gameSet.professions.filter(
  (profession) => !ONLY || String(ONLY).split(',').includes(profession.id),
);

function runJobs(jobs) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0;
    let done = 0;
    const startedAt = Date.now();
    if (jobs.length === 0) return resolve(results);
    const workers = [];
    const feed = (worker) => {
      if (next >= jobs.length) return;
      worker.postMessage({ ...jobs[next], jobId: next });
      next += 1;
    };
    for (let i = 0; i < Math.min(WORKERS, jobs.length); i += 1) {
      const worker = new Worker(__filename);
      workers.push(worker);
      worker.on('message', (message) => {
        results[message.jobId] = message;
        done += 1;
        const minutes = Math.round((Date.now() - startedAt) / 60000);
        process.stderr.write(`\r  ${done}/${jobs.length} jobs (${minutes} min)   `);
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

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const stdError = (values) => {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance / values.length);
};
const percentile = (sorted, p) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]
    : null;
const round = (value, digits = 4) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/** One card over every position it applied in. */
function aggregateCard(cardRows) {
  const applied = cardRows.filter((row) => row.applies);
  const escape = applied.map((row) => row.taken.escape - row.other.escape);
  const bankrupt = applied.map((row) => row.taken.bankrupt - row.other.bankrupt);
  const rolls = applied
    .filter((row) => row.taken.rolls !== null && row.other.rolls !== null)
    .map((row) => row.other.rolls - row.taken.rolls); // positive: the card saves rolls
  return {
    positions: cardRows.length,
    applied: applied.length,
    escapeEffect: round(mean(escape)),
    escapeError: round(stdError(escape)),
    bankruptEffect: round(mean(bankrupt)),
    rollsSaved: round(mean(rolls), 2),
    helps: applied.length ? round(escape.filter((v) => v > 0.01).length / applied.length, 3) : null,
    hurts: applied.length
      ? round(escape.filter((v) => v < -0.01).length / applied.length, 3)
      : null,
  };
}

async function main() {
  if (REPORT_ONLY) {
    const results = JSON.parse(fs.readFileSync(OUT_DATA, 'utf8'));
    writeOutputs(results);
    return;
  }
  console.log(
    `Card lab: ${professions.length} professions x ${STAGES.length} stages x ${SEEDS_PER_STAGE} seeds, ${ROLLOUTS} rollouts, ${GAMES} games each for the milestones`,
  );

  // ── 1. every card at many positions ──
  const previous =
    GAMES_ONLY || FAMILY !== 'typical' ? JSON.parse(fs.readFileSync(OUT_DATA, 'utf8')) : null;
  const family =
    FAMILY === 'builders'
      ? { stages: BUILDER_STAGES, policyId: 'best-found', seedBase: 9000 }
      : FAMILY === 'shares'
        ? {
            stages: STAGES,
            policyId: DEFAULT_POLICY,
            seedBase: 7000,
            evalPolicyId: 'stocks-for-deposits',
            cardFilter: 'shares',
          }
        : { stages: STAGES, policyId: DEFAULT_POLICY, seedBase: 7000 };
  const cardJobs = [];
  for (const profession of GAMES_ONLY ? [] : professions) {
    for (const stage of family.stages) {
      for (let k = 0; k < SEEDS_PER_STAGE; k += 1) {
        cardJobs.push({
          type: 'card',
          setId: 'cashflow',
          professionId: profession.id,
          stage,
          seed: family.seedBase + stage * 100 + k * 17 + professions.indexOf(profession),
          rollouts: ROLLOUTS,
          policyId: family.policyId,
          evalPolicyId: family.evalPolicyId,
          cardFilter: family.cardFilter,
        });
      }
    }
  }
  console.log(`Part 1: ${cardJobs.length} positions, every card at each`);
  const cardResults = (await runJobs(cardJobs)).filter((result) => !result.skipped);
  const byCard = new Map();
  for (const result of cardResults) {
    for (const row of result.rows) {
      const entry = {
        ...row,
        stage: result.job.stage,
        professionId: result.job.professionId,
        features: result.features,
      };
      if (!byCard.has(row.id)) byCard.set(row.id, []);
      byCard.get(row.id).push(entry);
    }
  }
  const cards = {};
  for (const [id, rows] of byCard) {
    const deck = rows[0].deck;
    const early = rows.filter((row) => row.stage <= 10);
    const late = rows.filter((row) => row.stage > 10);
    // a Deal bought out of the cash on hand, or only with the bank's loan on top
    const fromCash = rows.filter((row) => row.fromCash);
    const withLoan = rows.filter((row) => row.fromCash === false);
    cards[id] = {
      deck,
      ...aggregateCard(rows),
      early: aggregateCard(early),
      late: aggregateCard(late),
      fromCash: aggregateCard(fromCash),
      withLoan: aggregateCard(withLoan),
    };
  }

  if (FAMILY !== 'typical') {
    const key = FAMILY;
    for (const [id, aggregate] of Object.entries(cards)) {
      if (!previous.cards[id]) continue;
      previous.cards[id][key] = aggregate;
    }
    previous.meta[`${key}Positions`] = cardResults.length;
    previous.meta[`${key}Rollouts`] = ROLLOUTS;
    fs.writeFileSync(OUT_DATA, JSON.stringify(previous, null, 2));
    writeOutputs(previous);
    return;
  }

  // ── 2. whole games: where a game stands at fixed rolls, and how bankruptcies end ──
  const gameJobs = [];
  for (const profession of professions) {
    for (const policyId of ['all-rounder', 'best-found']) {
      const chunk = 50;
      for (let from = 0; from < GAMES; from += chunk) {
        gameJobs.push({
          type: 'games',
          setId: 'cashflow',
          professionId: profession.id,
          policyId,
          seeds: Array.from({ length: Math.min(chunk, GAMES - from) }, (_, i) => 50000 + from + i),
        });
      }
    }
  }
  console.log(`Part 2: ${gameJobs.length} game batches`);
  const gameResults = await runJobs(gameJobs);

  const milestones = {};
  const progressBands = {};
  const ruin = {
    games: 0,
    bankrupt: 0,
    escaped: 0,
    lastKinds: {},
    lastCards: {},
    children: {},
    landings: {},
    escapedChildren: {},
    escapedLandings: {},
  };
  for (const result of gameResults) {
    const { professionId, policyId } = result.job;
    for (const game of result.games) {
      const key = `${professionId}|${policyId}`;
      const entry = (milestones[key] ||= {
        professionId,
        policyId,
        games: 0,
        escaped: 0,
        marks: {},
      });
      entry.games += 1;
      if (game.outcome === 'escaped') entry.escaped += 1;
      for (const turn of MILESTONES) {
        const mark = game.marks[turn];
        if (!mark) continue;
        const bucket = (entry.marks[turn] ||= { all: [], escaped: [] });
        const progress = mark.expenses > 0 ? mark.passive / mark.expenses : 0;
        bucket.all.push(progress);
        if (game.outcome === 'escaped') bucket.escaped.push(progress);
        // how far toward the exit a game is at a roll, over every profession: the chance to escape from there
        const band =
          progress < 0.05 ? 0 : progress < 0.1 ? 1 : progress < 0.2 ? 2 : progress < 0.4 ? 3 : 4;
        const slot = (progressBands[`${policyId}|${turn}`] ||= Array.from({ length: 5 }, () => ({
          games: 0,
          escaped: 0,
          bankrupt: 0,
        })))[band];
        slot.games += 1;
        if (game.outcome === 'escaped') slot.escaped += 1;
        if (game.outcome === 'bankrupt') slot.bankrupt += 1;
      }
      if (policyId === 'all-rounder') {
        ruin.games += 1;
        if (game.outcome === 'escaped') {
          ruin.escaped += 1;
          ruin.escapedChildren[game.children] = (ruin.escapedChildren[game.children] || 0) + 1;
          for (const [kind, count] of Object.entries(game.landings || {})) {
            if (kind === 'downsized' || kind === 'charity' || kind === 'baby') {
              ruin.escapedLandings[kind] = (ruin.escapedLandings[kind] || 0) + count;
            }
          }
        }
        if (game.outcome === 'bankrupt') {
          ruin.bankrupt += 1;
          ruin.children[game.children] = (ruin.children[game.children] || 0) + 1;
          const final = game.last || [];
          const lastKind = final.length ? final[final.length - 1].kind : 'none';
          ruin.lastKinds[lastKind] = (ruin.lastKinds[lastKind] || 0) + 1;
          // what the game threw at the player (a pass is only the player's own choice, not what ended it)
          for (const decision of final
            .slice(-3)
            .filter((d) => d.kind === 'doodad' || d.kind === 'market')) {
            const label = `${decision.kind}|${decision.cardId ?? decision.detail}`;
            ruin.lastCards[label] = (ruin.lastCards[label] || 0) + 1;
          }
          for (const [kind, count] of Object.entries(game.landings || {})) {
            if (kind === 'downsized' || kind === 'charity' || kind === 'baby') {
              ruin.landings[kind] = (ruin.landings[kind] || 0) + count;
            }
          }
        }
      }
    }
  }
  const milestoneRows = Object.values(milestones).map((entry) => ({
    professionId: entry.professionId,
    policyId: entry.policyId,
    games: entry.games,
    escapeRate: round(entry.escaped / entry.games, 3),
    marks: Object.fromEntries(
      Object.entries(entry.marks).map(([turn, bucket]) => {
        const sorted = [...bucket.escaped].sort((a, b) => a - b);
        const every = [...bucket.all].sort((a, b) => a - b);
        return [
          turn,
          {
            escapedP10: round(percentile(sorted, 0.1), 3),
            escapedP50: round(percentile(sorted, 0.5), 3),
            escapedP90: round(percentile(sorted, 0.9), 3),
            allP50: round(percentile(every, 0.5), 3),
            still: bucket.all.length,
          },
        ];
      }),
    ),
  }));

  const results = {
    meta: {
      ...(previous ? previous.meta : {}),
      generatedAt: new Date().toISOString(),
      digest: domain.strategyRulesDigest(
        CASHFLOW_GAME_SETS.filter((set) => set.id === 'cashflow' || set.id === 'custom-jfk'),
      ),
      policy: DEFAULT_POLICY,
      stages: STAGES,
      milestones: MILESTONES,
      positions: previous ? previous.meta.positions : cardResults.length,
      rollouts: previous ? previous.meta.rollouts : ROLLOUTS,
      gamesPerProfession: GAMES,
      professions: professions.map((profession) => profession.id),
    },
    cards: previous ? previous.cards : cards,
    milestones: milestoneRows,
    progressBands,
    ruin,
  };
  fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
  fs.writeFileSync(OUT_DATA, JSON.stringify(results, null, 2));
  writeOutputs(results);
}

// ───────────────────────────── outputs ─────────────────────────────
const texts = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/assets/i18n/cashflow-cards/en.json'), 'utf8'),
);
const cardName = (card) => {
  const label = card.symbol ? (texts.symbols?.[card.symbol] ?? card.symbol) : '';
  const title = texts.cards?.[card.id]?.title ?? card.title;
  return label && !title.includes(label) ? `${title} (${label})` : title;
};
const cardById = Object.fromEntries(
  ['dealSmall', 'dealBig', 'doodad', 'market'].flatMap((deck) =>
    gameSet.decks[deck].map((card) => [card.id, { ...card, deck }]),
  ),
);
const money = (minor) => `${(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} €`;
const pct = (value) =>
  value === null || value === undefined ? '-' : `${(value * 100).toFixed(1)} pts`;

function cardFacts(card) {
  const bits = [];
  if (card.priceMinor !== undefined) bits.push(`price ${money(card.priceMinor)}`);
  if (card.depositMinor !== undefined) bits.push(`deposit ${money(card.depositMinor)}`);
  if (card.cashflowMinor !== undefined) bits.push(`cashflow ${money(card.cashflowMinor)}/month`);
  if (card.costMinor !== undefined) bits.push(`cost ${money(card.costMinor)}`);
  if (card.successOn !== undefined) bits.push(`wins on ${card.successOn}+`);
  return bits.join(', ');
}

/** The dice cards: what the gamble costs and returns on average, by the card's own numbers. */
function diceCards() {
  const rows = [];
  for (const card of gameSet.decks.dealSmall) {
    if (card.successOn === undefined) continue;
    const winChance = (7 - card.successOn) / 6;
    rows.push({
      id: card.id,
      title: cardName(card),
      costMinor: card.costMinor,
      winChance,
      payoutMinor: card.payoutMinor ?? null,
      coins: card.quantity ?? null,
      recurring: card.recurring === true,
      facts: cardFacts(card),
    });
  }
  return rows;
}

function writeOutputs(results) {
  const dice = diceCards();
  const ranked = Object.entries(results.cards)
    .filter(([, card]) => card.applied >= 3)
    .map(([id, card]) => ({ id, ...card, card: cardById[id] }));
  const byDeck = (deck) => ranked.filter((row) => row.deck === deck);
  const best = (deck, count) =>
    [...byDeck(deck)].sort((a, b) => b.escapeEffect - a.escapeEffect).slice(0, count);
  const worst = (deck, count) =>
    [...byDeck(deck)].sort((a, b) => a.escapeEffect - b.escapeEffect).slice(0, count);

  // the in-app manual's figures: small, plain, no card text (the manual reads that from the cards themselves)
  const app = {
    meta: results.meta,
    cards: Object.fromEntries(
      Object.entries(results.cards).map(([id, card]) => [
        id,
        {
          deck: card.deck,
          applied: card.applied,
          positions: card.positions,
          escapeEffect: card.escapeEffect,
          escapeError: card.escapeError,
          bankruptEffect: card.bankruptEffect,
          rollsSaved: card.rollsSaved,
          helps: card.helps,
          hurts: card.hurts,
          early: card.early.escapeEffect,
          late: card.late.escapeEffect,
          fromCash: card.fromCash.escapeEffect,
          builders: card.builders
            ? {
                applied: card.builders.applied,
                positions: card.builders.positions,
                escapeEffect: card.builders.escapeEffect,
                bankruptEffect: card.builders.bankruptEffect,
                rollsSaved: card.builders.rollsSaved,
                fromCash: card.builders.fromCash.escapeEffect,
                fromCashApplied: card.builders.fromCash.applied,
                fromCashRolls: card.builders.fromCash.rollsSaved,
                helps: card.builders.helps,
              }
            : null,
          traded: card.shares
            ? {
                applied: card.shares.applied,
                escapeEffect: card.shares.escapeEffect,
                bankruptEffect: card.shares.bankruptEffect,
                rollsSaved: card.shares.rollsSaved,
              }
            : null,
          fromCashApplied: card.fromCash.applied,
          fromCashRolls: card.fromCash.rollsSaved,
          withLoan: card.withLoan.escapeEffect,
          withLoanApplied: card.withLoan.applied,
        },
      ]),
    ),
    dice: dice.map(({ id, costMinor, winChance, payoutMinor, coins, recurring }) => ({
      id,
      costMinor,
      winChance,
      payoutMinor,
      coins,
      recurring,
    })),
    milestones: results.milestones,
    progressBands: results.progressBands,
    ruin: results.ruin,
  };
  fs.writeFileSync(OUT_APP, JSON.stringify(app));

  const lines = [];
  const push = (line = '') => lines.push(line);
  const fmt = (v) => (v === null || v === undefined ? '-' : (v * 100).toFixed(1));
  const rollsOf = (v, n) => (v === null || v === undefined || n < 3 ? '-' : String(Math.round(v)));
  push('# Cashflow card lab');
  push();
  push(
    `<!-- Generated by scripts/card-lab.js from docs/domain/strategy/data/card-results.json - do not edit by hand. -->`,
  );
  push();
  push(
    `What each card is worth, measured. Every card was put in front of **${results.meta.positions} typical positions** (taken out of simulated games at roll ${results.meta.stages.join(', ')}, for every profession, played by the "${results.meta.policy}" strategy) and of **${results.meta.buildersPositions ?? 0} built-up positions** (the best strategy found, roll 20, 40 and 60, with properties already owned). Each position was played out ${results.meta.rollouts} times with the card taken and ${results.meta.rollouts} times without it, on the same dice. A Deal is "taken" by buying it, a Doodad by paying it, a Market card by playing it. **Effects are in percentage points of the chance to escape the rat race** (plus helps, minus hurts); the measuring error is about one point. Card ids are those of [CASHFLOW_CARDS.md](CASHFLOW_CARDS.md), and the history names a picked card by the same id.`,
  );
  push();
  push(
    "How to use it when you analyse a game: look up the card ids in the history, find them here, and say what the card was worth *in the position the player was in* - a Big Deal bought with a loan is a very different card from the same Big Deal bought from cash. The analyst (`GET /game/review`) measures the player's own decision on the player's own position; this is the background to quote beside it.",
  );
  push();
  push(
    'Columns: **from cash** - the deposit was in cash on hand; **with a loan** - the bank had to lend it; **rolls saved** - median rolls to escape without the card minus with it, from cash, in a typical / a built-up game; **traded** (shares) - the shares are sold when the price is high.',
  );
  push();
  for (const [deck, title] of [
    ['dealSmall', 'Small Deals'],
    ['dealBig', 'Big Deals'],
  ]) {
    push(`## ${title}`);
    push();
    push('| card | id | facts | from cash | with a loan | rolls saved | traded |');
    push('| --- | --- | --- | --- | --- | --- | --- |');
    const rows = Object.entries(results.cards)
      .filter(([, card]) => card.deck === deck)
      .sort(
        (a, b) =>
          (b[1].fromCash.escapeEffect ?? b[1].escapeEffect ?? -9) -
            (a[1].fromCash.escapeEffect ?? a[1].escapeEffect ?? -9) ||
          (b[1].escapeEffect ?? -9) - (a[1].escapeEffect ?? -9),
      );
    for (const [id, card] of rows) {
      push(
        `| ${cardName(cardById[id])} | \`${id}\` | ${cardFacts(cardById[id])} | ${card.fromCash.applied >= 3 ? fmt(card.fromCash.escapeEffect) : '-'} | ${card.withLoan.applied >= 3 ? fmt(card.withLoan.escapeEffect) : '-'} | ${rollsOf(card.fromCash.rollsSaved, card.fromCash.applied)} / ${rollsOf(card.builders?.fromCash.rollsSaved, card.builders?.fromCash.applied ?? 0)} | ${card.shares ? fmt(card.shares.escapeEffect) : '-'} |`,
      );
    }
    push();
  }
  push('## Doodads');
  push();
  push('The cost of being handed the card, against a position where it was never drawn.');
  push();
  push('| doodad | id | cost | escape | bankrupt | early game | late game | built-up game |');
  push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [id, card] of Object.entries(results.cards)
    .filter(([, card]) => card.deck === 'doodad')
    .sort((a, b) => a[1].escapeEffect - b[1].escapeEffect)) {
    push(
      `| ${cardName(cardById[id])} | \`${id}\` | ${money(cardById[id].costMinor)} | ${fmt(card.escapeEffect)} | ${fmt(card.bankruptEffect)} | ${fmt(card.early.escapeEffect)} | ${fmt(card.late.escapeEffect)} | ${fmt(card.builders?.escapeEffect)} |`,
    );
  }
  push();
  push('## Market cards');
  push();
  push(
    'Only positions the card applies to count (a buyer needs a property of its kind). "Built-up" is rolls saved in a built-up game.',
  );
  push();
  push('| card | id | applies in | escape | bankrupt | built-up (rolls) |');
  push('| --- | --- | --- | --- | --- | --- |');
  for (const [id, card] of Object.entries(results.cards)
    .filter(([, card]) => card.deck === 'market' && card.applied > 0)
    .sort((a, b) => b[1].escapeEffect - a[1].escapeEffect)) {
    push(
      `| ${cardName(cardById[id])} | \`${id}\` | ${card.applied} of ${card.positions} | ${fmt(card.escapeEffect)} | ${fmt(card.bankruptEffect)} | ${card.builders?.applied >= 3 ? (card.builders.rollsSaved ?? '-') : '-'} |`,
    );
  }
  push();
  push('## The dice cards');
  push();
  push(
    'A dice card wins on its number or higher. The effect is the whole card, measured, not an expected-value calculation.',
  );
  push();
  push('| card | id | costs | chance | pays | escape | bankrupt |');
  push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of dice) {
    const effect = results.cards[row.id];
    push(
      `| ${row.title} | \`${row.id}\` | ${money(row.costMinor)} | ${(row.winChance * 100).toFixed(0)}% | ${row.payoutMinor ? money(row.payoutMinor) + (row.recurring ? ' a month' : '') : row.coins ? `${row.coins} coins` : ''} | ${effect ? fmt(effect.escapeEffect) : '-'} | ${effect ? fmt(effect.bankruptEffect) : '-'} |`,
    );
  }
  push();
  push('## Where a game stands on the way to the exit');
  push();
  push(
    `Passive income as a share of the expenses (100% is the exit) at roll ${results.meta.milestones.join(', ')}, for the games that **escaped** with the best strategy found - the middle game, and the fast and slow tenth in brackets:`,
  );
  push();
  push(
    `| profession | escapes | ${results.meta.milestones.map((roll) => `roll ${roll}`).join(' | ')} |`,
  );
  push(`| --- | --- | ${results.meta.milestones.map(() => '---').join(' | ')} |`);
  for (const entry of results.milestones
    .filter((e) => e.policyId === 'best-found')
    .sort((a, b) => a.escapeRate - b.escapeRate)) {
    push(
      `| ${entry.professionId} | ${Math.round(entry.escapeRate * 100)}% | ${results.meta.milestones
        .map((roll) => {
          const mark = entry.marks[String(roll)];
          return mark && mark.escapedP50 !== null
            ? `${Math.round(mark.escapedP50 * 100)}% (${Math.round(mark.escapedP10 * 100)}-${Math.round(mark.escapedP90 * 100)})`
            : '-';
        })
        .join(' | ')} |`,
    );
  }
  push();
  push(
    'The other way round: of all games that stood in a band at a roll (the all-round strategy, every profession), how many escaped / went bankrupt:',
  );
  push();
  push(
    `| passive income covers | ${results.meta.milestones.map((roll) => `roll ${roll}`).join(' | ')} |`,
  );
  push(`| --- | ${results.meta.milestones.map(() => '---').join(' | ')} |`);
  ['under 5%', '5-10%', '10-20%', '20-40%', '40% or more'].forEach((band, index) => {
    push(
      `| ${band} | ${results.meta.milestones
        .map((roll) => {
          const slot = results.progressBands[`all-rounder|${roll}`]?.[index];
          return slot && slot.games >= 20
            ? `${Math.round((slot.escaped / slot.games) * 100)}% / ${Math.round((slot.bankrupt / slot.games) * 100)}%`
            : '-';
        })
        .join(' | ')} |`,
    );
  });
  push();
  push('## How games end in bankruptcy');
  push();
  const total = Math.max(1, results.ruin.bankrupt);
  push(
    `${results.ruin.games} games with the all-round strategy, ${results.ruin.bankrupt} (${Math.round((results.ruin.bankrupt / results.ruin.games) * 100)}%) went bankrupt. The last decision before the end:`,
  );
  push();
  for (const [kind, count] of Object.entries(results.ruin.lastKinds).sort((a, b) => b[1] - a[1])) {
    push(`- ${kind}: ${Math.round((count / total) * 100)}%`);
  }
  push();
  push('The Doodads and Market cards most often among the last three decisions:');
  push();
  for (const [key, count] of Object.entries(results.ruin.lastCards)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)) {
    const [kind, id] = key.split('|');
    push(
      `- ${cardById[id] ? cardName(cardById[id]) : id} (${kind}, \`${id}\`): ${Math.round((count / total) * 100)}% of the bankruptcies`,
    );
  }
  push();
  fs.writeFileSync(OUT_REPORT, lines.join('\n') + '\n');
  console.log(
    `Wrote ${path.relative(ROOT, OUT_DATA)}, ${path.relative(ROOT, OUT_APP)}, ${path.relative(ROOT, OUT_REPORT)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
