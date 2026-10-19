import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { tableLegalActions } from './legal';
import { applyCommand, createTable } from './reducer';
import { testContext } from './testing';
import { TableCommandError, type Table, type TableCommand } from './types';

const ctx = testContext;
const STEP = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.loanRule.incrementMinor;

function playing(settings: object = {}): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: { name: 'T', professions: 'random', turnOrder: 'seat', maxSeats: 6, ...settings },
      seed: 5,
    },
    ctx,
  ).table;
  const steps: [string, TableCommand][] = [];
  for (const id of ['p1', 'p2']) {
    steps.push([id, { type: 'join', name: id }], [id, { type: 'set_ready', ready: true }]);
  }
  steps.push(['host', { type: 'start' }]);
  for (const [who, command] of steps) table = applyCommand(table, who, command, ctx).table;
  return table;
}

/** p1 has borrowed one step in their own turn; the host is on the move again. */
function p1OwesTheBank(settings: object = {}): Table {
  const table = playing(settings);
  const p1Turn: Table = { ...table, activePlayerId: 'p1' };
  const borrowed = applyCommand(p1Turn, 'p1', { type: 'bank_loan', amountMinor: STEP }, ctx).table;
  return { ...borrowed, activePlayerId: 'host' };
}

const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof TableCommandError) return error.code;
    throw error;
  }
  return 'accepted';
};

describe('paying the bank back when it is not your turn', () => {
  it('is on by default: a player repays at any time, and it is in the history for everybody', () => {
    const table = p1OwesTheBank();
    expect(table.settings.repayOffTurn).toBe(true);
    expect(tableLegalActions(table, 'p1').map((a) => a.action)).toContain('bank_loan');
    const repaid = applyCommand(table, 'p1', { type: 'bank_loan', amountMinor: -STEP }, ctx);
    expect(repaid.events.map((e) => e.type)).toContain('loan_changed');
    expect(repaid.table.activePlayerId).toBe('host'); // the turn is not touched
    const owed = repaid.table.players
      .find((p) => p.id === 'p1')!
      .books!.liabilities.find((l) => l.tag === 'Bank loan');
    expect(owed?.amountMinor ?? 0).toBe(0);
  });

  it('borrowing is still only in your own turn', () => {
    const table = p1OwesTheBank();
    expect(
      code(() => applyCommand(table, 'p1', { type: 'bank_loan', amountMinor: STEP }, ctx)),
    ).toBe('NOT_YOUR_TURN');
  });

  it('is refused off turn when the host switched it off, and still allowed in your own turn', () => {
    const table = p1OwesTheBank({ repayOffTurn: false });
    expect(table.settings.repayOffTurn).toBe(false);
    expect(tableLegalActions(table, 'p1').map((a) => a.action)).not.toContain('bank_loan');
    expect(
      code(() => applyCommand(table, 'p1', { type: 'bank_loan', amountMinor: -STEP }, ctx)),
    ).toBe('NOT_YOUR_TURN');
    const own: Table = { ...table, activePlayerId: 'p1' };
    expect(
      code(() => applyCommand(own, 'p1', { type: 'bank_loan', amountMinor: -STEP }, ctx)),
    ).toBe('accepted');
  });

  it('a player who owes nothing is not offered it', () => {
    const table = playing();
    expect(tableLegalActions(table, 'p1').map((a) => a.action)).not.toContain('bank_loan');
  });
});
