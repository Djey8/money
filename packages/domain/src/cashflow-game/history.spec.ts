import { identityText } from './game-text';
import {
  UNDO_STACK_LIMIT,
  blankGameData,
  captureGameSnapshot,
  historySteps,
  inferStep,
  isGameSnapshot,
  keepSavedSlot,
  popUndoSteps,
  pushUndoSnapshot,
  type GameSnapshot,
  type HistoryDeps,
} from './history';
import { initialCashflowGameState, type CashflowGameState } from './types';

const deps: HistoryDeps = { text: identityText, money: (minor) => `${minor / 100}E` };

function snapshot(extra: Partial<GameSnapshot> = {}): GameSnapshot {
  return { ...blankGameData(), ...extra };
}

const started = (extra: Partial<CashflowGameState> = {}): CashflowGameState => ({
  ...initialCashflowGameState(),
  professionId: 'p',
  gameSetId: 's',
  virtualDate: '2026-10-01',
  gameSubscriptionTitles: ['Salary'],
  ...extra,
});

const tx = (category: string, comment = '') => ({ category, comment });

describe('the undo stack', () => {
  it('pushing never changes the old stack and keeps the newest on top', () => {
    const stack = [1, 2];
    const next = pushUndoSnapshot(stack, 3);
    expect(stack).toEqual([1, 2]);
    expect(next).toEqual([1, 2, 3]);
  });

  it('drops the oldest steps past the limit', () => {
    const full = Array.from({ length: UNDO_STACK_LIMIT }, (_, i) => i);
    const next = pushUndoSnapshot(full, 999);
    expect(next).toHaveLength(UNDO_STACK_LIMIT);
    expect(next[0]).toBe(1);
    expect(next[next.length - 1]).toBe(999);
    expect(pushUndoSnapshot([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('popping n steps hands back the oldest of them, and the stack without them', () => {
    expect(popUndoSteps(['a', 'b', 'c', 'd'], 1)).toEqual({
      snapshot: 'd',
      stack: ['a', 'b', 'c'],
    });
    expect(popUndoSteps(['a', 'b', 'c', 'd'], 3)).toEqual({ snapshot: 'b', stack: ['a'] });
  });

  it('popping more than there is takes everything; popping nothing or from nothing takes nothing', () => {
    expect(popUndoSteps(['a', 'b'], 9)).toEqual({ snapshot: 'a', stack: [] });
    expect(popUndoSteps(['a'], 0)).toEqual({ snapshot: undefined, stack: ['a'] });
    expect(popUndoSteps([], 1)).toEqual({ snapshot: undefined, stack: [] });
    expect(popUndoSteps(['a'], -3)).toEqual({ snapshot: undefined, stack: ['a'] });
  });
});

describe('snapshots', () => {
  it('a captured snapshot is a deep copy that no later change can reach', () => {
    const live = snapshot({ allTransactions: [tx('@A')], cashflowGame: started() });
    const copy = captureGameSnapshot(live);
    live.allTransactions.push(tx('@B'));
    live.cashflowGame.round = 7;
    expect(copy.allTransactions).toHaveLength(1);
    expect(copy.cashflowGame.round).toBe(0);
  });

  it('recognises a game, and refuses anything shaped differently', () => {
    expect(isGameSnapshot(snapshot({ cashflowGame: started() }))).toBe(true);
    const good = snapshot({ cashflowGame: started() }) as unknown as Record<string, unknown>;
    for (const broken of [
      null,
      undefined,
      {},
      'a game',
      { ...good, allTransactions: undefined },
      { ...good, allFireEmergencies: 'x' },
      { ...good, mojo: undefined },
      { ...good, cashflowGame: undefined },
      { ...good, cashflowGame: { ...started(), gameSubscriptionTitles: 'x' } },
    ]) {
      expect(isGameSnapshot(broken)).toBe(false);
    }
  });

  it('restoring keeps the saved slot the game has now, and leaves a game without one alone', () => {
    const old = snapshot({ cashflowGame: started() });
    const kept = keepSavedSlot(old, { gameId: 'g1', gameName: 'My game' });
    expect(kept.cashflowGame).toMatchObject({ gameId: 'g1', gameName: 'My game' });
    expect(old.cashflowGame.gameId).toBeUndefined(); // not mutated
    expect(keepSavedSlot(old, {})).toBe(old);
  });

  it('a blank game has every list empty, Mojo at zero and a fresh state', () => {
    const blank = blankGameData();
    for (const key of [
      'allTransactions',
      'allSubscriptions',
      'allGrowProjects',
      'allShares',
      'allInvestments',
      'allAssets',
      'liabilities',
      'allSmileProjects',
      'allFireEmergencies',
    ] as const) {
      expect(blank[key]).toEqual([]);
    }
    expect(blank.mojo).toEqual({ amount: 0, target: 0 });
    expect(blank.cashflowGame).toEqual(initialCashflowGameState());
    expect(isGameSnapshot(blank)).toBe(true);
    // a fresh object every time, so one reset can never leak into the next
    expect(blankGameData().allTransactions).not.toBe(blank.allTransactions);
  });
});

describe('inferStep (steps saved before history tracking)', () => {
  const live = (extra: Partial<GameSnapshot> = {}) =>
    snapshot({ cashflowGame: started(), ...extra });

  it('names a start and a reset from the profession appearing or going', () => {
    expect(inferStep(snapshot(), live(), deps)).toEqual({ kind: 'start' });
    expect(inferStep(live(), snapshot(), deps)).toEqual({ kind: 'reset' });
  });

  it('a round that went up is a Payday, in the game’s words', () => {
    expect(inferStep(live(), live({ cashflowGame: started({ round: 3 }) }), deps)).toEqual({
      kind: 'payday',
      detail: 'CashflowGame.Round 3',
    });
  });

  it('a child, a charity and a downsizing are told apart', () => {
    expect(inferStep(live(), live({ cashflowGame: started({ children: 1 }) }), deps).kind).toBe(
      'baby',
    );
    expect(
      inferStep(live(), live({ cashflowGame: started({ charityRoundsLeft: 3 }) }), deps).kind,
    ).toBe('charity');
    expect(
      inferStep(live(), live({ cashflowGame: started({ unemployedRoundsLeft: 2 }) }), deps).kind,
    ).toBe('downsized');
  });

  it('a change of the Bank loan is a borrow or a repayment, with the amount', () => {
    const owing = (amount: number) => live({ liabilities: [{ tag: 'Bank loan', amount }] });
    expect(inferStep(owing(0), owing(2000), deps)).toEqual({ kind: 'loanTaken', detail: '2000E' });
    expect(inferStep(owing(2000), owing(500), deps)).toEqual({
      kind: 'loanRepaid',
      detail: '1500E',
    });
  });

  it('a new transaction is read for what it says: a card sale, a Grow trade, a plain entry', () => {
    const before = live();
    expect(inferStep(before, live({ allTransactions: [tx('@OK4U card sale')] }), deps)).toEqual({
      kind: 'cardSale',
      detail: 'OK4U',
    });
    expect(
      inferStep(before, live({ allTransactions: [tx('@OK4U', 'Buy Share OK4U 5 x 10;')] }), deps),
    ).toEqual({ kind: 'buyShare', detail: 'OK4U' });
    expect(inferStep(before, live({ allTransactions: [tx('@Food', 'Lunch')] }), deps)).toEqual({
      kind: 'transaction',
      detail: 'Food',
    });
  });

  it('a Grow project with no money moving is a plan; nothing at all is a plain transaction', () => {
    expect(inferStep(live(), live({ allGrowProjects: [{}] }), deps).kind).toBe('planDeal');
    expect(inferStep(live(), live(), deps)).toEqual({ kind: 'transaction' });
  });
});

describe('historySteps', () => {
  it('lists every step newest first, numbered from the first thing that happened', () => {
    const stack = [
      snapshot({ step: { kind: 'start', at: 't1' }, cashflowGame: started() }),
      snapshot({
        step: { kind: 'payday', detail: 'Round 1', at: 't2' },
        cashflowGame: started(),
        allTransactions: [tx('@Savings')],
      }),
    ];
    const live = snapshot({
      cashflowGame: started({ round: 1 }),
      allTransactions: [tx('@Savings'), tx('@Salary'), tx('@Rent')],
    });

    const list = historySteps(stack, live, deps);

    expect(list.map((s) => [s.number, s.kind, s.detail])).toEqual([
      [2, 'payday', 'Round 1'],
      [1, 'start', ''],
    ]);
    expect(list[0].at).toBe('t2');
    expect(list[0].id).toBe('t2-1');
  });

  it('each line holds only what its own step added to the books', () => {
    const stack = [
      snapshot({ step: { kind: 'payday', at: 'a' }, allTransactions: [] }),
      snapshot({ step: { kind: 'payday', at: 'b' }, allTransactions: [tx('@one')] }),
    ];
    const live = snapshot({ allTransactions: [tx('@one'), tx('@two'), tx('@three')] });
    const [newest, older] = historySteps(stack, live, deps);
    expect(older.transactions.map((t) => t.category)).toEqual(['@one']);
    expect(newest.transactions.map((t) => t.category)).toEqual(['@two', '@three']);
  });

  it('names an old, unnamed step from what it changed, and gives it no timestamp', () => {
    const stack = [snapshot({ cashflowGame: started() })];
    const live = snapshot({ cashflowGame: started({ children: 1 }) });
    const [only] = historySteps(stack, live, deps);
    expect(only).toMatchObject({ kind: 'baby', at: '', id: 'saved-0', number: 1 });
  });

  it('is empty for an empty stack', () => {
    expect(historySteps([], snapshot(), deps)).toEqual([]);
  });

  it('does not touch the stack it was given', () => {
    const stack = [snapshot({ step: { kind: 'start', at: 't1' } })];
    const copy = JSON.stringify(stack);
    historySteps(stack, snapshot(), deps);
    expect(JSON.stringify(stack)).toBe(copy);
  });
});
