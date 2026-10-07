'use strict';

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { GameActionError } = require('../repositories/game-play');
const {
  PRESET_SPECS,
  benchmarkFor,
  describeReview,
  describeProgress,
  progressPoints,
} = require('@money/domain');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

/**
 * The game analyst on the server (todo/cashflow-game-analysis.md, E6): runs the domain's `reviewGame` on a stored undo
 * history, in a worker thread, and sets the result beside what the strategy lab measured for the profession.
 */

const RESULT_FILES = [
  process.env.GAME_STRATEGY_RESULTS,
  path.join(__dirname, '..', 'strategy', 'results.json'),
  path.join(__dirname, '..', '..', 'docs', 'domain', 'strategy', 'data', 'results.json'),
].filter(Boolean);

// What the card lab measured: where games stand on the way to the exit, and how they end (scripts/card-lab.js).
const CARD_RESULT_FILES = [
  process.env.GAME_CARD_RESULTS,
  path.join(__dirname, '..', 'strategy', 'card-results.json'),
  path.join(__dirname, '..', '..', 'docs', 'domain', 'strategy', 'data', 'card-results.json'),
].filter(Boolean);

let cardLabBands;
function loadProgressBands() {
  if (cardLabBands === undefined) {
    const file = CARD_RESULT_FILES.find((candidate) => fs.existsSync(candidate));
    cardLabBands = file ? (JSON.parse(fs.readFileSync(file, 'utf8')).progressBands ?? null) : null;
  }
  return cardLabBands;
}

let labResults;
function loadLabResults() {
  if (labResults === undefined) {
    const file = RESULT_FILES.find((candidate) => fs.existsSync(candidate));
    labResults = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  }
  return labResults;
}

const DEFAULT_STRATEGY = 'all-rounder';

// A review plays thousands of games on a core of its own; a few at once would starve the API.
const MAX_REVIEWS_AT_ONCE = 2;
let reviewsRunning = 0;

function runWorker(data) {
  if (reviewsRunning >= MAX_REVIEWS_AT_ONCE) {
    throw new GameActionError(
      'GAME_REVIEW_BUSY',
      'Other reviews are running; try again in a minute.',
    );
  }
  reviewsRunning += 1;
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'game-review-worker.js'), { workerData: data });
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      clearTimeout(killer);
      reviewsRunning -= 1;
      return true;
    };
    // the worker's own deadline is cooperative; this one is hard
    const killer = setTimeout(() => {
      if (finish()) reject(new Error('The review took too long and was stopped.'));
      worker.terminate();
    }, data.timeBudgetMs + 30000);
    worker.once('message', (message) => {
      if (finish()) resolve(message);
    });
    worker.once('error', (error) => {
      if (finish()) reject(error);
    });
    worker.once('exit', (code) => {
      if (code !== 0 && finish()) reject(new Error(`The review worker stopped with code ${code}.`));
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
  const bands = loadProgressBands();
  const progress = bands
    ? progressPoints(stack, live, { gameSets: CASHFLOW_GAME_SETS, bands })
    : [];
  return {
    reviewable: true,
    baseline: { id: strategyId, label: strategy.label, description: strategy.description },
    review,
    benchmark,
    progress,
    text: describeReview(review, { money: options.money, benchmark }) + describeProgress(progress),
  };
}

function notReviewable(reason) {
  return { reviewable: false, reason };
}

module.exports = { reviewHistory, notReviewable };
