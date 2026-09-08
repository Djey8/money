'use strict';

/**
 * Grow (GROW-1..7) is the investment/idea tracker. Its money-moving actions
 * (buy/sell/dividend/payback/cashflow/deposit) used to be encoded by hand
 * into `Transaction.comment` (`"Buy Share X 10 x 25;"`) and parsed back with
 * `split(' ')` positional indexing — replaced here per PLAN.md D-16 with
 * explicit typed actions backed by `packages/domain/src/grow/actions.ts`'s
 * pure calculators; this repository generates the same canonical comment
 * string those calculators return, so the existing (untouched) Angular UI
 * keeps reading it correctly.
 *
 * `PATCH /grow/{id}` only accepts metadata fields — `amount`/`cashflow`/
 * `share`/`investment`/`liabilitie` are output-only from PATCH's
 * perspective, changed only by the typed actions below (`assertNoMoneyFields`).
 *
 * Title uniqueness is scoped to Grow's own list only: confirmed by reading
 * `add-grow.component.ts`'s `invalidTitle()` directly — it calls
 * `isDuplicateTitle(title, [AppStateService.instance.allGrowProjects])`,
 * a single-list check, not the three-way Smile/Fire/Grow check
 * `docs/discovery/DOMAIN_MODEL.md` describes for a different call site
 * (creating a Smile/Fire project, which does check against Grow too).
 *
 * A typed action loads the Grow project's *kind* (`isAsset`/`share`/
 * `investment`, mutually exclusive, fixed at creation) and the matching
 * standalone Asset/Share/Investment entity plus any attached Liability, all
 * from the SAME read already in `withGrowActionWrite`'s transaction, calls
 * the matching pure calculator in `actions.ts`, and folds the resulting
 * Transaction + Grow patch + linked-entity patch(es) into one atomic
 * CouchDB write — extending the same multi-collection atomicity pattern
 * `share-repository.js`/`investment-repository.js` already established.
 * Every typed-action write also runs `applyDerivedState` (the same
 * transaction-derived-state recompute every other transaction write goes
 * through), so a Buy/Sell Share transaction correctly feeds Smile/Fire fund
 * state and the Income accounting rebuild exactly like one entered by hand.
 *
 * Money fields are integer minor units, per this package's convention;
 * `quantity` fields are plain numbers, matching `share-repository.js`.
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

function decryptOptionalMoney(value, session, schemaVersion) {
  return value === undefined ? undefined : decryptMoney(value, session, schemaVersion);
}

function decryptOptional(value, session) {
  return value === undefined ? undefined : decryptValue(value, session);
}

function decryptBoolean(value, session) {
  const decrypted = decryptValue(value, session);
  return typeof decrypted === 'boolean' ? decrypted : decrypted === 'true';
}

function decryptCategory(raw, session) {
  if (raw === undefined) return undefined;
  return Array.isArray(raw)
    ? raw.map((entry) => decryptValue(entry, session))
    : decryptValue(raw, session);
}

function encryptCategory(category, session) {
  return Array.isArray(category)
    ? category.map((entry) => writeValue(entry, session))
    : writeValue(category, session);
}

/** Omits the key entirely when `value` is `undefined`, keeping the stored shape sparse like the source data. */
function optionalField(key, value, encode) {
  return value === undefined ? {} : { [key]: encode(value) };
}

function decryptLinks(raw, session) {
  return (raw || []).map((link) => ({
    label: decryptValue(link.label, session),
    url: decryptValue(link.url, session),
  }));
}

function encryptLinks(links, session) {
  return (links || []).map((link) => ({
    label: writeValue(link.label, session),
    url: writeValue(link.url, session),
  }));
}

function decryptActionItems(raw, session) {
  return (raw || []).map((item) => ({
    text: decryptValue(item.text, session),
    done: decryptBoolean(item.done, session),
    priority: decryptValue(item.priority, session),
    dueDate: decryptOptional(item.dueDate, session),
  }));
}

function encryptActionItems(items, session) {
  return (items || []).map((item) => ({
    text: writeValue(item.text, session),
    done: writeValue(item.done, session),
    priority: writeValue(item.priority, session),
    ...optionalField('dueDate', item.dueDate, (value) => writeValue(value, session)),
  }));
}

function decryptNotes(raw, session) {
  return (raw || []).map((note) => ({
    text: decryptValue(note.text, session),
    createdAt: decryptValue(note.createdAt, session),
  }));
}

function encryptNotes(notes, session) {
  return (notes || []).map((note) => ({
    text: writeValue(note.text, session),
    createdAt: writeValue(note.createdAt, session),
  }));
}

function decryptEmbeddedShare(raw, session, schemaVersion) {
  if (!raw) return null;
  return {
    tag: decryptValue(raw.tag, session),
    quantity: Number(decryptValue(raw.quantity, session)),
    priceMinor: decryptMoney(raw.price, session, schemaVersion),
  };
}

function encryptEmbeddedShare(share, session, schemaVersion) {
  if (!share) return null;
  return {
    tag: writeValue(share.tag, session),
    quantity: writeValue(share.quantity, session),
    price: writeValue(toStoredMoney(share.priceMinor, schemaVersion), session),
  };
}

function decryptEmbeddedInvestment(raw, session, schemaVersion) {
  if (!raw) return null;
  return {
    tag: decryptValue(raw.tag, session),
    depositMinor: decryptMoney(raw.deposit, session, schemaVersion),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
  };
}

function encryptEmbeddedInvestment(investment, session, schemaVersion) {
  if (!investment) return null;
  return {
    tag: writeValue(investment.tag, session),
    deposit: writeValue(toStoredMoney(investment.depositMinor, schemaVersion), session),
    amount: writeValue(toStoredMoney(investment.amountMinor, schemaVersion), session),
  };
}

function decryptEmbeddedLiabilitie(raw, session, schemaVersion) {
  if (!raw) return null;
  return {
    tag: decryptValue(raw.tag, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    investment: decryptBoolean(raw.investment, session),
    creditMinor: decryptMoney(raw.credit, session, schemaVersion),
  };
}

function encryptEmbeddedLiabilitie(liabilitie, session, schemaVersion) {
  if (!liabilitie) return null;
  return {
    tag: writeValue(liabilitie.tag, session),
    amount: writeValue(toStoredMoney(liabilitie.amountMinor, schemaVersion), session),
    investment: writeValue(liabilitie.investment, session),
    credit: writeValue(toStoredMoney(liabilitie.creditMinor, schemaVersion), session),
  };
}

const MONEY_MINOR_FIELDS = [
  ['currentCost', 'currentCostMinor'],
  ['targetCost', 'targetCostMinor'],
  ['monthlySavings', 'monthlySavingsMinor'],
  ['annualSavings', 'annualSavingsMinor'],
  ['alternativeCost', 'alternativeCostMinor'],
];
const PLAIN_OPTIONAL_FIELDS = ['type', 'reasoning', 'alternative', 'pattern', 'insights', 'status'];

function decryptGrow(raw, session, schemaVersion) {
  const grow = {
    id: decryptValue(raw.id, session),
    title: decryptValue(raw.title, session),
    sub: decryptValue(raw.sub, session),
    phase: decryptValue(raw.phase, session),
    description: decryptValue(raw.description, session),
    strategy: decryptValue(raw.strategy, session),
    riskScore: Number(decryptValue(raw.riskScore, session)),
    risks: decryptValue(raw.risks, session),
    links: decryptLinks(raw.links, session),
    actionItems: decryptActionItems(raw.actionItems, session),
    notes: decryptNotes(raw.notes, session),
    cashflowMinor: decryptMoney(raw.cashflow, session, schemaVersion),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    isAsset: decryptBoolean(raw.isAsset, session),
    share: decryptEmbeddedShare(raw.share, session, schemaVersion),
    investment: decryptEmbeddedInvestment(raw.investment, session, schemaVersion),
    liabilitie: decryptEmbeddedLiabilitie(raw.liabilitie, session, schemaVersion),
    createdAt: decryptValue(raw.createdAt, session),
    updatedAt: decryptValue(raw.updatedAt, session),
    category: decryptCategory(raw.category, session),
  };
  for (const field of PLAIN_OPTIONAL_FIELDS) {
    grow[field] = decryptOptional(raw[field], session);
  }
  for (const [rawField, apiField] of MONEY_MINOR_FIELDS) {
    grow[apiField] = decryptOptionalMoney(raw[rawField], session, schemaVersion);
  }
  return grow;
}

function encryptGrow(grow, session, schemaVersion) {
  const raw = {
    id: writeValue(grow.id, session),
    title: writeValue(grow.title, session),
    sub: writeValue(grow.sub, session),
    phase: writeValue(grow.phase, session),
    description: writeValue(grow.description, session),
    strategy: writeValue(grow.strategy, session),
    riskScore: writeValue(grow.riskScore, session),
    risks: writeValue(grow.risks, session),
    links: encryptLinks(grow.links, session),
    actionItems: encryptActionItems(grow.actionItems, session),
    notes: encryptNotes(grow.notes, session),
    cashflow: writeValue(toStoredMoney(grow.cashflowMinor, schemaVersion), session),
    amount: writeValue(toStoredMoney(grow.amountMinor, schemaVersion), session),
    isAsset: writeValue(grow.isAsset, session),
    share: encryptEmbeddedShare(grow.share, session, schemaVersion),
    investment: encryptEmbeddedInvestment(grow.investment, session, schemaVersion),
    liabilitie: encryptEmbeddedLiabilitie(grow.liabilitie, session, schemaVersion),
    createdAt: writeValue(grow.createdAt, session),
    updatedAt: writeValue(grow.updatedAt, session),
    ...optionalField('category', grow.category, (value) => encryptCategory(value, session)),
  };
  for (const field of PLAIN_OPTIONAL_FIELDS) {
    Object.assign(
      raw,
      optionalField(field, grow[field], (value) => writeValue(value, session)),
    );
  }
  for (const [rawField, apiField] of MONEY_MINOR_FIELDS) {
    Object.assign(
      raw,
      optionalField(rawField, grow[apiField], (value) =>
        writeValue(toStoredMoney(value, schemaVersion), session),
      ),
    );
  }
  return raw;
}

function assertStableId(rawGrow) {
  if (rawGrow.id === undefined) {
    throw new Error(
      'Grow project is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection grow first',
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

function decryptAllGrow(rawGrow, session, schemaVersion) {
  return rawGrow.map((raw) => {
    assertStableId(raw);
    return decryptGrow(raw, session, schemaVersion);
  });
}

async function listGrow(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawGrow = data.grow || [];
  if (!Array.isArray(rawGrow)) throw new Error('Stored grow projects must be an array');
  return decryptAllGrow(rawGrow, session, schemaVersion);
}

async function getGrow(deps, userId, growId) {
  const projects = await listGrow(deps, userId);
  return projects.find((project) => project.id === growId) || null;
}

function assertNoTitleCollision(title, existingTitles) {
  if (existingTitles.includes(title)) {
    const error = new Error('A Grow project with this title already exists.');
    error.code = 'GROW_DUPLICATE_TITLE';
    throw error;
  }
}

const MONEY_FIELDS_OWNED_BY_TYPED_ACTIONS = [
  'amountMinor',
  'cashflowMinor',
  'share',
  'investment',
  'liabilitie',
];

function assertNoMoneyFields(patch) {
  const found = MONEY_FIELDS_OWNED_BY_TYPED_ACTIONS.find((field) => field in patch);
  if (found) {
    const error = new Error(
      `${found} is only changed via the typed action endpoints (POST /grow/{id}/{buy,sell,dividend,payback,cashflow,deposit}), not PATCH.`,
    );
    error.code = 'GROW_MONEY_FIELD_NOT_PATCHABLE';
    throw error;
  }
}

/** Shared read → mutate → write-with-retry-on-409 loop for CRUD (no transaction, no linked-entity writes). */
async function withGrowWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawGrow = data.grow || [];
    if (!Array.isArray(rawGrow)) throw new Error('Stored grow projects must be an array');

    const mutation = mutate({ data, rawGrow, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedRawGrow, result } = mutation;
    const updatedData = { ...data, grow: updatedRawGrow };
    const now = new Date().toISOString();
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write grow projects after maximum retries due to write conflicts');
}

async function createGrow(deps, userId, input) {
  return withGrowWrite(deps, userId, ({ rawGrow, session, schemaVersion }) => {
    const title = input.title.trim();
    const existingTitles = decryptAllGrow(rawGrow, session, schemaVersion).map((p) => p.title);
    assertNoTitleCollision(title, existingTitles);

    const now = new Date().toISOString();
    const newGrow = {
      id: `grow_${crypto.randomUUID()}`,
      title,
      sub: input.sub || '',
      phase: input.phase || 'idea',
      description: input.description || '',
      strategy: input.strategy || '',
      riskScore: input.riskScore || 0,
      risks: input.risks || '',
      links: input.links || [],
      actionItems: input.actionItems || [],
      notes: input.notes || [],
      cashflowMinor: 0,
      amountMinor: 0,
      isAsset: Boolean(input.isAsset),
      share: input.share ? { tag: title, quantity: 0, priceMinor: 0 } : null,
      investment: input.investment ? { tag: title, depositMinor: 0, amountMinor: 0 } : null,
      liabilitie: null,
      createdAt: now,
      updatedAt: now,
      type: input.type,
      category: input.category,
      currentCostMinor: input.currentCostMinor,
      targetCostMinor: input.targetCostMinor,
      monthlySavingsMinor: input.monthlySavingsMinor,
      annualSavingsMinor: input.annualSavingsMinor,
      reasoning: input.reasoning,
      alternative: input.alternative,
      alternativeCostMinor: input.alternativeCostMinor,
      pattern: input.pattern,
      insights: input.insights,
    };
    return {
      updatedRawGrow: [...rawGrow, encryptGrow(newGrow, session, schemaVersion)],
      result: newGrow,
    };
  });
}

const EDITABLE_METADATA_FIELDS = [
  'title',
  'sub',
  'phase',
  'description',
  'strategy',
  'riskScore',
  'risks',
  'links',
  'actionItems',
  'notes',
  'type',
  'category',
  'currentCostMinor',
  'targetCostMinor',
  'monthlySavingsMinor',
  'annualSavingsMinor',
  'reasoning',
  'alternative',
  'alternativeCostMinor',
  'pattern',
  'insights',
  'status',
];

async function updateGrow(deps, userId, growId, patch) {
  assertNoMoneyFields(patch);
  return withGrowWrite(deps, userId, ({ rawGrow, session, schemaVersion }) => {
    const existing = decryptAllGrow(rawGrow, session, schemaVersion);
    const index = existing.findIndex((project) => project.id === growId);
    if (index === -1) return null;
    const current = existing[index];

    let title = current.title;
    if (patch.title !== undefined) {
      title = patch.title.trim();
      if (title !== current.title) {
        const otherTitles = existing
          .filter((project) => project.id !== current.id)
          .map((project) => project.title);
        assertNoTitleCollision(title, otherTitles);
      }
    }

    const updated = { ...current, title };
    for (const field of EDITABLE_METADATA_FIELDS) {
      if (field !== 'title' && patch[field] !== undefined) updated[field] = patch[field];
    }
    updated.updatedAt = new Date().toISOString();

    const updatedRawGrow = rawGrow.map((raw, i) =>
      i === index ? encryptGrow(updated, session, schemaVersion) : raw,
    );
    return { updatedRawGrow, result: updated };
  });
}

async function deleteGrow(deps, userId, growId) {
  return withGrowWrite(deps, userId, ({ rawGrow, session, schemaVersion }) => {
    const existing = decryptAllGrow(rawGrow, session, schemaVersion);
    const index = existing.findIndex((project) => project.id === growId);
    if (index === -1) return null;
    return {
      updatedRawGrow: rawGrow.filter((_, i) => i !== index),
      result: { id: growId },
    };
  });
}

module.exports = {
  listGrow,
  getGrow,
  createGrow,
  updateGrow,
  deleteGrow,
  // Internals re-exported for the typed-action module (backend/repositories/grow-action-repository.js).
  decryptMoney,
  decryptGrow,
  encryptGrow,
  decryptAllGrow,
  assertStableId,
  loadUserData,
  MAX_WRITE_RETRIES,
};
