import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { reportMarkdown, runBatch, type BatchConfig } from './batch';
import type { CustomRules } from '../custom-rules';
import { injectStats, statsMarkdown } from './stats-doc';

/**
 * Runs a batch of Dreamfund games from the command line (JFK, 2026-10-26):
 *
 *   npm run simulate:dreamfund -- --games 100 --policies saver,etf --shapes ring,infinity --sizes medium --out reports/run.md
 *
 * Options: --games N (per strategy and map), --policies a,b (default all), --shapes ring,infinity,rectangle,square,mountain,
 * --sizes small,medium,large, --difficulty easy|medium|hard, --mode free|guided|strict, --max-turns N, --first-seed N, --out file
 * (writes the report there and the raw games beside it as .json; otherwise the report goes to the screen).
 */
function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const list = (name: string) => option(name)?.split(',').filter(Boolean);

const rules: Partial<CustomRules> = {};
const difficulty = option('difficulty');
if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard')
  rules.difficulty = difficulty;
const mode = option('mode');
if (mode === 'free' || mode === 'guided' || mode === 'strict') rules.mode = mode;

const config: BatchConfig = {
  games: Number(option('games') ?? 20),
  policies: list('policies'),
  shapes: list('shapes') as BatchConfig['shapes'],
  sizes: list('sizes') as BatchConfig['sizes'],
  professionId: option('character'),
  maxTurns: option('max-turns') ? Number(option('max-turns')) : undefined,
  firstSeed: option('first-seed') ? Number(option('first-seed')) : undefined,
  rules,
};

const started = Date.now();
// --from-json file: the pages are made again from the games of an earlier run (no new simulation)
const earlier = option('from-json');
const result = earlier
  ? { ...runBatch({ ...config, games: 0 }), records: JSON.parse(readFileSync(earlier, 'utf8')) }
  : runBatch(config);
const report = reportMarkdown(result);
const docPath = option('doc');
if (docPath) {
  // the statistics go into pages the players read, between the markers of the character (--doc-name Jonas); --doc-de is the German page
  const name = option('doc-name') ?? 'jonas';
  for (const [path, lang] of [
    [docPath, 'en'],
    [option('doc-de'), 'de'],
  ] as const) {
    if (!path) continue;
    const page = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const stats = statsMarkdown(result.records, {
      profession: option('profession') ?? 'Jonas',
      maxTurns: config.maxTurns ?? 400,
      shapes: config.shapes ?? ['ring'],
      lang,
    });
    writeFileSync(path, injectStats(page, name.toLowerCase(), stats), 'utf8');
    console.log(`statistics of ${result.records.length} games -> ${path}`);
  }
}
const out = option('out');
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, report, 'utf8');
  writeFileSync(out.replace(/\.md$/, '') + '.json', JSON.stringify(result.records), 'utf8');
  console.log(
    `${result.records.length} games in ${((Date.now() - started) / 1000).toFixed(1)} s -> ${out}`,
  );
} else {
  console.log(report);
}
