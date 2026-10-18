'use strict';

/**
 * The profile picture of a self-hosted account (JFK, 2026-10-18). A small picture the client has already cut square and shrunk,
 * kept on the account's own document in the users database as `picture: { mime, data (base64), updatedAt }` - top level, so a
 * save of the account's data never touches it. It is not secret (other players see it on the leaderboard), so it is not encrypted.
 */

const MAX_BYTES = 150 * 1024;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

class PictureError extends Error {}

/** What the bytes start with, per type: a file that says it is a PNG but is not one is refused. */
const MAGIC = {
  'image/png': (b) =>
    b.length > 8 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/jpeg': (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b.length > 12 &&
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP',
};

/** Checks a data URL and returns what is stored; throws PictureError with the reason. */
function parseDataUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_BYTES * 2) {
    throw new PictureError('image must be a data URL of a small picture (PNG, JPEG or WebP).');
  }
  const match = DATA_URL.exec(value);
  if (!match) throw new PictureError('image must be a base64 data URL of a PNG, JPEG or WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new PictureError(`The picture may be at most ${MAX_BYTES / 1024} KB.`);
  }
  if (!MAGIC[match[1]](bytes)) throw new PictureError('The file is not the picture type it says.');
  return { mime: match[1], data: match[2] };
}

async function mutate(usersDb, userId, change) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const doc = await usersDb.get(userId);
    const result = change(doc);
    try {
      await usersDb.insert(doc);
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
  }
  throw new PictureError('The account keeps changing; try again.');
}

/** The account's picture as `{ mime, data, updatedAt }`, or null. */
async function getPicture(usersDb, userId) {
  try {
    const doc = await usersDb.get(userId);
    return doc.picture && doc.picture.data ? doc.picture : null;
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

async function setPicture(usersDb, userId, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  const picture = { ...parsed, updatedAt: Date.now() };
  await mutate(usersDb, userId, (doc) => {
    doc.picture = picture;
  });
  return picture;
}

async function deletePicture(usersDb, userId) {
  await mutate(usersDb, userId, (doc) => {
    delete doc.picture;
  });
}

const toDataUrl = (picture) => `data:${picture.mime};base64,${picture.data}`;

module.exports = {
  MAX_BYTES,
  PictureError,
  parseDataUrl,
  getPicture,
  setPicture,
  deletePicture,
  toDataUrl,
};
