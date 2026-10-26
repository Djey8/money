#!/usr/bin/env node
/**
 * Writes the Dreamfund manual of the app from the pages the players read: docs/DREAMFUND_GAME.md and docs/DREAMFUND_GAME.de.md become
 * src/assets/i18n/dreamfund-manual/en.json and de.json (the sections as blocks, like the Cashflow manual). The statistics in the pages
 * are written by the simulation, so the manual is made again after every run:  node scripts/dreamfund-manual.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

/** Inline Markdown the page does not draw: links, italics. Bold and `code` are kept (the page draws those). */
function inline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1$2')
    .trim();
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => inline(cell));
}

function parse(markdown, language) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  let title = '';
  let subtitle = '';
  let current = { title: '', blocks: [] };
  const flush = () => {
    if (current.title || current.blocks.length) sections.push(current);
  };
  let paragraph = [];
  const endParagraph = () => {
    if (paragraph.length) {
      const text = inline(paragraph.join(' '));
      if (!title) {
        // before the title nothing is shown
      } else if (!current.title && !subtitle) {
        subtitle = text;
      } else {
        current.blocks.push({ type: 'p', text });
      }
    }
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*<!--.*-->\s*$/.test(line)) continue;
    if (/^# /.test(line)) {
      title = inline(line.slice(2));
      continue;
    }
    if (/^## /.test(line)) {
      endParagraph();
      flush();
      current = { title: inline(line.slice(3)), blocks: [] };
      continue;
    }
    if (/^#{3,4} /.test(line)) {
      endParagraph();
      current.blocks.push({ type: 'h3', text: inline(line.replace(/^#{3,4} /, '')) });
      continue;
    }
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      endParagraph();
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      i -= 1;
      current.blocks.push({ type: 'table', head, rows });
      continue;
    }
    if (/^\s*(-|\d+\.) /.test(line)) {
      endParagraph();
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && (/^\s*(-|\d+\.) /.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*(-|\d+\.) /.test(lines[i])) items.push(lines[i].replace(/^\s*(-|\d+\.) /, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i += 1;
      }
      i -= 1;
      current.blocks.push({ type: 'list', ordered, items: items.map(inline) });
      continue;
    }
    if (line.trim() === '') {
      endParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }
  endParagraph();
  flush();
  const order = [];
  const byId = {};
  sections.forEach((section, index) => {
    const id = `s${index + 1}`;
    order.push(id);
    const name = section.title || (language === 'de' ? 'Überblick' : 'Overview');
    byId[id] = {
      nav: name.replace(/^[^\p{L}\p{N}]+/u, '') || name,
      title: name,
      blocks: section.blocks,
    };
  });
  // the subtitle is the first sentence of the page
  const first = subtitle.match(/^.*?[.!?](?=\s|$)/);
  void first;
  return {
    title,
    subtitle:
      language === 'de'
        ? 'Die Karte, jede Kartenart, die Ziele und wie man gewinnt - mit den Statistiken der Charaktere.'
        : 'The map, every card type, the goals and how to win - with the statistics of the characters.',
    order,
    sections: byId,
  };
}

const out = path.join(root, 'src/assets/i18n/dreamfund-manual');
fs.mkdirSync(out, { recursive: true });
for (const [language, file] of [
  ['en', 'docs/DREAMFUND_GAME.md'],
  ['de', 'docs/DREAMFUND_GAME.de.md'],
]) {
  const manual = parse(fs.readFileSync(path.join(root, file), 'utf8'), language);
  fs.writeFileSync(path.join(out, `${language}.json`), `${JSON.stringify(manual, null, 2)}\n`);
  console.log(
    `Wrote src/assets/i18n/dreamfund-manual/${language}.json (${manual.order.length} sections)`,
  );
}
