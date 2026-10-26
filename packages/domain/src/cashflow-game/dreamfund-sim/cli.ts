import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { reportMarkdown, runBatch, type BatchConfig } from './batch';
import type { CustomRules } from '../custom-rules';

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
  maxTurns: option('max-turns') ? Number(option('max-turns')) : undefined,
  firstSeed: option('first-seed') ? Number(option('first-seed')) : undefined,
  rules,
};

const started = Date.now();
const result = runBatch(config);
const report = reportMarkdown(result);
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
