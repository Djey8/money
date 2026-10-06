'use strict';

const {
  initialCashflowGameState,
  summarizeGameFinances,
  cashOnHandMinor,
  legalActions,
  gameOutcome,
  currentTurn,
  CLASSIC_RAT_RACE_BOARD,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue, toApiTransactions } = require('./transaction-repository');
const { getSettings } = require('./settings-repository');

/**
 * Cashflow game, read side (todo/cashflow-game-pro.md slice D1). The live game is stored the way the browser writes it:
 * every leaf of `data.cashflowGame` an encrypted string, so `decodeGameState` is the server's port of the browser's
 * `decryptCashflowGameState` (app-data.service.ts) - the two must read the same document the same way.
 */

function decodeGameState(raw, session) {
  if (raw == null) return initialCashflowGameState();
  const str = (value) => decryptValue(value, session);
  const num = (value) => parseInt(str(value), 10) || 0;
  const float = (value) => parseFloat(str(value)) || 0;
  const flag = (value) => str(value) === 'true';
  const nullableStr = (value) => (value == null ? null : str(value));
  const list = (value, map) => (Array.isArray(value) ? value.map(map) : []);
  const drawn = (deck) => list(raw.drawnCardIds?.[deck], str);

  const state = {
    gameSetId: nullableStr(raw.gameSetId),
    professionId: nullableStr(raw.professionId),
    mode: raw.mode != null ? str(raw.mode) : 'companion',
    boardPosition: raw.boardPosition == null ? null : num(raw.boardPosition),
    round: num(raw.round),
    virtualDate: nullableStr(raw.virtualDate),
    children: num(raw.children),
    charityRoundsLeft: num(raw.charityRoundsLeft),
    unemployedRoundsLeft: num(raw.unemployedRoundsLeft),
    gameSubscriptionTitles: list(raw.gameSubscriptionTitles, str),
    drawnCardIds: {
      dealSmall: drawn('dealSmall'),
      dealBig: drawn('dealBig'),
      market: drawn('market'),
      doodad: drawn('doodad'),
    },
    history: list(raw.history, (entry) => ({
      round: num(entry.round),
      virtualDateBefore: str(entry.virtualDateBefore),
      virtualDateAfter: str(entry.virtualDateAfter),
      kind: str(entry.kind),
      createdTransactions: list(entry.createdTransactions, (t) => ({
        account: str(t.account),
        amountMinor: num(t.amountMinor),
        date: str(t.date),
        time: str(t.time),
        category: str(t.category),
        comment: str(t.comment),
      })),
    })),
    assetDeals: list(raw.assetDeals, (d) => ({
      title: str(d.title),
      coins: float(d.coins),
      costMinor: num(d.costMinor),
      ...(d.successOn != null ? { successOn: num(d.successOn) } : {}),
      ...(d.payoutMinor != null ? { payoutMinor: num(d.payoutMinor) } : {}),
      ...(d.recurring != null ? { recurring: flag(d.recurring) } : {}),
      ...(d.rollDue != null ? { rollDue: flag(d.rollDue) } : {}),
      ...(d.split?.shareTag != null ? { split: { shareTag: str(d.split.shareTag) } } : {}),
      stage: str(d.stage),
      ...(d.successText != null ? { successText: str(d.successText) } : {}),
      ...(d.failureText != null ? { failureText: str(d.failureText) } : {}),
    })),
    marketOffers: list(raw.marketOffers, (o) => ({
      title: str(o.title),
      salePriceMinor: num(o.salePriceMinor),
      cardId: str(o.cardId),
      label: str(o.label),
      ...(o.pricePerCoinMinor != null ? { pricePerCoinMinor: num(o.pricePerCoinMinor) } : {}),
    })),
  };
  if (raw.turn != null) {
    state.turn = {
      phase: str(raw.turn.phase),
      count: num(raw.turn.count),
      ...(raw.turn.outcome != null ? { outcome: str(raw.turn.outcome) } : {}),
      ...(Array.isArray(raw.turn.lastRoll) ? { lastRoll: raw.turn.lastRoll.map(num) } : {}),
      ...(raw.turn.pending != null
        ? {
            pending: {
              kind: str(raw.turn.pending.kind),
              spaceIndex: num(raw.turn.pending.spaceIndex),
            },
          }
        : {}),
    };
  }
  if (raw.gameId != null) state.gameId = str(raw.gameId);
  if (raw.gameName != null) state.gameName = str(raw.gameName);
  return state;
}

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

module.exports = { getGame, listGameSets, getGameSet, decodeGameState };
