'use strict';

const { computeMojoStatus, toMinorUnits, MONEY_FIELD_NAMES } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;

/** Decrypts every field of the stored Mojo singleton and normalizes its money fields to integer minor units — same per-field encryption/schema-version handling as the other entity repositories (report-repository.js's `decryptEntry`). */
function decryptMojoEntry(raw, session, schemaVersion) {
  const result = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const decrypted = decryptValue(value, session);
    if (MONEY_FIELD_NAMES.has(key)) {
      const numeric = Number(decrypted);
      result[key] = schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
    } else {
      result[key] = decrypted;
    }
  }
  return result;
}

function toMojoBalance(rawMojo, session, schemaVersion) {
  const decrypted = decryptMojoEntry(rawMojo, session, schemaVersion);
  return { amountMinor: decrypted.amount || 0, targetMinor: decrypted.target || 0 };
}

async function getMojoStatus({ usersDb, authDb }, userId) {
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
  return computeMojoStatus(toMojoBalance(data.mojo, session, schemaVersion));
}

/**
 * Updates only `target` — `amount` is owned by transaction-derived-state
 * (`applyDerivedState` in `transaction-derived-state.js`), never written here,
 * matching the UI's own `info-mojo.component.ts` (only `target` is editable).
 * Retries on a CouchDB write conflict the same way `withTransactionsWrite`
 * does, since a concurrent transaction write recalculating `amount` could
 * race with this.
 */
async function updateMojoTarget({ usersDb, authDb }, userId, targetMinor) {
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
    const existingBalance = toMojoBalance(data.mojo, session, schemaVersion);
    const rawTarget = toStoredMoney(targetMinor, schemaVersion);
    const updatedMojo = { ...(data.mojo || {}), target: writeValue(rawTarget, session) };
    const updatedData = { ...data, mojo: updatedMojo };
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: new Date().toISOString() });
      return computeMojoStatus({ amountMinor: existingBalance.amountMinor, targetMinor });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to update Mojo target after maximum retries due to write conflicts');
}

module.exports = { getMojoStatus, updateMojoTarget };
