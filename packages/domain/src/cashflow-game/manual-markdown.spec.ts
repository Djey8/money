import * as fs from 'fs';
import * as path from 'path';
import {
  MANUAL_MARKDOWN_LANGUAGES,
  renderManualMarkdown,
  type ManualJson,
} from './manual-markdown';

const root = path.join(__dirname, '..', '..', '..', '..');
const manualOf = (language: string): ManualJson =>
  JSON.parse(
    fs.readFileSync(path.join(root, `src/assets/i18n/cashflow-manual/${language}.json`), 'utf8'),
  );

describe('renderManualMarkdown', () => {
  it('writes every section as a numbered heading, with its text, tables and lists', () => {
    const markdown = renderManualMarkdown(manualOf('en'), 'en');
    expect(markdown).toContain('# Cashflow Game Manual');
    expect(markdown).toContain('## 1. Getting started');
    expect(markdown).toContain('## 21. What the cards are worth');
    expect(markdown).toContain('| Where | What it shows or does |');
    expect(markdown).toMatch(/^- /m);
  });

  it('keeps the same sections in every language', () => {
    const headings = (language: string) =>
      renderManualMarkdown(manualOf(language), language).match(/^## \d+\./gm);
    for (const language of MANUAL_MARKDOWN_LANGUAGES) {
      expect(headings(language)).toEqual(headings('en'));
    }
  });
});

describe.each([...MANUAL_MARKDOWN_LANGUAGES])('docs/domain/CASHFLOW_MANUAL_%s.md', (language) => {
  it('is the manual of that language (run: node scripts/manual-markdown.js)', () => {
    const expected = renderManualMarkdown(manualOf(language), language);
    const actual = fs
      .readFileSync(
        path.join(root, `docs/domain/CASHFLOW_MANUAL_${language.toUpperCase()}.md`),
        'utf8',
      )
      .replace(/\r\n/g, '\n');
    expect(actual).toBe(expected);
  });
});
