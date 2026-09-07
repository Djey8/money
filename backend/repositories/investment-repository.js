'use strict';

/**
 * Investments (INV-1/2/3) are `{tag, amountMinor, depositMinor}` records —
 * the same cross-entity tag namespace as Assets/Shares (see
 * `asset-repository.js`'s header comment): a `tag` must not collide with an
 * existing Asset, Share, *or* Investment tag.
 *
 * Confirmed by reading `info-investment.component.ts` directly: editing an
 * Investment's `tag` also renames any `income.revenue.properties` entry
 * whose `tag` matched the old value (`updateInvestment()`'s "update Income
 * properties" loop) — a Property income record is matched to its Investment
 * by tag string, not a foreign key, same convention as everywhere else in
 * this domain (see `CLAUDE.md`'s "entities are keyed by string" note). The
 * original does this as two separate, non-atomic `writeAndSync` calls (the
 * Property rename first, the Investment update second); this repository
 * does both in the same CouchDB document write, a deliberate atomicity
 * improvement — a partial failure here can no longer leave the two
 * collections disagreeing about a renamed tag.
 *
 * Unlike Share (see the not-yet-built `share-repository.js`), editing an
 * Investment never touches a linked Grow project — `Grow.investment` exists
 * on the interface but `info-investment.component.ts` never writes to
 * `data.grow`, confirmed by reading the whole file.
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

function decryptInvestment(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    tag: decryptValue(raw.tag, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    depositMinor: decryptMoney(raw.deposit, session, schemaVersion),
  };
}

function encryptInvestment(investment, session, schemaVersion) {
  return {
    id: writeValue(investment.id, session),
    tag: writeValue(investment.tag, session),
    amount: writeValue(toStoredMoney(investment.amountMinor, schemaVersion), session),
    deposit: writeValue(toStoredMoney(investment.depositMinor, schemaVersion), session),
  };
}

function assertStableId(rawInvestment) {
  if (rawInvestment.id === undefined) {
    throw new Error(
      'Investment is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection investments first',
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

function decryptAllInvestments(rawInvestments, session, schemaVersion) {
  return rawInvestments.map((raw) => {
    assertStableId(raw);
    return decryptInvestment(raw, session, schemaVersion);
  });
}

/** Decrypts just the `tag` of every Asset/Share/Investment entry, mirroring `asset-repository.js`'s `loadExistingTags` — these three arrays share one tag namespace regardless of which is being written to. */
function loadExistingTags(data, session) {
  const tagsOf = (entries) => (entries || []).map((entry) => decryptValue(entry.tag, session));
  return [
    ...tagsOf(data.balance?.asset?.assets),
    ...tagsOf(data.balance?.asset?.shares),
    ...tagsOf(data.balance?.asset?.investments),
  ];
}

async function listInvestments(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawInvestments = data.balance?.asset?.investments || [];
  if (!Array.isArray(rawInvestments)) throw new Error('Stored investments must be an array');
  return decryptAllInvestments(rawInvestments, session, schemaVersion);
}

async function getInvestment(deps, userId, investmentId) {
  const investments = await listInvestments(deps, userId);
  return investments.find((investment) => investment.id === investmentId) || null;
}

/**
 * Renames every `income.revenue.properties` entry whose `tag` equals
 * `oldTag` to `newTag`, still encrypted. Returns the raw properties array
 * unchanged (same reference) if nothing matched, so callers can tell "no
 * cascade needed" apart from "cascade applied" without a second decrypt pass.
 */
function renamePropertyTag(rawProperties, oldTag, newTag, session) {
  let changed = false;
  const updated = rawProperties.map((raw) => {
    if (decryptValue(raw.tag, session) !== oldTag) return raw;
    changed = true;
    return { ...raw, tag: writeValue(newTag, session) };
  });
  return changed ? updated : rawProperties;
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every Investment
 * write, mirroring `asset-repository.js`'s `withAssetsWrite`. `mutate` may
 * additionally return `updatedRawProperties` to cascade a tag rename into
 * `income.revenue.properties` atomically, in the same document write.
 */
async function withInvestmentsWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawInvestments = data.balance?.asset?.investments || [];
    if (!Array.isArray(rawInvestments)) throw new Error('Stored investments must be an array');

    const mutation = mutate({ data, rawInvestments, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedRawInvestments, updatedRawProperties, result } = mutation;
    const updatedData = {
      ...data,
      balance: {
        ...data.balance,
        asset: { ...data.balance?.asset, investments: updatedRawInvestments },
      },
    };
    if (updatedRawProperties !== undefined) {
      updatedData.income = {
        ...data.income,
        revenue: { ...data.income?.revenue, properties: updatedRawProperties },
      };
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
  throw new Error('Failed to write investments after maximum retries due to write conflicts');
}

function assertNoTagCollision(tag, existingTags) {
  if (existingTags.includes(tag)) {
    const error = new Error('An Asset, Share, or Investment with this tag already exists.');
    error.code = 'INVESTMENT_DUPLICATE_TAG';
    throw error;
  }
}

async function createInvestment(deps, userId, input) {
  return withInvestmentsWrite(deps, userId, ({ data, rawInvestments, session, schemaVersion }) => {
    const tag = input.tag.trim();
    assertNoTagCollision(tag, loadExistingTags(data, session));

    const newInvestment = {
      id: `investments_${crypto.randomUUID()}`,
      tag,
      amountMinor: input.amountMinor || 0,
      depositMinor: input.depositMinor || 0,
    };
    return {
      updatedRawInvestments: [
        ...rawInvestments,
        encryptInvestment(newInvestment, session, schemaVersion),
      ],
      result: newInvestment,
    };
  });
}

async function updateInvestment(deps, userId, investmentId, patch) {
  return withInvestmentsWrite(deps, userId, ({ data, rawInvestments, session, schemaVersion }) => {
    const existingInvestments = decryptAllInvestments(rawInvestments, session, schemaVersion);
    const index = existingInvestments.findIndex((investment) => investment.id === investmentId);
    if (index === -1) return null;
    const current = existingInvestments[index];

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

    const updatedInvestment = {
      ...current,
      tag,
      amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : current.amountMinor,
      depositMinor: patch.depositMinor !== undefined ? patch.depositMinor : current.depositMinor,
    };

    const updatedRawInvestments = rawInvestments.map((raw, i) =>
      i === index ? encryptInvestment(updatedInvestment, session, schemaVersion) : raw,
    );

    let updatedRawProperties;
    if (tag !== current.tag) {
      const rawProperties = data.income?.revenue?.properties || [];
      updatedRawProperties = renamePropertyTag(rawProperties, current.tag, tag, session);
    }

    return { updatedRawInvestments, updatedRawProperties, result: updatedInvestment };
  });
}

async function deleteInvestment(deps, userId, investmentId) {
  return withInvestmentsWrite(deps, userId, ({ rawInvestments, session, schemaVersion }) => {
    const existingInvestments = decryptAllInvestments(rawInvestments, session, schemaVersion);
    const index = existingInvestments.findIndex((investment) => investment.id === investmentId);
    if (index === -1) return null;
    return {
      updatedRawInvestments: rawInvestments.filter((_, i) => i !== index),
      result: { id: investmentId },
    };
  });
}

module.exports = {
  listInvestments,
  getInvestment,
  createInvestment,
  updateInvestment,
  deleteInvestment,
};
