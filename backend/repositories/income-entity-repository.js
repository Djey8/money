'use strict';

/**
 * Revenues, Interests, and Properties (REV-1/INT-1/PROP-1) are read-only
 * through this API — deliberately so, confirmed by reading the code rather
 * than assumed. `applyDerivedState` (`transaction-derived-state.js`, Slice 1)
 * unconditionally rebuilds `data.income.revenue.{revenues,interests,properties}`
 * from the *entire* transaction history on every `POST/PATCH/DELETE
 * /transactions` — `summarizeTransactionAccounting`
 * (`packages/domain/src/transactions/accounting.ts`) has no merge step
 * against whatever was previously stored, unlike Smile/Fire's
 * `applyFundProjects`, which does preserve manual `phase`/`completionDate`/
 * bucket overrides across the same recompute. A hypothetical
 * `PATCH /income/{revenues,interests,properties}/{id}` would therefore have
 * its effect silently discarded the next time *any* transaction anywhere in
 * the account is created, updated, or deleted — this is true of the
 * original Angular app's own equivalent (`IncomeStatementService
 * .recalculate()`, the same all-time-cumulative engine flagged in PLAN.md
 * D-22) too, not a gap introduced by this port.
 *
 * `info-interests.component.ts`/`info-properties.component.ts` do offer a
 * direct edit/delete form in the original UI, and `info.component.ts`'s
 * `updateRevenues`/`removeFromReveneus` adjust a Revenue's running total as
 * a side effect of editing/deleting the transaction that produced it — but
 * none of this has a lasting effect independent of transaction history, and
 * no `add-*` component exists for any of the three (a new Revenue/Interest/
 * Property tag is created implicitly the first time a transaction posts an
 * `@`-tagged category against the `Income` account that doesn't already
 * match a Share/Investment tag). Since editing/deleting the underlying
 * transaction is the only operation with a durable effect, that's exactly
 * what's exposed here: `POST/PATCH/DELETE /transactions` (Slice 1) already
 * covers every create/update/delete path for these three, the same way
 * Smile/Fire's Mojo quick-add (SMILE-2) and Liability's "payback" quick-action
 * (LIAB-2) needed no dedicated endpoint of their own.
 *
 * No stable `id` exists for these entries (matched only by `tag`, freshly
 * recomputed every time) — unlike Assets/Shares/Investments/Liabilities,
 * there's nothing here to migrate or address by id.
 */

const { toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptTaggedAmount(raw, session, schemaVersion) {
  return {
    tag: decryptValue(raw.tag, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
  };
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

async function listIncomeEntities(deps, userId, collection) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawEntries = data.income?.revenue?.[collection] || [];
  if (!Array.isArray(rawEntries)) {
    throw new Error(`Stored ${collection} must be an array`);
  }
  return rawEntries.map((raw) => decryptTaggedAmount(raw, session, schemaVersion));
}

async function listRevenues(deps, userId) {
  return listIncomeEntities(deps, userId, 'revenues');
}

async function listInterests(deps, userId) {
  return listIncomeEntities(deps, userId, 'interests');
}

async function listProperties(deps, userId) {
  return listIncomeEntities(deps, userId, 'properties');
}

module.exports = { listRevenues, listInterests, listProperties };
