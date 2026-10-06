'use strict';

const {
  summarizeGameFinances,
  cashOnHandMinor,
  legalActions,
  gameOutcome,
  currentTurn,
  CLASSIC_RAT_RACE_BOARD,
  systemClock,
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
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue, toApiTransactions } = require('./transaction-repository');
const { decodeGameState } = require('../services/game-state-codec');
const { getSettings, decryptSettings } = require('./settings-repository');
const { readBooks, applyEffectsToData } = require('../services/game-writer');
const { createGameText, createMoneyFormat } = require('../services/game-text');

/**
 * Cashflow game, read side (todo/cashflow-game-pro.md slice D1). The live game is stored the way the browser writes it:
 * every leaf of `data.cashflowGame` an encrypted string, so `decodeGameState` is the server's port of the browser's
 * `decryptCashflowGameState` (app-data.service.ts) - the two must read the same document the same way.
 */

/** The printed content lives in its own module, kept out of the domain package's main entry on purpose. */
function loadGameSets() {
  return require('@money/domain/dist/cashflow-content').CASHFLOW_GAME_SETS;
}

async function loadUserData({ usersDb }, userId) {
  try {
    return (await usersDb.get(userId)).data || {};
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    return {};
  }
}

/** The game's decoded state plus the account money the read view derives its figures from. */
async function loadGameBooks(deps, userId) {
  const data = await loadUserData(deps, userId);
  const session = await getEncryptionSession(deps.authDb, userId);
  const schemaVersion = data.meta?.schemaVersion || 1;
  const state = decodeGameState(data.cashflowGame, session);
  const rawSubscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const subscriptions = rawSubscriptions.map((raw) => {
    const amount = Number(decryptValue(raw.amount, session));
    return {
      title: decryptValue(raw.title, session),
      amountMinor: schemaVersion >= 2 ? amount : Math.round(amount * 100),
    };
  });
  const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
  const currency = data.meta?.currency || 'EUR';
  const transactions = toApiTransactions(rawTransactions, session, schemaVersion, currency);
  const { allocation } = await getSettings(deps, userId);
  return { state, subscriptions, transactions, allocation, currency };
}

/** `GET /game`: where the live game stands and what may be done next. */
async function getGame(deps, userId) {
  const { state, subscriptions, transactions, allocation, currency } = await loadGameBooks(
    deps,
    userId,
  );
  if (!state.professionId) return { active: false, legalActions: legalActions(state) };

  const solo = state.mode === 'solo';
  const turn = solo ? currentTurn(state) : null;
  const gameSet = loadGameSets().find((candidate) => candidate.id === state.gameSetId);
  const profession = gameSet?.professions.find((candidate) => candidate.id === state.professionId);
  return {
    active: true,
    currency,
    gameSetId: state.gameSetId,
    professionId: state.professionId,
    professionTitle: profession?.title ?? null,
    mode: state.mode,
    gameId: state.gameId ?? null,
    gameName: state.gameName ?? null,
    round: state.round,
    virtualDate: state.virtualDate,
    children: state.children,
    position: solo
      ? {
          index: state.boardPosition,
          spaceKind:
            state.boardPosition == null
              ? null
              : (CLASSIC_RAT_RACE_BOARD[state.boardPosition]?.kind ?? null),
        }
      : null,
    turn,
    outcome: gameOutcome(state, subscriptions),
    status: {
      charityRoundsLeft: state.charityRoundsLeft,
      unemployedRoundsLeft: state.unemployedRoundsLeft,
    },
    pendingDecision: turn?.pending ?? null,
    cashMinor: cashOnHandMinor(transactions, allocation),
    finances: summarizeGameFinances(state, subscriptions),
    assetDeals: state.assetDeals,
    marketOffers: state.marketOffers,
    legalActions: legalActions(state),
  };
}

function toSetSummary(gameSet) {
  return {
    id: gameSet.id,
    title: gameSet.title,
    professions: gameSet.professions.map((profession) => ({
      id: profession.id,
      title: profession.title,
      salaryMinor: profession.salaryMinor,
    })),
  };
}

function listGameSets() {
  return loadGameSets().map(toSetSummary);
}

/** One set with its loan rule and the rat-race board (the same ring for every set). */
function getGameSet(gameSetId) {
  const gameSet = loadGameSets().find((candidate) => candidate.id === gameSetId);
  if (!gameSet) return null;
  return { ...toSetSummary(gameSet), loanRule: gameSet.loanRule, board: CLASSIC_RAT_RACE_BOARD };
}

const MAX_WRITE_RETRIES = 10;

class GameActionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** The effects one action plays over the books; the rules themselves are the domain's. */
function playAction(action, input, { books, profession, deps }) {
  switch (action) {
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
      throw new GameActionError('GAME_ACTION_UNKNOWN', `Unknown game action: ${action}`);
  }
}

/**
 * Plays one action of the live game and stores the result (todo/cashflow-game-pro.md slice D2): the action must be one
 * of `legalActions`, the rule is the domain's, the effects are written the way the browser stores them - one document
 * write, retried on a concurrent change. Returns the game as `getGame` shows it afterwards.
 */
async function playGameAction(deps, userId, action, input = {}) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await deps.usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      throw new GameActionError('GAME_NOT_STARTED', 'No game is running.');
    }
    const data = userDoc.data || {};
    const session = await getEncryptionSession(deps.authDb, userId);
    const settings = decryptSettings(data.settings, session);
    const state = decodeGameState(data.cashflowGame, session);
    if (!state.professionId) throw new GameActionError('GAME_NOT_STARTED', 'No game is running.');
    const legal = legalActions(state).map((candidate) => candidate.action);
    if (!legal.includes(action)) {
      throw new GameActionError(
        'GAME_ACTION_NOT_ALLOWED',
        `'${action}' is not allowed now. Allowed: ${legal.join(', ')}.`,
      );
    }
    const gameSet = loadGameSets().find((candidate) => candidate.id === state.gameSetId);
    const profession = gameSet?.professions.find(
      (candidate) => candidate.id === state.professionId,
    );
    const books = readBooks(data, session, { state, allocation: settings.allocation, gameSet });
    const text = createGameText(settings.language);
    const gameDeps = {
      clock: systemClock,
      text,
      money: createMoneyFormat(settings),
      plainMoney: createMoneyFormat(settings),
    };

    let effectsList;
    try {
      effectsList = playAction(action, input, { books, profession, deps: gameDeps });
    } catch (error) {
      if (error instanceof GameActionError) throw error;
      throw new GameActionError('GAME_RULE_REFUSED', error.message);
    }

    let nextData = data;
    let nextBooks = books;
    for (const effects of effectsList) {
      nextData = applyEffectsToData(nextData, effects, { session, nowIso: systemClock.nowIso() });
      nextBooks = applyEffectsToBooks(nextBooks, effects);
    }
    // A solo game ends the moment the books say so (escaped / bankrupt).
    const ended = endIfOver(nextBooks.state, nextBooks.subscriptions);
    if (ended !== nextBooks.state) {
      nextData = applyEffectsToData(nextData, emptyEffects(ended, null), {
        session,
        nowIso: systemClock.nowIso(),
      });
    }

    try {
      await deps.usersDb.insert({ ...userDoc, data: nextData, updatedAt: systemClock.nowIso() });
      return await getGame(deps, userId);
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new GameActionError('GAME_WRITE_CONFLICT', 'The game kept changing; try again.');
}

module.exports = {
  getGame,
  listGameSets,
  getGameSet,
  decodeGameState,
  playGameAction,
  GameActionError,
};
