'use strict';

const { initialCashflowGameState } = require('@money/domain');
const { decryptValue } = require('../repositories/transaction-repository');

/**
 * The live game's stored form: `data.cashflowGame`, every string / number / boolean leaf an encrypted string (the browser
 * does this in `encryptForStorage`, database.service.ts), nulls left as they are. `decodeGameState` is the port of the
 * browser's `decryptCashflowGameState` (app-data.service.ts) - the two must read the same document the same way - and
 * `encodeGameState` writes what the browser's save writes.
 */

function decodeGameState(raw, session) {
  if (raw == null) return initialCashflowGameState();
  const str = (value) => decryptValue(value, session);
  const num = (value) => parseInt(str(value), 10) || 0;
  const float = (value) => parseFloat(str(value)) || 0;
  const flag = (value) => String(str(value)) === 'true';
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

function encodeLeaves(value, session) {
  if (Array.isArray(value)) return value.map((item) => encodeLeaves(item, session));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, leaf]) => leaf !== undefined)
        .map(([key, leaf]) => [key, encodeLeaves(leaf, session)]),
    );
  }
  if (value === null || value === undefined) return null;
  return session ? session.encrypt(String(value)) : value;
}

function encodeGameState(state, session) {
  return encodeLeaves(state, session);
}

module.exports = { decodeGameState, encodeGameState };
