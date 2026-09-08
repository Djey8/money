'use strict';

/**
 * Budget rows (BUD-1..7) are `{date: "YYYY-MM", tag: "@Category",
 * amountMinor}` — one row per (month, category) pair, confirmed by reading
 * `add-budget.component.ts` and `plan.component.ts` directly. The original
 * app has no id at all: every write path (the add form, and `plan.component
 * .ts`'s fill-forward/copy/from-subscriptions bulk operations) addresses a
 * row exclusively by the composite `(date, tag)` key via `.find()`/
 * `.findIndex()` over the flat `data.budget` array. This repository adds a
 * stable `id` (via `mm-admin migrate-balance-entity-ids --collection
 * budget`) so `GET/PATCH/DELETE /budget/{id}` has something to address,
 * while keeping `POST /budget`'s upsert-by-(date,tag) semantics exactly as
 * the add form has them: overwrite the existing row's amount if one already
 * matches (date, tag), else create a new row with a fresh id.
 *
 * **`PATCH /budget/{id}` rejects a (date,tag) collision when either
 * changes** (decision 5) — the original `plan.component.ts` never exposes
 * an edit-in-place path for a single row at all (only the add form's
 * upsert, and the bulk ops), so there's no existing behavior to match here;
 * this is a new guard, not a corrected bug, added because every other
 * entity's PATCH in this API already enforces its own uniqueness
 * constraint on rename and Budget's (date, tag) pair is exactly that kind
 * of constraint.
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

function decryptBudgetRow(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    date: decryptValue(raw.date, session),
    tag: decryptValue(raw.tag, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
  };
}

function encryptBudgetRow(row, session, schemaVersion) {
  return {
    id: writeValue(row.id, session),
    date: writeValue(row.date, session),
    tag: writeValue(row.tag, session),
    amount: writeValue(toStoredMoney(row.amountMinor, schemaVersion), session),
  };
}

function assertStableId(rawRow) {
  if (rawRow.id === undefined) {
    throw new Error(
      'Budget row is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection budget first',
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

function decryptAllBudgetRows(rawRows, session, schemaVersion) {
  return rawRows.map((raw) => {
    assertStableId(raw);
    return decryptBudgetRow(raw, session, schemaVersion);
  });
}

async function listBudget(deps, userId, { month } = {}) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawRows = data.budget || [];
  if (!Array.isArray(rawRows)) throw new Error('Stored budget must be an array');
  const rows = decryptAllBudgetRows(rawRows, session, schemaVersion);
  return month ? rows.filter((row) => row.date === month) : rows;
}

async function getBudgetRow(deps, userId, budgetId) {
  const rows = await listBudget(deps, userId);
  return rows.find((row) => row.id === budgetId) || null;
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every Budget
 * write, mirroring `asset-repository.js`'s `withAssetsWrite`. `mutate`
 * receives the still-encrypted `rawRows` array and returns one of:
 * - `null` — nothing to do (e.g. the target id doesn't exist); no write happens.
 * - `{ skipWrite: true, result }` — a no-op outcome (e.g. a fill-forward or
 *   copy that had nothing to do); no write happens, `result` is returned as-is.
 * - `{ updatedRawRows, result }` — the new rows array to persist.
 */
async function withBudgetWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawRows = data.budget || [];
    if (!Array.isArray(rawRows)) throw new Error('Stored budget must be an array');

    const mutation = mutate({ data, rawRows, session, schemaVersion });
    if (mutation === null) return null;
    if (mutation.skipWrite) return mutation.result;
    const { updatedRawRows, result } = mutation;
    const updatedData = { ...data, budget: updatedRawRows };
    const now = new Date().toISOString();
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write budget after maximum retries due to write conflicts');
}

function assertNoDateTagCollision(date, tag, existingRows, { excludeId } = {}) {
  const collides = existingRows.some(
    (row) => row.id !== excludeId && row.date === date && row.tag === tag,
  );
  if (collides) {
    const error = new Error(`A budget row for ${date} / ${tag} already exists.`);
    error.code = 'BUDGET_DUPLICATE_MONTH_TAG';
    throw error;
  }
}

/**
 * `POST /budget` — upsert by (date, tag): overwrites the existing row's
 * amount if one already matches, else creates a new row with a fresh id.
 */
async function upsertBudget(deps, userId, input) {
  return withBudgetWrite(deps, userId, ({ rawRows, session, schemaVersion }) => {
    const existing = decryptAllBudgetRows(rawRows, session, schemaVersion);
    const index = existing.findIndex((row) => row.date === input.date && row.tag === input.tag);
    if (index !== -1) {
      const updated = { ...existing[index], amountMinor: input.amountMinor };
      const updatedRawRows = rawRows.map((raw, i) =>
        i === index ? encryptBudgetRow(updated, session, schemaVersion) : raw,
      );
      return { updatedRawRows, result: updated };
    }
    const newRow = {
      id: `budget_${crypto.randomUUID()}`,
      date: input.date,
      tag: input.tag,
      amountMinor: input.amountMinor,
    };
    return {
      updatedRawRows: [...rawRows, encryptBudgetRow(newRow, session, schemaVersion)],
      result: newRow,
    };
  });
}

async function updateBudgetRow(deps, userId, budgetId, patch) {
  return withBudgetWrite(deps, userId, ({ rawRows, session, schemaVersion }) => {
    const existing = decryptAllBudgetRows(rawRows, session, schemaVersion);
    const index = existing.findIndex((row) => row.id === budgetId);
    if (index === -1) return null;
    const current = existing[index];
    const updated = { ...current, ...patch };

    if (updated.date !== current.date || updated.tag !== current.tag) {
      assertNoDateTagCollision(updated.date, updated.tag, existing, { excludeId: budgetId });
    }

    const updatedRawRows = rawRows.map((raw, i) =>
      i === index ? encryptBudgetRow(updated, session, schemaVersion) : raw,
    );
    return { updatedRawRows, result: updated };
  });
}

async function deleteBudgetRow(deps, userId, budgetId) {
  return withBudgetWrite(deps, userId, ({ rawRows, session, schemaVersion }) => {
    const existing = decryptAllBudgetRows(rawRows, session, schemaVersion);
    const index = existing.findIndex((row) => row.id === budgetId);
    if (index === -1) return null;
    return {
      updatedRawRows: rawRows.filter((_, i) => i !== index),
      result: { id: budgetId },
    };
  });
}

/** `DELETE /budget?month=` — deletes every row for that month, no cascade. */
async function deleteBudgetMonth(deps, userId, month) {
  return withBudgetWrite(deps, userId, ({ rawRows, session, schemaVersion }) => {
    const existing = decryptAllBudgetRows(rawRows, session, schemaVersion);
    const remainingRawRows = rawRows.filter((raw, i) => existing[i].date !== month);
    return {
      updatedRawRows: remainingRawRows,
      result: { month, deletedCount: rawRows.length - remainingRawRows.length },
    };
  });
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const totalMonths = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

const MAX_FILL_FORWARD_LOOKBACK_MONTHS = 120;

/**
 * `POST /budget/fill-forward` — walks backward up to 120 months from
 * `targetMonth` for the nearest prior month with any row, then chain-fills
 * forward month by month to `targetMonth`. Each newly-filled month becomes
 * the source for the next step (true chaining, not always copying from the
 * original last-populated month). Add-only: never overwrites a row that
 * already exists for a given (date, tag), in an intermediate month or the
 * target month — ported from `plan.component.ts`'s `fill()` exactly,
 * including its silent no-op when no prior month has any budget at all.
 */
async function fillForwardBudget(deps, userId, targetMonth) {
  return withBudgetWrite(deps, userId, ({ rawRows, session, schemaVersion }) => {
    const existing = decryptAllBudgetRows(rawRows, session, schemaVersion);

    let lastPopulatedMonth = null;
    for (let back = 1; back <= MAX_FILL_FORWARD_LOOKBACK_MONTHS; back += 1) {
      const candidate = shiftMonth(targetMonth, -back);
      if (existing.some((row) => row.date === candidate)) {
        lastPopulatedMonth = candidate;
        break;
      }
    }
    if (!lastPopulatedMonth) {
      return { skipWrite: true, result: { targetMonth, rowsAdded: 0 } };
    }

    let working = existing;
    let cursor = lastPopulatedMonth;
    while (cursor !== targetMonth) {
      const nextMonth = shiftMonth(cursor, 1);
      const sourceRows = working.filter((row) => row.date === cursor);
      for (const sourceRow of sourceRows) {
        const alreadyExists = working.some(
          (row) => row.date === nextMonth && row.tag === sourceRow.tag,
        );
        if (!alreadyExists) {
          working = [
            ...working,
            {
              id: `budget_${crypto.randomUUID()}`,
              date: nextMonth,
              tag: sourceRow.tag,
              amountMinor: sourceRow.amountMinor,
            },
          ];
        }
      }
      cursor = nextMonth;
    }

    if (working.length === existing.length) {
      return { skipWrite: true, result: { targetMonth, rowsAdded: 0 } };
    }
    return {
      updatedRawRows: working.map((row) => encryptBudgetRow(row, session, schemaVersion)),
      result: { targetMonth, rowsAdded: working.length - existing.length },
    };
  });
}

/**
 * `POST /budget/copy` — copies every row from `fromMonth` into `toMonth`,
 * overwriting an existing target row's amount if one already matches
 * (date, tag) — deliberately different overwrite semantics from
 * `fillForwardBudget`, matching the original app's own two distinct
 * behaviors (`plan.component.ts`'s `copy()`).
 */
async function copyBudget(deps, userId, { fromMonth, toMonth }) {
  return withBudgetWrite(deps, userId, ({ rawRows, session, schemaVersion }) => {
    const existing = decryptAllBudgetRows(rawRows, session, schemaVersion);
    const sourceRows = existing.filter((row) => row.date === fromMonth);
    if (sourceRows.length === 0) {
      return { skipWrite: true, result: { fromMonth, toMonth, rowsCopied: 0 } };
    }

    let working = existing;
    for (const sourceRow of sourceRows) {
      const targetIndex = working.findIndex(
        (row) => row.date === toMonth && row.tag === sourceRow.tag,
      );
      if (targetIndex === -1) {
        working = [
          ...working,
          {
            id: `budget_${crypto.randomUUID()}`,
            date: toMonth,
            tag: sourceRow.tag,
            amountMinor: sourceRow.amountMinor,
          },
        ];
      } else {
        working = working.map((row, i) =>
          i === targetIndex ? { ...row, amountMinor: sourceRow.amountMinor } : row,
        );
      }
    }

    return {
      updatedRawRows: working.map((row) => encryptBudgetRow(row, session, schemaVersion)),
      result: { fromMonth, toMonth, rowsCopied: sourceRows.length },
    };
  });
}

module.exports = {
  listBudget,
  getBudgetRow,
  upsertBudget,
  updateBudgetRow,
  deleteBudgetRow,
  deleteBudgetMonth,
  fillForwardBudget,
  copyBudget,
  // Internals re-exported for the fill-forward/copy/from-subscriptions modules.
  decryptMoney,
  decryptBudgetRow,
  encryptBudgetRow,
  decryptAllBudgetRows,
  assertStableId,
  loadUserData,
  withBudgetWrite,
  assertNoDateTagCollision,
  MAX_WRITE_RETRIES,
};
