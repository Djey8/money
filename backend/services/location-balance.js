'use strict';

const { locationBalanceDeltas, transferBalanceDeltas } = require('@money/domain');
const { fromStoredMoney, readValue, toStoredMoney, writeValue } = require('./stored-values');

/**
 * Adds a map of `{ locationId: deltaMinor }` to the stored location balances. Only locations that exist are
 * touched (a delta for a deleted location is ignored); returns the same `data` object when nothing moved.
 */
function applyDeltaMap(data, deltas, session, schemaVersion) {
  const stored = data.locations;
  if (!Array.isArray(stored) || stored.length === 0) return data;
  if (Object.keys(deltas).length === 0) return data;
  let changed = false;
  const locations = stored.map((location) => {
    const delta = deltas[readValue(location.id, session)];
    if (!delta) return location;
    changed = true;
    const amountMinor = fromStoredMoney(location.amount, session, schemaVersion) + delta;
    return {
      ...location,
      amount: writeValue(toStoredMoney(amountMinor, schemaVersion), session),
    };
  });
  return changed ? { ...data, locations } : data;
}

/**
 * Moves the stored location balances by whatever a transaction-list change books.
 * `before`/`after` are API-shaped transactions (`amountMinor`, `locationId`, `locationSplits`). The new balances
 * are written into the same user document as the transactions, so the two can never disagree.
 */
function applyLocationDeltas(data, before, after, session, schemaVersion) {
  return applyDeltaMap(data, locationBalanceDeltas(before, after), session, schemaVersion);
}

/** The same for transfers between locations: the source loses, the destination gains (never a transaction). */
function applyTransferDeltas(data, before, after, session, schemaVersion) {
  return applyDeltaMap(data, transferBalanceDeltas(before, after), session, schemaVersion);
}

module.exports = { applyLocationDeltas, applyTransferDeltas };
