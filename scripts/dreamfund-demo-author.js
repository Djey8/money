#!/usr/bin/env node
/**
 * Writes the script of the guided Dreamfund demo game (packages/domain/src/cashflow-game/dreamfund/table/demo-rigs.generated.ts).
 *
 * The demo is a real table: the person plays Jonas against the bot Coach on a fixed map. What makes it a lesson is that the dice and the
 * cards are always the same. A table's randomness is one number (`rngState`); for every move of the story that must come out one way
 * (this die, this card) the search below tries numbers until the real rules give the wanted result, and writes it down. The game then
 * plays the rig instead of its own number when a demo table's person makes that move (`demo.ts`).
 *
 * Run it after any change of cards, rules or the map (and `npm run build:domain` first):  node scripts/dreamfund-demo-author.js
 * It fails loudly when the story cannot be played any more, so a changed card never silently breaks the demo.
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
require(path.join(root, 'backend/services/game-sets.js'));
const dist = path.join(root, 'packages/domain/dist/cashflow-game/dreamfund/table/');
const R = require(`${dist}reducer`);
const V = require(`${dist}view`);
const BOT = require(`${dist}bot`);
const DEMO = require(`${dist}demo-setup`);

const ctx = { clock: { nowIso: () => '2026-11-06T10:00:00.000Z' } };
const ME = 'me';
const rigs = [];
const log = [];

const me = (t) => t.players.find((p) => p.id === ME);
const summary = (t) => V.projectDreamFor(t, ME).players.find((p) => p.name === 'Me').summary;
const apply = (t, cmd) => R.applyDreamCommand(t, ME, cmd, ctx);

function start() {
  let t = R.createDreamTable(
    { id: 'demo', hostId: ME, hostName: 'Me', seed: 12345, settings: DEMO.DEMO_SETTINGS },
    ctx,
  ).table;
  t = apply(t, {
    type: 'add_bot',
    name: 'Coach',
    policyId: DEMO.DEMO_BOT,
    professionId: DEMO.DEMO_CHARACTER,
  }).table;
  t = apply(t, { type: 'set_ready', ready: true, pick: DEMO.DEMO_CHARACTER }).table;
  t = apply(t, { type: 'start' }).table;
  // the search plays with the table's own number: the rigs are what it is writing
  t = { ...t, settings: { ...t.settings, demo: undefined } };
  return R.briefAll(t, ctx);
}

function toMe(t) {
  for (let g = 0; g < 400 && t.activePlayerId !== ME && t.phase === 'playing'; g += 1) {
    const next = BOT.runDreamBots(t, ctx).table;
    if (next.version === t.version) break;
    t = next;
  }
  return t;
}

/** Plays a move as it is. */
function plain(t, cmd, label) {
  const r = apply(t, cmd);
  log.push(label ?? cmd.type);
  const sm = summary(r.table);
  console.log(
    (label ?? cmd.type).padEnd(34),
    'cash',
    sm.cashMinor / 100,
    'reserve',
    sm.reserveMinor / 100,
    'dream',
    sm.dreamSavedMinor / 100,
    'loan',
    sm.bankLoanMinor / 100,
    'flow',
    sm.cashflowMinor / 100,
  );
  return r.table;
}

/** Plays a move whose result must be one way: searches the number that makes it so, and writes it down as a rig. */
function rig(t, cmd, wanted, label) {
  for (let i = 1; i <= 60000; i += 1) {
    const state = Math.imul(i, 2654435761) >>> 0;
    let r;
    try {
      r = R.applyDreamCommand({ ...t, rngState: state }, ME, cmd, ctx);
    } catch {
      continue;
    }
    if (wanted(r, t)) {
      rigs.push({ type: cmd.type, state, label });
      log.push(`${label} [rig ${state}]`);
      return r.table;
    }
  }
  throw new Error(`The demo story cannot be played: no number gives "${label}".`);
}

const landed = (r) => r.events.find((e) => e.type === 'rolled')?.data;
const pendingOf = (r) => me(r.table).pending;

let t = start();
// the map (seed 12): 0 Payday, 2 Opportunity, 4 Emergency, 6 Harvest, 9 Payday, 14 Dream, 16 Life, 18 Payday, 19 Career
const rollTo = (tile, label, extra = () => true) =>
  rig(t, { type: 'roll' }, (r) => landed(r)?.to === tile && extra(r), label);
const endTurn = () => {
  t = plain(t, { type: 'end_turn' });
  t = toMe(t);
};

// orientation: a little money into the reserve (the Mojo) and the dream (the Smile) before the first roll
t = plain(t, { type: 'fund_reserve', amountMinor: 5000 }, 'reserve 50');
t = plain(t, { type: 'fund_dream', amountMinor: 5000 }, 'dream 50');

// turn 1: an Opportunity tile - the free subscription audit
t = rollTo(2, 'roll 1 -> Opportunity', (r) => pendingOf(r)?.kind === 'opportunity_pile');
t = rig(
  t,
  { type: 'choose_pile', pile: 'seed' },
  (r) => {
    const p = pendingOf(r);
    return p?.kind === 'opportunity' && p.offers.includes('S01') && p.offers.length === 2;
  },
  'Seed pile with the subscription audit',
);
t = plain(t, { type: 'take_opportunity', cardId: 'S01' }, 'take S01');
t = rig(
  t,
  { type: 'roll_opportunity' },
  (r) => (me(r.table).resolved?.dice ?? [0])[0] >= 4,
  'the saving card die',
);
endTurn();

// turn 2: an Emergency bigger than the cash and the reserve - the Bank lends
t = rollTo(4, 'roll 2 -> an Emergency that needs the Bank', (r) => {
  const p = pendingOf(r);
  if (p?.kind !== 'emergency') return false;
  const info = V.pendingInfoOf(me(r.table).life, p);
  const pay = info?.emergency?.payMinor;
  const short = (pay ?? 0) - summary(r.table).cashMinor - summary(r.table).reserveMinor;
  return !!pay && pay >= 170000 && pay <= 190000 && short >= 20000 && short <= 120000;
});
console.log(
  'emergency',
  me(t).pending.cardId,
  V.pendingInfoOf(me(t).life, me(t).pending).emergency.payMinor / 100,
);
t = plain(t, { type: 'pay_emergency', pay: 'now' }, 'pay the emergency');
endTurn();

// turn 3: a Harvest tile
t = rollTo(6, 'roll 3 -> Harvest');
if (V.dreamLegalActions(t, ME).some((a) => a.type === 'harvest_continue')) {
  t = plain(t, { type: 'harvest_continue' });
}
endTurn();

// turn 4: Payday - settle the month and repay the Bank
t = rollTo(9, 'roll 4 -> Payday');
t = plain(t, { type: 'settle_payday' });
const loan = summary(t).bankLoanMinor;
if (loan > 0) t = plain(t, { type: 'repay_bank_loan', amountMinor: loan }, 'repay the loan');
endTurn();

// turn 5: a Dream tile - the small dream, with a plan of 50 a month
t = rollTo(
  14,
  'roll 5 -> Dream',
  (r) => pendingOf(r)?.kind === 'dream' && pendingOf(r).offers.includes('D64'),
);
t = plain(t, { type: 'take_dream', cardId: 'D64' }, 'take the small dream D64');
t = plain(
  t,
  { type: 'set_plan', kind: 'smile', id: 'D64', perMinor: 5000 },
  'plan 50 a month into the dream',
);
endTurn();

// turn 6: a Life card - a gym membership, a cost that stays
t = rollTo(
  16,
  'roll 6 -> Life (a gym membership)',
  (r) => pendingOf(r)?.kind === 'life' && pendingOf(r).cardId === 'L26',
);
t = plain(t, { type: 'answer_life', decision: 'accept' }, 'accept the gym membership');
endTurn();

// turn 7: the second Payday - the plans pay in
t = rollTo(18, 'roll 7 -> Payday');
t = plain(t, { type: 'settle_payday' });
endTurn();

// turn 8: the Career tile - a promotion
t = rollTo(
  19,
  'roll 8 -> Career, promoted',
  (r) => me(r.table).resolved?.result?.kind === 'promoted',
);
console.log(
  'promoted',
  JSON.stringify(me(t).resolved),
  'cash',
  summary(t).cashMinor / 100,
  'loan',
  summary(t).bankLoanMinor / 100,
);
endTurn();

const out = path.join(
  root,
  'packages/domain/src/cashflow-game/dreamfund/table/demo-rigs.generated.ts',
);
const body = rigs
  .map((r) => `  { type: '${r.type}', state: ${r.state}, label: ${JSON.stringify(r.label)} },`)
  .join('\n');
fs.writeFileSync(
  out,
  [
    '// Written by scripts/dreamfund-demo-author.js - do not edit by hand.',
    "import type { DemoRig } from './demo';",
    '',
    '/** The forced throws of the guided demo, in the order the story makes them. */',
    'export const DEMO_RIGS: DemoRig[] = [',
    body,
    '];',
    '',
  ].join('\n'),
);
execSync(`npx prettier --write "${out}"`, { stdio: 'ignore' });
console.log(`Wrote ${rigs.length} rigs to demo-rigs.generated.ts`);
