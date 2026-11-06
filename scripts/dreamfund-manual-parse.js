/**
 * Reads a Dreamfund game page (docs/DREAMFUND_GAME.md or .de.md) into its sections as blocks. Used by dreamfund-manual.js, which
 * builds the manual of the app from authored sections (scripts/dreamfund-manual/) that import parts of these pages.
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
      current.blocks.push({
        type: 'h3',
        level: line.startsWith('####') ? 4 : 3,
        text: inline(line.replace(/^#{3,4} /, '')),
      });
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
  return { title, sections };
}

module.exports = { parse };
