'use strict';

/**
 * Transfers: money moved between two of the user's own locations (an ATM withdrawal, crypto to bank, 50 EUR into
 * the shared account), stored at `data.transfers` (todo/locations.md).
 *
 * A transfer is NOT a transaction. It lives in its own list, never enters the transaction stream, and so can never
 * change the income statement, Cashflow, KPIs, budget or any fund: it only moves a balance from one location to
 * another. The same document write that stores a transfer also moves both location balances (the source loses
 * the amount, the destination gains it), so the two can never disagree. No fees: one exact amount moves.
 *
 * Deleting a location keeps its transfers; the missing end simply reads as "a deleted location" (the field is
 * dropped from the stored transfer, never written as null).
 */

const crypto = require('crypto');
const { toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { applyTransferDeltas } = require('../services/location-balance');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');
const {
  decryptValue,
  readLocationIds,
  locationNotFoundError,
} = require('./transaction-repository');

const MAX_WRITE_RETRIES = 10;

function transferError(message) {
  const error = new Error(message);
  error.code = 'TRANSFER_INVALID';
  return error;
}

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptTransfer(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    ...(raw.fromLocationId !== undefined
      ? { fromLocationId: decryptValue(raw.fromLocationId, session) }
      : {}),
    ...(raw.toLocationId !== undefined
      ? { toLocationId: decryptValue(raw.toLocationId, session) }
      : {}),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    date: decryptValue(raw.date, session),
    time: raw.time === undefined || raw.time === '' ? '00:00' : decryptValue(raw.time, session),
    comment: raw.comment === undefined ? '' : decryptValue(raw.comment, session),
  };
}

function encryptTransfer(transfer, session, schemaVersion) {
  return {
    id: writeValue(transfer.id, session),
    ...(transfer.fromLocationId
      ? { fromLocationId: writeValue(transfer.fromLocationId, session) }
      : {}),
    ...(transfer.toLocationId ? { toLocationId: writeValue(transfer.toLocationId, session) } : {}),
    amount: writeValue(toStoredMoney(transfer.amountMinor, schemaVersion), session),
    date: writeValue(transfer.date, session),
    time: writeValue(transfer.time || '00:00', session),
    comment: writeValue(transfer.comment || '', session),
  };
}

function assertStableId(raw) {
  if (raw.id === undefined) throw new Error('Transfer is missing a stable ID');
}

function decryptAllTransfers(rawTransfers, session, schemaVersion) {
  return rawTransfers.map((raw) => {
    assertStableId(raw);
    return decryptTransfer(raw, session, schemaVersion);
  });
}

async function loadUserData({ usersDb, authDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { data: {} };
  }
  const data = userDoc.data || {};
  const session = await getEncryptionSession(authDb, userId);
  const schemaVersion = data.meta?.schemaVersion || 1;
  return { data, session, schemaVersion };
}

async function listTransfers(deps, userId, { locationId } = {}) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const raw = data.transfers || [];
  if (!Array.isArray(raw)) throw new Error('Stored transfers must be an array');
  const transfers = decryptAllTransfers(raw, session, schemaVersion);
  return locationId
    ? transfers.filter((t) => t.fromLocationId === locationId || t.toLocationId === locationId)
    : transfers;
}

async function getTransfer(deps, userId, transferId) {
  const transfers = await listTransfers(deps, userId);
  return transfers.find((transfer) => transfer.id === transferId) || null;
}

/**
 * Read -> mutate -> write-with-retry-on-409. `mutate` gets the still-encrypted transfers and the whole document
 * and returns `null` (nothing to do) or `{ rawTransfers, before, after, result }`, where `before`/`after` are the
 * transfers (API shape) that were removed/added so the two location balances can follow in the same insert.
 */
async function withTransfersWrite({ usersDb, authDb }, userId, mutate) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      userDoc = {
        _id: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {},
      };
    }
    const data = userDoc.data || {};
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = data.meta?.schemaVersion || 1;
    const rawTransfers = data.transfers || [];
    if (!Array.isArray(rawTransfers)) throw new Error('Stored transfers must be an array');

    const mutation = mutate({ data, rawTransfers, session, schemaVersion });
    if (mutation === null) return null;
    const withTransfers = { ...data, transfers: mutation.rawTransfers };
    const updatedData = applyTransferDeltas(
      withTransfers,
      mutation.before,
      mutation.after,
      session,
      schemaVersion,
    );
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: new Date().toISOString() });
      return mutation.result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write transfers after maximum retries due to write conflicts');
}

/** Both ends must exist and differ; an unchanged end that has since vanished is tolerated on edits. */
function assertEnds(data, session, transfer, current) {
  const known = readLocationIds(data, session);
  for (const field of ['fromLocationId', 'toLocationId']) {
    const id = transfer[field];
    if (!id) throw transferError(`${field} is required.`);
    if (!known.has(id) && current?.[field] !== id) throw locationNotFoundError(id);
  }
  if (transfer.fromLocationId === transfer.toLocationId) {
    throw transferError('A transfer needs two different locations.');
  }
}

async function createTransfer(deps, userId, input) {
  return withTransfersWrite(deps, userId, ({ data, rawTransfers, session, schemaVersion }) => {
    const transfer = {
      id: `xfer_${crypto.randomUUID()}`,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      amountMinor: input.amountMinor,
      date: input.date,
      time: input.time || '00:00',
      comment: input.comment || '',
    };
    assertEnds(data, session, transfer);
    return {
      rawTransfers: [...rawTransfers, encryptTransfer(transfer, session, schemaVersion)],
      before: [],
      after: [transfer],
      result: transfer,
    };
  });
}

async function updateTransfer(deps, userId, transferId, patch) {
  return withTransfersWrite(deps, userId, ({ data, rawTransfers, session, schemaVersion }) => {
    const existing = decryptAllTransfers(rawTransfers, session, schemaVersion);
    const index = existing.findIndex((transfer) => transfer.id === transferId);
    if (index === -1) return null;
    const current = existing[index];
    const updated = { ...current, ...patch };
    assertEnds(data, session, updated, current);
    return {
      rawTransfers: rawTransfers.map((raw, i) =>
        i === index ? encryptTransfer(updated, session, schemaVersion) : raw,
      ),
      before: [current],
      after: [updated],
      result: updated,
    };
  });
}

async function deleteTransfer(deps, userId, transferId) {
  return withTransfersWrite(deps, userId, ({ rawTransfers, session, schemaVersion }) => {
    const existing = decryptAllTransfers(rawTransfers, session, schemaVersion);
    const index = existing.findIndex((transfer) => transfer.id === transferId);
    if (index === -1) return null;
    return {
      rawTransfers: rawTransfers.filter((_, i) => i !== index),
      before: [existing[index]],
      after: [],
      result: { id: transferId },
    };
  });
}

/** Whole-account import: validates plaintext transfers and returns them in stored (encrypted) form. */
function prepareImportedTransfers(transfers, session, schemaVersion) {
  const ids = new Set();
  for (const transfer of transfers) {
    if (!transfer || typeof transfer !== 'object')
      throw new Error('Each transfer must be an object');
    if (typeof transfer.id !== 'string' || transfer.id === '') {
      throw new Error('Each transfer needs a string id');
    }
    if (ids.has(transfer.id)) throw new Error(`Duplicate transfer id ${transfer.id}`);
    ids.add(transfer.id);
    if (typeof transfer.amount !== 'number' || !Number.isFinite(transfer.amount)) {
      throw new Error(`Transfer ${transfer.id} needs a finite numeric amount`);
    }
    if (typeof transfer.date !== 'string' || transfer.date === '') {
      throw new Error(`Transfer ${transfer.id} needs a date`);
    }
  }
  return decryptAllTransfers(transfers, null, schemaVersion).map((transfer) =>
    encryptTransfer(transfer, session, schemaVersion),
  );
}

module.exports = {
  listTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  deleteTransfer,
  prepareImportedTransfers,
  decryptAllTransfers,
  encryptTransfer,
};
