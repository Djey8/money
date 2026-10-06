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
  pickCashflowProfession,
  textOrFallback,
  nextSmartDate,
  gameSubscriptionDays,
  pushUndoSnapshot,
  popUndoSteps,
  keepSavedSlot,
  blankGameData,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptSettings } = require('./settings-repository');
const { decodeGameState } = require('../services/game-state-codec');
const { readBooks, applyEffectsToData } = require('../services/game-writer');
const { createGameText, createMoneyFormat } = require('../services/game-text');
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

/** The starting position of a game: savings booked, the profession's subscriptions and starting positions created. */
function playStart(books, input, deps, gameSets) {
  const { gameSetId, professionId, mode = 'companion' } = input;
  const result = pickCashflowProfession(
    gameSets,
    gameSetId,
    professionId,
    deps.clock.todayIso(),
    mode,
  );
  const { text } = deps;
  const { profession } = result;
  const professionTitle = textOrFallback(
    text,
    `CashflowGame.profession.${profession.id}.title`,
    profession.title,
  );
  const salaryWord = text('CashflowGame.salary');
  const savingsWord = text('CashflowGame.savings');
  const lineTitle = (line) =>
    line.key
      ? textOrFallback(text, `CashflowGame.expenseLine.${line.key}`, line.title)
      : line.title;
  // result.subscriptions is [salary, ...the non-zero expense lines], in that order.
  const nonZeroExpenses = profession.expenses.filter((line) => line.amountMinor !== 0);
  const titles = result.subscriptions.map((_sub, index) =>
    index === 0
      ? text('CashflowGame.salarySubscriptionTitle', { profession: professionTitle })
      : lineTitle(nonZeroExpenses[index - 1]),
  );

  const usedDays = gameSubscriptionDays(books.subscriptions);
  const kit = result.starterKit;
  const effects = emptyEffects(
    { ...result.state, gameSubscriptionTitles: titles },
    { kind: 'start', detail: professionTitle },
  );
  effects.appendedTransactions = result.startingTransactions.map((record) => ({
    ...record,
    category: `@${savingsWord}`,
    comment: `${text('CashflowGame.savingsTransactionComment', { profession: professionTitle })}\n#cashflow`,
  }));
  effects.subscriptionUpserts = result.subscriptions.map((sub, index) => ({
    title: titles[index],
    account: sub.account,
    amountMinor: sub.amountMinor,
    startDate: nextSmartDate(usedDays, deps.clock.todayIso()),
    endDate: '',
    category: index === 0 ? `@${salaryWord}` : `@${titles[index]}`,
    comment: sub.comment ? `${sub.comment}\n#cashflow` : '#cashflow',
    frequency: sub.frequency,
  }));
  effects.assetUpserts = (kit.assets ?? []).map((asset) => ({
    tag: asset.tag,
    amountMinor: asset.amountMinor,
  }));
  effects.investmentUpserts = (kit.investments ?? []).map((investment) => ({
    tag: investment.tag,
    depositMinor: investment.depositMinor,
    amountMinor: investment.amountMinor,
  }));
  effects.shareUpserts = (kit.shares ?? []).map((share) => ({ ...share }));
  effects.liabilityUpserts = (kit.liabilities ?? []).map((liability) => ({
    tag: liability.key
      ? textOrFallback(text, `CashflowGame.liabilityTag.${liability.key}`, liability.tag)
      : liability.tag,
    amountMinor: liability.amountMinor,
    investment: false,
  }));
  return [effects];
}

/** The effects one action plays over the books; the rules themselves are the domain's. */
function playAction(action, input, { books, profession, deps, gameSets }) {
  switch (action) {
    case 'start':
      return playStart(books, input, deps, gameSets);
    case 'payday':
      return [playPayday(roundBooksOf(books), deps)];
    case 'baby':
      return [playBaby(roundBooksOf(books), profession, deps)];
    case 'charity':
      return playCharityPaying(books, deps).effects;
    case 'downsized':
      return playDownsizedPaying(books, deps).effects;
    case 'bank_loan':
      return [playBankLoan(books, input.amountMinor, deps)];
    case 'clear_status':
      return [emptyEffects(clearCashflowStatus(books.state, input.status), null)];
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
    gameDeps: { clock: systemClock, text, money, plainMoney: money },
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
function applyEffectsList(effectsList, context, startData, startStack) {
  let data = startData;
  let stack = startStack;
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
    try {
      nextData = runAction(action, input, context, { settings, state, data, session, history });
    } catch (error) {
      if (error instanceof GameActionError) throw error;
      throw refuse('GAME_RULE_REFUSED', error.message);
    }

    try {
      await deps.usersDb.insert({ ...userDoc, data: nextData, updatedAt: systemClock.nowIso() });
      return await getGame(deps, userId);
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
    return withHistory(restored, stack, context);
  }
  if (action === 'reset') {
    const blank = writeSnapshot(data, blankGameData(), session);
    return withHistory(blank, [], context);
  }

  const gameSets = loadGameSets();
  const gameSet = gameSets.find(
    (candidate) => candidate.id === (input.gameSetId ?? state.gameSetId),
  );
  const profession = gameSet?.professions.find(
    (candidate) => candidate.id === (input.professionId ?? state.professionId),
  );
  const books = readBooks(data, session, { state, allocation: settings.allocation, gameSet });
  const effectsList = playAction(action, input, {
    books,
    profession,
    deps: context.gameDeps,
    gameSets,
  });

  // A new game has a new history: whatever an earlier game left behind is dropped.
  const startStack = action === 'start' ? [] : history.stack;
  const applied = applyEffectsList(effectsList, context, data, startStack);
  let { data: nextData } = applied;
  let nextBooks = books;
  for (const effects of effectsList) nextBooks = applyEffectsToBooks(nextBooks, effects);

  // A solo game ends the moment the books say so (escaped / bankrupt).
  const ended = endIfOver(nextBooks.state, nextBooks.subscriptions);
  if (ended !== nextBooks.state) {
    nextData = applyEffectsToData(nextData, emptyEffects(ended, null), {
      session,
      nowIso: systemClock.nowIso(),
    });
  }
  return applied.stack === history.stack && action !== 'start'
    ? nextData
    : withHistory(nextData, applied.stack, context);
}

module.exports = { playGameAction, GameActionError };
