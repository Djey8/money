#!/usr/bin/env node
/**
 * Does a bot at a table play like the bot of the simulation? (todo/dreamfund-multiplayer.md, slice 3.) A person who only rolls and a
 * bot with a strategy sit at a Dreamfund table; the game is played until the bot has won or the rounds are used up. The share of wins
 * is compared with the simulation's (`docs/dreamfund-balance/matrix.json`, the same character, strategy and difficulty).
 *
 *   node scripts/dreamfund-table-check.js --policy expert --character dual-student-informatik --difficulty medium --tables 30
 */
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const dist = path.resolve(root, arg('dist', 'packages/domain/dist/cashflow-game/dreamfund'));
const { createDreamTable, applyDreamCommand, passiveCommands } = require(
  path.join(dist, 'table/reducer.js'),
);
const { runDreamBots } = require(path.join(dist, 'table/bot.js'));

const policy = arg('policy', 'expert');
const character = arg('character', 'dual-student-informatik');
const difficulty = arg('difficulty', 'medium');
const tables = Number(arg('tables', 30));
const rounds = Number(arg('rounds', 150));
const first = Number(arg('first-seed', 1));
const ctx = { clock: { nowIso: () => '2026-11-01T10:00:00.000Z' } };

function play(seed) {
  let t = createDreamTable(
    {
      id: 'check',
      hostId: 'host',
      hostName: 'Person',
      seed,
      settings: {
        name: 'check',
        difficulty,
        endCondition: 'round-limit',
        roundLimit: rounds,
        turnOrder: 'seat',
        professions: 'duplicates',
      },
    },
    ctx,
  ).table;
  t = applyDreamCommand(
    t,
    'host',
    { type: 'add_bot', name: 'Bot', policyId: policy, professionId: character },
    ctx,
  ).table;
  t = applyDreamCommand(t, 'host', { type: 'start' }, ctx).table;
  t = applyDreamCommand(t, 'host', { type: 'pick_profession', professionId: character }, ctx).table;
  // the bot plays; the person, who is in the way, only rolls and ends the turn
  for (let guard = 0; guard < rounds * 60 && t.phase === 'playing'; guard += 1) {
    t = runDreamBots(t, ctx).table;
    if (t.phase !== 'playing') break;
    const bot = t.players.find((p) => p.bot);
    if (t.finishers.some((f) => f.playerId === bot.id && f.outcome === 'won')) break;
    const who = t.activePlayerId;
    for (const command of passiveCommands(t, who)) {
      try {
        t = applyDreamCommand(t, who, command, ctx).table;
        break;
      } catch {
        // the next passive move
      }
    }
  }
  const bot = t.players.find((p) => p.bot);
  const outcome = t.finishers.find((f) => f.playerId === bot.id)?.outcome ?? 'timeout';
  return { outcome, round: t.tableRound };
}

const results = [];
const json = process.argv.includes('--json');
const started = Date.now();
for (let i = 0; i < tables; i += 1) results.push(play(first + i));
const won = results.filter((r) => r.outcome === 'won');
const bankrupt = results.filter((r) => r.outcome === 'bankrupt');
if (json) {
  console.log(
    JSON.stringify({
      tables,
      won: won.length,
      bankrupt: bankrupt.length,
      rounds: won.map((r) => r.round),
    }),
  );
  process.exit(0);
}
console.log(
  `${policy} / ${character} / ${difficulty}: ${tables} tables, won ${Math.round((100 * won.length) / tables)}%, bankrupt ${Math.round((100 * bankrupt.length) / tables)}%` +
    (won.length
      ? `, median round of a win ${won.map((r) => r.round).sort((a, b) => a - b)[Math.floor(won.length / 2)]}`
      : '') +
    ` (${((Date.now() - started) / 1000).toFixed(0)} s)`,
);
try {
  const matrix = require(path.join(root, 'docs/dreamfund-balance/matrix.json')).matrix[character]?.[
    difficulty
  ]?.[policy];
  if (matrix) {
    console.log(
      `the simulation: won ${Math.round(matrix.win * 100)}%, bankrupt ${Math.round(matrix.bankrupt * 100)}%` +
        (matrix.turnsToWin ? `, median roll of a win ${matrix.turnsToWin.median}` : ''),
    );
  }
} catch {
  // no map on this machine
}
