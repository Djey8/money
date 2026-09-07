'use strict';

/**
 * Fire (emergency fund) projects are structurally identical to Smile
 * projects — same phases, same bucket/link/note/actionItem shapes, same
 * create/edit/delete semantics in the UI (`add-fire.component.ts`,
 * `info-fire.component.ts` mirror `add-smile.component.ts`/
 * `info-smile.component.ts` closely enough that this file deliberately
 * parallels `smile-repository.js` structurally). Kept as a separate file
 * rather than a shared parameterized module — consistent with how
 * `transaction-repository.js`/`mojo-repository.js`/`smile-repository.js`
 * are already separate per-entity files despite sharing patterns (retry-
 * on-409 loops, per-field encrypt/decrypt) — to avoid refactoring the
 * already-shipped, already-reviewed Smile code purely to share this one
 * new consumer.
 */

const crypto = require('crypto');
const { computeProjectTotals, toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;
const FIRE_PHASES = ['idea', 'planning', 'saving', 'ready', 'completed'];

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
  if (raw.completionDate !== undefined) bucket.completionDate = decryptValue(raw.completionDate, session);
  return bucket;
}

/** Decrypts every field of one stored Fire project and computes its read-side bucket totals. */
function decryptProject(raw, session, schemaVersion) {
  const buckets = (raw.buckets || []).map((bucket) => decryptBucket(bucket, session, schemaVersion));
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
    createdAt: decryptValue(raw.createdAt, session),
    updatedAt: decryptValue(raw.updatedAt, session),
  };
  if (raw.targetDate !== undefined) project.targetDate = decryptValue(raw.targetDate, session);
  if (raw.completionDate !== undefined) project.completionDate = decryptValue(raw.completionDate, session);
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
  if (bucket.targetDate !== undefined) encrypted.targetDate = writeValue(bucket.targetDate, session);
  if (bucket.completionDate !== undefined) {
    encrypted.completionDate = writeValue(bucket.completionDate, session);
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
    createdAt: writeValue(project.createdAt, session),
    updatedAt: writeValue(project.updatedAt, session),
  };
  if (project.targetDate !== undefined) encrypted.targetDate = writeValue(project.targetDate, session);
  if (project.completionDate !== undefined) {
    encrypted.completionDate = writeValue(project.completionDate, session);
  }
  return encrypted;
}

function assertStableId(rawProject) {
  if (rawProject.id === undefined) {
    throw new Error(
      'Fire project is missing a stable ID; run mm-admin migrate-fund-project-ids --collection fire first',
    );
  }
}

function decryptAllProjects(rawProjects, session, schemaVersion) {
  return rawProjects.map((raw) => {
    assertStableId(raw);
    return decryptProject(raw, session, schemaVersion);
  });
}

async function listFireProjects({ usersDb, authDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { data: {} };
  }
  const data = userDoc.data || {};
  const rawProjects = data.fire || [];
  if (!Array.isArray(rawProjects)) throw new Error('Stored fire projects must be an array');
  const session = await getEncryptionSession(authDb, userId);
  const schemaVersion = data.meta?.schemaVersion || 1;
  return decryptAllProjects(rawProjects, session, schemaVersion);
}

async function getFireProject(deps, userId, projectId) {
  const projects = await listFireProjects(deps, userId);
  return projects.find((project) => project.id === projectId) || null;
}

/**
 * `existingBucketIds`, when given, lets `buildBucket` preserve an incoming
 * bucket's own `id` if it names an existing bucket of the project being
 * patched (an in-place edit); omitted or unrecognized ids always mint a
 * fresh one (a new bucket). Create never passes this — every bucket at
 * creation time is new. Consumes the id once claimed, so a patch requesting
 * the same existing id twice can't produce two buckets sharing one id.
 */
function buildBucket(bucketInput, existingBucketIds) {
  const requestedId = bucketInput.id;
  let id = `bucket_${crypto.randomUUID()}`;
  if (requestedId && existingBucketIds && existingBucketIds.has(requestedId)) {
    id = requestedId;
    existingBucketIds.delete(requestedId);
  }
  const bucket = {
    id,
    title: bucketInput.title.trim(),
    targetMinor: bucketInput.targetMinor,
    amountMinor: bucketInput.amountMinor || 0,
  };
  if (bucketInput.notes !== undefined) bucket.notes = bucketInput.notes;
  if (bucketInput.targetDate !== undefined) bucket.targetDate = bucketInput.targetDate;
  return bucket;
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop for every Fire write
 * (create/update/delete), mirroring `smile-repository.js`'s
 * `withSmileWrite`/`transaction-repository.js`'s `withTransactionsWrite`.
 * `mutate` receives the still-encrypted `rawProjects` array (decrypting is
 * each caller's own responsibility) and returns either `null` (nothing to
 * do — e.g. the target id doesn't exist, no write happens) or
 * `{ updatedRawProjects, result }`.
 */
async function withFireWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawProjects = data.fire || [];
    if (!Array.isArray(rawProjects)) throw new Error('Stored fire projects must be an array');

    const mutation = mutate({ rawProjects, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedRawProjects, result } = mutation;
    const updatedData = { ...data, fire: updatedRawProjects };
    const now = new Date().toISOString();
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write Fire projects after maximum retries due to write conflicts');
}

async function createFireProject(deps, userId, input) {
  return withFireWrite(deps, userId, ({ rawProjects, session, schemaVersion }) => {
    const existingProjects = decryptAllProjects(rawProjects, session, schemaVersion);

    const title = input.title.trim();
    if (existingProjects.some((project) => project.title === title)) {
      const error = new Error('A Fire project with this title already exists.');
      error.code = 'FIRE_DUPLICATE_TITLE';
      throw error;
    }

    const now = new Date().toISOString();
    const buckets = [];
    if (input.targetMinor !== undefined) {
      buckets.push(buildBucket({ title, targetMinor: input.targetMinor, amountMinor: input.amountMinor }));
    }
    for (const bucketInput of input.buckets || []) {
      buckets.push(buildBucket(bucketInput));
    }

    const phase = input.phase || 'idea';
    const newProject = {
      id: `fire_${crypto.randomUUID()}`,
      title,
      sub: input.sub || '',
      phase,
      description: input.description || '',
      buckets,
      totals: computeProjectTotals(buckets),
      links: input.links || [],
      actionItems: (input.actionItems || []).map((item) => ({ ...item, done: item.done || false })),
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

async function updateFireProject(deps, userId, projectId, patch) {
  return withFireWrite(deps, userId, ({ rawProjects, session, schemaVersion }) => {
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
        const error = new Error('A Fire project with this title already exists.');
        error.code = 'FIRE_DUPLICATE_TITLE';
        throw error;
      }
    }

    let buckets = current.buckets;
    if (patch.buckets !== undefined) {
      const existingBucketIds = new Set(current.buckets.map((bucket) => bucket.id));
      buckets = patch.buckets.map((bucketInput) => buildBucket(bucketInput, existingBucketIds));
    }

    const updatedProject = {
      ...current,
      title,
      sub: patch.sub !== undefined ? patch.sub : current.sub,
      phase: patch.phase !== undefined ? patch.phase : current.phase,
      description: patch.description !== undefined ? patch.description : current.description,
      buckets,
      totals: computeProjectTotals(buckets),
      links: patch.links !== undefined ? patch.links : current.links,
      // `done` is required (not defaulted) here by validatePatchFireProjectInput
      // — this replaces the whole array, so a missing `done` on an
      // already-done item the caller forgot to echo back must never
      // silently un-complete it the way defaulting to false would.
      actionItems: patch.actionItems !== undefined ? patch.actionItems : current.actionItems,
      notes:
        patch.notes !== undefined
          ? patch.notes.map((note) => ({ text: note.text, createdAt: note.createdAt || now }))
          : current.notes,
      updatedAt: now,
    };
    if (patch.targetDate !== undefined) updatedProject.targetDate = patch.targetDate;
    if (patch.completionDate !== undefined) updatedProject.completionDate = patch.completionDate;
    // Mirrors info-fire.component.ts's advancePhase(): moving to 'completed'
    // stamps a completion date if one isn't already set (by this same patch
    // or previously) — but never overwrites an explicit completionDate the
    // caller sent, and never auto-clears one when moving away from 'completed'.
    // Deliberately NOT replicating updateFireEmergencie()'s full-edit-form
    // behavior of clearing completionDate to '' whenever its local text field
    // is empty and phase isn't 'completed' — that's an artifact of the UI
    // always resubmitting its whole local form state, which conflicts with
    // PATCH's "only touch what's sent" contract.
    if (patch.phase === 'completed' && !updatedProject.completionDate) {
      updatedProject.completionDate = now;
    }

    const updatedRawProjects = rawProjects.map((raw, i) =>
      i === index ? encryptProject(updatedProject, session, schemaVersion) : raw,
    );
    return { updatedRawProjects, result: updatedProject };
  });
}

async function deleteFireProject(deps, userId, projectId) {
  return withFireWrite(deps, userId, ({ rawProjects, session, schemaVersion }) => {
    const existingProjects = decryptAllProjects(rawProjects, session, schemaVersion);
    const index = existingProjects.findIndex((project) => project.id === projectId);
    if (index === -1) return null;
    return {
      updatedRawProjects: rawProjects.filter((_, i) => i !== index),
      result: { id: projectId },
    };
  });
}

module.exports = {
  FIRE_PHASES,
  listFireProjects,
  getFireProject,
  createFireProject,
  updateFireProject,
  deleteFireProject,
};
