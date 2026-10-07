'use strict';

const {
  systemClock,
  legalActions,
  playPayday,
  playBaby,
  playBankLoan,
  playCharityPaying,
  playDownsizedPaying,
  roundBooksOf,
  clearCashflowStatus,
  emptyEffects,
  applyEffectsToBooks,
  endIfOver,
  pushUndoSnapshot,
  popUndoSteps,
  keepSavedSlot,
  blankGameData,
  playTurn,
  settleDecision,
  CLASSIC_RAT_RACE_BOARD,
  systemRng,
  startGameAction,
  drawCardAction,
  buyDealAction,
  payDoodadAction,
  playMarketAction,
  rollDecisionAction,
  sellPositionAction,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptSettings } = require('./settings-repository');
const { decodeGameState } = require('../services/game-state-codec');
const { readBooks, applyEffectsToData } = require('../services/game-writer');
const { createGameText, createMoneyFormat } = require('../services/game-text');
const { createCardTextSource } = require('../services/game-card-text');
const {
  readSnapshot,
  writeSnapshot,
  readHistoryStack,
  buildHistoryDocument,
} = require('../services/game-snapshot');
const { getGame, loadGameSets } = require('./game-repository');

/**
 * Plays the live game (todo/cashflow-game-pro.md slice D2): every action is one document write that carries the books,
 * the game state and the history - so what an agent plays can be undone in the app and the other way round. The rules
 * are the domain's; each step that is undoable pushes the account as it was onto the history first, like the app does.
 */

const MAX_WRITE_RETRIES = 10;

class GameActionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function refuse(code, message) {
  return new GameActionError(code, message);
}

/**
 * What one action plays over the books: the effects in order, the one History step they share when they carry none of
 * their own (a roll), and what the caller reports back (`result`).
 */
function playAction(action, input, { books, profession, deps, gameSets }) {
  switch (action) {
    case 'start':
      return startGameAction(books, input, deps, gameSets);
    case 'payday':
      return { effects: [playPayday(roundBooksOf(books), deps)] };
    case 'baby':
      return { effects: [playBaby(roundBooksOf(books), profession, deps)] };
    case 'charity':
      return { effects: playCharityPaying(books, deps).effects };
    case 'downsized':
      return { effects: playDownsizedPaying(books, deps).effects };
    case 'bank_loan':
      return { effects: [playBankLoan(books, input.amountMinor, deps)] };
    case 'clear_status':
      return { effects: [emptyEffects(clearCashflowStatus(books.state, input.status), null)] };
    case 'roll': {
      const turn = playTurn(
        books,
        { ...deps, board: CLASSIC_RAT_RACE_BOARD, profession, rng: deps.rng },
        { dice: input.dice },
      );
      return {
        effects: turn.effects,
        step: turn.step,
        result: {
          dice: turn.roll.dice,
          total: turn.roll.total,
          from: books.state.boardPosition,
          to: turn.move.to,
          landed: turn.move.landed.kind,
          paydays: turn.move.paydays + (turn.openingPayday ? 1 : 0),
          openingPayday: turn.openingPayday,
          autoLoansMinor: turn.autoLoansMinor,
        },
      };
    }
    case 'pass_card': {
      const settled = settleDecision(books.state, 'passed', books.subscriptions);
      return { effects: [emptyEffects(settled.state, settled.step)] };
    }
    case 'draw_card':
      return drawCardAction(books, input, deps);
    case 'buy_deal':
      return buyDealAction(books, input, deps);
    case 'pay_doodad':
      return payDoodadAction(books, input, deps);
    case 'play_market':
      return playMarketAction(books, input, deps);
    case 'roll_decision':
      return rollDecisionAction(books, input, deps);
    case 'sell_position':
      return sellPositionAction(books, input, deps);
    default:
      throw refuse('GAME_ACTION_UNKNOWN', `Unknown game action: ${action}`);
  }
}

/** What an action needs to run: the stored data, the encryption session, the account's settings and the game's words. */
async function loadContext(deps, userId) {
  let userDoc;
  try {
    userDoc = await deps.usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { _id: userId, data: {} };
  }
  const data = userDoc.data || {};
  const session = await getEncryptionSession(deps.authDb, userId);
  const settings = decryptSettings(data.settings, session);
  const state = decodeGameState(data.cashflowGame, session);
  const text = createGameText(settings.language);
  const money = createMoneyFormat(settings);
  return {
    userDoc,
    data,
    session,
    settings,
    state,
    gameDeps: {
      clock: systemClock,
      text,
      money,
      plainMoney: money,
      rng: deps.rng ?? systemRng,
      cards: createCardTextSource(settings.language),
    },
    history: readHistoryStack(data, session),
  };
}

/** Writes the history document for `stack` (the account as it is now is the "live" end of it). */
function withHistory(data, stack, context) {
  const live = readSnapshot(data, context.session);
  return {
    ...data,
    cashflowGameHistory: buildHistoryDocument(
      stack,
      live,
      { text: context.gameDeps.text, money: context.gameDeps.money },
      systemClock.nowIso(),
      context.session,
    ),
  };
}

function pushStep(stack, data, step, context) {
  return pushUndoSnapshot(stack, {
    step: { ...step, at: systemClock.nowIso() },
    ...readSnapshot(data, context.session),
  });
}

/** Plays effects in order: each undoable one first pushes how the account stood, then changes it. */
function applyEffectsList(effectsList, context, startData, startStack, sharedStep) {
  let data = startData;
  let stack = startStack;
  if (sharedStep) stack = pushStep(stack, data, sharedStep, context);
  for (const effects of effectsList) {
    if (effects.step) stack = pushStep(stack, data, effects.step, context);
    data = applyEffectsToData(data, effects, {
      session: context.session,
      nowIso: systemClock.nowIso(),
    });
  }
  return { data, stack };
}

async function playGameAction(deps, userId, action, input = {}) {
  // `deps.rng` is for tests and the scripted agent harness; the API itself always rolls with the system's dice.
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    const context = await loadContext(deps, userId);
    const { userDoc, data, session, settings, state, history } = context;
    const canUndo = history.stack.length > 0;
    if (action !== 'start' && !state.professionId) {
      throw refuse('GAME_NOT_STARTED', 'No game is running.');
    }
    const legal = legalActions(state, { canUndo }).map((candidate) => candidate.action);
    if (!legal.includes(action)) {
      throw refuse(
        'GAME_ACTION_NOT_ALLOWED',
        `'${action}' is not allowed now. Allowed: ${legal.join(', ')}.`,
      );
    }

    let nextData;
    let result;
    try {
      ({ data: nextData, result } = runAction(action, input, context, {
        settings,
        state,
        data,
        session,
        history,
      }));
    } catch (error) {
      if (error instanceof GameActionError) throw error;
      throw refuse('GAME_RULE_REFUSED', error.message);
    }

    try {
      await deps.usersDb.insert({ ...userDoc, data: nextData, updatedAt: systemClock.nowIso() });
      const game = await getGame(deps, userId);
      return result ? { ...game, result } : game;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw refuse('GAME_WRITE_CONFLICT', 'The game kept changing; try again.');
}

function runAction(action, input, context, { settings, state, data, session, history }) {
  if (action === 'undo') {
    const count = input.count ?? 1;
    const { snapshot, stack } = popUndoSteps(history.stack, count);
    if (!snapshot) throw refuse('GAME_RULE_REFUSED', 'Nothing to undo.');
    const restored = writeSnapshot(data, keepSavedSlot(snapshot, state), session);
    return { data: withHistory(restored, stack, context) };
  }
  if (action === 'reset') {
    const blank = writeSnapshot(data, blankGameData(), session);
    return { data: withHistory(blank, [], context) };
  }

  const gameSets = loadGameSets();
  const gameSet = gameSets.find(
    (candidate) => candidate.id === (input.gameSetId ?? state.gameSetId),
  );
  const profession = gameSet?.professions.find(
    (candidate) => candidate.id === (input.professionId ?? state.professionId),
  );
  const books = readBooks(data, session, { state, allocation: settings.allocation, gameSet });
  const played = playAction(action, input, {
    books,
    profession,
    deps: context.gameDeps,
    gameSets,
  });

  const effectsList = played.effects;
  // A new game has a new history: whatever an earlier game left behind is dropped.
  const startStack = action === 'start' ? [] : history.stack;
  const applied = applyEffectsList(effectsList, context, data, startStack, played.step);
  let { data: nextData } = applied;
  let nextBooks = books;
  for (const effects of effectsList) nextBooks = applyEffectsToBooks(nextBooks, effects);

  // Dealing with the card closes the solo turn's decision (the app's Done); a companion game has none open.
  if (
    played.settle &&
    nextBooks.state.mode === 'solo' &&
    nextBooks.state.turn?.phase === 'decide'
  ) {
    const settled = settleDecision(nextBooks.state, 'done', nextBooks.subscriptions);
    nextBooks = { ...nextBooks, state: settled.state };
    nextData = applyEffectsToData(nextData, emptyEffects(settled.state, null), {
      session,
      nowIso: systemClock.nowIso(),
    });
  }

  // A solo game ends the moment the books say so (escaped / bankrupt).
  const ended = endIfOver(nextBooks.state, nextBooks.subscriptions);
  if (ended !== nextBooks.state) {
    nextData = applyEffectsToData(nextData, emptyEffects(ended, null), {
      session,
      nowIso: systemClock.nowIso(),
    });
  }
  const stored =
    applied.stack === history.stack && action !== 'start'
      ? nextData
      : withHistory(nextData, applied.stack, context);
  return { data: stored, result: played.result };
}

module.exports = { playGameAction, GameActionError, loadContext };
