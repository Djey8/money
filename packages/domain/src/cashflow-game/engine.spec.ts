import { CASHFLOW_GAME_SETS } from './game-sets';
import {
  addMonthsToIsoDate,
  pickCashflowProfession,
  runCashflowPayday,
  undoLastCashflowPayday,
} from './engine';
import { CashflowGameSubscription } from './engine';

describe('addMonthsToIsoDate', () => {
  it('adds whole months, clamping the day to the target month length', () => {
    expect(addMonthsToIsoDate('2026-01-31', 1)).toBe('2026-02-28'); // Feb has 28 days
    expect(addMonthsToIsoDate('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonthsToIsoDate('2026-12-05', 1)).toBe('2027-01-05'); // year rollover
  });
});

describe('pickCashflowProfession', () => {
  it('returns a fresh state plus the starter kit and a starting-cash transaction', () => {
    const result = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );

    expect(result.state).toMatchObject({
      gameSetId: 'placeholder',
      professionId: 'placeholder-profession',
      round: 0,
      virtualDate: '2026-09-25',
      gameSubscriptionTitles: [
        'Placeholder profession Salary',
        'Placeholder profession Taxes & Expenses',
      ],
      history: [],
    });
    expect(result.starterKit.subscriptions).toHaveLength(2);
    expect(result.startingCashTransaction).toMatchObject({
      account: 'Income',
      amountMinor: 300000,
      date: '2026-09-25',
    });
  });

  it('rejects an unknown game set or profession', () => {
    expect(() =>
      pickCashflowProfession(CASHFLOW_GAME_SETS, 'not-a-set', 'x', '2026-09-25'),
    ).toThrow('Unknown Cashflow game set');
    expect(() =>
      pickCashflowProfession(CASHFLOW_GAME_SETS, 'placeholder', 'not-a-profession', '2026-09-25'),
    ).toThrow('Unknown Cashflow profession');
  });
});

const gameSubscriptions: CashflowGameSubscription[] = [
  { title: 'Placeholder profession Salary', account: 'Income', amountMinor: 300000 },
  { title: 'Placeholder profession Taxes & Expenses', account: 'Daily', amountMinor: -180000 },
  { title: 'Unrelated subscription the player also has', account: 'Daily', amountMinor: -999 },
];

describe('runCashflowPayday', () => {
  it('creates one transaction per game subscription, dated at the virtual date, and advances it by a month', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );

    const { state, transactions } = runCashflowPayday(started, gameSubscriptions);

    expect(transactions).toEqual([
      expect.objectContaining({ account: 'Income', amountMinor: 300000, date: '2026-09-25' }),
      expect.objectContaining({ account: 'Daily', amountMinor: -180000, date: '2026-09-25' }),
    ]);
    // the unrelated subscription is never touched
    expect(transactions.some((t) => t.amountMinor === -999)).toBe(false);
    expect(state.round).toBe(1);
    expect(state.virtualDate).toBe('2026-10-25');
    expect(state.history).toHaveLength(1);
  });

  it('marks every created transaction with the #cashflow tag', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { transactions } = runCashflowPayday(started, gameSubscriptions);
    expect(transactions.every((t) => t.comment.includes('#cashflow'))).toBe(true);
  });

  it('refuses to run before a profession is picked', () => {
    expect(() =>
      runCashflowPayday(
        {
          gameSetId: null,
          professionId: null,
          round: 0,
          virtualDate: null,
          children: 0,
          charityRoundsLeft: 0,
          unemployedRoundsLeft: 0,
          gameSubscriptionTitles: [],
          history: [],
        },
        gameSubscriptions,
      ),
    ).toThrow('Pick a profession');
  });
});

describe('undoLastCashflowPayday', () => {
  it('rewinds round and virtualDate, and returns the transactions to remove', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: afterPayday, transactions } = runCashflowPayday(started, gameSubscriptions);

    const { state: undone, removedTransactions } = undoLastCashflowPayday(afterPayday);

    expect(undone.round).toBe(0);
    expect(undone.virtualDate).toBe('2026-09-25');
    expect(undone.history).toHaveLength(0);
    expect(removedTransactions).toEqual(transactions);
  });

  it('refuses when there is nothing to undo', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    expect(() => undoLastCashflowPayday(started)).toThrow('Nothing to undo');
  });
});
