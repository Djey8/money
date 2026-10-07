#!/usr/bin/env node
/**
 * Writes docs/domain/CASHFLOW_MANUAL_<LANG>.md: the Cashflow manual of each language as Markdown, so an agent that teaches
 * the game can read it (explain_concept topics cashflow_manual_en ... cashflow_manual_ar) in the language it teaches in.
 * A domain spec keeps the files equal to the manual; rerun after the manual changes:  node scripts/manual-markdown.js
 * (build the domain package first).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const domain = require(path.join(root, 'packages/domain/dist/index.js'));

for (const language of domain.MANUAL_MARKDOWN_LANGUAGES) {
  const manual = JSON.parse(
    fs.readFileSync(path.join(root, `src/assets/i18n/cashflow-manual/${language}.json`), 'utf8'),
  );
  const out = path.join(root, `docs/domain/CASHFLOW_MANUAL_${language.toUpperCase()}.md`);
  fs.writeFileSync(out, domain.renderManualMarkdown(manual, language));
  console.log(`Wrote ${path.relative(root, out)}`);
}
