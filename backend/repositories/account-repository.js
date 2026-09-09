'use strict';

/**
 * Account (AUTH-6/7/8, PROF-1) — the identity-sensitive counterpart to
 * Settings (`settings-repository.js`), which owns `username` and every
 * cosmetic preference. `email` requires a uniqueness check and a
 * session-cookie reissue on change, so it stays here, and every route
 * built on top of this repository is `requireSession`-only (never a PAT,
 * regardless of scope) — the same restriction already applied to
 * `/auth/tokens*`, extended here because a leaked PAT with `account:w`
 * scope should never be able to change the account's email, verify its
 * password, or delete it outright.
 *
 * `GET /account` alone is PAT-readable via `account:r` — reading the
 * current email isn't identity-sensitive the way changing/deleting it is.
 */

const bcrypt = require('bcryptjs');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AccountError extends Error {}

// Generous headroom, not a soft cap — hitting it aborts the deletion rather
// than silently leaving some of the user's PATs active after "account
// deleted" (the same reasoning as rotate-encryption-key.js's own
// AUDIT_OVERFETCH_LIMIT check).
const PAT_OVERFETCH_LIMIT = 1000;

async function getAccount({ authDb }, userId) {
  try {
    const authDoc = await authDb.get(userId);
    return { email: authDoc.email, createdAt: authDoc.createdAt || null };
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    // Reachable only via a still-unexpired session JWT surviving a deleted
    // account — session tokens are stateless (signature + expiry only, no
    // live DB check), so this can't be prevented, only reported cleanly
    // instead of letting a raw 404 escape.
    const notFound = new AccountError('Account not found.');
    notFound.code = 'ACCOUNT_NOT_FOUND';
    throw notFound;
  }
}

/**
 * Updates the account's email, mirroring the legacy `PUT /auth/update-email`
 * route's uniqueness check exactly, plus one correction it doesn't make:
 * this also writes `data.info.email` in the same operation, so the
 * Pro-API-readable copy of the email (`GET /data/export`'s `data.info`)
 * never silently diverges from the real one on `authDb`. Does not touch
 * the session cookie — the caller (the HTTP route) does that, since
 * cookie issuance is an HTTP concern, not a repository one.
 */
async function updateAccountEmail({ usersDb, authDb }, userId, newEmail) {
  if (!newEmail || typeof newEmail !== 'string' || !EMAIL_REGEX.test(newEmail)) {
    throw new AccountError('A valid email address is required.');
  }

  const existing = await authDb.find({ selector: { email: newEmail }, limit: 1 });
  if (existing.docs.length > 0 && existing.docs[0]._id !== userId) {
    const error = new AccountError('Email already in use by another account.');
    error.code = 'ACCOUNT_EMAIL_TAKEN';
    throw error;
  }

  const authDoc = await authDb.get(userId);
  authDoc.email = newEmail;
  authDoc.updatedAt = new Date().toISOString();
  await authDb.insert(authDoc);

  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { _id: userId, createdAt: new Date().toISOString(), data: {} };
  }
  userDoc.data = {
    ...(userDoc.data || {}),
    info: { ...(userDoc.data?.info || {}), email: newEmail },
  };
  userDoc.updatedAt = new Date().toISOString();
  await usersDb.insert(userDoc);

  return { email: newEmail };
}

async function verifyAccountPassword({ authDb }, userId, password) {
  if (!password || typeof password !== 'string') {
    throw new AccountError('password is required.');
  }
  let authDoc;
  try {
    authDoc = await authDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    return false;
  }
  return bcrypt.compare(password, authDoc.password);
}

/** Destroys one document by id, retrying once on a 409 (a concurrent edit changed `_rev` after the earlier `find`/`get`) by re-fetching the latest revision. Treats an already-gone document (404) as success. */
async function destroyTolerant(db, docId) {
  try {
    const doc = await db.get(docId);
    await db.destroy(doc._id, doc._rev);
  } catch (error) {
    if (error.statusCode === 404) return;
    if (error.statusCode !== 409) throw error;
    // Someone else changed this doc between our find()/get() and this
    // destroy — re-fetch once and retry with the fresh revision.
    const fresh = await db.get(docId);
    await db.destroy(fresh._id, fresh._rev);
  }
}

/**
 * Destroys the account entirely: every Personal Access Token belonging to
 * this user (`pat_<id>` documents, keyed by a `userId` field rather than by
 * `_id`), then the `usersDb` data document, then the `authDb` credentials
 * document — deliberately in that order. Left in place, a PAT would keep
 * authenticating after account deletion (`verifyToken` in
 * `cli/commands/token.js` checks only that the PAT itself is unexpired and
 * unrevoked, never that its owning account still exists) — a real gap in
 * the legacy `DELETE /auth/delete-account` route, which deletes neither the
 * PATs nor anything else beyond the two account documents. Destroying PATs
 * *first* means that if any single destroy fails partway through (a
 * transient CouchDB error, or a genuine 409 that survives the one retry in
 * `destroyTolerant`), the account itself is still fully intact and the
 * whole operation can simply be retried — the alternative order would let
 * the account documents be destroyed successfully and then fail on a PAT,
 * leaving that PAT alive with no account left to delete it from, exactly
 * the outcome this function exists to prevent.
 *
 * Hard-deletes each PAT document rather than marking it revoked the way
 * `revokeToken` (`cli/commands/token.js`) does for a single token — that
 * function deliberately keeps a revoked token's record for audit purposes
 * ("a durable record over a disappearing one"), but here the whole account,
 * including its `authDb`/`usersDb` documents, is being permanently
 * destroyed anyway, so there is no account left for a soft-deleted PAT
 * record to be an audit trail for.
 *
 * Does not touch the current refresh token or any cookies — those are
 * HTTP-session concerns the calling route handles (it has access to the
 * request's cookies; this repository only ever receives a `userId`).
 */
async function deleteAccount({ usersDb, authDb }, userId) {
  // Fetched and validated before anything is destroyed, so a user with an
  // implausibly large number of PATs aborts the whole deletion up front
  // rather than partially deleting the account and leaving some tokens
  // silently still active.
  const patResult = await authDb.find({
    selector: { type: 'pat', userId },
    limit: PAT_OVERFETCH_LIMIT,
  });
  if (patResult.docs.length === PAT_OVERFETCH_LIMIT) {
    throw new AccountError(
      `User ${userId} has at least ${PAT_OVERFETCH_LIMIT} personal access tokens — refusing to ` +
        'delete the account without a way to guarantee all of them are cleaned up.',
    );
  }

  for (const pat of patResult.docs) {
    await destroyTolerant(authDb, pat._id);
  }

  await destroyTolerant(usersDb, userId);
  await destroyTolerant(authDb, userId);

  return { deletedTokenCount: patResult.docs.length };
}

module.exports = {
  getAccount,
  updateAccountEmail,
  verifyAccountPassword,
  deleteAccount,
  AccountError,
};
