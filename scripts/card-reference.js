#!/usr/bin/env node
/**
 * Writes docs/domain/CASHFLOW_CARDS.md: every card of the game set with its id (JFK, 2026-10-07). The History names a
 * picked card by id; this is where an agent turns the id back into a card. A domain spec keeps the file equal to the
 * decks, so rerun this after a card changes:  node scripts/card-reference.js   (build the domain package first).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const domain = require(path.join(root, 'packages/domain/dist/index.js'));
const { CASHFLOW_GAME_SETS } = require(path.join(root, 'packages/domain/dist/cashflow-content.js'));

const texts = JSON.parse(
  fs.readFileSync(path.join(root, 'src/assets/i18n/cashflow-cards/en.json'), 'utf8'),
);
const money = (minor) => `${(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} €`;
const deps = {
  textFor: (id) => texts.cards?.[id] ?? {},
  symbolFor: (symbol) => (symbol ? (texts.symbols?.[symbol] ?? symbol) : undefined),
  money,
};
const setId = process.argv[2] || 'cashflow';
const gameSet = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === setId);
if (!gameSet) throw new Error(`No game set '${setId}'.`);
const decks = Object.fromEntries(
  domain.REFERENCE_DECKS.map((deck) => [deck, domain.cardReferenceRows(gameSet, deck, deps)]),
);
const out = path.join(root, 'docs/domain/CASHFLOW_CARDS.md');
fs.writeFileSync(out, domain.renderCardReferenceMarkdown(setId, decks));
console.log(`Wrote ${path.relative(root, out)}`);
