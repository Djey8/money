'use strict';

/**
 * Shares (SHARE-1/2/3) are `{tag, quantity, priceMinor}` records — the same
 * cross-entity tag namespace as Assets/Investments (see
 * `asset-repository.js`'s header comment): a `tag` must not collide with an
 * existing Asset, Share, or Investment tag.
 *
 * This is the one balance-sheet entity with real Grow-project coupling,
 * confirmed by reading `info-share.component.ts`'s `updateShare()` directly
 * (deferred in the Investments commit specifically to investigate this):
 *
 * 1. Renaming a Share's `tag` cascades a rename into any `income.revenue.interests`
 *    entry whose `tag` matched the old value — the same string-matched
 *    convention `investment-repository.js` already uses for
 *    `income.revenue.properties`.
 * 2. Independently of any rename, updating `quantity`/`priceMinor` also
 *    updates the embedded `share.quantity`/`share.price` on any Grow project
 *    whose `title` equals the (possibly just-renamed) share tag — a second,
 *    embedded copy of the same data (`Grow.share: Share`) that the original
 *    UI keeps in sync by title match, not a foreign key. This sync always
 *    runs after a successful edit (not only when the tag changes), mirroring
 *    `updateShare()`'s own unconditional "update Grow Projects" loop. Only
 *    `share.quantity`/`share.price` are overwritten — `share.tag` on the
 *    embedded copy is left untouched, matching the original exactly.
 *
 * The original does the Interest rename, the Share update, and the Grow sync
 * as up to three separate, non-atomic `persistence` calls. This repository
 * does all of them in one CouchDB document write — the same atomicity
 * improvement `investment-repository.js` already makes for its own
 * (simpler, single-cascade) case.
 *
 * `quantity` is a plain number, not money — no minor-units conversion,
 * matching `report-repository.js`'s `decryptEntry` treatment of the same
 * field on `data.balance.asset.shares` entries.
 *
 * Deliberate correction: `add-share.component.ts`'s create flow strips
 * spaces from the tag with `title.replace(' ', '')` — a plain-string
 * `replace` only removes the *first* space, so a multi-word title like
 * "Rental Property Fund" becomes "RentalProperty Fund", not "RentalPropertyFund".
 * The evident intent (a ticker-like tag with no internal spaces) is clear
 * from the fact that spaces are stripped at all; this repository strips
 * *every* space instead, on both create and update (the original's edit
 * flow doesn't normalize the tag at all, an inconsistency with create that
 * isn't a deliberate design choice worth replicating).
 */

const crypto = require('crypto');
const { toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;

function normalizeShareTag(tag) {
  return tag.trim().replace(/\s+/g, '');
}

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptShare(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    tag: decryptValue(raw.tag, session),
    quantity: Number(decryptValue(raw.quantity, session)),
    priceMinor: decryptMoney(raw.price, session, schemaVersion),
  };
}

function encryptShare(share, session, schemaVersion) {
  return {
    id: writeValue(share.id, session),
    tag: writeValue(share.tag, session),
    quantity: writeValue(share.quantity, session),
    price: writeValue(toStoredMoney(share.priceMinor, schemaVersion), session),
  };
}

function assertStableId(rawShare) {
  if (rawShare.id === undefined) {
    throw new Error(
      'Share is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection shares first',
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

function decryptAllShares(rawShares, session, schemaVersion) {
  return rawShares.map((raw) => {
    assertStableId(raw);
    return decryptShare(raw, session, schemaVersion);
  });
}

/** Same cross-entity tag namespace as `asset-repository.js`/`investment-repository.js`. */
function loadExistingTags(data, session) {
  const tagsOf = (entries) => (entries || []).map((entry) => decryptValue(entry.tag, session));
  return [
    ...tagsOf(data.balance?.asset?.assets),
    ...tagsOf(data.balance?.asset?.shares),
    ...tagsOf(data.balance?.asset?.investments),
  ];
}

async function listShares(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawShares = data.balance?.asset?.shares || [];
  if (!Array.isArray(rawShares)) throw new Error('Stored shares must be an array');
  return decryptAllShares(rawShares, session, schemaVersion);
}

async function getShare(deps, userId, shareId) {
  const shares = await listShares(deps, userId);
  return shares.find((share) => share.id === shareId) || null;
}

/** Renames every entry whose `tag` equals `oldTag` to `newTag`, still encrypted. Returns the same array reference if nothing matched. */
function renameEntryTag(rawEntries, oldTag, newTag, session) {
  let changed = false;
  const updated = rawEntries.map((raw) => {
    if (decryptValue(raw.tag, session) !== oldTag) return raw;
    changed = true;
    return { ...raw, tag: writeValue(newTag, session) };
  });
  return changed ? updated : rawEntries;
}

/**
 * Syncs `share.quantity`/`share.price` (never `share.tag`) on every Grow
 * project whose `title` equals `tag`, still encrypted. Returns the same
 * array reference if nothing matched.
 */
function syncGrowEmbeddedShare(rawGrowProjects, tag, quantity, priceMinor, session, schemaVersion) {
  let changed = false;
  const updated = rawGrowProjects.map((raw) => {
    if (decryptValue(raw.title, session) !== tag) return raw;
    changed = true;
    return {
      ...raw,
      share: {
        ...raw.share,
        quantity: writeValue(quantity, session),
        price: writeValue(toStoredMoney(priceMinor, schemaVersion), session),
      },
    };
  });
  return changed ? updated : rawGrowProjects;
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every Share write.
 * `mutate` may additionally return `updatedRawInterests` (Interest tag-rename
 * cascade) and/or `updatedRawGrow` (embedded share sync), both folded into
 * the same document write as `updatedRawShares`.
 */
async function withSharesWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawShares = data.balance?.asset?.shares || [];
    if (!Array.isArray(rawShares)) throw new Error('Stored shares must be an array');

    const mutation = mutate({ data, rawShares, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedRawShares, updatedRawInterests, updatedRawGrow, result } = mutation;
    const updatedData = {
      ...data,
      balance: { ...data.balance, asset: { ...data.balance?.asset, shares: updatedRawShares } },
    };
    if (updatedRawInterests !== undefined) {
      updatedData.income = {
        ...data.income,
        revenue: { ...data.income?.revenue, interests: updatedRawInterests },
      };
    }
    if (updatedRawGrow !== undefined) {
      updatedData.grow = updatedRawGrow;
    }
    const now = new Date().toISOString();
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write shares after maximum retries due to write conflicts');
}

function assertNoTagCollision(tag, existingTags) {
  if (existingTags.includes(tag)) {
    const error = new Error('An Asset, Share, or Investment with this tag already exists.');
    error.code = 'SHARE_DUPLICATE_TAG';
    throw error;
  }
}

async function createShare(deps, userId, input) {
  return withSharesWrite(deps, userId, ({ data, rawShares, session, schemaVersion }) => {
    const tag = normalizeShareTag(input.tag);
    assertNoTagCollision(tag, loadExistingTags(data, session));

    const newShare = {
      id: `shares_${crypto.randomUUID()}`,
      tag,
      quantity: input.quantity || 0,
      priceMinor: input.priceMinor || 0,
    };
    return {
      updatedRawShares: [...rawShares, encryptShare(newShare, session, schemaVersion)],
      result: newShare,
    };
  });
}

async function updateShare(deps, userId, shareId, patch) {
  return withSharesWrite(deps, userId, ({ data, rawShares, session, schemaVersion }) => {
    const existingShares = decryptAllShares(rawShares, session, schemaVersion);
    const index = existingShares.findIndex((share) => share.id === shareId);
    if (index === -1) return null;
    const current = existingShares[index];

    let tag = current.tag;
    if (patch.tag !== undefined) {
      tag = normalizeShareTag(patch.tag);
      if (tag !== current.tag) {
        const otherTags = loadExistingTags(data, session).filter(
          (existing) => existing !== current.tag,
        );
        assertNoTagCollision(tag, otherTags);
      }
    }

    const updatedShare = {
      ...current,
      tag,
      quantity: patch.quantity !== undefined ? patch.quantity : current.quantity,
      priceMinor: patch.priceMinor !== undefined ? patch.priceMinor : current.priceMinor,
    };

    const updatedRawShares = rawShares.map((raw, i) =>
      i === index ? encryptShare(updatedShare, session, schemaVersion) : raw,
    );

    let updatedRawInterests;
    if (tag !== current.tag) {
      const rawInterests = data.income?.revenue?.interests || [];
      updatedRawInterests = renameEntryTag(rawInterests, current.tag, tag, session);
    }

    const rawGrow = data.grow || [];
    const updatedRawGrow = syncGrowEmbeddedShare(
      rawGrow,
      tag,
      updatedShare.quantity,
      updatedShare.priceMinor,
      session,
      schemaVersion,
    );

    return {
      updatedRawShares,
      updatedRawInterests,
      updatedRawGrow: updatedRawGrow === rawGrow ? undefined : updatedRawGrow,
      result: updatedShare,
    };
  });
}

async function deleteShare(deps, userId, shareId) {
  return withSharesWrite(deps, userId, ({ rawShares, session, schemaVersion }) => {
    const existingShares = decryptAllShares(rawShares, session, schemaVersion);
    const index = existingShares.findIndex((share) => share.id === shareId);
    if (index === -1) return null;
    return {
      updatedRawShares: rawShares.filter((_, i) => i !== index),
      result: { id: shareId },
    };
  });
}

module.exports = {
  listShares,
  getShare,
  createShare,
  updateShare,
  deleteShare,
  // Re-exported for data-repository.js's importUserData (D-9: delegate to
  // each collection's own encrypt logic rather than reimplementing it).
  encryptShare,
  decryptAllShares,
};
