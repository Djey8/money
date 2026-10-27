#!/usr/bin/env node
/**
 * The full map of the Dreamfund edition (JFK, 2026-10-27): every character x every difficulty x every strategy, played many times from
 * the same seeds. It is what the bots of the multiplayer step and the analyzer MCP are measured against, so it is run again whenever a
 * card, a character or a difficulty number changes.
 *
 *   npm run matrix:dreamfund -- --games 60 --out docs/dreamfund-balance \
 *       --benchmarks packages/domain/src/cashflow-game/analysis/dreamfund-benchmarks.ts
 *
 * Options: --games N (per strategy, character and level; default 60), --characters a,b (default all), --levels easy,medium,hard,
 * --policies a,b (default all), --max-turns N (default 150, about 60 months), --shape ring, --size medium, --jobs N (default: cores - 1),
 * --dist dir (a copy of packages/domain/dist, so that a rebuild during a long run changes nothing), --out dir (default
 * docs/dreamfund-balance), --benchmarks file (also writes the compact map the analyzer reads), --work dir (keep the raw games there),
 * --from dir (play nothing: make the pages again from the raw games of an earlier run's work dir).
 * Writes matrix.json (the numbers) and MATRIX.md (the readable map).
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const list = (name, fallback) => (arg(name) ? arg(name).split(',').filter(Boolean) : fallback);

const dist = path.resolve(root, arg('dist', 'packages/domain/dist'));
const cli = path.join(dist, 'cashflow-game/dreamfund-sim/cli.js');
const { CASHFLOW_GAME_SETS } = require(path.join(dist, 'cashflow-content.js'));
const { DREAM_POLICIES } = require(path.join(dist, 'cashflow-game/dreamfund-sim/policies.js'));
const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');
const allCharacters = set.professions.filter((p) => !p.variantOf).map((p) => p.id);
const labelOf = Object.fromEntries(DREAM_POLICIES.map((p) => [p.id, p.name]));

const games = Number(arg('games', 60));
const characters = list('characters', allCharacters);
const levels = list('levels', ['easy', 'medium', 'hard']);
const policies = list(
  'policies',
  DREAM_POLICIES.map((p) => p.id),
);
const maxTurns = Number(arg('max-turns', 150));
const shape = arg('shape', 'ring');
const size = arg('size', 'medium');
const jobs = Number(arg('jobs', Math.max(1, os.cpus().length - 1)));
const outDir = path.resolve(root, arg('out', 'docs/dreamfund-balance'));
const from = arg('from');
const work = from
  ? path.resolve(from)
  : arg('work')
    ? path.resolve(arg('work'))
    : fs.mkdtempSync(path.join(os.tmpdir(), 'dreamfund-matrix-'));
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const tasks = characters.flatMap((character) => levels.map((level) => ({ character, level })));
const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
};
/** A roll is about 0.4 of a month (a Payday comes about every 2.5 rolls on the medium maps). */
const months = (turns) => (turns === null ? null : Math.round(turns / 2.5));
const matrix = {};
let done = 0;

function aggregate(records) {
  const cell = {};
  for (const policy of policies) {
    const rows = records.filter((r) => r.policyId === policy);
    const won = rows.filter((r) => r.outcome === 'won');
    const share = (outcome) =>
      rows.filter((r) => r.outcome === outcome).length / (rows.length || 1);
    const turns = won.map((r) => r.wonTurn);
    const reached = (field) =>
      rows.filter((r) => r[field] !== undefined).length / (rows.length || 1);
    const median = (field) =>
      quantile(
        rows.filter((r) => r[field] !== undefined).map((r) => r[field]),
        0.5,
      );
    cell[policy] = {
      games: rows.length,
      win: won.length / (rows.length || 1),
      bankrupt: share('bankrupt'),
      timeout: share('timeout'),
      error: share('error'),
      turnsToWin: turns.length
        ? { p25: quantile(turns, 0.25), median: quantile(turns, 0.5), p75: quantile(turns, 0.75) }
        : null,
      reached: {
        reserve: reached('reserveFullTurn'),
        debts: reached('debtsRepaidTurn'),
        dream: reached('dreamLivedTurn'),
        independent: reached('independentTurn'),
      },
      medianTurn: {
        reserve: median('reserveFullTurn'),
        debts: median('debtsRepaidTurn'),
        dream: median('dreamLivedTurn'),
        independent: median('independentTurn'),
      },
      peakPassiveMedianMinor: quantile(
        rows.map((r) => r.peakPassiveMinor),
        0.5,
      ),
      netWorthMedianMinor: quantile(
        rows.map((r) => r.netWorthMinor),
        0.5,
      ),
    };
  }
  return cell;
}

function finish(task, out) {
  const records = JSON.parse(fs.readFileSync(out.replace(/\.md$/, '') + '.json', 'utf8'));
  (matrix[task.character] ||= {})[task.level] = aggregate(records);
  done += 1;
  console.log(`[${done}/${tasks.length}] ${task.character} ${task.level}`);
}

function run(task) {
  const out = path.join(work, `${task.level}-${task.character}.md`);
  if (from) return Promise.resolve(finish(task, out));
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        '--games',
        String(games),
        '--policies',
        policies.join(','),
        '--character',
        task.character,
        '--difficulty',
        task.level,
        '--max-turns',
        String(maxTurns),
        '--shapes',
        shape,
        '--sizes',
        size,
        '--out',
        out,
      ],
      { stdio: 'ignore' },
    );
    child.on('exit', (code) => {
      if (code !== 0)
        return reject(new Error(`${task.character} ${task.level} exited with ${code}`));
      finish(task, out);
      resolve();
    });
    child.on('error', reject);
  });
}

/** The strategy that wins most (ties: the one that gets furthest, then the quicker one). */
function bestOf(cell) {
  return policies
    .map((id) => ({ id, stats: cell[id] }))
    .sort(
      (a, b) =>
        b.stats.win - a.stats.win ||
        b.stats.reached.independent - a.stats.reached.independent ||
        (a.stats.turnsToWin?.median ?? Infinity) - (b.stats.turnsToWin?.median ?? Infinity),
    )[0];
}

async function main() {
  const queue = [...tasks];
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (queue.length) await run(queue.shift());
    }),
  );
  const result = {
    generated: new Date().toISOString().slice(0, 10),
    config: { games, maxTurns, shape, size, policies, levels },
    matrix,
  };
  fs.writeFileSync(path.join(outDir, 'matrix.json'), JSON.stringify(result, null, 1));
  fs.writeFileSync(path.join(outDir, 'MATRIX.md'), markdown(result));
  // the same map for the agents: explain_concept topic dreamfund_map
  fs.writeFileSync(path.join(root, 'docs/domain/DREAMFUND_MAP.md'), markdown(result));
  for (const [docPath, lang] of [
    [arg('doc'), 'en'],
    [arg('doc-de'), 'de'],
  ]) {
    if (!docPath) continue;
    const file = path.resolve(root, docPath);
    const page = fs.readFileSync(file, 'utf8');
    const start = '<!-- matrix:start -->';
    const end = '<!-- matrix:end -->';
    const a = page.indexOf(start);
    const b = page.indexOf(end);
    if (a < 0 || b < a) throw new Error(`${docPath} has no ${start} ... ${end}`);
    fs.writeFileSync(
      file,
      `${page.slice(0, a + start.length)}\n\n${docTable(result, lang)}\n\n${page.slice(b)}`,
    );
    console.log(`the map is in ${docPath}`);
  }
  const benchmarks = arg('benchmarks');
  if (benchmarks) fs.writeFileSync(path.resolve(root, benchmarks), benchmarkSource(result));
  console.log(`written to ${outDir}`);
}

const pct = (value) => `${Math.round(value * 100)}%`;
const round3 = (value) => Math.round(value * 1000) / 1000;

/** The readers' table: per character and difficulty the best strategy and how often it won. */
function docTable({ config, matrix: data }, lang) {
  const de = lang === 'de';
  const names = {
    'dual-student-informatik': 'Jonas',
    'mehmet-elektroniker': 'Mehmet',
    'lena-pflege': 'Lena',
    'sophie-lehrerin': 'Sophie',
    'tobias-designer': 'Tobias',
    'katrin-marketing': 'Katrin',
    'frank-ingenieur': 'Frank',
    'jan-oberarzt': 'Dr. Jan',
    'heike-werkstatt': 'Heike',
    'peter-busfahrer': 'Peter',
  };
  const level = { easy: de ? 'Leicht' : 'Easy', medium: 'Normal', hard: de ? 'Schwer' : 'Hard' };
  const lines = [
    `| ${de ? 'Charakter' : 'Character'} | ${config.levels.map((l) => level[l]).join(' | ')} |`,
    `|---|${config.levels.map(() => '---').join('|')}|`,
  ];
  for (const [character, levelsOf] of Object.entries(data)) {
    const cells = config.levels.map((l) => {
      const cell = levelsOf[l];
      if (!cell) return '-';
      const { id, stats } = bestOf(cell);
      return `**${pct(stats.win)}** ${labelOf[id] ?? id}`;
    });
    lines.push(`| ${names[character] ?? character} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

function markdown({ config, matrix: data, generated }) {
  const lines = [
    '# The Dreamfund map',
    '',
    `Generated ${generated}: ${config.games} games per strategy, character and level on the ${config.shape} ${config.size} map, up to ${config.maxTurns} rolls (about ${Math.round(config.maxTurns / 2.5)} months).`,
    'Win rates are shares of games won (all five goals); the best strategy of a row is in bold. With this many games a cell is exact to about +/- 7 points.',
    '',
    `Strategies: ${config.policies.map((id) => `\`${id}\` ${labelOf[id] ?? id}`).join(', ')}.`,
    '',
  ];
  for (const level of config.levels) {
    lines.push(
      `## ${level}`,
      '',
      `| character | ${config.policies.join(' | ')} | best |`,
      `|---|${config.policies.map(() => '---').join('|')}|---|`,
    );
    for (const [character, levelsOf] of Object.entries(data)) {
      const cell = levelsOf[level];
      if (!cell) continue;
      const best = Math.max(...config.policies.map((p) => cell[p].win));
      lines.push(
        `| ${character} | ${config.policies.map((p) => (cell[p].win === best && best > 0 ? `**${pct(cell[p].win)}**` : pct(cell[p].win))).join(' | ')} | ${pct(best)} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Bankruptcies of the best strategy and the month each goal was reached (the typical game of that strategy)',
    '',
    '| character | level | best strategy | won | bankrupt | reserve | debts | dream | independence |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  for (const [character, levelsOf] of Object.entries(data)) {
    for (const level of config.levels) {
      const cell = levelsOf[level];
      if (!cell) continue;
      const { id, stats } = bestOf(cell);
      const at = (key) =>
        stats.medianTurn[key] === null
          ? '-'
          : `m${months(stats.medianTurn[key])} (${pct(stats.reached[key])})`;
      lines.push(
        `| ${character} | ${level} | ${labelOf[id] ?? id} | ${pct(stats.win)} | ${pct(stats.bankrupt)} | ${at('reserve')} | ${at('debts')} | ${at('dream')} | ${at('independent')} |`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** The compact map the analyzer reads (packages/domain/src/cashflow-game/analysis/dreamfund-benchmarks.ts). */
function benchmarkSource({ config, matrix: data, generated }) {
  const body = {};
  for (const [character, levelsOf] of Object.entries(data)) {
    for (const level of config.levels) {
      const cell = levelsOf[level];
      if (!cell) continue;
      const { id, stats } = bestOf(cell);
      (body[character] ||= {})[level] = {
        best: { id, label: labelOf[id] ?? id },
        winRate: round3(stats.win),
        bankruptRate: round3(stats.bankrupt),
        months: {
          reserve: months(stats.medianTurn.reserve),
          debts: months(stats.medianTurn.debts),
          dream: months(stats.medianTurn.dream),
          independence: months(stats.medianTurn.independent),
        },
        strategies: Object.fromEntries(
          policies.map((policy) => [
            policy,
            [
              round3(cell[policy].win),
              round3(cell[policy].bankrupt),
              months(cell[policy].turnsToWin?.median ?? null),
            ],
          ]),
        ),
      };
    }
  }
  return [
    '// GENERATED by scripts/dreamfund-matrix.js --benchmarks - do not edit by hand.',
    '// The map of the Dreamfund edition: for every character and difficulty, how the strategies fared (win rate, bankruptcy rate, the typical',
    '// month of a win) and when the best one reached each goal. The analyzer sets a game beside it; the bots of the multiplayer step play it.',
    '',
    'export type DreamfundLevel = ' +
      JSON.stringify(config.levels).replace(/,/g, ' | ').replace(/[[\]]/g, '') +
      ';',
    '',
    'export interface DreamfundCellBenchmark {',
    '  /** The strategy that won most often here. */',
    '  best: { id: string; label: string };',
    '  winRate: number;',
    '  bankruptRate: number;',
    '  /** The typical month of the best strategy in which each goal was reached (null: it did not get there). */',
    '  months: { reserve: number | null; debts: number | null; dream: number | null; independence: number | null };',
    '  /** Per strategy: [win rate, bankruptcy rate, typical month of a win or null]. */',
    '  strategies: Record<string, [number, number, number | null]>;',
    '}',
    '',
    `export const DREAMFUND_MAP_META = { generated: '${generated}', gamesPerCell: ${config.games}, maxRolls: ${config.maxTurns} };`,
    '',
    'export const DREAMFUND_MAP: Record<string, Partial<Record<DreamfundLevel, DreamfundCellBenchmark>>> = ' +
      JSON.stringify(body, null, 2) +
      ';',
    '',
  ].join('\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
