'use strict';

/**
 * `mm-admin user create|list` — admin-side user management, docs/MASTER_PROMPT.md §4.3.
 *
 * Reuses the exact same email/password policy `routes/auth.js`'s `/register`
 * endpoint enforces (kept as a small, deliberately duplicated snippet here
 * rather than a shared import, to avoid coupling this CLI's module graph to
 * the Express route file for two regex checks — see the comment on
 * `validatePassword` if that tradeoff ever needs revisiting).
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error('Invalid email format');
  }
}

// Mirrors routes/auth.js's /register policy exactly: min 8 chars, at least
// one uppercase, one lowercase, one number.
function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must contain uppercase, lowercase, and a number');
  }
}

/**
 * Creates a user account directly (bypassing the HTTP registration flow) —
 * useful for scripted/self-hosted setup. Produces the exact same auth +
 * users document shape `/api/auth/register` does.
 *
 * @param {{authDb: object, usersDb: object}} deps
 * @param {{email: string, password: string}} options
 */
async function createUser(deps, { email, password }) {
  const { authDb, usersDb } = deps;
  validateEmail(email);
  validatePassword(password);

  const existing = await authDb.find({ selector: { email }, limit: 1 });
  if (existing.docs.length > 0) {
    throw new Error(`A user with email ${email} already exists`);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = `user_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
  const now = new Date().toISOString();

  await authDb.insert({ _id: userId, email, password: hashedPassword, createdAt: now });
  await usersDb.insert({
    _id: userId,
    createdAt: now,
    updatedAt: now,
    data: { info: { email, username: email.split('@')[0] } },
  });

  return { userId, email };
}

/**
 * Lists user accounts. Filters on `password` existing rather than fetching
 * all `auth` docs, since that database also holds `rt_*` refresh-token
 * records (`type: 'refresh_token'`, no `password` field) and, once slice 1
 * lands, `pat_*` token records (`type: 'pat'`) — only real accounts have a
 * password hash.
 */
async function listUsers(deps) {
  const { authDb } = deps;
  const result = await authDb.find({
    selector: { password: { $exists: true } },
    fields: ['_id', 'email', 'createdAt'],
  });
  return result.docs.map((d) => ({ userId: d._id, email: d.email, createdAt: d.createdAt }));
}

module.exports = { createUser, listUsers, validateEmail, validatePassword };
