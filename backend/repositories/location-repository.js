'use strict';

/**
 * Locations: where the money physically sits (bank account, cash, PayPal, a crypto exchange ...),
 * stored at `data.locations` (todo/locations.md). Orthogonal to the Barefoot buckets.
 *
 * `amountMinor` is a live counter with two writers, by design:
 *  - bookings: `applyDerivedState` (services/transaction-derived-state.js) moves it in the same document
 *    write whenever a transaction with a `locationId` is created, edited or deleted, so this repository
 *    never touches it for those;
 *  - the owner: PATCH `amountMinor` is a plain overwrite, the manual correction the UI's info panel offers.
 *
 * A location is identified by name + optional subName (case-insensitive), mirroring the app
 * (src/app/shared/location.utils.ts). Deleting one keeps the history: every transaction that pointed at it
 * loses its `locationId` in the same write (no cascade delete, no dangling reference).
 */

const crypto = require('crypto');
const { toMinorUnits } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue } = require('./transaction-repository');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;
const LOCATION_KINDS = ['bank', 'savings', 'cash', 'crypto', 'wallet', 'broker', 'card', 'other'];

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptLocation(raw, session, schemaVersion) {
  const subName = raw.subName === undefined ? '' : decryptValue(raw.subName, session);
  return {
    id: decryptValue(raw.id, session),
    name: decryptValue(raw.name, session),
    ...(subName ? { subName } : {}),
    kind: raw.kind === undefined ? 'other' : decryptValue(raw.kind, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
  };
}

function encryptLocation(location, session, schemaVersion) {
  return {
    id: writeValue(location.id, session),
    name: writeValue(location.name, session),
    ...(location.subName ? { subName: writeValue(location.subName, session) } : {}),
    kind: writeValue(location.kind || 'other', session),
    amount: writeValue(toStoredMoney(location.amountMinor, schemaVersion), session),
  };
}

function assertStableId(raw) {
  if (raw.id === undefined) {
    throw new Error('Location is missing a stable ID');
  }
}

function decryptAllLocations(rawLocations, session, schemaVersion) {
  return rawLocations.map((raw) => {
    assertStableId(raw);
    return decryptLocation(raw, session, schemaVersion);
  });
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

async function listLocations(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawLocations = data.locations || [];
  if (!Array.isArray(rawLocations)) throw new Error('Stored locations must be an array');
  return decryptAllLocations(rawLocations, session, schemaVersion);
}

async function getLocation(deps, userId, locationId) {
  const locations = await listLocations(deps, userId);
  return locations.find((location) => location.id === locationId) || null;
}

/**
 * Shared read -> mutate -> write-with-retry-on-409 loop, mirroring asset-repository.js. `mutate` gets the
 * still-encrypted `rawLocations` and the whole `data` document and returns `null` (nothing to do) or
 * `{ updatedData, result }`; the document is written once, so anything `mutate` changes alongside the
 * locations (the transactions on delete) lands atomically.
 */
async function withLocationsWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawLocations = data.locations || [];
    if (!Array.isArray(rawLocations)) throw new Error('Stored locations must be an array');

    const mutation = mutate({ data, rawLocations, session, schemaVersion });
    if (mutation === null) return null;
    const { updatedData, result } = mutation;
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: new Date().toISOString() });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write locations after maximum retries due to write conflicts');
}

const norm = (value) => (value || '').trim().toLowerCase();

function assertNoNameCollision(name, subName, others) {
  if (others.some((o) => norm(o.name) === norm(name) && norm(o.subName) === norm(subName))) {
    const error = new Error('A location with this name and sub name already exists.');
    error.code = 'LOCATION_DUPLICATE_NAME';
    throw error;
  }
}

async function createLocation(deps, userId, input) {
  return withLocationsWrite(deps, userId, ({ data, rawLocations, session, schemaVersion }) => {
    const name = input.name.trim();
    const subName = (input.subName || '').trim();
    assertNoNameCollision(name, subName, decryptAllLocations(rawLocations, session, schemaVersion));

    const location = {
      id: `loc_${crypto.randomUUID()}`,
      name,
      ...(subName ? { subName } : {}),
      kind: input.kind || 'other',
      amountMinor: input.amountMinor || 0,
    };
    return {
      updatedData: {
        ...data,
        locations: [...rawLocations, encryptLocation(location, session, schemaVersion)],
      },
      result: location,
    };
  });
}

async function updateLocation(deps, userId, locationId, patch) {
  return withLocationsWrite(deps, userId, ({ data, rawLocations, session, schemaVersion }) => {
    const existing = decryptAllLocations(rawLocations, session, schemaVersion);
    const index = existing.findIndex((location) => location.id === locationId);
    if (index === -1) return null;
    const current = existing[index];

    const name = patch.name !== undefined ? patch.name.trim() : current.name;
    let subName = current.subName || '';
    if (patch.subName !== undefined) subName = (patch.subName || '').trim();
    assertNoNameCollision(
      name,
      subName,
      existing.filter((_, i) => i !== index),
    );

    const updated = {
      id: current.id,
      name,
      ...(subName ? { subName } : {}),
      kind: patch.kind !== undefined ? patch.kind : current.kind,
      // A plain overwrite: the owner's manual correction, not a booking.
      amountMinor: patch.amountMinor !== undefined ? patch.amountMinor : current.amountMinor,
    };
    return {
      updatedData: {
        ...data,
        locations: rawLocations.map((raw, i) =>
          i === index ? encryptLocation(updated, session, schemaVersion) : raw,
        ),
      },
      result: updated,
    };
  });
}

async function deleteLocation(deps, userId, locationId) {
  return withLocationsWrite(deps, userId, ({ data, rawLocations, session, schemaVersion }) => {
    const existing = decryptAllLocations(rawLocations, session, schemaVersion);
    const index = existing.findIndex((location) => location.id === locationId);
    if (index === -1) return null;

    // Orphan the history: drop the link from every booking made here. The stored `locationId` is one
    // encrypted value per transaction, so the key is removed without touching any other field.
    let unlinked = 0;
    const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
    const transactions = rawTransactions.map((raw) => {
      let next = raw;
      let touched = false;
      if (next.locationId !== undefined && decryptValue(next.locationId, session) === locationId) {
        const { locationId: _removed, ...rest } = next;
        next = rest;
        touched = true;
      }
      // A booking split to this location loses that part of the split (the rest stays).
      if (Array.isArray(next.locationSplits)) {
        const kept = next.locationSplits.filter(
          (leg) => decryptValue(leg.locationId, session) !== locationId,
        );
        if (kept.length !== next.locationSplits.length) {
          const { locationSplits: _old, ...rest } = next;
          next = kept.length > 0 ? { ...rest, locationSplits: kept } : rest;
          touched = true;
        }
      }
      if (touched) unlinked += 1;
      return next;
    });
    // The same for a subscription's rule.
    const rawSubscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
    const subscriptions = rawSubscriptions.map((raw) => {
      let next = raw;
      if (next.locationId !== undefined && decryptValue(next.locationId, session) === locationId) {
        const { locationId: _removed, locationSplit: _rule, ...rest } = next;
        return rest;
      }
      if (Array.isArray(next.locationSplit)) {
        const kept = next.locationSplit.filter(
          (leg) => decryptValue(leg.locationId, session) !== locationId,
        );
        if (kept.length !== next.locationSplit.length) {
          const { locationSplit: _old, ...rest } = next;
          next = kept.length > 0 ? { ...rest, locationSplit: kept } : rest;
        }
      }
      return next;
    });
    // Transfers keep their history; the end that pointed here is dropped (shown as "a deleted location").
    const rawTransfers = Array.isArray(data.transfers) ? data.transfers : [];
    let transfersTouched = false;
    const transfers = rawTransfers.map((raw) => {
      let next = raw;
      for (const field of ['fromLocationId', 'toLocationId']) {
        if (next[field] !== undefined && decryptValue(next[field], session) === locationId) {
          const { [field]: _gone, ...rest } = next;
          next = rest;
          transfersTouched = true;
        }
      }
      return next;
    });
    // A recurring transfer between two locations cannot survive losing one of them; the transfers it already made stay.
    const rawRules = Array.isArray(data.recurringTransfers) ? data.recurringTransfers : [];
    const keptRules = rawRules.filter(
      (raw) =>
        decryptValue(raw.fromLocationId, session) !== locationId &&
        decryptValue(raw.toLocationId, session) !== locationId,
    );
    return {
      updatedData: {
        ...data,
        locations: rawLocations.filter((_, i) => i !== index),
        ...(transfersTouched ? { transfers } : {}),
        ...(keptRules.length !== rawRules.length ? { recurringTransfers: keptRules } : {}),
        ...(unlinked > 0 ? { transactions } : {}),
        ...(rawSubscriptions.length > 0 ? { subscriptions } : {}),
      },
      result: { id: locationId, transactionsUnlinked: unlinked },
    };
  });
}

/**
 * Whole-account import brings its own plaintext locations, so the checks the UI and the routes make are
 * repeated here: usable id, a finite amount, a known kind, and no duplicate id or name + subName.
 * Throws a plain Error; the importer wraps it as IMPORT_INVALID_DATA.
 */
function assertImportableLocations(locations) {
  const ids = new Set();
  const names = new Set();
  for (const location of locations) {
    if (!location || typeof location !== 'object')
      throw new Error('Each location must be an object');
    if (typeof location.id !== 'string' || location.id === '') {
      throw new Error('Each location needs a string id');
    }
    if (typeof location.name !== 'string' || location.name.trim() === '') {
      throw new Error(`Location ${location.id} needs a name`);
    }
    if (typeof location.amount !== 'number' || !Number.isFinite(location.amount)) {
      throw new Error(`Location ${location.id} needs a finite numeric amount`);
    }
    if (location.kind !== undefined && !LOCATION_KINDS.includes(location.kind)) {
      throw new Error(`Location ${location.id} has an unknown kind '${location.kind}'`);
    }
    const key = `${norm(location.name)}|${norm(location.subName)}`;
    if (ids.has(location.id)) throw new Error(`Duplicate location id ${location.id}`);
    if (names.has(key)) throw new Error(`Duplicate location name '${location.name}'`);
    ids.add(location.id);
    names.add(key);
  }
}

/** Validates plaintext imported locations and returns them in stored (encrypted) form. */
function prepareImportedLocations(locations, session, schemaVersion) {
  assertImportableLocations(locations);
  return decryptAllLocations(locations, null, schemaVersion).map((item) =>
    encryptLocation(item, session, schemaVersion),
  );
}

module.exports = {
  prepareImportedLocations,
  assertImportableLocations,
  LOCATION_KINDS,
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  // Re-exported for data-repository.js's importUserData (D-9: one encrypt logic per collection).
  encryptLocation,
  decryptLocation,
  decryptAllLocations,
};
