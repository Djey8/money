'use strict';

/**
 * Smile projects and Fire emergency funds are the same entity with a
 * different storage key (`data.smile` / `data.fire`): same phases, same
 * bucket/link/note/actionItem/payment-plan shapes, same create/edit/delete
 * semantics in the UI (`add-smile`/`info-smile` vs `add-fire`/`info-fire`).
 * They used to be two near-identical files; consolidated here (PLAN.md D-9)
 * so every rule is implemented once. `smile-repository.js` and
 * `fire-repository.js` are thin wrappers keeping their existing exports.
 * Fire's own *allocation* rules differ from Smile's (first bucket /
 * `@<bucket>` routing, auto-completion) — those live in the domain
 * package's fund-state engine, not here.
 */

const crypto = require('crypto');
const {
  computeProjectTotals,
  toMinorUnits,
  calculatePaymentPlan,
  validatePaymentPlan,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');
const { rebuildDerivedState } = require('../services/rebuild-derived');
const { computeWriteEffects } = require('../services/write-effects');
const { cascadeFundRename, createRenamer, renamePlan } = require('../services/fund-rename');
const { applyAllListOps, normalizeActionItem, normalizeNote } = require('../services/list-ops');

function fundError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** Optional bucket fields: `null` removes one on update. */
const OPTIONAL_BUCKET_FIELDS = ['notes', 'links', 'targetDate', 'completionDate'];

function withOptionalBucketFields(bucket, input) {
  const next = { ...bucket };
  for (const field of OPTIONAL_BUCKET_FIELDS) {
    if (input[field] === null) delete next[field];
    else if (input[field] !== undefined) next[field] = input[field];
  }
  return next;
}

/**
 * Item-level bucket edits by bucket id: updates, then removals, then
 * additions. Amounts are never input (rebuilt from transactions).
 */
function applyBucketOps(buckets, patch, newBucket) {
  let next = buckets;
  for (const change of patch.bucketsUpdate || []) {
    const index = next.findIndex((bucket) => bucket.id === change.id);
    if (index === -1) throw fundError('FUND_INVALID_INPUT', `Bucket ${change.id} doesn't exist.`);
    const updated = withOptionalBucketFields(next[index], change);
    if (change.title !== undefined) updated.title = change.title.trim();
    if (change.targetMinor !== undefined) updated.targetMinor = change.targetMinor;
    next = next.map((bucket, i) => (i === index ? updated : bucket));
  }
  for (const id of patch.bucketsRemove || []) {
    if (!next.some((bucket) => bucket.id === id)) {
      throw fundError('FUND_INVALID_INPUT', `Bucket ${id} doesn't exist.`);
    }
    next = next.filter((bucket) => bucket.id !== id);
  }
  return [...next, ...(patch.bucketsAdd || []).map((input) => newBucket(input))];
}

function assertValidBuckets(buckets) {
  if (buckets.length === 0) {
    throw fundError('FUND_INVALID_INPUT', 'A project needs at least one bucket.');
  }
  const seen = new Set();
  for (const bucket of buckets) {
    const key = bucket.title.trim().toLocaleLowerCase();
    if (seen.has(key)) {
      throw fundError(
        'FUND_INVALID_INPUT',
        'Bucket titles must be unique within a project (case-insensitive).',
      );
    }
    seen.add(key);
  }
}

/**
 * Removing a bucket that holds money (or deleting a project with
 * contributions) is refused unless `force`: the money's routing depends on
 * that bucket/project by name. With force, a removed bucket's tags are
 * stripped (fund-rename.js) so the engine redistributes that money under
 * the project's default rule; `effects` shows the result.
 */
function assertNoMoneyLost(current, buckets, force) {
  if (force) return;
  const remaining = new Set(buckets.map((bucket) => bucket.id));
  const funded = current.buckets.filter(
    (bucket) => !remaining.has(bucket.id) && bucket.amountMinor > 0,
  );
  if (funded.length > 0) {
    const list = funded.map((bucket) => `"${bucket.title}" (${bucket.amountMinor})`).join(', ');
    throw fundError(
      'FUND_HAS_MONEY',
      `Removing ${list} would move money already saved in it. Send force: true to remove anyway — its contributions are then redistributed across the remaining buckets by the project's default rule.`,
    );
  }
}

const MAX_WRITE_RETRIES = 10;
const FUND_PHASES = ['idea', 'planning', 'saving', 'ready', 'completed'];

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptLink(raw, session) {
  return { label: decryptValue(raw.label, session), url: decryptValue(raw.url, session) };
}

function decryptNote(raw, session) {
  return { text: decryptValue(raw.text, session), createdAt: decryptValue(raw.createdAt, session) };
}

function decryptActionItem(raw, session) {
  const decryptedDone = decryptValue(raw.done, session);
  const item = {
    text: decryptValue(raw.text, session),
    done: typeof decryptedDone === 'boolean' ? decryptedDone : decryptedDone === 'true',
    priority: decryptValue(raw.priority, session),
  };
  if (raw.dueDate !== undefined) item.dueDate = decryptValue(raw.dueDate, session);
  return item;
}

function decryptBucket(raw, session, schemaVersion) {
  const bucket = {
    id: decryptValue(raw.id, session),
    title: decryptValue(raw.title, session),
    targetMinor: decryptMoney(raw.target, session, schemaVersion),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
  };
  if (raw.notes !== undefined) bucket.notes = decryptValue(raw.notes, session);
  if (raw.links) bucket.links = raw.links.map((link) => decryptLink(link, session));
  if (raw.targetDate !== undefined) bucket.targetDate = decryptValue(raw.targetDate, session);
  if (raw.completionDate !== undefined)
    bucket.completionDate = decryptValue(raw.completionDate, session);
  return bucket;
}

function decryptBoolean(value, session) {
  const decrypted = decryptValue(value, session);
  return typeof decrypted === 'boolean' ? decrypted : decrypted === 'true';
}

/**
 * Decrypts one stored payment plan (`PlannedSubscription` in the original
 * app's `plannedSubscriptions` array). Only `status: 'planned'` entries are
 * ever produced by this API today (`POST /smile/{id}/payment-plan` — see
 * `docs/domain/PAYMENT_PLAN_FORMULA.md`); `activatedAt`/`deactivatedAt`/
 * `activeSubscriptionId` are decrypted defensively if present (e.g. a plan
 * the original UI itself activated/deactivated) but this API never sets them.
 */
function decryptPlan(raw, session, schemaVersion) {
  const plan = {
    id: decryptValue(raw.id, session),
    title: decryptValue(raw.title, session),
    status: decryptValue(raw.status, session),
    projectType: decryptValue(raw.projectType, session),
    projectTitle: decryptValue(raw.projectTitle, session),
    account: decryptValue(raw.account, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    startDate: decryptValue(raw.startDate, session),
    endDate: decryptValue(raw.endDate, session),
    category: decryptValue(raw.category, session),
    comment: decryptValue(raw.comment, session),
    frequency: decryptValue(raw.frequency, session),
    targetDate: decryptValue(raw.targetDate, session),
    targetBucketIds: (raw.targetBucketIds || []).map((id) => decryptValue(id, session)),
    originalCalculatedAmountMinor: decryptMoney(
      raw.originalCalculatedAmount,
      session,
      schemaVersion,
    ),
    manuallyAdjusted: decryptBoolean(raw.manuallyAdjusted, session),
    createdAt: decryptValue(raw.createdAt, session),
    updatedAt: decryptValue(raw.updatedAt, session),
  };
  if (raw.activatedAt !== undefined) plan.activatedAt = decryptValue(raw.activatedAt, session);
  if (raw.deactivatedAt !== undefined)
    plan.deactivatedAt = decryptValue(raw.deactivatedAt, session);
  if (raw.activeSubscriptionId !== undefined) {
    plan.activeSubscriptionId = decryptValue(raw.activeSubscriptionId, session);
  }
  return plan;
}

/** Decrypts every field of one stored Smile/Fire project and computes its read-side bucket totals. */
function decryptProject(raw, session, schemaVersion) {
  const buckets = (raw.buckets || []).map((bucket) =>
    decryptBucket(bucket, session, schemaVersion),
  );
  const project = {
    id: decryptValue(raw.id, session),
    title: decryptValue(raw.title, session),
    sub: decryptValue(raw.sub, session) || '',
    phase: decryptValue(raw.phase, session),
    description: decryptValue(raw.description, session) || '',
    buckets,
    totals: computeProjectTotals(buckets),
    links: (raw.links || []).map((link) => decryptLink(link, session)),
    actionItems: (raw.actionItems || []).map((item) => decryptActionItem(item, session)),
    notes: (raw.notes || []).map((note) => decryptNote(note, session)),
    plannedSubscriptions: (raw.plannedSubscriptions || []).map((plan) =>
      decryptPlan(plan, session, schemaVersion),
    ),
    createdAt: decryptValue(raw.createdAt, session),
    updatedAt: decryptValue(raw.updatedAt, session),
  };
  if (raw.targetDate !== undefined) project.targetDate = decryptValue(raw.targetDate, session);
  if (raw.completionDate !== undefined)
    project.completionDate = decryptValue(raw.completionDate, session);
  return project;
}

function encryptLink(link, session) {
  return { label: writeValue(link.label, session), url: writeValue(link.url, session) };
}

function encryptNote(note, session) {
  return { text: writeValue(note.text, session), createdAt: writeValue(note.createdAt, session) };
}

function encryptActionItem(item, session) {
  const encrypted = {
    text: writeValue(item.text, session),
    done: writeValue(item.done, session),
    priority: writeValue(item.priority, session),
  };
  if (item.dueDate !== undefined) encrypted.dueDate = writeValue(item.dueDate, session);
  return encrypted;
}

function encryptBucket(bucket, session, schemaVersion) {
  const encrypted = {
    id: writeValue(bucket.id, session),
    title: writeValue(bucket.title, session),
    target: writeValue(toStoredMoney(bucket.targetMinor, schemaVersion), session),
    amount: writeValue(toStoredMoney(bucket.amountMinor, schemaVersion), session),
  };
  if (bucket.notes !== undefined) encrypted.notes = writeValue(bucket.notes, session);
  if (bucket.links) encrypted.links = bucket.links.map((link) => encryptLink(link, session));
  if (bucket.targetDate !== undefined)
    encrypted.targetDate = writeValue(bucket.targetDate, session);
  if (bucket.completionDate !== undefined) {
    encrypted.completionDate = writeValue(bucket.completionDate, session);
  }
  return encrypted;
}

function encryptPlan(plan, session, schemaVersion) {
  const encrypted = {
    id: writeValue(plan.id, session),
    title: writeValue(plan.title, session),
    status: writeValue(plan.status, session),
    projectType: writeValue(plan.projectType, session),
    projectTitle: writeValue(plan.projectTitle, session),
    account: writeValue(plan.account, session),
    amount: writeValue(toStoredMoney(plan.amountMinor, schemaVersion), session),
    startDate: writeValue(plan.startDate, session),
    endDate: writeValue(plan.endDate, session),
    category: writeValue(plan.category, session),
    comment: writeValue(plan.comment, session),
    frequency: writeValue(plan.frequency, session),
    targetDate: writeValue(plan.targetDate, session),
    targetBucketIds: plan.targetBucketIds.map((id) => writeValue(id, session)),
    originalCalculatedAmount: writeValue(
      toStoredMoney(plan.originalCalculatedAmountMinor, schemaVersion),
      session,
    ),
    manuallyAdjusted: writeValue(plan.manuallyAdjusted, session),
    createdAt: writeValue(plan.createdAt, session),
    updatedAt: writeValue(plan.updatedAt, session),
  };
  if (plan.activatedAt !== undefined) encrypted.activatedAt = writeValue(plan.activatedAt, session);
  if (plan.deactivatedAt !== undefined) {
    encrypted.deactivatedAt = writeValue(plan.deactivatedAt, session);
  }
  if (plan.activeSubscriptionId !== undefined) {
    encrypted.activeSubscriptionId = writeValue(plan.activeSubscriptionId, session);
  }
  return encrypted;
}

/** Encrypts a fully-built API-shape project back into the stored representation. */
function encryptProject(project, session, schemaVersion) {
  const encrypted = {
    id: writeValue(project.id, session),
    title: writeValue(project.title, session),
    sub: writeValue(project.sub, session),
    phase: writeValue(project.phase, session),
    description: writeValue(project.description, session),
    buckets: project.buckets.map((bucket) => encryptBucket(bucket, session, schemaVersion)),
    links: project.links.map((link) => encryptLink(link, session)),
    actionItems: project.actionItems.map((item) => encryptActionItem(item, session)),
    notes: project.notes.map((note) => encryptNote(note, session)),
    plannedSubscriptions: (project.plannedSubscriptions || []).map((plan) =>
      encryptPlan(plan, session, schemaVersion),
    ),
    createdAt: writeValue(project.createdAt, session),
    updatedAt: writeValue(project.updatedAt, session),
  };
  if (project.targetDate !== undefined)
    encrypted.targetDate = writeValue(project.targetDate, session);
  if (project.completionDate !== undefined) {
    encrypted.completionDate = writeValue(project.completionDate, session);
  }
  return encrypted;
}

/**
 * @param {{kind: 'smile' | 'fire', label: string, codePrefix: string}} config
 *   `kind` is the storage key and id/`projectType` prefix, `label` the
 *   human name in messages, `codePrefix` the error-code prefix.
 */
function createFundProjectRepository({ kind, label, codePrefix }) {
  async function loadRawProjects({ usersDb, authDb }, userId) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      userDoc = { data: {} };
    }
    const data = userDoc.data || {};
    const rawProjects = data[kind] || [];
    if (!Array.isArray(rawProjects)) throw new Error(`Stored ${kind} projects must be an array`);
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = data.meta?.schemaVersion || 1;
    return { userDoc, data, rawProjects, session, schemaVersion };
  }

  function assertStableId(rawProject) {
    if (rawProject.id === undefined) {
      throw new Error(
        `${label} project is missing a stable ID; run mm-admin migrate-fund-project-ids --collection ${kind} first`,
      );
    }
  }

  async function listProjects(deps, userId) {
    const { rawProjects, session, schemaVersion } = await loadRawProjects(deps, userId);
    return rawProjects.map((raw) => {
      assertStableId(raw);
      return decryptProject(raw, session, schemaVersion);
    });
  }

  async function getProject(deps, userId, projectId) {
    const projects = await listProjects(deps, userId);
    return projects.find((project) => project.id === projectId) || null;
  }

  function decryptAllProjects(rawProjects, session, schemaVersion) {
    return rawProjects.map((raw) => {
      assertStableId(raw);
      return decryptProject(raw, session, schemaVersion);
    });
  }

  /**
   * `existingBucketIds`, when given, lets `buildBucket` preserve an incoming
   * bucket's own `id` if it names an existing bucket of the project being
   * patched (an in-place edit); omitted or unrecognized ids always mint a
   * fresh one (a new bucket). Create never passes this — every bucket at
   * creation time is new. Intentionally doesn't accept `links`/`completionDate`
   * at creation — matching `CreateSmileProjectRequest`'s bucket schema, a
   * bucket's read-side shape (decryptBucket) supports more than creation
   * exposes on purpose.
   */
  function buildBucket(bucketInput, existingBucketIds) {
    const requestedId = bucketInput.id;
    // Consume the id once claimed, so a patch requesting the same existing id
    // twice can't produce two buckets sharing one id — the second request
    // falls through to minting a fresh one instead (route-layer validation
    // rejects this case outright, but the repository stays safe either way).
    let id = `bucket_${crypto.randomUUID()}`;
    if (requestedId && existingBucketIds && existingBucketIds.has(requestedId)) {
      id = requestedId;
      existingBucketIds.delete(requestedId);
    }
    const bucket = {
      id,
      title: bucketInput.title.trim(),
      targetMinor: bucketInput.targetMinor,
      // Never input: bucket amounts are rebuilt from transactions on every write.
      amountMinor: 0,
    };
    return withOptionalBucketFields(bucket, bucketInput);
  }

  /**
   * Shared read → mutate → write-with-retry-on-409 loop for every Smile write
   * (create/update/delete), mirroring `transaction-repository.js`'s
   * `withTransactionsWrite`. `mutate` receives the still-encrypted
   * `rawProjects` array (decrypting is each caller's own responsibility, since
   * create/update/delete each need a different subset decrypted) and returns
   * either `null` (nothing to do — e.g. the target id doesn't exist, no write
   * happens) or `{ updatedRawProjects, result }`.
   */
  /**
   * A returned project is re-read from the rebuilt data, so its bucket
   * amounts (and a Fire project's auto-completion) reflect the rebuild, not
   * the pre-rebuild values the mutation built; every result carries `effects`.
   */
  function withRebuiltResult(result, updatedData, session, schemaVersion, effects) {
    if (result && Array.isArray(result.buckets) && result.id) {
      const raw = (updatedData[kind] || []).find(
        (candidate) => decryptValue(candidate.id, session) === result.id,
      );
      if (raw) return { ...decryptProject(raw, session, schemaVersion), effects };
    }
    return { ...result, effects };
  }

  async function withProjectWrite({ usersDb, authDb }, userId, mutate) {
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
      const rawProjects = data[kind] || [];
      if (!Array.isArray(rawProjects)) throw new Error(`Stored ${kind} projects must be an array`);

      const mutation = mutate({ data, rawProjects, session, schemaVersion });
      if (mutation === null) return null;
      const { updatedRawProjects, result, baseData } = mutation;
      // Bucket amounts are derived from transactions (rebuild-derived.js):
      // any change to titles or targets must rebuild them right away.
      const updatedData = rebuildDerivedState(
        { ...(baseData || data), [kind]: updatedRawProjects },
        session,
        schemaVersion,
      );
      const now = new Date().toISOString();
      try {
        await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
        const effects = computeWriteEffects(data, updatedData, session, schemaVersion);
        return withRebuiltResult(result, updatedData, session, schemaVersion, effects);
      } catch (error) {
        if (error.statusCode !== 409) throw error;
        attempt += 1;
      }
    }
    throw new Error(
      `Failed to write ${label} projects after maximum retries due to write conflicts`,
    );
  }

  async function createProject(deps, userId, input) {
    return withProjectWrite(deps, userId, ({ rawProjects, session, schemaVersion }) => {
      const existingProjects = decryptAllProjects(rawProjects, session, schemaVersion);

      const title = input.title.trim();
      if (existingProjects.some((project) => project.title === title)) {
        const error = new Error(`A ${label} project with this title already exists.`);
        error.code = `${codePrefix}_DUPLICATE_TITLE`;
        throw error;
      }

      const now = new Date().toISOString();
      const buckets = [];
      if (input.targetMinor !== undefined) {
        buckets.push(buildBucket({ title, targetMinor: input.targetMinor }));
      }
      for (const bucketInput of input.buckets || []) {
        buckets.push(buildBucket(bucketInput));
      }

      const phase = input.phase || 'idea';
      const newProject = {
        id: `${kind}_${crypto.randomUUID()}`,
        title,
        sub: input.sub || '',
        phase,
        description: input.description || '',
        buckets,
        totals: computeProjectTotals(buckets),
        links: input.links || [],
        actionItems: (input.actionItems || []).map((item) => ({
          ...item,
          done: item.done || false,
        })),
        notes: (input.notes || []).map((note) => ({ text: note.text, createdAt: now })),
        createdAt: now,
        updatedAt: now,
      };
      if (input.targetDate !== undefined) newProject.targetDate = input.targetDate;
      if (phase === 'completed') newProject.completionDate = now;

      return {
        updatedRawProjects: [...rawProjects, encryptProject(newProject, session, schemaVersion)],
        result: newProject,
      };
    });
  }

  async function updateProject(deps, userId, projectId, patch) {
    return withProjectWrite(deps, userId, ({ data, rawProjects, session, schemaVersion }) => {
      const existingProjects = decryptAllProjects(rawProjects, session, schemaVersion);
      const index = existingProjects.findIndex((project) => project.id === projectId);
      if (index === -1) return null;
      const current = existingProjects[index];
      const now = new Date().toISOString();

      let title = current.title;
      if (patch.title !== undefined) {
        title = patch.title.trim();
        if (
          title !== current.title &&
          existingProjects.some((project, i) => i !== index && project.title === title)
        ) {
          const error = new Error(`A ${label} project with this title already exists.`);
          error.code = `${codePrefix}_DUPLICATE_TITLE`;
          throw error;
        }
      }

      let buckets = current.buckets;
      if (patch.buckets !== undefined) {
        const existingBucketIds = new Set(current.buckets.map((bucket) => bucket.id));
        buckets = patch.buckets.map((bucketInput) => buildBucket(bucketInput, existingBucketIds));
      }
      if (patch.bucketsAdd || patch.bucketsUpdate || patch.bucketsRemove) {
        buckets = applyBucketOps(buckets, patch, (input) => buildBucket(input));
      }
      assertValidBuckets(buckets);
      assertNoMoneyLost(current, buckets, patch.force === true);

      const updatedProject = {
        ...current,
        title,
        sub: patch.sub !== undefined ? patch.sub : current.sub,
        phase: patch.phase !== undefined ? patch.phase : current.phase,
        description: patch.description !== undefined ? patch.description : current.description,
        buckets,
        totals: computeProjectTotals(buckets),
        links: patch.links !== undefined ? patch.links : current.links,
        // `done` is required (not defaulted) here by the route validator
        // — this replaces the whole array, so a missing `done` on an
        // already-done item the caller forgot to echo back must never
        // silently un-complete it the way defaulting to false would.
        actionItems:
          patch.actionItems !== undefined
            ? patch.actionItems.map(normalizeActionItem)
            : current.actionItems,
        notes:
          patch.notes !== undefined
            ? patch.notes.map((note) => normalizeNote(note, now))
            : current.notes,
        updatedAt: now,
      };
      Object.assign(
        updatedProject,
        applyAllListOps(updatedProject, patch, now, 'FUND_INVALID_INPUT'),
      );
      if (patch.targetDate !== undefined) updatedProject.targetDate = patch.targetDate;
      if (patch.completionDate !== undefined) updatedProject.completionDate = patch.completionDate;
      // Mirrors info-smile.component.ts's advancePhase(): moving to 'completed'
      // stamps a completion date if one isn't already set (by this same patch
      // or previously) — but never overwrites an explicit completionDate the
      // caller sent, and never auto-clears one when moving away from 'completed'.
      if (patch.phase === 'completed' && !updatedProject.completionDate) {
        updatedProject.completionDate = now;
      }

      // A rename carries over to transactions, subscriptions and the
      // project's own payment plans (fund-rename.js).
      const renamer = createRenamer(kind, current, updatedProject);
      if (renamer.changed) {
        updatedProject.plannedSubscriptions = (current.plannedSubscriptions || []).map((plan) =>
          renamePlan(plan, renamer, updatedProject),
        );
      }
      const baseData = cascadeFundRename(
        data,
        kind,
        current,
        updatedProject,
        session,
        schemaVersion,
      );
      const updatedRawProjects = rawProjects.map((raw, i) =>
        i === index ? encryptProject(updatedProject, session, schemaVersion) : raw,
      );
      return { updatedRawProjects, result: updatedProject, baseData };
    });
  }

  /**
   * Computes and persists a new payment plan (`status: 'planned'`) onto a
   * Smile project's `plannedSubscriptions` array, matching `savePlan()`'s own
   * create path in `payment-planner-dialog.component.ts` — see
   * `docs/domain/PAYMENT_PLAN_FORMULA.md`. Only creation is in scope
   * (SMILE-7's own catalog entry); activating/deactivating/editing a plan
   * afterwards isn't exposed by this API.
   */
  async function createPaymentPlan(deps, userId, projectId, input) {
    return withProjectWrite(deps, userId, ({ rawProjects, session, schemaVersion }) => {
      const existingProjects = decryptAllProjects(rawProjects, session, schemaVersion);
      const index = existingProjects.findIndex((project) => project.id === projectId);
      if (index === -1) return null;
      const project = existingProjects[index];

      const selectedBucketIds = input.selectedBucketIds || [];
      const knownBucketIds = new Set(project.buckets.map((bucket) => bucket.id));
      if (selectedBucketIds.some((id) => !knownBucketIds.has(id))) {
        const error = new Error(
          'selectedBucketIds must reference existing buckets on this project.',
        );
        error.code = 'PAYMENT_PLAN_INVALID';
        throw error;
      }

      const plan = calculatePaymentPlan({
        projectType: kind,
        projectTitle: project.title,
        planTitle: input.planTitle,
        buckets: project.buckets.map((bucket) => ({
          id: bucket.id,
          title: bucket.title,
          targetMinor: bucket.targetMinor,
          amountMinor: bucket.amountMinor,
        })),
        selectedBucketIds,
        startDate: input.startDate,
        targetDate: input.targetDate,
        frequency: input.frequency,
        account: input.account,
        manualAmountMinor: input.manualAmountMinor,
      });

      const validation = validatePaymentPlan(plan);
      if (!validation.valid) {
        const error = new Error(validation.errors.join(', '));
        error.code = 'PAYMENT_PLAN_INVALID';
        throw error;
      }

      const now = new Date().toISOString();
      const newPlan = {
        ...plan,
        id: `plan_${crypto.randomUUID()}`,
        createdAt: now,
        updatedAt: now,
      };

      const updatedProject = {
        ...project,
        plannedSubscriptions: [...(project.plannedSubscriptions || []), newPlan],
        updatedAt: now,
      };

      const updatedRawProjects = rawProjects.map((raw, i) =>
        i === index ? encryptProject(updatedProject, session, schemaVersion) : raw,
      );
      return { updatedRawProjects, result: newPlan };
    });
  }

  /**
   * Refused while transactions still count toward the project unless
   * `force` — they keep their amounts either way (nothing matches their
   * category any more), but the saved money no longer shows in any project.
   * With force, active payment plans' subscriptions are ended today, as the
   * app does when a plan is deleted (subscription-activation.service.ts).
   */
  async function deleteProject(deps, userId, projectId, { force = false } = {}) {
    return withProjectWrite(deps, userId, ({ data, rawProjects, session, schemaVersion }) => {
      const existingProjects = decryptAllProjects(rawProjects, session, schemaVersion);
      const index = existingProjects.findIndex((project) => project.id === projectId);
      if (index === -1) return null;
      const project = existingProjects[index];
      const saved = project.buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0);
      if (saved > 0 && !force) {
        throw fundError(
          'FUND_HAS_MONEY',
          `"${project.title}" still holds ${saved} (minor units) from its contributions. Send force: true to delete it anyway — the contributions stay as transactions but no longer count toward any project.`,
        );
      }
      const today = new Date().toISOString().slice(0, 10);
      const activePlans = (project.plannedSubscriptions || []).filter(
        (plan) => plan.status === 'active',
      );
      const subscriptions = (data.subscriptions || []).map((raw) => {
        const matches = activePlans.some(
          (plan) =>
            decryptValue(raw.title, session) === plan.title &&
            decryptValue(raw.category, session) === plan.category &&
            decryptValue(raw.frequency, session) === plan.frequency,
        );
        return matches ? { ...raw, endDate: writeValue(today, session) } : raw;
      });
      return {
        updatedRawProjects: rawProjects.filter((_, i) => i !== index),
        result: { id: projectId },
        ...(activePlans.length > 0 && { baseData: { ...data, subscriptions } }),
      };
    });
  }

  return {
    listProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    createPaymentPlan,
    withProjectWrite,
    decryptAllProjects,
  };
}

module.exports = {
  FUND_PHASES,
  createFundProjectRepository,
  // Re-exported for data-repository.js's importUserData, which delegates to
  // each collection's own encrypt logic per D-9 rather than reimplementing it.
  encryptProject,
};
