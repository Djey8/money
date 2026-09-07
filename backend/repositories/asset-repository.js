'use strict';

/**
 * Assets (ASSET-1/2/3) are the simplest balance-sheet entity — just a
 * `{tag, amount}` pair (`TaggedAmount` in the original app), no linked Grow
 * project, no Grow-DSL-generated transaction like Share/Investment editing
 * has (see `src/app/panels/info/info-share/info-share.component.ts`'s own
 * "also updates linked Grow project & interests" note in
 * `docs/discovery/FEATURE_CATALOG.md`) — so this ships independently of the
 * Grow typed-actions/DSL-rewrite work the rest of Slice 4 depends on.
 *
 * A title/tag must be unique not just within Assets, but across Assets,
 * Shares, and Investments combined (`add-asset.component.ts`'s
 * `invalidTitle`, mirrored identically in `add-share.component.ts`/
 * `add-investment.component.ts`) — a `Transaction.category` like `@Car`
 * must unambiguously resolve to one balance-sheet entry. Liabilities have
 * their own separate tag namespace (`add-liabilitie.component.ts` only
 * checks against other liabilities), confirmed by reading the original
 * components directly rather than assumed from symmetry.
 */

const crypto = require('crypto');
const { toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptAsset(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    tag: decryptValue(raw.tag, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
  };
}

function encryptAsset(asset, session, schemaVersion) {
  return {
    id: writeValue(asset.id, session),
    tag: writeValue(asset.tag, session),
    amount: writeValue(toStoredMoney(asset.amountMinor, schemaVersion), session),
  };
}

function assertStableId(rawAsset) {
  if (rawAsset.id === undefined) {
    throw new Error(
      'Asset is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection assets first',
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

function decryptAllAssets(rawAssets, session, schemaVersion) {
  return rawAssets.map((raw) => {
    assertStableId(raw);
    return decryptAsset(raw, session, schemaVersion);
  });
}

/**
 * Decrypts just the `tag` of every Asset/Share/Investment entry, for the
 * cross-entity title-uniqueness check — these three arrays share one tag
 * namespace in the original app, regardless of which of them a caller is
 * writing to. Shares/Investments aren't otherwise addressed by this
 * repository (no CRUD for them yet), so their entries are read here without
 * requiring a stable `id` — only the tag matters for this check.
 */
function loadExistingTags(data, session) {
  const tagsOf = (entries) => (entries || []).map((entry) => decryptValue(entry.tag, session));
  return [
    ...tagsOf(data.balance?.asset?.assets),
    ...tagsOf(data.balance?.asset?.shares),
    ...tagsOf(data.balance?.asset?.investments),
  ];
}

async function listAssets(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawAssets = data.balance?.asset?.assets || [];
  if (!Array.isArray(rawAssets)) throw new Error('Stored assets must be an array');
  return decryptAllAssets(rawAssets, session, schemaVersion);
}

async function getAsset(deps, userId, assetId) {
  const assets = await listAssets(deps, userId);
  return assets.find((asset) => asset.id === assetId) || null;
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every Asset write,
 * mirroring `smile-repository.js`'s `withSmileWrite`. `mutate` receives the
 * still-encrypted `rawAssets` array plus the full `data` document (needed for
 * the cross-entity tag check against Shares/Investments) and returns either
 * `null` (nothing to do) or `{ updatedRawAssets, result }`.
 */
async function withAssetsWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawAssets = data.balance?.asset?.assets || [];
    if (!Array.isArray(rawAssets)) throw new Error('Stored assets must be an array');

    const mutation = mutate({ data, rawAssets, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedRawAssets, result } = mutation;
    const updatedData = {
      ...data,
      balance: { ...data.balance, asset: { ...data.balance?.asset, assets: updatedRawAssets } },
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
  throw new Error('Failed to write assets after maximum retries due to write conflicts');
}

function assertNoTagCollision(tag, existingTags) {
  if (existingTags.includes(tag)) {
    const error = new Error('An Asset, Share, or Investment with this tag already exists.');
    error.code = 'ASSET_DUPLICATE_TAG';
    throw error;
  }
}

async function createAsset(deps, userId, input) {
  return withAssetsWrite(deps, userId, ({ data, rawAssets, session, schemaVersion }) => {
    const tag = input.tag.trim();
    assertNoTagCollision(tag, loadExistingTags(data, session));

    const newAsset = {
      id: `assets_${crypto.randomUUID()}`,
      tag,
      amountMinor: input.amountMinor || 0,
    };
    return {
      updatedRawAssets: [...rawAssets, encryptAsset(newAsset, session, schemaVersion)],
      result: newAsset,
    };
  });
}

async function updateAsset(deps, userId, assetId, patch) {
  return withAssetsWrite(deps, userId, ({ data, rawAssets, session, schemaVersion }) => {
    const existingAssets = decryptAllAssets(rawAssets, session, schemaVersion);
    const index = existingAssets.findIndex((asset) => asset.id === assetId);
    if (index === -1) return null;
    const current = existingAssets[index];

    let tag = current.tag;
    if (patch.tag !== undefined) {
      tag = patch.tag.trim();
      if (tag !== current.tag) {
        const otherTags = loadExistingTags(data, session).filter(
          (existing) => existing !== current.tag,
        );
        assertNoTagCollision(tag, otherTags);
      }
    }

    const updatedAsset = {
      ...current,
      tag,
      amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : current.amountMinor,
    };

    const updatedRawAssets = rawAssets.map((raw, i) =>
      i === index ? encryptAsset(updatedAsset, session, schemaVersion) : raw,
    );
    return { updatedRawAssets, result: updatedAsset };
  });
}

async function deleteAsset(deps, userId, assetId) {
  return withAssetsWrite(deps, userId, ({ rawAssets, session, schemaVersion }) => {
    const existingAssets = decryptAllAssets(rawAssets, session, schemaVersion);
    const index = existingAssets.findIndex((asset) => asset.id === assetId);
    if (index === -1) return null;
    return {
      updatedRawAssets: rawAssets.filter((_, i) => i !== index),
      result: { id: assetId },
    };
  });
}

module.exports = { listAssets, getAsset, createAsset, updateAsset, deleteAsset };
