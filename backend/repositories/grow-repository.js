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
 * Create/PATCH also accept the project's *plan* — `kind`, the embedded
 * `share`/`investment`/`liabilitie` copies, `amountMinor`, `cashflowMinor`
 * — mirroring exactly what the UI's edit panel writes
 * (`info-grow.component.ts`'s `updateGrowProject()`): these are planned
 * values that move no money and create no transaction (`applyPlanFields`).
 * Money only moves through the typed actions in
 * `grow-action-repository.js`. The embedded copies are always tagged with
 * the project's title — the title is the link key to the balance sheet.
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
const { toMinorUnits, normalizeQuantity, multiplyQuantityPrice } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');
const { cascadeGrowRename } = require('../services/grow-rename');

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

function planError(message) {
  const error = new Error(message);
  error.code = 'GROW_INVALID_PLAN';
  return error;
}

function kindOf(project) {
  if (project.isAsset) return 'asset';
  if (project.share) return 'share';
  if (project.investment) return 'investment';
  return null;
}

/** Echoing back a read object is fine, but an embedded copy's `tag` can't diverge from the title — that's what links it to the balance sheet. */
function assertTagMatchesTitle(plan, field, title) {
  if (plan.tag !== undefined && plan.tag !== title) {
    throw planError(
      `${field}.tag must equal the project title ("${title}") — the title is the link key to the balance sheet. Rename the project instead.`,
    );
  }
}

/**
 * Applies the plan fields (see header comment) onto `project`, mirroring
 * `info-grow.component.ts`'s `updateGrowProject()`: switching `kind`
 * initializes an empty embedded copy for the new kind and clears the
 * others; a changed `share` recomputes `amountMinor` as
 * `quantity * price - loan` unless `amountMinor` is given explicitly.
 * Also re-tags every embedded copy with the (possibly just-renamed) title.
 */
function applyPlanFields(project, input) {
  const next = { ...project };
  const { title } = next;
  if (input.kind !== undefined) {
    next.isAsset = input.kind === 'asset';
    next.share =
      input.kind === 'share' ? next.share || { tag: title, quantity: 0, priceMinor: 0 } : null;
    next.investment =
      input.kind === 'investment'
        ? next.investment || { tag: title, depositMinor: 0, amountMinor: 0 }
        : null;
  }
  if (input.share !== undefined) {
    if (!next.share)
      throw planError('share can only be set on a share-kind project (kind: "share").');
    assertTagMatchesTitle(input.share, 'share', title);
    next.share = {
      ...next.share,
      ...(input.share.quantity !== undefined && {
        quantity: normalizeQuantity(input.share.quantity),
      }),
      ...(input.share.priceMinor !== undefined && { priceMinor: input.share.priceMinor }),
    };
  }
  if (input.investment !== undefined) {
    if (!next.investment) {
      throw planError(
        'investment can only be set on an investment-kind project (kind: "investment").',
      );
    }
    assertTagMatchesTitle(input.investment, 'investment', title);
    next.investment = {
      ...next.investment,
      ...(input.investment.depositMinor !== undefined && {
        depositMinor: input.investment.depositMinor,
      }),
      ...(input.investment.amountMinor !== undefined && {
        amountMinor: input.investment.amountMinor,
      }),
    };
  }
  if (input.liabilitie === null) {
    next.liabilitie = null;
  } else if (input.liabilitie !== undefined) {
    assertTagMatchesTitle(input.liabilitie, 'liabilitie', title);
    next.liabilitie = {
      tag: title,
      amountMinor: input.liabilitie.amountMinor ?? next.liabilitie?.amountMinor ?? 0,
      creditMinor: input.liabilitie.creditMinor ?? next.liabilitie?.creditMinor ?? 0,
      investment: false,
    };
  }
  if (input.cashflowMinor !== undefined) next.cashflowMinor = input.cashflowMinor;
  if (input.amountMinor !== undefined) {
    next.amountMinor = input.amountMinor;
  } else if (input.share !== undefined && next.share) {
    next.amountMinor =
      multiplyQuantityPrice(next.share.quantity, next.share.priceMinor) -
      (next.liabilitie?.amountMinor ?? 0);
  }

  if (next.share) next.share = { ...next.share, tag: title };
  if (next.investment) next.investment = { ...next.investment, tag: title };
  if (next.liabilitie) {
    next.liabilitie = { ...next.liabilitie, tag: title, investment: kindOf(next) !== null };
  }
  return next;
}

/** Create's legacy `isAsset`/`share: true`/`investment: true` flags, normalized to `kind` (validated mutually exclusive at the route). */
function createKindFrom(input) {
  if (input.kind !== undefined) return input.kind;
  if (input.isAsset) return 'asset';
  if (input.share) return 'share';
  if (input.investment) return 'investment';
  return undefined;
}

function planInputFrom(input) {
  return {
    kind: createKindFrom(input),
    share: typeof input.share === 'object' ? input.share : undefined,
    investment: typeof input.investment === 'object' ? input.investment : undefined,
    liabilitie: input.liabilitie,
    amountMinor: input.amountMinor,
    cashflowMinor: input.cashflowMinor,
  };
}

/**
 * The UI's edit panel also writes a changed share price through to the
 * standalone balance-sheet Share tagged with the project's title (never its
 * quantity — that only moves through buy/sell). Returns `undefined` when
 * there is nothing to write.
 */
function syncBalanceSharePrice(data, project, previous, session, schemaVersion) {
  if (!project.share || project.share.priceMinor === previous.share?.priceMinor) return undefined;
  const rawShares = data.balance?.asset?.shares || [];
  const index = rawShares.findIndex((raw) => decryptValue(raw.tag, session) === project.title);
  if (index === -1) return undefined;
  const price = writeValue(toStoredMoney(project.share.priceMinor, schemaVersion), session);
  return {
    ...data.balance,
    asset: {
      ...data.balance.asset,
      shares: rawShares.map((raw, i) => (i === index ? { ...raw, price } : raw)),
    },
  };
}

/** Shared read → mutate → write-with-retry-on-409 loop for CRUD (no transaction; at most a balance-sheet share price sync). */
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
    const { updatedRawGrow, updatedBalance, baseData, result } = mutation;
    const updatedData = {
      ...(baseData || data),
      grow: updatedRawGrow,
      ...(updatedBalance && { balance: updatedBalance }),
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
  throw new Error('Failed to write grow projects after maximum retries due to write conflicts');
}

async function createGrow(deps, userId, input) {
  return withGrowWrite(deps, userId, ({ rawGrow, session, schemaVersion }) => {
    const title = input.title.trim();
    const existingTitles = decryptAllGrow(rawGrow, session, schemaVersion).map((p) => p.title);
    assertNoTitleCollision(title, existingTitles);

    const now = new Date().toISOString();
    const baseGrow = {
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
      isAsset: false,
      share: null,
      investment: null,
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
      status: input.status,
    };
    const newGrow = applyPlanFields(baseGrow, planInputFrom(input));
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
  return withGrowWrite(deps, userId, ({ data, rawGrow, session, schemaVersion }) => {
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

    const withMetadata = { ...current, title };
    for (const field of EDITABLE_METADATA_FIELDS) {
      if (field !== 'title' && patch[field] !== undefined) withMetadata[field] = patch[field];
    }
    const updated = applyPlanFields(withMetadata, patch);
    updated.updatedAt = new Date().toISOString();

    // A rename carries over to everything linked by the title (grow-rename.js).
    const baseData =
      title === current.title
        ? data
        : cascadeGrowRename(data, current.title, title, session, schemaVersion);
    const updatedRawGrow = rawGrow.map((raw, i) =>
      i === index ? encryptGrow(updated, session, schemaVersion) : raw,
    );
    return {
      updatedRawGrow,
      baseData,
      updatedBalance: syncBalanceSharePrice(baseData, updated, current, session, schemaVersion),
      result: updated,
    };
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
