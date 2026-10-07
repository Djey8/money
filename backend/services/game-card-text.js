'use strict';

const fs = require('fs');
const path = require('path');

/**
 * What the printed cards say in the account's language: the server's `CashflowCardTextService` (the browser fetches the
 * same `cashflow-cards/<lang>.json` files). A language without a file falls back to English, then to the key itself.
 * Found in `GAME_I18N_DIR`, else `backend/i18n` (the Docker image), else the repo's own assets.
 */

const FALLBACK_LANGUAGE = 'en';
const files = new Map();

function cardsDirectory() {
  const candidates = [
    process.env.GAME_I18N_DIR && path.join(process.env.GAME_I18N_DIR, 'cashflow-cards'),
    path.join(__dirname, '..', 'i18n', 'cashflow-cards'),
    path.join(__dirname, '..', '..', 'src', 'assets', 'i18n', 'cashflow-cards'),
  ].filter(Boolean);
  return candidates.find((directory) => fs.existsSync(directory));
}

function loadFile(language) {
  if (!files.has(language)) {
    const directory = cardsDirectory();
    const file = directory && path.join(directory, `${language}.json`);
    files.set(
      language,
      file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { cards: {} },
    );
  }
  return files.get(language);
}

/** @returns {import('@money/domain').CardTextSource} */
function createCardTextSource(language) {
  const own = loadFile(language);
  const fallback = loadFile(FALLBACK_LANGUAGE);
  return {
    textFor: (cardId) => own.cards?.[cardId] ?? fallback.cards?.[cardId] ?? {},
    symbolFor: (symbol) =>
      symbol ? (own.symbols?.[symbol] ?? fallback.symbols?.[symbol] ?? symbol) : symbol,
    sharedText: (key) => own.shared?.[key] ?? fallback.shared?.[key] ?? '',
    groupName: (group) => own.doodadGroups?.[group] ?? fallback.doodadGroups?.[group] ?? group,
  };
}

module.exports = { createCardTextSource };
