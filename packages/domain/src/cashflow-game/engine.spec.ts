import { CASHFLOW_GAME_SETS } from './game-sets';
import {
  addMonthsToIsoDate,
  adjustCashflowBankLoan,
  pickCashflowProfession,
  resolveCashflowBaby,
  resolveCashflowCharity,
  resolveCashflowDownsized,
  runCashflowPayday,
  undoLastCashflowPayday,
} from './engine';
import { CashflowGameSubscription } from './engine';
import { initialCashflowGameState } from './types';

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
    expect(() => runCashflowPayday(initialCashflowGameState(), gameSubscriptions)).toThrow(
      'Pick a profession',
    );
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
    expect(() => undoLastCashflowPayday(started)).toThrow(
      'Only the most recent Payday can be undone',
    );
  });

  it('rewinds an active charity bonus and an unemployment skip together with undo', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: charitied } = resolveCashflowCharity(started, gameSubscriptions);
    const { state: afterPayday } = runCashflowPayday(charitied, gameSubscriptions);
    expect(afterPayday.charityRoundsLeft).toBe(2); // ticked down by the payday

    const { state: undone } = undoLastCashflowPayday(afterPayday);
    expect(undone.charityRoundsLeft).toBe(3); // restored, not just re-incremented
  });
});

describe('runCashflowPayday — unemployment skips a round entirely', () => {
  it('creates nothing, but still advances round/virtualDate and ticks the counter down', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: downsized } = resolveCashflowDownsized(started, gameSubscriptions);
    expect(downsized.unemployedRoundsLeft).toBe(2);

    const { state: afterFirst, transactions: firstTransactions } = runCashflowPayday(
      downsized,
      gameSubscriptions,
    );
    expect(firstTransactions).toEqual([]);
    expect(afterFirst.round).toBe(1);
    expect(afterFirst.unemployedRoundsLeft).toBe(1);
    expect(afterFirst.history[afterFirst.history.length - 1]).toMatchObject({ skipped: true });

    const { state: afterSecond, transactions: secondTransactions } = runCashflowPayday(
      afterFirst,
      gameSubscriptions,
    );
    expect(secondTransactions).toEqual([]);
    expect(afterSecond.unemployedRoundsLeft).toBe(0);

    // back to normal on the third payday
    const { transactions: thirdTransactions } = runCashflowPayday(afterSecond, gameSubscriptions);
    expect(thirdTransactions.length).toBeGreaterThan(0);
  });
});

describe('resolveCashflowBaby', () => {
  const profession = CASHFLOW_GAME_SETS[0].professions[0];

  it('adds a child and upserts a scaled children-expense subscription', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state, subscriptionUpsert } = resolveCashflowBaby(started, profession);

    expect(state.children).toBe(1);
    expect(state.gameSubscriptionTitles).toContain(subscriptionUpsert.title);
    expect(subscriptionUpsert).toMatchObject({
      account: 'Daily',
      amountMinor: profession.perChildExpenseMinor, // 1 child
      frequency: 'monthly',
    });

    const second = resolveCashflowBaby(state, profession);
    expect(second.state.children).toBe(2);
    expect(second.subscriptionUpsert.amountMinor).toBe(profession.perChildExpenseMinor * 2);
    // still one title, not duplicated
    expect(
      second.state.gameSubscriptionTitles.filter((t) => t === subscriptionUpsert.title),
    ).toHaveLength(1);
  });

  it('refuses a fourth child', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    let state = started;
    for (let i = 0; i < 3; i++) {
      state = resolveCashflowBaby(state, profession).state;
    }
    expect(() => resolveCashflowBaby(state, profession)).toThrow('maximum of 3 children');
  });
});

describe('resolveCashflowCharity', () => {
  it('charges 10% of total income and unlocks the dice choice for 3 rounds', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state, transaction } = resolveCashflowCharity(started, gameSubscriptions);

    // Only the salary (300000) counts as income; the expenses subscription is negative.
    expect(transaction).toMatchObject({
      account: 'Daily',
      amountMinor: -30000,
      date: '2026-09-25',
    });
    expect(state.charityRoundsLeft).toBe(3);
  });
});

describe('resolveCashflowDownsized', () => {
  it('charges total expenses once and ends any active charity bonus', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: charitied } = resolveCashflowCharity(started, gameSubscriptions);
    expect(charitied.charityRoundsLeft).toBe(3);

    const { state, transaction } = resolveCashflowDownsized(charitied, gameSubscriptions);

    expect(transaction).toMatchObject({ account: 'Daily', amountMinor: -180000 });
    expect(state.unemployedRoundsLeft).toBe(2);
    expect(state.charityRoundsLeft).toBe(0);
  });
});

describe('adjustCashflowBankLoan', () => {
  const gameSet = CASHFLOW_GAME_SETS[0]; // incrementMinor 100000, monthlyInterestPercent 10

  it('borrowing upserts the liability and a 10%/increment interest subscription', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const result = adjustCashflowBankLoan(started, gameSet, 0, 200000);

    expect(result.liabilityUpsert).toEqual({ tag: 'Bank loan', amountMinor: 200000 });
    expect(result.subscriptionUpsert).toMatchObject({
      title: 'Bank loan interest',
      amountMinor: -20000, // 10% of 200000
    });
    expect(result.state.gameSubscriptionTitles).toContain('Bank loan interest');
  });

  it('repaying in full removes the liability and the interest subscription', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: borrowed } = adjustCashflowBankLoan(started, gameSet, 0, 100000);
    const repaid = adjustCashflowBankLoan(borrowed, gameSet, 100000, -100000);

    expect(repaid.liabilityUpsert).toBeNull();
    expect(repaid.subscriptionUpsert).toBeNull();
    expect(repaid.state.gameSubscriptionTitles).not.toContain('Bank loan interest');
  });

  it('refuses an amount that is not a multiple of the increment, or repaying more than owed', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    expect(() => adjustCashflowBankLoan(started, gameSet, 0, 50000)).toThrow('steps of');
    expect(() => adjustCashflowBankLoan(started, gameSet, 100000, -200000)).toThrow(
      'Cannot repay more',
    );
    expect(() => adjustCashflowBankLoan(started, gameSet, 0, 0)).toThrow('non-zero amount');
  });
});
