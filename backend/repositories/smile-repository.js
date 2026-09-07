'use strict';

const crypto = require('crypto');
const { computeProjectTotals, toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;
const SMILE_PHASES = ['idea', 'planning', 'saving', 'ready', 'completed'];

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

/** Decrypts every field of one stored Smile project and computes its read-side bucket totals. */
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

async function loadRawProjects({ usersDb, authDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { data: {} };
  }
  const data = userDoc.data || {};
  const rawProjects = data.smile || [];
  if (!Array.isArray(rawProjects)) throw new Error('Stored smile projects must be an array');
  const session = await getEncryptionSession(authDb, userId);
  const schemaVersion = data.meta?.schemaVersion || 1;
  return { userDoc, data, rawProjects, session, schemaVersion };
}

function assertStableId(rawProject) {
  if (rawProject.id === undefined) {
    throw new Error(
      'Smile project is missing a stable ID; run mm-admin migrate-fund-project-ids --collection smile first',
    );
  }
}

async function listSmileProjects(deps, userId) {
  const { rawProjects, session, schemaVersion } = await loadRawProjects(deps, userId);
  return rawProjects.map((raw) => {
    assertStableId(raw);
    return decryptProject(raw, session, schemaVersion);
  });
}

async function getSmileProject(deps, userId, projectId) {
  const projects = await listSmileProjects(deps, userId);
  return projects.find((project) => project.id === projectId) || null;
}

/** Intentionally doesn't accept `links`/`completionDate` — matching `CreateSmileProjectRequest`'s bucket schema, a bucket's read-side shape (decryptBucket) supports more than creation exposes on purpose; add a bucket's links via a future PATCH once that endpoint exists. */
function buildBucket(bucketInput) {
  const bucket = {
    id: `bucket_${crypto.randomUUID()}`,
    title: bucketInput.title.trim(),
    targetMinor: bucketInput.targetMinor,
    amountMinor: bucketInput.amountMinor || 0,
  };
  if (bucketInput.notes !== undefined) bucket.notes = bucketInput.notes;
  if (bucketInput.targetDate !== undefined) bucket.targetDate = bucketInput.targetDate;
  return bucket;
}

async function createSmileProject({ usersDb, authDb }, userId, input) {
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
    const rawProjects = data.smile || [];
    if (!Array.isArray(rawProjects)) throw new Error('Stored smile projects must be an array');
    const existingProjects = rawProjects.map((raw) => {
      assertStableId(raw);
      return decryptProject(raw, session, schemaVersion);
    });

    const title = input.title.trim();
    if (existingProjects.some((project) => project.title === title)) {
      const error = new Error('A Smile project with this title already exists.');
      error.code = 'SMILE_DUPLICATE_TITLE';
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
      id: `smile_${crypto.randomUUID()}`,
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

    const updatedRawProjects = [...rawProjects, encryptProject(newProject, session, schemaVersion)];
    const updatedData = { ...data, smile: updatedRawProjects };
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return newProject;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to create Smile project after maximum retries due to write conflicts');
}

module.exports = {
  SMILE_PHASES,
  listSmileProjects,
  getSmileProject,
  createSmileProject,
};
