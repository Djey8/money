'use strict';

const { parentPort, workerData } = require('worker_threads');
const domain = require('@money/domain');
const { CASHFLOW_GAME_SETS } = require('@money/domain/dist/cashflow-content');

/**
 * Judges a game's decisions in a thread of its own (a review plays thousands of games; the API's request thread must keep
 * answering). Gets the undo stack, the live snapshot and the strategy to continue with, returns `reviewGame`'s result.
 */
const { stack, live, strategyId, rollouts, timeBudgetMs } = workerData;
const spec = domain.PRESET_SPECS.find((candidate) => candidate.id === strategyId);
const policy = domain.policyFromSpec(spec);
const review = domain.reviewGame(stack, live, {
  gameSets: CASHFLOW_GAME_SETS,
  policy,
  rollouts,
  timeBudgetMs,
});
parentPort.postMessage(review);
