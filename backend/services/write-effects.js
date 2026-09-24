'use strict';

/**
 * The `effects` report every transaction write returns: exactly what a
 * write changed across the areas a transaction can reach — the income
 * statement, the balance sheet, Smile/Fire buckets, Mojo, and Grow
 * projects — as before → after pairs, so a caller (an agent, or a person
 * reading its output) sees transparently what happened instead of
 * re-reading everything. Only entries that actually changed are listed;
 * an area with no changes is an empty list (or `null` for Mojo).
 *
 * Computed from the stored user `data` immediately before and after the
 * write, inside the same read → write loop, so it describes precisely the
 * write that was persisted. Money is integer minor units.
 */

const { toMinorUnits, isEncryptedValue } = require('@money/domain');

// Local rather than transaction-repository's decryptValue: that module
// requires this one, so importing back would be a require cycle.
function decryptValue(value, session) {
  if (!isEncryptedValue(value)) return value;
  if (!session) throw new Error('Encrypted data requires a configured encryption key');
  return session.decrypt(value);
}

function money(value, session, schemaVersion) {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(decryptValue(value, session));
  if (Number.isNaN(numeric)) return 0;
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function text(value, session) {
  return value === undefined || value === null ? value : decryptValue(value, session);
}

function quantity(value, session) {
  return value === undefined || value === null ? 0 : Number(decryptValue(value, session));
}

const INCOME_SECTIONS = [
  ['revenues', (data) => data.income?.revenue?.revenues],
  ['interests', (data) => data.income?.revenue?.interests],
  ['properties', (data) => data.income?.revenue?.properties],
  ['expenses.daily', (data) => data.income?.expenses?.daily],
  ['expenses.splurge', (data) => data.income?.expenses?.splurge],
  ['expenses.smile', (data) => data.income?.expenses?.smile],
  ['expenses.fire', (data) => data.income?.expenses?.fire],
  ['expenses.mojo', (data) => data.income?.expenses?.mojo],
];

function incomeSnapshot(data, session, schemaVersion) {
  const entries = new Map();
  for (const [section, read] of INCOME_SECTIONS) {
    for (const raw of read(data) || []) {
      const tag = text(raw.tag, session);
      entries.set(`${section}\u0000${tag}`, {
        section,
        tag,
        amountMinor: money(raw.amount, session, schemaVersion),
      });
    }
  }
  return entries;
}

function balanceSnapshot(data, session, schemaVersion) {
  const entries = new Map();
  const add = (type, raw, value) => {
    const tag = text(raw.tag, session);
    entries.set(`${type}\u0000${tag}`, { type, tag, value });
  };
  const asset = data.balance?.asset || {};
  for (const raw of asset.assets || []) {
    add('asset', raw, { amountMinor: money(raw.amount, session, schemaVersion) });
  }
  for (const raw of asset.shares || []) {
    add('share', raw, {
      quantity: quantity(raw.quantity, session),
      priceMinor: money(raw.price, session, schemaVersion),
    });
  }
  for (const raw of asset.investments || []) {
    add('investment', raw, {
      depositMinor: money(raw.deposit, session, schemaVersion),
      amountMinor: money(raw.amount, session, schemaVersion),
    });
  }
  for (const raw of data.balance?.liabilities || []) {
    add('liability', raw, {
      amountMinor: money(raw.amount, session, schemaVersion),
      creditMinor: money(raw.credit, session, schemaVersion),
    });
  }
  return entries;
}

function fundSnapshot(projects, session, schemaVersion) {
  const entries = new Map();
  for (const project of projects || []) {
    const title = text(project.title, session);
    for (const bucket of project.buckets || []) {
      const id = text(bucket.id, session);
      entries.set(`${title}\u0000${id}`, {
        project: title,
        bucket: text(bucket.title, session) || id,
        amountMinor: money(bucket.amount, session, schemaVersion),
      });
    }
  }
  return entries;
}

function embeddedGrowPosition(raw, session, schemaVersion) {
  return {
    amountMinor: money(raw.amount, session, schemaVersion),
    share: raw.share
      ? {
          quantity: quantity(raw.share.quantity, session),
          priceMinor: money(raw.share.price, session, schemaVersion),
        }
      : null,
    investment: raw.investment
      ? {
          depositMinor: money(raw.investment.deposit, session, schemaVersion),
          amountMinor: money(raw.investment.amount, session, schemaVersion),
        }
      : null,
    liabilitie: raw.liabilitie
      ? {
          amountMinor: money(raw.liabilitie.amount, session, schemaVersion),
          creditMinor: money(raw.liabilitie.credit, session, schemaVersion),
        }
      : null,
  };
}

function growSnapshot(data, session, schemaVersion) {
  const entries = new Map();
  for (const raw of data.grow || []) {
    const id = text(raw.id, session);
    const title = text(raw.title, session);
    entries.set(id || title, {
      id,
      title,
      value: embeddedGrowPosition(raw, session, schemaVersion),
    });
  }
  return entries;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function diff(before, after, describe) {
  const changes = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const change = describe(before.get(key), after.get(key));
    if (change) changes.push(change);
  }
  return changes;
}

/**
 * @param {object} beforeData the stored user `data` before the write
 * @param {object} afterData the stored user `data` the write persisted
 */
function computeWriteEffects(beforeData, afterData, session, schemaVersion) {
  const before = beforeData || {};
  const after = afterData || {};

  const incomeStatement = diff(
    incomeSnapshot(before, session, schemaVersion),
    incomeSnapshot(after, session, schemaVersion),
    (b, a) => {
      const beforeMinor = b?.amountMinor ?? 0;
      const afterMinor = a?.amountMinor ?? 0;
      if (beforeMinor === afterMinor) return null;
      const { section, tag } = a || b;
      return { section, tag, beforeMinor, afterMinor };
    },
  );

  const balanceSheet = diff(
    balanceSnapshot(before, session, schemaVersion),
    balanceSnapshot(after, session, schemaVersion),
    (b, a) => {
      if (same(b?.value, a?.value)) return null;
      const { type, tag } = a || b;
      return { type, tag, before: b?.value ?? null, after: a?.value ?? null };
    },
  );

  const fundChanges = (read) =>
    diff(
      fundSnapshot(read(before), session, schemaVersion),
      fundSnapshot(read(after), session, schemaVersion),
      (b, a) => {
        const beforeMinor = b?.amountMinor ?? 0;
        const afterMinor = a?.amountMinor ?? 0;
        if (beforeMinor === afterMinor) return null;
        const { project, bucket } = a || b;
        return { project, bucket, beforeMinor, afterMinor };
      },
    );

  const mojoBefore = money(before.mojo?.amount, session, schemaVersion);
  const mojoAfter = money(after.mojo?.amount, session, schemaVersion);

  const grow = diff(
    growSnapshot(before, session, schemaVersion),
    growSnapshot(after, session, schemaVersion),
    (b, a) => {
      if (same(b?.value, a?.value)) return null;
      const { id, title } = a || b;
      return { id, title, before: b?.value ?? null, after: a?.value ?? null };
    },
  );

  return {
    incomeStatement,
    balanceSheet,
    smile: fundChanges((data) => data.smile),
    fire: fundChanges((data) => data.fire),
    mojo: mojoBefore === mojoAfter ? null : { beforeMinor: mojoBefore, afterMinor: mojoAfter },
    grow,
  };
}

module.exports = { computeWriteEffects };
