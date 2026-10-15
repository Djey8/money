#!/usr/bin/env node
'use strict';

/**
 * The self-learning loop (todo/cashflow-tournament-and-bots.md): when the rules change - or just to look for better play - search
 * again, and ship a new champion only if it beats the one we have on games the search never saw.
 *
 *   npm run champions:refresh                  the full loop (hours on a big machine; see the budgets below)
 *   npm run champions:refresh -- --quick       a small run to see that everything still works (minutes; the results are NOT kept)
 *   npm run champions:refresh -- --only global|professions|characters|tournament     one step of the loop
 *
 * The steps, in order:
 *   1. build the domain package;
 *   2. the tournament: every strategy of the bot catalog at every seat, all professions, 2/4/6 seats, both rule sets
 *      (docs/domain/CASHFLOW_TOURNAMENT.md, the manual's data);
 *   3. the global search: one champion over every profession - replaces champion-v2 only if it wins on fresh games;
 *   4. the professions: a champion per profession, each starting from the one it has and replacing it only if it beats it on fresh
 *      games (champion-book.json, table/champion-book.ts, the manual's data, CASHFLOW_CHAMPIONS.md);
 *   5. the characters: the best strategy of each style (table/characters.ts);
 *   6. build again, and print what changed in the champion book.
 * Then run the tests (`npm run test:domain`, the freshness check turns green) and commit the generated files.
 * Nothing here plays live games or learns from people: it is offline search on simulated tables, reproducible from its seeds.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const quick = flag('quick');
const only = value('only', null);
const STYLES = ['investor', 'trader', 'marketer', 'banker', 'gambler', 'cautious', 'chaser'];

const budgets = quick
  ? {
      rounds: 2,
      global: '--candidates 12 --generations 2 --matches 2 --verify 60',
      pro: '--candidates 12 --generations 2 --matches 2 --verify 60',
      style: '--candidates 12 --generations 2 --matches 2 --verify 60',
    }
  : {
      rounds: 60,
      global: '--candidates 80 --generations 10 --matches 12 --verify 3000',
      pro: '--candidates 48 --generations 10 --matches 12 --verify 2000',
      style: '--candidates 48 --generations 8 --matches 10 --verify 1500',
    };

function run(label, cmd, args) {
  console.log(`\n== ${label}\n$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`\nstep failed: ${label}`);
    process.exit(result.status || 1);
  }
}
const node = (script, extra) => [
  'node',
  [path.join('scripts', script), ...extra.split(' ').filter(Boolean)],
];
const step = (name) => !only || only === name;

// what the book says now, to show what a refresh changed
const bookFile = path.join(root, 'docs/domain/strategy/data/champion-book.json');
const read = () => {
  try {
    return JSON.parse(fs.readFileSync(bookFile, 'utf8')).entries || {};
  } catch {
    return {};
  }
};
const before = read();

if (quick) {
  console.log('QUICK run: small budgets, results go to a scratch folder and are not kept.');
}
run('build the domain package', 'npm', ['run', 'build', '--workspace=packages/domain']);

const scratch = quick ? ['--out', path.join(require('os').tmpdir(), 'champions-quick')] : [];
const keepFiles = quick ? null : true;

if (step('tournament')) {
  const [c, a] = node(
    'tournament-lab.js',
    `--players 2,4,6 --rules guided,strict --professions all --mode mirror,mix --rounds ${budgets.rounds} ${quick ? '' : '--write'}`,
  );
  run('the tournament', c, a);
}
if (step('global')) {
  const [c, a] = node(
    'champion-search.js',
    `--style any --again ${budgets.global} ${scratch.join(' ')}`,
  );
  run('the global search (champion-v2)', c, a);
  if (keepFiles) {
    const [c2, a2] = node('champion-search.js', '--style any --write-characters');
    run('write the global champion and the characters found so far', c2, a2);
    run('build the domain package (the catalog now has champion-v2)', 'npm', [
      'run',
      'build',
      '--workspace=packages/domain',
    ]);
  }
}
if (step('professions')) {
  const [c, a] = node(
    'champion-search.js',
    `--profession all --again --base ${value('base', keepFiles ? 'champion-v2' : 'champion-v1')} ${budgets.pro} ${keepFiles ? '--write-book' : ''} ${scratch.join(' ')}`,
  );
  run('a champion per profession', c, a);
}
if (step('characters')) {
  for (const style of STYLES) {
    const [c, a] = node(
      'champion-search.js',
      `--style ${style} --again ${budgets.style} ${scratch.join(' ')}`,
    );
    run(`the character: ${style}`, c, a);
  }
  if (keepFiles) {
    const [c, a] = node('champion-search.js', '--write-characters');
    run('write the characters', c, a);
  }
}
if (keepFiles)
  run('build the domain package again', 'npm', ['run', 'build', '--workspace=packages/domain']);

const after = read();
console.log('\n== what changed in the champion book');
let changed = 0;
for (const [id, entry] of Object.entries(after)) {
  const old = before[id];
  if (!old || old.spec.id !== entry.spec.id) {
    changed += 1;
    console.log(
      `  ${entry.title}: ${old ? old.spec.id : '(new)'} -> ${entry.spec.id}  (${(entry.winRate * 100).toFixed(1)}% vs ${(entry.championV1WinRate * 100).toFixed(1)}%)`,
    );
  }
}
if (!changed) console.log('  nothing: every champion stands.');
console.log(
  '\nNext: run the tests, then commit the generated files (docs/domain/strategy/data, the champion book and characters in packages/domain, the manual data).',
);
