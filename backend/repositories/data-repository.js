'use strict';

/**
 * `POST /data/recalculate` (SET-11) — the server-side equivalent of the
 * original app's "Fix Accounting" button
 * (`IncomeStatementService.recalculate()`). Reuses
 * `transaction-repository.js`'s `withTransactionsWrite` read ->
 * recalculate-derived-state -> write-with-retry loop unchanged (per D-9,
 * rather than duplicating it here), passing the existing transactions back
 * as-is so the mutation is a pure forced recalculation — every write
 * already runs `applyDerivedState` (`services/transaction-derived-state.js`)
 * on write, so this endpoint's only job is to force that same recalculation
 * to happen again against whatever is currently stored, useful after a
 * direct data edit (e.g. `POST /data/import`, or manual CouchDB surgery)
 * that could have left the derived aggregates (accounting totals, Mojo,
 * Smile/Fire fund buckets) stale.
 *
 * Guards against a real data-loss trap in the shared recalculation engine:
 * `recalculateFundState` (packages/domain/src/transactions/fund-state.ts)
 * silently excludes any transaction with `amountMinor === 0` from its
 * output — and `withTransactionsWrite` writes back exactly what that
 * engine returns. The Pro API itself never lets a zero-amount transaction
 * be created (`POST`/`PATCH /transactions` both reject `amountMinor: 0`),
 * so this can't happen through normal use of this API — but this endpoint
 * is explicitly meant to run against "whatever is currently stored",
 * including legacy-origin or (once it exists) imported data that predates
 * that validation. Without this guard, calling this endpoint on such an
 * account would silently delete those transactions — the opposite of its
 * "recalculates derived state, never touches your transactions" contract.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decryptDocumentPreservingTypes, transactionFromApi } = require('@money/domain');
const {
  withTransactionsWrite,
  toApiTransactions,
  encryptTransaction,
} = require('./transaction-repository');
const { getEncryptionSession } = require('../services/encryption-session');
const { applyDerivedState, writeValue } = require('../services/transaction-derived-state');
const { decryptAllAssets, encryptAsset } = require('./asset-repository');
const { decryptAllShares, encryptShare } = require('./share-repository');
const { decryptAllInvestments, encryptInvestment } = require('./investment-repository');
const { decryptAllLiabilities, encryptLiability } = require('./liability-repository');
const { decryptAllGrow, encryptGrow } = require('./grow-repository');
const { decryptAllBudgetRows, encryptBudgetRow } = require('./budget-repository');
const { decryptAllSubscriptions, encryptSubscription } = require('./subscription-repository');
const {
  decryptAllProjects: decryptAllSmileProjects,
  encryptProject: encryptSmileProject,
} = require('./smile-repository');
const {
  decryptAllProjects: decryptAllFireProjects,
  encryptProject: encryptFireProject,
} = require('./fire-repository');
const {
  decryptSettings,
  encryptSettings,
  validateSettingsAllocation,
} = require('./settings-repository');

class RecalculateError extends Error {}
class ImportError extends Error {}

const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', 'migration-backups');
const MAX_WRITE_RETRIES = 10;

/**
 * `GET /data/export` (SET-8) — wraps the same full-document read the
 * legacy, session-only `GET /api/data/document` does, with two deliberate
 * corrections:
 *
 * 1. **Always returns plaintext, with correct JSON types**, even when
 *    `encryptDatabase` is on. The legacy route returns the document
 *    exactly as stored — still ciphertext, since only the Angular client
 *    (which already holds the key) can make sense of it. Every other Pro
 *    API read decrypts server-side (ADR-0001), and an exported file is
 *    explicitly meant to be portable/human-readable, so this does too —
 *    using `decryptDocumentPreservingTypes` (packages/domain), which both
 *    decrypts every encrypted leaf regardless of shape/name AND recovers
 *    the original number type for known-numeric fields (encryption always
 *    stores a number as its stringified form, so a naive decrypt-only walk
 *    would hand back `"-12.5"` instead of `-12.5`). Throws if a value looks
 *    encrypted but no key is configured — reachable if `encryptDatabase`
 *    was toggled off without re-encrypting already-stored data (allowed by
 *    `PUT /encryption-config`) — rather than silently returning leftover
 *    ciphertext inside an otherwise-plaintext export.
 * 2. **Never includes the encryption key or config.** This isn't an active
 *    filtering step — `encryptionConfig` lives only on the separate
 *    `authDb` document (`services/encryption-session.js`), never inside
 *    `usersDb`'s `data`, and this function never reads `authDb` for
 *    anything but the decryption session — but it's called out because the
 *    original client-side export (`settings.component.ts`
 *    `exportMigrationData`, SET-8) does bundle the raw key into the
 *    downloaded file, which this deliberately does not replicate.
 */
async function exportUserData({ usersDb, authDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    return { data: {}, createdAt: null, updatedAt: null };
  }
  const session = await getEncryptionSession(authDb, userId);
  const { data } = decryptDocumentPreservingTypes(userDoc.data || {}, {
    decrypt: session ? (value) => session.decrypt(value) : undefined,
  });
  return {
    data,
    createdAt: userDoc.createdAt || null,
    updatedAt: userDoc.updatedAt || null,
  };
}

async function recalculateUserData(deps, userId) {
  const result = await withTransactionsWrite(
    deps,
    userId,
    ({ existingTransactions }) => {
      const zeroAmountCount = existingTransactions.filter((tx) => tx.amountMinor === 0).length;
      if (zeroAmountCount > 0) {
        const error = new RecalculateError(
          `Cannot recalculate: ${zeroAmountCount} stored transaction(s) have a zero amount, which ` +
            'the recalculation engine excludes rather than preserves. Remove or correct them first.',
        );
        error.code = 'RECALCULATE_WOULD_DROP_TRANSACTIONS';
        throw error;
      }
      return {
        allTransactions: existingTransactions,
        buildResult: (effectiveTransactions) => ({
          transactionCount: effectiveTransactions.length,
        }),
      };
    },
    { createIfMissing: false },
  );
  // No document exists yet for this user — nothing to recalculate, same
  // "empty, not an error" treatment listTransactions gives a missing doc.
  return result || { transactionCount: 0 };
}

function writeBackupFile(backupDir, userId, userDoc) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // A short random suffix, not just the millisecond timestamp — this can be
  // called more than once per import (once per write-retry attempt, each
  // against a freshly-read document), and two attempts landing in the same
  // millisecond would otherwise silently overwrite one backup with another.
  const disambiguator = crypto.randomBytes(3).toString('hex');
  const filePath = path.join(backupDir, `${userId}-import-${timestamp}-${disambiguator}.json`);
  fs.writeFileSync(filePath, JSON.stringify(userDoc, null, 2), 'utf8');
  return filePath;
}

/**
 * A genuine `GET /data/export` always includes every collection key, even
 * as an empty array, EXCEPT for a brand-new account that never touched
 * that collection (registration only ever writes `data.info`) — so an
 * absent key is legitimate, but a *present, non-array* value (`null`, a
 * string, an object — a typo'd or corrupted hand-authored import) is not,
 * and must be rejected rather than silently treated as "wipe this
 * collection", matching this codebase's established "reject rather than
 * silently drop" convention (see the zero-amount-transaction guard below).
 */
function requireArrayField(value, fieldName) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    const error = new ImportError(`data.${fieldName} must be an array.`);
    error.code = 'IMPORT_INVALID_DATA';
    throw error;
  }
  return value;
}

/**
 * Same absent-vs-malformed distinction as `requireArrayField`, for a plain
 * object field. Exists because `importedData.balance?.asset?.assets`-style
 * optional chaining makes a malformed *intermediate* object (`balance:
 * null`, `balance: 'x'`, `balance: { asset: 42 }`) indistinguishable from
 * "genuinely absent" by the time it reaches `requireArrayField` on the
 * leaf — every intermediate object a collection is nested under must be
 * validated in its own right, not just the leaf array itself.
 */
function requireObjectField(value, fieldName) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    const error = new ImportError(`data.${fieldName} must be an object.`);
    error.code = 'IMPORT_INVALID_DATA';
    throw error;
  }
  return value;
}

function normalizeSchemaVersion(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

/**
 * Same absent-vs-malformed distinction, for a scalar string field with a
 * default. A bare `value || fallback` (the pattern this replaces) would
 * accept any truthy-but-wrong-type value (an object, an array, `NaN`) —
 * exactly the class of gap that let a malformed `meta.currency` get
 * written straight into storage, silently corrupting the one field every
 * downstream money computation for the account depends on.
 */
function requireOptionalStringField(value, fieldName, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim() === '') {
    const error = new ImportError(`data.${fieldName} must be a non-empty string.`);
    error.code = 'IMPORT_INVALID_DATA';
    throw error;
  }
  return value;
}

/**
 * `POST /data/import` (SET-9) — replaces the entire account with the given
 * data, restoring what `GET /data/export` produced (or a hand-authored
 * equivalent). Requires `{confirm: true}` — this is destructive.
 *
 * Re-encrypts every collection by delegating to that collection's own
 * existing `decryptAllX`/`encryptX` pair (D-9: reuse already-correct,
 * already-tested per-entity logic rather than a second generic mechanism)
 * — `decryptAllX(rawItems, null, schemaVersion)` first, since the import
 * payload is already plaintext; passing `null` as the session makes this a
 * pure normalize-and-validate pass (defaults missing fields, recovers
 * numeric/boolean types if the caller hand-authored the JSON, and — because
 * every `decryptAllX` calls `assertStableId` internally — rejects any item
 * missing a stable id, the same requirement a real export already
 * satisfies). `encryptX(normalized, session, schemaVersion)` second, with
 * the account's real encryption session (or `null`, a no-op, for an
 * unencrypted account).
 *
 * `data.meta`/`data.info` are never encrypted anywhere in this codebase
 * (confirmed against every repository) and are written through unchanged.
 *
 * `data.transactions`/`data.income.*`/`data.mojo.amount`/the Smile-Fire
 * fund buckets' `amount` are never trusted from the import payload directly
 * — those are exactly the fields `applyDerivedState` (the same engine every
 * normal transaction write already runs) recomputes from transaction
 * history, so this always calls it once, last, over the freshly-encrypted
 * document, and takes its output as authoritative. This also means an
 * imported zero-amount transaction is guarded against the same way
 * `recalculateUserData` guards against it: `recalculateFundState` silently
 * drops zero-amount transactions from its output, so importing one would
 * otherwise silently lose it on the very next write.
 *
 * Writes a timestamped backup of the pre-import document (if one exists)
 * before overwriting, mirroring `mm-admin migrate`'s own `writeBackup`
 * pattern, so a bad import is manually recoverable by an operator with
 * server access. Requires the import's `data.meta.schemaVersion` to match
 * the account's current one (when an account already exists) — this never
 * converts between schema versions; that's `mm-admin migrate`'s job.
 *
 * The schema-version check and the backup are both re-validated against a
 * freshly-read document immediately before the write, inside the same
 * retry-on-409 loop the write itself runs in — not just once, up front.
 * An initial read happens first too (to fail fast in the common case and
 * to know which `schemaVersion` to assemble the new document under), but
 * relying on only that read would leave a real gap: if this account had no
 * document yet at that first read but one is created concurrently (another
 * device's first write, or a racing duplicate import) before the write
 * actually happens, an initial-read-only check would silently skip both
 * the version check and the backup for data that's about to be destroyed.
 */
async function importUserData(
  { usersDb, authDb },
  userId,
  input,
  { backupDir = DEFAULT_BACKUP_DIR } = {},
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ImportError('A request body object is required.');
  }
  if (input.confirm !== true) {
    throw new ImportError(
      'confirm must be true to import data — this replaces the entire account.',
    );
  }
  if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) {
    throw new ImportError('data must be an object.');
  }
  const importedData = input.data;

  function checkSchemaVersionAgainst(existingDoc) {
    if (!existingDoc) return;
    const currentSchemaVersion = normalizeSchemaVersion(existingDoc.data?.meta?.schemaVersion);
    if (importedSchemaVersion !== currentSchemaVersion) {
      const error = new ImportError(
        `Import schema version (${importedSchemaVersion}) does not match the account's current ` +
          `schema version (${currentSchemaVersion}). Run mm-admin migrate first if you need to convert.`,
      );
      error.code = 'IMPORT_SCHEMA_VERSION_MISMATCH';
      throw error;
    }
  }

  const importedSchemaVersion = normalizeSchemaVersion(importedData.meta?.schemaVersion);

  let initialDoc = null;
  try {
    initialDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  checkSchemaVersionAgainst(initialDoc); // fail fast in the common (non-racing) case

  const schemaVersion = importedSchemaVersion;
  const session = await getEncryptionSession(authDb, userId);

  let assembledData;
  let apiTransactions;
  try {
    const importedMeta = requireObjectField(importedData.meta, 'meta');
    const importedInfo = requireObjectField(importedData.info, 'info');
    const importedBalance = requireObjectField(importedData.balance, 'balance');
    const importedAsset = requireObjectField(importedBalance.asset, 'balance.asset');
    const importedMojo = requireObjectField(importedData.mojo, 'mojo');
    const importedSettings = requireObjectField(importedData.settings, 'settings');
    const currency = requireOptionalStringField(importedMeta.currency, 'meta.currency', 'EUR');

    // decryptAllocation's own `Number(x ?? default)` only guards against a
    // missing field, not a present-but-wrong-type one (a string/object/NaN
    // silently becomes NaN with no check), and never checks the four
    // values sum to 100 at all — both invariants `PATCH /settings` already
    // enforces on every other write path via this same validator. Only
    // checked when present at all: an absent `allocation` still safely
    // defaults inside `decryptSettings`, exactly like every other absent
    // settings field.
    if (importedSettings.allocation !== undefined) {
      const allocationError = validateSettingsAllocation(importedSettings.allocation);
      if (allocationError) {
        const error = new ImportError(`data.settings.allocation: ${allocationError}`);
        error.code = 'IMPORT_INVALID_DATA';
        throw error;
      }
    }

    assembledData = {
      meta: { ...importedMeta, schemaVersion, currency },
      info: importedInfo,
      settings: encryptSettings(decryptSettings(importedSettings, null), session),
      balance: {
        asset: {
          assets: decryptAllAssets(
            requireArrayField(importedAsset.assets, 'balance.asset.assets'),
            null,
            schemaVersion,
          ).map((item) => encryptAsset(item, session, schemaVersion)),
          shares: decryptAllShares(
            requireArrayField(importedAsset.shares, 'balance.asset.shares'),
            null,
            schemaVersion,
          ).map((item) => encryptShare(item, session, schemaVersion)),
          investments: decryptAllInvestments(
            requireArrayField(importedAsset.investments, 'balance.asset.investments'),
            null,
            schemaVersion,
          ).map((item) => encryptInvestment(item, session, schemaVersion)),
        },
        liabilities: decryptAllLiabilities(
          requireArrayField(importedBalance.liabilities, 'balance.liabilities'),
          null,
          schemaVersion,
        ).map((item) => encryptLiability(item, session, schemaVersion)),
      },
      grow: decryptAllGrow(requireArrayField(importedData.grow, 'grow'), null, schemaVersion).map(
        (item) => encryptGrow(item, session, schemaVersion),
      ),
      budget: decryptAllBudgetRows(
        requireArrayField(importedData.budget, 'budget'),
        null,
        schemaVersion,
      ).map((item) => encryptBudgetRow(item, session, schemaVersion)),
      subscriptions: decryptAllSubscriptions(
        requireArrayField(importedData.subscriptions, 'subscriptions'),
        null,
        schemaVersion,
      ).map((item) => encryptSubscription(item, session, schemaVersion)),
      smile: decryptAllSmileProjects(
        requireArrayField(importedData.smile, 'smile'),
        null,
        schemaVersion,
      ).map((item) => encryptSmileProject(item, session, schemaVersion)),
      fire: decryptAllFireProjects(
        requireArrayField(importedData.fire, 'fire'),
        null,
        schemaVersion,
      ).map((item) => encryptFireProject(item, session, schemaVersion)),
      // `amount` is not written here — it's exclusively owned by
      // applyDerivedState below, matching mojo-repository.js's own
      // updateMojoTarget, which never writes it either.
      mojo: { target: writeValue(importedMojo.target ?? 0, session) },
    };
    apiTransactions = toApiTransactions(
      requireArrayField(importedData.transactions, 'transactions'),
      null,
      schemaVersion,
      currency,
    );
  } catch (error) {
    if (error instanceof ImportError) throw error;
    const wrapped = new ImportError(`Invalid import data: ${error.message}`);
    wrapped.code = 'IMPORT_INVALID_DATA';
    throw wrapped;
  }

  const zeroAmountCount = apiTransactions.filter((tx) => tx.amountMinor === 0).length;
  if (zeroAmountCount > 0) {
    const error = new ImportError(
      `Cannot import: ${zeroAmountCount} transaction(s) have a zero amount, which the recalculation ` +
        'engine excludes rather than preserves. Remove or correct them first.',
    );
    error.code = 'IMPORT_WOULD_DROP_TRANSACTIONS';
    throw error;
  }

  // `applyDerivedState` reads every Smile/Fire bucket target/amount and
  // Mojo's target back out of `assembledData` (via `readNumber`, which
  // throws a plain `Error` for a non-finite value — none of those fields
  // have their own explicit numeric-type check the way `settings.allocation`
  // now does above) — wrapped the same way as the assembly block itself, so
  // a malformed Smile/Fire/Mojo numeric field gives the caller a clean
  // `400 IMPORT_INVALID_DATA` instead of an unwrapped 500.
  let derived;
  let finalData;
  try {
    derived = applyDerivedState(assembledData, apiTransactions, session, schemaVersion);
    finalData = derived.data;
    finalData.transactions = derived.transactions.map((effectiveTransaction) =>
      encryptTransaction(transactionFromApi(effectiveTransaction, schemaVersion), session),
    );
  } catch (error) {
    if (error instanceof ImportError) throw error;
    const wrapped = new ImportError(`Invalid import data: ${error.message}`);
    wrapped.code = 'IMPORT_INVALID_DATA';
    throw wrapped;
  }

  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let current = null;
    try {
      current = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
    // Re-validated against the freshly-read document, not the initial read
    // from before `assembledData`/`applyDerivedState` were computed — closes
    // the race described in this function's doc comment.
    checkSchemaVersionAgainst(current);
    const backupFile = current ? writeBackupFile(backupDir, userId, current) : null;
    const docToWrite = current
      ? { ...current, data: finalData, updatedAt: new Date().toISOString() }
      : {
          _id: userId,
          createdAt: new Date().toISOString(),
          data: finalData,
          updatedAt: new Date().toISOString(),
        };
    try {
      await usersDb.insert(docToWrite);
      return { transactionCount: derived.transactions.length, schemaVersion, backupFile };
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(`Could not write imported data for ${userId}: CouchDB conflict`);
}

module.exports = {
  recalculateUserData,
  RecalculateError,
  exportUserData,
  importUserData,
  ImportError,
};
