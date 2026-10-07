'use strict';

const { isEncodedUndoChain, decodeUndoChain, isGameSnapshot } = require('@money/domain');
const { loadContext } = require('./game-play');
const { readSnapshot } = require('../services/game-snapshot');
const { reviewHistory, notReviewable } = require('../services/game-review');
const { readBlob } = require('./game-saves');
const { GameActionError } = require('./game-play');

/**
 * The game analyst's two entry points (todo/cashflow-game-analysis.md, E6): the game being played, and a saved game. Both
 * need the game's step history - the undo chain - because a position is judged against the one before it; a compact save
 * does not keep it and says so.
 */

async function reviewLive(deps, userId, options) {
  const context = await loadContext(deps, userId);
  if (!context.state.professionId) {
    throw new GameActionError('GAME_NOT_STARTED', 'No game is running.');
  }
  if (context.history.stack.length === 0) {
    return notReviewable('The running game has no step history to judge.');
  }
  const live = readSnapshot(context.data, context.session);
  return reviewHistory(context.history.stack, live, { ...options, money: context.gameDeps.money });
}

async function reviewSave(deps, userId, id, options) {
  const context = await loadContext(deps, userId);
  const blob = readBlob(context.data, id, context.session);
  if (!blob) throw new GameActionError('GAME_SAVE_NOT_FOUND', 'No saved game has that id.');
  if (!isGameSnapshot(blob.snapshot)) return notReviewable('This saved game is damaged.');
  if (!isEncodedUndoChain(blob.undo)) {
    return notReviewable(
      'This game was saved compactly, without its undo history, so its positions cannot be replayed. Save games you want analysed in full (compact: false).',
    );
  }
  const stack = decodeUndoChain(blob.undo);
  if (stack.length === 0) return notReviewable('This saved game has no step history to judge.');
  return reviewHistory(stack, blob.snapshot, { ...options, money: context.gameDeps.money });
}

module.exports = { reviewLive, reviewSave };
