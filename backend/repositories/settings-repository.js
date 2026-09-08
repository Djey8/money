'use strict';

/**
 * Settings (SET-1,2,3,4,5,10) is a singleton object at `data.settings`.
 * Confirmed by reading `settings.component.ts` directly: today every one of
 * these fields except `username`/`email` lives only in the browser's
 * `localStorage` — there is no CouchDB path for it at all. `email` is owned
 * by `/account` (see `account-repository.js`), not here — the two resources
 * split "personal profile edit" (PLAN.md SET-10 vs. AUTH-6) by field
 * sensitivity: `username` is a cosmetic preference like everything else in
 * this file, `email` has real identity/security weight (uniqueness,
 * session-cookie reissue) and stays with the session-only `/account`
 * endpoints.
 *
 * `language` normalizes the original's six mutually-exclusive booleans
 * (`isEng`/`isDe`/`isEs`/`isFr`/`isCn`/`isAr`) into one enum. `allocation`
 * normalizes the four separately-named `dailyR`/`splurgeR`/`smileR`/`fireR`
 * fields into one nested object; the four values must sum to 100, matching
 * the original's own `changeAllocation()` validation.
 *
 * Confirmed original defaults (`settings.component.ts`): `daily=60,
 * splurge=10, smile=10, fire=20`, `currency='€'`, `theme='light'`,
 * `language='en'`, `dateFormat='dd.MM.yyyy'`, `isEuropeanFormat=true`.
 */

const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;

const DEFAULT_SETTINGS = {
  username: '',
  currency: '€',
  theme: 'light',
  language: 'en',
  dateFormat: 'dd.MM.yyyy',
  isEuropeanFormat: true,
  allocation: { daily: 60, splurge: 10, smile: 10, fire: 20 },
};

function decryptAllocation(raw, session) {
  const allocation = raw || {};
  return {
    daily: Number(decryptValue(allocation.daily, session) ?? DEFAULT_SETTINGS.allocation.daily),
    splurge: Number(
      decryptValue(allocation.splurge, session) ?? DEFAULT_SETTINGS.allocation.splurge,
    ),
    smile: Number(decryptValue(allocation.smile, session) ?? DEFAULT_SETTINGS.allocation.smile),
    fire: Number(decryptValue(allocation.fire, session) ?? DEFAULT_SETTINGS.allocation.fire),
  };
}

function decryptSettings(raw, session) {
  if (!raw) return { ...DEFAULT_SETTINGS, allocation: { ...DEFAULT_SETTINGS.allocation } };
  const decryptOr = (value, fallback) => {
    const decrypted = decryptValue(value, session);
    return decrypted === undefined ? fallback : decrypted;
  };
  const decryptedEuropeanFormat = decryptOr(
    raw.isEuropeanFormat,
    DEFAULT_SETTINGS.isEuropeanFormat,
  );
  return {
    username: decryptOr(raw.username, DEFAULT_SETTINGS.username),
    currency: decryptOr(raw.currency, DEFAULT_SETTINGS.currency),
    theme: decryptOr(raw.theme, DEFAULT_SETTINGS.theme),
    language: decryptOr(raw.language, DEFAULT_SETTINGS.language),
    dateFormat: decryptOr(raw.dateFormat, DEFAULT_SETTINGS.dateFormat),
    // Stored as a raw boolean when unencrypted, or as the string 'true'/'false' once
    // writeValue's `String(value)` round-trips it through an encrypted session. Exhaustive
    // rather than falsy-checked, so a corrupted/legacy value (e.g. 0 or '') defaults sanely
    // instead of silently reading as true — matters once /data/import can write this path
    // directly, bypassing the PATCH route's own `typeof === 'boolean'` validation.
    isEuropeanFormat: [true, 'true'].includes(decryptedEuropeanFormat)
      ? true
      : [false, 'false'].includes(decryptedEuropeanFormat)
        ? false
        : DEFAULT_SETTINGS.isEuropeanFormat,
    allocation: decryptAllocation(raw.allocation, session),
  };
}

function encryptSettings(settings, session) {
  return {
    username: writeValue(settings.username, session),
    currency: writeValue(settings.currency, session),
    theme: writeValue(settings.theme, session),
    language: writeValue(settings.language, session),
    dateFormat: writeValue(settings.dateFormat, session),
    isEuropeanFormat: writeValue(settings.isEuropeanFormat, session),
    allocation: {
      daily: writeValue(settings.allocation.daily, session),
      splurge: writeValue(settings.allocation.splurge, session),
      smile: writeValue(settings.allocation.smile, session),
      fire: writeValue(settings.allocation.fire, session),
    },
  };
}

async function getSettings({ usersDb, authDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { data: {} };
  }
  const data = userDoc.data || {};
  const session = await getEncryptionSession(authDb, userId);
  return decryptSettings(data.settings, session);
}

/**
 * Accepts a partial patch — `allocation` itself is all-or-nothing (send all
 * four fields together) since a partial ratio update can't be validated to
 * sum to 100. Writes the whole `settings` object back on every attempt
 * (unlike `mojo-repository.js`'s `updateMojoTarget`, which writes only its
 * `target` sub-field to avoid clobbering `amount`, owned separately by
 * `transaction-derived-state.js`) — safe here since nothing else ever
 * writes any part of `data.settings`.
 */
async function updateSettings({ usersDb, authDb }, userId, patch) {
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
    const current = decryptSettings(data.settings, session);
    const updated = {
      ...current,
      ...patch,
      allocation: patch.allocation ? { ...patch.allocation } : current.allocation,
    };
    const updatedData = { ...data, settings: encryptSettings(updated, session) };
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: new Date().toISOString() });
      return updated;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to update settings after maximum retries due to write conflicts');
}

/**
 * Shared between `PATCH /settings` (backend/routes/api.js) and
 * `POST /data/import` (data-repository.js's `importUserData`) — moved here
 * (D-9) rather than kept private to the route so import doesn't need a
 * second, independent copy of "allocation must be four finite numbers
 * summing to 100." Returns an error string, or `null` if valid.
 */
function validateSettingsAllocation(allocation) {
  if (typeof allocation !== 'object' || allocation === null || Array.isArray(allocation)) {
    return 'allocation must be an object with daily, splurge, smile, and fire.';
  }
  const fields = ['daily', 'splurge', 'smile', 'fire'];
  const unknownField = Object.keys(allocation).find((key) => !fields.includes(key));
  if (unknownField) return `allocation.${unknownField} is not a recognized field.`;
  for (const field of fields) {
    if (!Number.isFinite(allocation[field])) return `allocation.${field} must be a number.`;
  }
  const sum = fields.reduce((total, field) => total + allocation[field], 0);
  if (Math.abs(sum - 100) > 0.001) {
    return 'allocation.daily + splurge + smile + fire must sum to 100.';
  }
  return null;
}

module.exports = {
  getSettings,
  updateSettings,
  DEFAULT_SETTINGS,
  validateSettingsAllocation,
  // Re-exported for data-repository.js's importUserData (D-9: delegate to
  // each collection's own encrypt logic rather than reimplementing it).
  encryptSettings,
  decryptSettings,
};
