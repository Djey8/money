'use strict';

/**
 * Liabilities (LIAB-1/2/3) are `{tag, amountMinor, investment, creditMinor}`
 * records — `investment` flags whether this liability is tied to an
 * investment (e.g. a mortgage on a rental property), `creditMinor` tracks
 * the remaining credit/loan amount separately from `amountMinor`.
 *
 * Unlike Assets/Shares/Investments (which share one tag namespace — see
 * `asset-repository.js`'s header comment), Liabilities have their own
 * separate, independent tag namespace: confirmed by reading
 * `add-liabilitie.component.ts`/`info-liabilitie.component.ts` directly —
 * both call `isDuplicateTitle(title, [AppStateService.instance.liabilities], 'tag')`,
 * never checking against assets/shares/investments.
 *
 * The "payback" quick-action (LIAB-2) in `info-liabilitie.component.ts` only
 * pre-fills the Add Transaction panel with a `Payback Liabilitie <amount>
 * <credit>;` comment — it never touches the Liability record itself, so it
 * needs no dedicated endpoint, matching Smile/Fire's Mojo quick-add
 * (SMILE-2), already covered by `POST /transactions` since Slice 1.
 */

const crypto = require('crypto');
const { toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const { assertRenameKeepsGrowLink, syncGrowEmbedded } = require('../services/grow-links');

const MAX_WRITE_RETRIES = 10;

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptBoolean(value, session) {
  const decrypted = decryptValue(value, session);
  return typeof decrypted === 'boolean' ? decrypted : decrypted === 'true';
}

function decryptLiability(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    tag: decryptValue(raw.tag, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    investment: decryptBoolean(raw.investment, session),
    creditMinor: decryptMoney(raw.credit, session, schemaVersion),
  };
}

function encryptLiability(liability, session, schemaVersion) {
  return {
    id: writeValue(liability.id, session),
    tag: writeValue(liability.tag, session),
    amount: writeValue(toStoredMoney(liability.amountMinor, schemaVersion), session),
    investment: writeValue(liability.investment, session),
    credit: writeValue(toStoredMoney(liability.creditMinor, schemaVersion), session),
  };
}

function assertStableId(rawLiability) {
  if (rawLiability.id === undefined) {
    throw new Error(
      'Liability is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection liabilities first',
    );
  }
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
  return { userDoc, data, session, schemaVersion };
}

function decryptAllLiabilities(rawLiabilities, session, schemaVersion) {
  return rawLiabilities.map((raw) => {
    assertStableId(raw);
    return decryptLiability(raw, session, schemaVersion);
  });
}

async function listLiabilities(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawLiabilities = data.balance?.liabilities || [];
  if (!Array.isArray(rawLiabilities)) throw new Error('Stored liabilities must be an array');
  return decryptAllLiabilities(rawLiabilities, session, schemaVersion);
}

async function getLiability(deps, userId, liabilityId) {
  const liabilities = await listLiabilities(deps, userId);
  return liabilities.find((liability) => liability.id === liabilityId) || null;
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every Liability
 * write, mirroring `asset-repository.js`'s `withAssetsWrite`.
 */
async function withLiabilitiesWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawLiabilities = data.balance?.liabilities || [];
    if (!Array.isArray(rawLiabilities)) throw new Error('Stored liabilities must be an array');

    const mutation = mutate({ data, rawLiabilities, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedRawLiabilities, updatedRawGrow, result } = mutation;
    const updatedData = {
      ...data,
      balance: { ...data.balance, liabilities: updatedRawLiabilities },
      ...(updatedRawGrow !== undefined && { grow: updatedRawGrow }),
    };
    const now = new Date().toISOString();
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write liabilities after maximum retries due to write conflicts');
}

function assertNoTagCollision(tag, existingTags) {
  if (existingTags.includes(tag)) {
    const error = new Error('A Liability with this tag already exists.');
    error.code = 'LIABILITY_DUPLICATE_TAG';
    throw error;
  }
}

async function createLiability(deps, userId, input) {
  return withLiabilitiesWrite(deps, userId, ({ rawLiabilities, session, schemaVersion }) => {
    const existingLiabilities = decryptAllLiabilities(rawLiabilities, session, schemaVersion);
    const tag = input.tag.trim();
    assertNoTagCollision(
      tag,
      existingLiabilities.map((liability) => liability.tag),
    );

    const newLiability = {
      id: `liabilities_${crypto.randomUUID()}`,
      tag,
      amountMinor: input.amountMinor || 0,
      investment: input.investment || false,
      creditMinor: input.creditMinor || 0,
    };
    return {
      updatedRawLiabilities: [
        ...rawLiabilities,
        encryptLiability(newLiability, session, schemaVersion),
      ],
      result: newLiability,
    };
  });
}

async function updateLiability(deps, userId, liabilityId, patch) {
  return withLiabilitiesWrite(deps, userId, ({ data, rawLiabilities, session, schemaVersion }) => {
    const existingLiabilities = decryptAllLiabilities(rawLiabilities, session, schemaVersion);
    const index = existingLiabilities.findIndex((liability) => liability.id === liabilityId);
    if (index === -1) return null;
    const current = existingLiabilities[index];

    let tag = current.tag;
    if (patch.tag !== undefined) {
      tag = patch.tag.trim();
      if (tag !== current.tag) {
        assertRenameKeepsGrowLink(data, current.tag, tag, session, { mortgage: true });
        const otherTags = existingLiabilities
          .filter((liability) => liability.id !== current.id)
          .map((liability) => liability.tag);
        assertNoTagCollision(tag, otherTags);
      }
    }

    const updatedLiability = {
      ...current,
      tag,
      amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : current.amountMinor,
      investment: patch.investment !== undefined ? patch.investment : current.investment,
      creditMinor: patch.creditMinor !== undefined ? patch.creditMinor : current.creditMinor,
    };

    const updatedRawLiabilities = rawLiabilities.map((raw, i) =>
      i === index ? encryptLiability(updatedLiability, session, schemaVersion) : raw,
    );
    // A linked Grow project's embedded loan copy follows the edit.
    const rawGrow = data.grow || [];
    const syncedGrow = syncGrowEmbedded(
      rawGrow,
      tag,
      'liabilitie',
      { amount: updatedLiability.amountMinor, credit: updatedLiability.creditMinor },
      session,
      schemaVersion,
    );
    return {
      updatedRawLiabilities,
      updatedRawGrow: syncedGrow === rawGrow ? undefined : syncedGrow,
      result: updatedLiability,
    };
  });
}

async function deleteLiability(deps, userId, liabilityId) {
  return withLiabilitiesWrite(deps, userId, ({ rawLiabilities, session, schemaVersion }) => {
    const existingLiabilities = decryptAllLiabilities(rawLiabilities, session, schemaVersion);
    const index = existingLiabilities.findIndex((liability) => liability.id === liabilityId);
    if (index === -1) return null;
    return {
      updatedRawLiabilities: rawLiabilities.filter((_, i) => i !== index),
      result: { id: liabilityId },
    };
  });
}

module.exports = {
  listLiabilities,
  getLiability,
  createLiability,
  updateLiability,
  deleteLiability,
  // Re-exported for data-repository.js's importUserData (D-9: delegate to
  // each collection's own encrypt logic rather than reimplementing it).
  encryptLiability,
  decryptAllLiabilities,
};
