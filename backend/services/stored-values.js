'use strict';

const { fromMinorUnits, toMinorUnits } = require('@money/domain');

/** Helpers for reading and writing one stored (possibly encrypted, possibly minor-unit) value. */

function readValue(value, session) {
  return session && typeof value === 'string' ? session.decrypt(value) : value;
}

function readNumber(value, session) {
  const number = Number(readValue(value, session));
  if (!Number.isFinite(number)) throw new Error('Stored financial value is invalid');
  return number;
}

function writeValue(value, session) {
  return session ? session.encrypt(String(value)) : value;
}

function toStoredMoney(amountMinor, schemaVersion) {
  return schemaVersion >= 2 ? amountMinor : fromMinorUnits(amountMinor);
}

function fromStoredMoney(value, session, schemaVersion) {
  const amount = readNumber(value, session);
  return schemaVersion >= 2 ? amount : toMinorUnits(amount);
}

module.exports = { readValue, readNumber, writeValue, toStoredMoney, fromStoredMoney };
