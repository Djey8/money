const crypto = require('crypto');

/**
 * Cashflow game accounts (an email containing "cashflow") can only be created with the game password
 * (JFK, 2026-10-05): the game's printed content is meant for the owner and friends, not the public. The
 * check lives here, on the server, so it cannot be skipped by calling the API directly. Only the SHA-256
 * of the password is stored. `CASHFLOW_GAME_PASSWORD_SHA256` overrides it for a deployment.
 */
const DEFAULT_PASSWORD_SHA256 = '7568cac5ac38a6ec7004757b5eaed81d773a2bf827aba7c718183b528329e294';

function isGameAccountEmail(email) {
  return typeof email === 'string' && email.toLowerCase().includes('cashflow');
}

function hashPassword(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest();
}

function isGamePassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const expected = Buffer.from(
    process.env.CASHFLOW_GAME_PASSWORD_SHA256 || DEFAULT_PASSWORD_SHA256,
    'hex',
  );
  const actual = hashPassword(candidate);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { isGameAccountEmail, isGamePassword };
