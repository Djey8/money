import { setDefaultTableGameSets } from '../../table/default-game-sets';
import { CASHFLOW_GAME_SETS } from '../../../cashflow-content';
import { runDreamBots } from './bot';
import { splitDreamBotId } from './bot-levels';
import { DEMO_RIGS } from './demo-rigs.generated';
import { DEMO_BOT, DEMO_CHARACTER, DEMO_SETTINGS } from './demo-setup';
import { applyDreamCommand, briefAll, createDreamTable } from './reducer';
import type { DreamCommand, DreamTable } from './types';

/**
 * The guided demo game (demo-setup.ts / demo.ts): the story of the first rounds plays out the same every time - the same tiles, the same
 * cards, the same dice - on the real rules. If a card or a rule changes so that it no longer does, this fails and the authoring
 * script (scripts/dreamfund-demo-author.js) writes the story again.
 */
const ctx = { clock: { nowIso: () => '2026-11-06T10:00:00.000Z' } };
const ME = 'me';

beforeAll(() => setDefaultTableGameSets(CASHFLOW_GAME_SETS));

function demoTable(): DreamTable {
  let table = createDreamTable(
    { id: 'demo', hostId: ME, hostName: 'Me', seed: 987654, settings: { name: 'My first table' } },
    ctx,
  ).table;
  const play = (command: DreamCommand) => {
    table = applyDreamCommand(table, ME, command, ctx).table;
  };
  play({
    type: 'add_bot',
    name: 'Coach',
    policyId: DEMO_BOT,
    professionId: DEMO_CHARACTER,
  });
  play({ type: 'set_ready', ready: true, pick: DEMO_CHARACTER } as DreamCommand);
  play({ type: 'start' });
  return briefAll(table, ctx);
}

const mine = (table: DreamTable) => table.players.find((p) => p.id === ME)!;
const bankLoan = (table: DreamTable) =>
  mine(table).life?.books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0;

function untilMyTurn(table: DreamTable): DreamTable {
  let next = table;
  for (
    let guard = 0;
    guard < 400 && next.activePlayerId !== ME && next.phase === 'playing';
    guard += 1
  ) {
    const step = runDreamBots(next, ctx).table;
    if (step.version === next.version) break;
    next = step;
  }
  return next;
}

describe('the guided demo game', () => {
  it('turns any table of one person into the demo when Coach sits down, and fixes its settings', () => {
    const table = demoTable();
    expect(table.settings).toMatchObject({
      name: 'My first table',
      demo: 'basics',
      ranked: false,
      layoutSeed: DEMO_SETTINGS.layoutSeed,
      difficulty: 'medium',
    });
    expect(mine(table).professionId).toBe(DEMO_CHARACTER);
    const lobby = createDreamTable(
      { id: 'two', hostId: ME, hostName: 'Me', seed: 1, settings: { name: 'Two', maxSeats: 3 } },
      ctx,
    ).table;
    const withBot = applyDreamCommand(
      lobby,
      ME,
      { type: 'add_bot', name: 'Bot', policyId: 'expert' },
      ctx,
    ).table;
    expect(() =>
      applyDreamCommand(withBot, ME, { type: 'add_bot', name: 'Coach', policyId: DEMO_BOT }, ctx),
    ).toThrow(/Coach plays the guided demo/);
    const waiting = applyDreamCommand(
      lobby,
      ME,
      { type: 'add_bot', name: 'Coach', policyId: DEMO_BOT },
      ctx,
    ).table;
    expect(waiting.settings.demo).toBe('basics');
    expect(() =>
      applyDreamCommand(waiting, ME, { type: 'update_settings', settings: { ranked: true } }, ctx),
    ).toThrow(/fixed settings/);
  });

  it('is a table that is never ranked, with the bot Coach', () => {
    const table = demoTable();
    expect(table.settings.demo).toBe('basics');
    expect(table.settings.ranked).toBe(false);
    expect(splitDreamBotId(DEMO_BOT)).not.toBeNull();
    expect(table.players.some((p) => p.bot?.policyId === DEMO_BOT)).toBe(true);
  });

  it('plays the story with the same tiles and cards every time', () => {
    let table = demoTable();
    const play = (command: DreamCommand) => {
      const result = applyDreamCommand(table, ME, command, ctx);
      table = result.table;
      return result.events;
    };
    const landedOn = (events: { type: string; data?: unknown }[]) =>
      (events.find((e) => e.type === 'rolled')?.data as { to: number } | undefined)?.to;

    play({ type: 'fund_reserve', amountMinor: 5000 });
    play({ type: 'fund_dream', amountMinor: 5000 });
    const turn = (tile: number) => {
      const events = play({ type: 'roll' });
      expect(landedOn(events)).toBe(tile);
      return events;
    };
    const next = () => {
      play({ type: 'end_turn' });
      table = untilMyTurn(table);
    };
    // turn 1: an Opportunity tile with the free subscription audit
    turn(2);
    play({ type: 'choose_pile', pile: 'seed' });
    expect((mine(table).pending as { offers: string[] }).offers).toContain('S01');
    play({ type: 'take_opportunity', cardId: 'S01' });
    play({ type: 'roll_opportunity' });
    next();
    // turn 2: an emergency bigger than the cash and the reserve: the Bank lends 1,000
    turn(4);
    expect(mine(table).pending).toMatchObject({ kind: 'emergency', cardId: 'E108' });
    play({ type: 'pay_emergency', pay: 'now' });
    expect(bankLoan(table)).toBe(100000);
    next();
    // turn 3: Harvest, turn 4: Payday - the month is settled and the loan repaid
    turn(6);
    next();
    turn(9);
    expect(mine(table).paydayDue).toBe(true);
    play({ type: 'settle_payday' });
    play({ type: 'repay_bank_loan', amountMinor: 100000 });
    expect(bankLoan(table)).toBe(0);
    next();
    // turn 5: a Dream tile, turn 6: a Life card
    turn(14);
    expect(mine(table).pending).toMatchObject({ kind: 'dream' });
    play({ type: 'take_dream', cardId: 'D64' });
    play({ type: 'set_plan', kind: 'smile', id: 'D64', perMinor: 5000 });
    next();
    turn(16);
    expect(mine(table).pending).toMatchObject({ kind: 'life', cardId: 'L26' });
    play({ type: 'answer_life', decision: 'accept' });
    next();
    // turn 7: the second Payday, turn 8: a promotion
    turn(18);
    play({ type: 'settle_payday' });
    next();
    turn(19);
    expect(mine(table).resolved).toMatchObject({ kind: 'career', result: { kind: 'promoted' } });
    expect(table.demoStep).toBe(DEMO_RIGS.length);
  });

  it('forces nothing at a normal table', () => {
    const settings = { ...DEMO_SETTINGS, demo: undefined };
    const table = createDreamTable(
      { id: 'plain', hostId: ME, hostName: 'Me', seed: 987654, settings },
      ctx,
    ).table;
    expect(table.settings.demo).toBeUndefined();
    expect(table.demoStep).toBeUndefined();
  });
});
