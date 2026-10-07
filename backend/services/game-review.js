'use strict';

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { PRESET_SPECS, benchmarkFor, describeReview } = require('@money/domain');

/**
 * The game analyst on the server (todo/cashflow-game-analysis.md, E6): runs the domain's `reviewGame` on a stored undo
 * history, in a worker thread, and sets the result beside what the strategy lab measured for the profession.
 */

const RESULT_FILES = [
  process.env.GAME_STRATEGY_RESULTS,
  path.join(__dirname, '..', 'strategy', 'results.json'),
  path.join(__dirname, '..', '..', 'docs', 'domain', 'strategy', 'data', 'results.json'),
].filter(Boolean);

let labResults;
function loadLabResults() {
  if (labResults === undefined) {
    const file = RESULT_FILES.find((candidate) => fs.existsSync(candidate));
    labResults = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }
  return labResults;
}

const DEFAULT_STRATEGY = 'all-rounder';

function runWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'game-review-worker.js'), { workerData: data });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`The review worker stopped with code ${code}.`));
    });
  });
}

/**
 * @param stack the game's undo history: the position before each step, with the step
 * @param live the game as it stands now
 * @param options `strategy` (a preset id the games continue with), `rollouts`, `timeBudgetMs`, `money` (formatter)
 */
async function reviewHistory(stack, live, options) {
  const strategyId = PRESET_SPECS.some((spec) => spec.id === options.strategy)
    ? options.strategy
    : DEFAULT_STRATEGY;
  const rollouts = Math.min(Math.max(options.rollouts || 80, 10), 400);
  const timeBudgetMs = Math.min(Math.max(options.timeBudgetMs || 60000, 5000), 180000);
  const review = await runWorker({ stack, live, strategyId, rollouts, timeBudgetMs });
  const escaped = review.final.outcome === 'escaped' ? review.final.rolls : null;
  const benchmark = benchmarkFor(loadLabResults(), live.cashflowGame.professionId, escaped);
  const strategy = PRESET_SPECS.find((spec) => spec.id === strategyId);
  return {
    reviewable: true,
    baseline: { id: strategyId, label: strategy.label, description: strategy.description },
    review,
    benchmark,
    text: describeReview(review, { money: options.money, benchmark }),
  };
}

function notReviewable(reason) {
  return { reviewable: false, reason };
}

module.exports = { reviewHistory, notReviewable };
