'use strict';

const fs = require('fs');
const path = require('path');

/**
 * The text the game writes into the account (subscription titles, notes, history labels), in the language the account
 * uses: a lookup over the same `src/assets/i18n/*.json` catalogs the browser translates with, so a game played through
 * the API leaves the same words behind (todo/cashflow-game-pro.md, decision 7). A key the catalog does not know comes
 * back unchanged, like ngx-translate's missing-key handler - the domain's `textOrFallback` relies on that.
 *
 * The catalogs are found in `GAME_I18N_DIR`, else `backend/i18n` (the Docker image), else the repo's own assets.
 */

const LANGUAGES = ['en', 'de', 'es', 'fr', 'cn', 'ar'];
const catalogs = new Map();

function catalogDirectory() {
  const candidates = [
    process.env.GAME_I18N_DIR,
    path.join(__dirname, '..', 'i18n'),
    path.join(__dirname, '..', '..', 'src', 'assets', 'i18n'),
  ].filter(Boolean);
  return candidates.find((directory) => fs.existsSync(directory));
}

function loadCatalog(language) {
  if (!catalogs.has(language)) {
    const directory = catalogDirectory();
    const file = directory && path.join(directory, `${language}.json`);
    catalogs.set(
      language,
      file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {},
    );
  }
  return catalogs.get(language);
}

/** @returns {(key: string, params?: Record<string, string | number>) => string} */
function createGameText(language) {
  const catalog = loadCatalog(LANGUAGES.includes(language) ? language : 'en');
  return (key, params) => {
    const template = catalog[key];
    if (typeof template !== 'string') return key;
    if (!params) return template;
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
      params[name] === undefined ? match : String(params[name]),
    );
  };
}

/** "4.000 €": the way the app words an amount in a game note. */
function createMoneyFormat({ currency, isEuropeanFormat }) {
  return (amountMinor) =>
    `${(amountMinor / 100).toLocaleString(isEuropeanFormat ? 'de-DE' : 'en-US')} ${currency}`;
}

module.exports = { createGameText, createMoneyFormat };
