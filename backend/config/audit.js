'use strict';

/**
 * Audit log for Pro API writes — docs/adr/0006-api-scopes-and-access-control.md.
 *
 * Every `:w`/`:bulk` endpoint (once they exist, starting slice 1) calls
 * `recordAuditEntry` exactly once per logical operation — a batch write of
 * 50 transactions is one audit entry with `itemCount: 50`, not 50 entries.
 *
 * Metadata (userId, actor, timestamp, method, path, resource, resourceId,
 * itemCount) is always plaintext, so the log stays searchable/administrable
 * without the user's encryption key. `payload` — the actual diff/data of
 * the write, when the caller chooses to record one — is encrypted with the
 * same per-user key as everything else when `encryptPayload` is given (see
 * docs/adr/0001-pro-api-encryption-handling.md), since it can contain real
 * financial data.
 */

const crypto = require('crypto');

function generateAuditId() {
  return `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

const REQUIRED_FIELDS = ['userId', 'method', 'path', 'resource'];

function validateEntry(entry) {
  for (const field of REQUIRED_FIELDS) {
    if (!entry[field]) {
      throw new Error(`recordAuditEntry: ${field} is required`);
    }
  }
  if (!entry.actor || !entry.actor.type) {
    throw new Error('recordAuditEntry: actor.type is required');
  }
  if (!['session', 'token'].includes(entry.actor.type)) {
    throw new Error(
      `recordAuditEntry: actor.type must be 'session' or 'token', got '${entry.actor.type}'`,
    );
  }
  if (entry.actor.type === 'token' && !entry.actor.tokenId) {
    throw new Error("recordAuditEntry: actor.tokenId is required when actor.type is 'token'");
  }
}

/**
 * Writes one audit log entry.
 *
 * @param {object} auditDb - the audit database handle (config/db.js's getAuditDb())
 * @param {object} entry
 * @param {string} entry.userId
 * @param {{type: 'session'|'token', tokenId?: string}} entry.actor - who made the write
 * @param {string} entry.method - HTTP method, e.g. 'POST'
 * @param {string} entry.path - request path, e.g. '/api/v1/transactions'
 * @param {string} entry.resource - resource name, e.g. 'transactions'
 * @param {string} [entry.resourceId] - the specific record affected, if singular
 * @param {number} [entry.itemCount] - for bulk operations, how many records were affected
 * @param {any} [entry.payload] - JSON-serializable diff/data to record, encrypted via `encryptPayload` if given
 * @param {(value: string) => string} [encryptPayload]
 * @returns {Promise<object>} the written document
 */
async function recordAuditEntry(auditDb, entry, encryptPayload) {
  validateEntry(entry);

  const doc = {
    _id: generateAuditId(),
    userId: entry.userId,
    actor: entry.actor,
    timestamp: new Date().toISOString(),
    method: entry.method,
    path: entry.path,
    resource: entry.resource,
  };
  if (entry.resourceId !== undefined) doc.resourceId = entry.resourceId;
  if (entry.itemCount !== undefined) doc.itemCount = entry.itemCount;

  if (entry.payload !== undefined) {
    const serialized = JSON.stringify(entry.payload);
    doc.payload = encryptPayload ? encryptPayload(serialized) : serialized;
    doc.payloadEncrypted = Boolean(encryptPayload);
  }

  await auditDb.insert(doc);
  return doc;
}

/**
 * Reads a user's audit entries, most recent first, optionally filtered by
 * resource. Sorted in JS after fetching rather than via a Mango `sort`
 * clause — CouchDB Mango requires sort fields to be covered by an index in
 * a way that's easy to get subtly wrong without a live database to verify
 * against, and audit logs are expected to stay small per user for the
 * foreseeable future. Revisit if that stops being true.
 *
 * `payload` is returned as stored (possibly still encrypted, see
 * `payloadEncrypted` on each entry) — this function does not decrypt.
 */
// Without a sort-covering index, CouchDB's own result order isn't
// timestamp order, so a small fetch could miss the true most-recent
// entries. Overfetch a generous batch, sort in JS, then truncate to what
// the caller actually asked for.
const OVERFETCH_LIMIT = 1000;

async function queryAuditEntries(auditDb, userId, { resource, limit = 50 } = {}) {
  if (!userId) throw new Error('queryAuditEntries: userId is required');

  const selector = { userId };
  if (resource) selector.resource = resource;

  const result = await auditDb.find({ selector, limit: OVERFETCH_LIMIT });
  return result.docs
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
    .slice(0, limit);
}

module.exports = { recordAuditEntry, queryAuditEntries, generateAuditId };
