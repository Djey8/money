'use strict';

/**
 * `mm-admin token create|list|revoke` — Personal Access Token management,
 * docs/adr/0006-api-scopes-and-access-control.md.
 *
 * PATs are stored hashed as `pat_<id>` documents in `auth`, using the same
 * database and revocation-by-flag pattern as refresh tokens (`rt_<jti>`,
 * see routes/auth.js), but a token's plaintext value is never stored or
 * retrievable again after creation — only its SHA-256 hash. Unlike
 * passwords (low-entropy, need a slow KDF like bcrypt to resist brute
 * force), a 256-bit random token has enough entropy that a fast hash is
 * the right tool: it protects the stored value if the `auth` database
 * itself leaks, without the point of bcrypt (resisting guessing), which
 * doesn't apply here.
 *
 * Deliberately NOT covered by this module: enforcing that PATs can never
 * manage other PATs (ADR-0006's escalation-prevention rule). That's an
 * HTTP-route-layer concern for slice 1 (a route handler decides whether
 * the caller authenticated via a session or a PAT before ever reaching
 * these functions) — this module only implements the token lifecycle
 * operations themselves, callable by mm-admin (a human operator with
 * direct database access) or, later, an authenticated session route.
 */

const crypto = require('crypto');

const SCOPE_RESOURCES = [
  'transactions',
  'subscriptions',
  'smile',
  'fire',
  'mojo',
  'grow',
  'balance',
  'income',
  'budget',
  'settings',
  'encryption',
  'account',
  'reports',
  'data',
];
// reports is read-only (calculations never take a :w); data always
// requires :bulk (the highest-blast-radius resource — full export/import).
const READ_ONLY_RESOURCES = new Set(['reports']);
const BULK_ONLY_RESOURCES = new Set(['data']);

function validateScope(scope) {
  if (scope === 'admin') return;
  const match = /^([a-z]+):(r|w|rw|bulk)$/.exec(scope);
  if (!match) {
    throw new Error(`Invalid scope '${scope}' — expected <resource>:<r|w|rw|bulk> or 'admin'`);
  }
  const [, resource, level] = match;
  if (!SCOPE_RESOURCES.includes(resource)) {
    throw new Error(`Unknown resource '${resource}' in scope '${scope}'`);
  }
  if (READ_ONLY_RESOURCES.has(resource) && level !== 'r') {
    throw new Error(`'${resource}' is read-only — got scope '${scope}'`);
  }
  if (BULK_ONLY_RESOURCES.has(resource) && level !== 'bulk') {
    throw new Error(`'${resource}' only supports ':bulk' — got scope '${scope}'`);
  }
}

function validateScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error('At least one scope is required');
  }
  scopes.forEach(validateScope);
}

function generateToken() {
  return `mmpat_${crypto.randomBytes(32).toString('hex')}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new PAT. Returns the plaintext token — this is the only time
 * it is ever available; only its hash is persisted.
 *
 * @param {{authDb: object}} deps
 * @param {{userId: string, name: string, scopes: string[], expiresInDays?: number}} options
 */
async function createToken(deps, { userId, name, scopes, expiresInDays }) {
  const { authDb } = deps;
  if (!userId) throw new Error('createToken: userId is required');
  if (!name) throw new Error('createToken: name is required');
  validateScopes(scopes);
  if (expiresInDays !== undefined && (typeof expiresInDays !== 'number' || expiresInDays <= 0)) {
    throw new Error('createToken: expiresInDays must be a positive number');
  }

  const token = generateToken();
  const tokenId = `pat_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = new Date().toISOString();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await authDb.insert({
    _id: tokenId,
    type: 'pat',
    userId,
    name,
    scopes,
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt,
    revoked: false,
  });

  return { tokenId, token, userId, name, scopes, expiresAt };
}

/** Lists a user's tokens. Never returns the hash — there is nothing that needs it outside `verifyToken`. */
async function listTokens(deps, { userId }) {
  const { authDb } = deps;
  if (!userId) throw new Error('listTokens: userId is required');

  const result = await authDb.find({
    selector: { type: 'pat', userId },
    fields: ['_id', 'name', 'scopes', 'createdAt', 'expiresAt', 'revoked'],
  });
  return result.docs.map((d) => ({
    tokenId: d._id,
    name: d.name,
    scopes: d.scopes,
    createdAt: d.createdAt,
    expiresAt: d.expiresAt,
    revoked: d.revoked,
  }));
}

/**
 * Revokes a token. Marks it revoked rather than deleting it, so it still
 * shows up in `listTokens` (with `revoked: true`) for audit purposes —
 * consistent with the audit log's philosophy of a durable record over a
 * disappearing one.
 */
async function revokeToken(deps, { tokenId }) {
  const { authDb } = deps;
  if (!tokenId) throw new Error('revokeToken: tokenId is required');

  const doc = await authDb.get(tokenId);
  if (doc.type !== 'pat') {
    throw new Error(`${tokenId} is not a PAT`);
  }
  doc.revoked = true;
  doc.revokedAt = new Date().toISOString();
  await authDb.insert(doc);
  return { tokenId, revoked: true };
}

/**
 * Looks up a plaintext token and returns its scopes/owner if valid — the
 * primitive slice 1's PAT-authentication middleware will call on every
 * request. Returns `null` (never throws) for anything invalid: unknown
 * token, revoked, or expired, so a route handler can treat every failure
 * mode identically (401), without leaking which one occurred.
 */
async function verifyToken(deps, token) {
  const { authDb } = deps;
  if (!token || typeof token !== 'string') return null;

  const result = await authDb.find({
    selector: { type: 'pat', tokenHash: hashToken(token) },
    limit: 1,
  });
  if (result.docs.length === 0) return null;

  const doc = result.docs[0];
  if (doc.revoked) return null;
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return null;

  return { tokenId: doc._id, userId: doc.userId, scopes: doc.scopes, name: doc.name };
}

module.exports = {
  createToken,
  listTokens,
  revokeToken,
  verifyToken,
  validateScope,
  validateScopes,
  SCOPE_RESOURCES,
};
