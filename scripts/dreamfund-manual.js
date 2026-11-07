#!/usr/bin/env node
/**
 * Builds the Dreamer manual of the app (src/assets/i18n/dreamfund-manual/en.json and de.json), the way the Cashflow manual is built:
 * the pages are authored in scripts/dreamfund-manual/<language>.js (sections of blocks: text, steps, cards, callouts, tables, glossary).
 * What the simulation writes - the rule tables of the game page and the statistics - is not retyped: an authored section says
 * `{ type: 'import', md: 6 }` (a whole section of docs/DREAMFUND_GAME.md, counted from 0 as the parser lists them) or
 * `{ type: 'import', md: 7, sub: 0 }` (the first ### part of that section) and the build puts the blocks there. English and German
 * pages have the same sections in the same order, so one number works for both.
 *
 * Run it after every simulation:  node scripts/dreamfund-manual.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('./dreamfund-manual-parse.js');
const root = path.join(__dirname, '..');

/** The blocks of a ### part of a section: from its heading to the next heading of the same or a higher level. */
function subBlocks(blocks, ordinal, keepHeading) {
  let seen = -1;
  let start = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    if (blocks[i].type === 'h3' && blocks[i].level === 3) {
      seen += 1;
      if (seen === ordinal) {
        start = i;
        break;
      }
    }
  }
  if (start < 0) throw new Error(`no ### part number ${ordinal}`);
  let end = blocks.length;
  for (let i = start + 1; i < blocks.length; i += 1) {
    if (blocks[i].type === 'h3' && blocks[i].level === 3) {
      end = i;
      break;
    }
  }
  return blocks.slice(keepHeading ? start : start + 1, end);
}

function clean(block) {
  const { level, ...rest } = block;
  void level;
  return rest;
}

function expand(blocks, page, where) {
  const out = [];
  for (const block of blocks) {
    if (block.type !== 'import') {
      out.push(block);
      continue;
    }
    const section = page.sections[block.md];
    if (!section) throw new Error(`${where}: the game page has no section ${block.md}`);
    const picked =
      block.sub === undefined
        ? section.blocks
        : subBlocks(section.blocks, block.sub, block.keepHeading === true);
    for (const taken of picked) {
      if (taken.type === 'h3' && block.noHeadings) continue;
      out.push(clean(taken));
    }
  }
  return out;
}

const outDir = path.join(root, 'src/assets/i18n/dreamfund-manual');
fs.mkdirSync(outDir, { recursive: true });
for (const [language, file] of [
  ['en', 'docs/DREAMFUND_GAME.md'],
  ['de', 'docs/DREAMFUND_GAME.de.md'],
]) {
  const authoredPath = path.join(__dirname, 'dreamfund-manual', `${language}.js`);
  if (!fs.existsSync(authoredPath)) {
    console.log(`No authored manual for ${language}: skipped`);
    continue;
  }
  const authored = require(authoredPath);
  const page = parse(fs.readFileSync(path.join(root, file), 'utf8'), language);
  const sections = {};
  for (const id of authored.order) {
    const section = authored.sections[id];
    if (!section) throw new Error(`${language}: the order names ${id}, which has no section`);
    sections[id] = { ...section, blocks: expand(section.blocks, page, `${language}/${id}`) };
  }
  const manual = {
    title: authored.title,
    subtitle: authored.subtitle,
    labels: authored.labels ?? {},
    order: authored.order,
    sections,
  };
  fs.writeFileSync(path.join(outDir, `${language}.json`), `${JSON.stringify(manual, null, 2)}\n`);
  // the repo's format check (CI: npm run format) reads the generated file as well
  execSync(`npx prettier --write "${path.join(outDir, language + '.json')}"`, { stdio: 'ignore' });
  console.log(
    `Wrote src/assets/i18n/dreamfund-manual/${language}.json (${manual.order.length} sections)`,
  );
  // the same page for the agents: explain_concept topics dreamfund_game_en / dreamfund_game_de
  fs.copyFileSync(
    path.join(root, file),
    path.join(root, `docs/domain/DREAMFUND_GAME_${language.toUpperCase()}.md`),
  );
}
