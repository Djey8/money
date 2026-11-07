#!/usr/bin/env node
/**
 * Writes the two tables of the Dreamer manual that come from the cards and the characters (JFK, 2026-11-02): where every character
 * starts (partner, children, home, car, study, what the insurances cost) and which card needs which attribute of the life. They sit
 * between the markers <!-- attributes:start --> and <!-- attributes:end --> of docs/DREAMFUND_GAME.md and docs/DREAMFUND_GAME.de.md; the
 * text around them is written by hand. Run it again after a card or a character changes (build the domain package first):
 *
 *   node scripts/dreamfund-attributes.js && node scripts/dreamfund-manual.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { CASHFLOW_GAME_SETS } = require(path.join(root, 'packages/domain/dist/cashflow-content.js'));
const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');

const WORDS = {
  en: {
    relationship: 'Relationship',
    kids: 'Children',
    home: 'Home',
    location: 'Place',
    employment: 'Job',
    pet: 'Pet',
    car: 'Car',
    education: 'Study',
    career: 'Career stage',
    debt: 'Debt',
    owns: 'Owns',
    values: {
      single: 'single',
      partner: 'in a relationship',
      cohabiting: 'living together',
      married: 'married',
      own_flat: 'own flat',
      shared_flat: 'shared flat',
      with_parents: 'with the parents',
      with_partner: 'with the partner',
      home_city: 'home city',
      other_city: 'another city',
      abroad_europe: 'abroad (Europe)',
      other_continent: 'another continent',
      employed: 'employed',
      unemployed: 'out of work',
      short_time: 'short-time work',
      none: 'none',
      cat: 'cat',
      dog: 'dog',
    },
    yes: 'yes',
    no: 'no',
    studying: 'studying',
    anyPartner: 'a partner',
    atLeast: 'at least',
    or: ' or ',
    car_: 'a car',
    pet_: 'a pet',
    heads: {
      start: [
        'Character',
        'Relationship',
        'Children',
        'Home',
        'Car',
        'Study',
        'Insurances (a month)',
      ],
      needs: ['Pile', 'Card', 'Needs'],
    },
    piles: { emergency: 'Emergency', life: 'Life', dream: 'Dream', opportunity: 'Opportunity' },
    none: '-',
  },
  de: {
    relationship: 'Beziehung',
    kids: 'Kinder',
    home: 'Wohnen',
    location: 'Ort',
    employment: 'Job',
    pet: 'Haustier',
    car: 'Auto',
    education: 'Studium',
    career: 'Karrierestufe',
    debt: 'Schulden',
    owns: 'Besitzt',
    values: {
      single: 'Single',
      partner: 'in einer Beziehung',
      cohabiting: 'zusammenlebend',
      married: 'verheiratet',
      own_flat: 'eigene Wohnung',
      shared_flat: 'WG',
      with_parents: 'bei den Eltern',
      with_partner: 'beim Partner',
      home_city: 'Heimatstadt',
      other_city: 'andere Stadt',
      abroad_europe: 'im Ausland (Europa)',
      other_continent: 'anderer Kontinent',
      employed: 'angestellt',
      unemployed: 'ohne Arbeit',
      short_time: 'Kurzarbeit',
      none: 'keins',
      cat: 'Katze',
      dog: 'Hund',
    },
    yes: 'ja',
    no: 'nein',
    studying: 'im Studium',
    anyPartner: 'ein Partner',
    atLeast: 'mindestens',
    or: ' oder ',
    car_: 'ein Auto',
    pet_: 'ein Haustier',
    heads: {
      start: [
        'Charakter',
        'Beziehung',
        'Kinder',
        'Wohnen',
        'Auto',
        'Studium',
        'Versicherungen (im Monat)',
      ],
      needs: ['Stapel', 'Karte', 'Braucht'],
    },
    piles: { emergency: 'Notfall', life: 'Leben', dream: 'Traum', opportunity: 'Chance' },
    none: '-',
  },
};

const BASE = { relationship: 'single', kids: 0, car: false, home: 'own_flat', education: false };

function money(minor, lang) {
  return Math.round(minor / 100).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
}

function describeLife(requires, W) {
  const parts = [];
  for (const [key, wanted] of Object.entries(requires)) {
    if (key === 'kidsAtLeast') parts.push(`${W.kids}: ${W.atLeast} ${wanted}`);
    else if (key === 'partner')
      parts.push(`${W.relationship}: ${wanted ? W.anyPartner : W.values.single}`);
    else if (key === 'education') parts.push(`${W.education}: ${wanted ? W.studying : W.no}`);
    else {
      const list = Array.isArray(wanted) ? wanted : [wanted];
      parts.push(`${W[key] ?? key}: ${list.map((v) => W.values[v] ?? String(v)).join(W.or)}`);
    }
  }
  return parts.join('; ');
}

function startRows(lang) {
  const W = WORDS[lang];
  const rows = set.professions
    .filter((profession) => !profession.variantOf)
    .map((profession) => {
      const text = profession.profile.texts[lang] ?? profession.profile.texts.en;
      const life = { ...BASE, ...profession.lifeStart };
      const premium = profession.expenses
        .filter((line) => line.insurance)
        .reduce((sum, line) => sum + line.amountMinor, 0);
      return [
        text.name,
        W.values[life.relationship],
        String(life.kids),
        W.values[life.home],
        life.car ? W.yes : W.no,
        life.education ? W.yes : W.no,
        `${money(premium, lang)} TT`,
      ];
    });
  return table(W.heads.start, rows);
}

function needRows(lang) {
  const W = WORDS[lang];
  const rows = [];
  const add = (pile, card, needs) =>
    rows.push([W.piles[pile], `${card.title[lang]} (${card.id})`, needs]);
  for (const card of set.decks.emergency) {
    const needs = [];
    if (card.requires) needs.push(card.requires === 'car' ? W.car_ : W.pet_);
    if (card.needs) needs.push(describeLife(card.needs, W));
    if (needs.length) add('emergency', card, needs.join('; '));
  }
  for (const card of set.decks.life) {
    if (card.requires) add('life', card, describeLife(card.requires, W));
  }
  for (const card of set.decks.dream) {
    const needs = [];
    if (card.requiresPartner) needs.push(`${W.relationship}: ${W.anyPartner}`);
    if (card.requiresKids) needs.push(`${W.kids}: ${W.atLeast} 1`);
    if (needs.length) add('dream', card, needs.join('; '));
  }
  for (const card of set.decks.opportunity) {
    const need = card.requires;
    if (!need) continue;
    const needs = [];
    if (need.home) needs.push(`${W.home}: ${W.values[need.home] ?? need.home}`);
    if (need.careerStage !== undefined) needs.push(`${W.career} ${need.careerStage}+`);
    if (need.debtMinor !== undefined) needs.push(`${W.debt} >= ${money(need.debtMinor, lang)} TT`);
    if (need.owns) needs.push(`${W.owns}: ${need.owns}`);
    if (need.life) needs.push(describeLife(need.life, W));
    add('opportunity', card, needs.join('; '));
  }
  return table(W.heads.needs, rows);
}

function table(head, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

const BLOCKS = {
  en: { start: 'Where every character starts', needs: 'Which card needs which attribute' },
  de: { start: 'Wo jeder Charakter startet', needs: 'Welche Karte welches Merkmal braucht' },
};

for (const [lang, file] of [
  ['en', 'docs/DREAMFUND_GAME.md'],
  ['de', 'docs/DREAMFUND_GAME.de.md'],
]) {
  const p = path.join(root, file);
  const text = fs.readFileSync(p, 'utf8');
  const a = text.indexOf('<!-- attributes:start -->');
  const b = text.indexOf('<!-- attributes:end -->');
  if (a < 0 || b < a) throw new Error(`${file} has no attributes markers.`);
  const body = `<!-- attributes:start -->\n\n#### ${BLOCKS[lang].start}\n\n${startRows(lang)}\n\n#### ${BLOCKS[lang].needs}\n\n${needRows(lang)}\n\n`;
  fs.writeFileSync(p, text.slice(0, a) + body + text.slice(b));
  console.log(`${file}: written`);
}
