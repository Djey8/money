'use strict';

const {
  summarizeGameFinances,
  cashOnHandMinor,
  legalActions,
  gameOutcome,
  currentTurn,
  CLASSIC_RAT_RACE_BOARD,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue, toApiTransactions } = require('./transaction-repository');
const { decodeGameState } = require('../services/game-state-codec');
const { getSettings } = require('./settings-repository');
const { readHistoryStack, readHistoryLog } = require('../services/game-snapshot');

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
  const { stack } = readHistoryStack(data, session);
  return { state, subscriptions, transactions, allocation, currency, canUndo: stack.length > 0 };
}

/** `GET /game`: where the live game stands and what may be done next. */
async function getGame(deps, userId) {
  const { state, subscriptions, transactions, allocation, currency, canUndo } = await loadGameBooks(
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
    legalActions: legalActions(state, { canUndo }),
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

/** `GET /game/history`: what happened in the running game, oldest step first. */
async function getGameHistory(deps, userId) {
  const data = await loadUserData(deps, userId);
  const session = await getEncryptionSession(deps.authDb, userId);
  return readHistoryLog(data, session);
}

module.exports = {
  getGame,
  getGameHistory,
  listGameSets,
  getGameSet,
  loadGameSets,
  loadGameBooks,
};
