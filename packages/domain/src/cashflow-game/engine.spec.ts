import { fundingRoomMinor, summarizeGameFinances } from './saved-games';
import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import {
  addMonthsToIsoDate,
  adjustCashflowBankLoan,
  clearCashflowStatus,
  computeCashflowProfessionMonthlyCashflowMinor,
  computeMonthlyCashflowMinor,
  paydaySubscriptions,
  pickCashflowProfession,
  resolveCashflowBaby,
  resolveCashflowCharity,
  resolveCashflowDownsized,
  runCashflowPayday,
  undoLastCashflowPayday,
} from './engine';
import { CashflowGameSubscription } from './engine';
import { initialCashflowGameState } from './types';

describe('funding plans at Payday (JFK, 2026-10-25)', () => {
  const started = (virtualDate: string) => ({
    ...initialCashflowGameState(),
    professionId: 'p',
    gameSetId: 'g',
    virtualDate,
    gameSubscriptionTitles: ['Salary'],
    fundingSubscriptionTitles: ['Save for the guide'],
  });
  const subs = [
    { title: 'Salary', account: 'Income', amountMinor: 100000 },
    {
      title: 'Save for the guide',
      account: 'Daily',
      amountMinor: -30000,
      category: '@Mountain guide',
      comment: '#bucket:Equipment:300.00',
      startDate: '2026-11-15',
      endDate: '2027-01-15', // three paydays: 15 Nov, 15 Dec, 15 Jan
    },
  ];

  it('are posted on the Paydays between their start and their end - and only on those', () => {
    const dates = ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15'];
    const counts = dates.map((date) => paydaySubscriptions(started(date), subs).length);
    expect(counts).toEqual([1, 2, 2, 2, 1]);
  });

  it('carry their bucket tag and category into the transaction, and are not part of the monthly picture', () => {
    const state = started('2026-12-15');
    const { transactions } = runCashflowPayday(state, subs);
    expect(transactions).toHaveLength(2);
    expect(transactions[1]).toMatchObject({
      amountMinor: -30000,
      category: '@Mountain guide',
    });
    expect(transactions[1].comment).toContain('#bucket:Equipment:300.00');
    // the monthly picture reads the game's own subscriptions only
    expect(summarizeGameFinances(state, subs).expensesMinor).toBe(0);
  });
});

describe('what the month has free for funding plans', () => {
  const state = {
    ...initialCashflowGameState(),
    professionId: 'p',
    gameSetId: 'g',
    virtualDate: '2026-12-15',
    gameSubscriptionTitles: ['Salary', 'Rent'],
    fundingSubscriptionTitles: ['Plan A', 'Plan B'],
  };
  const subs = [
    { title: 'Salary', amountMinor: 283300 },
    { title: 'Rent', amountMinor: -233300 },
    { title: 'Plan A', amountMinor: -20000, endDate: '2027-06-15' },
    { title: 'Plan B', amountMinor: -10000, endDate: '2026-11-15' }, // over
  ];

  it('is the cashflow of the month less what the running plans pay: a plan that is over takes nothing', () => {
    expect(fundingRoomMinor(state, subs)).toBe(30000); // 500 - 200
    expect(fundingRoomMinor(state, subs, 'Plan A')).toBe(50000); // changing Plan A: it is not counted against itself
  });

  it('is never below zero', () => {
    const heavy = [
      ...subs.slice(0, 2),
      { title: 'Plan A', amountMinor: -900000, endDate: '2030-01-01' },
    ];
    expect(fundingRoomMinor(state, heavy)).toBe(0);
  });
});

describe('the custom edition: the dual student (JFK, 2026-10-25)', () => {
  const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories')!;
  const student = set.professions.find(
    (profession) => profession.id === 'dual-student-informatik',
  )!;

  it('is the only character of the edition, with a story in English and German and a checklist to win', () => {
    expect(set.edition).toBe('custom');
    expect(set.professions.map((profession) => profession.id)).toEqual(['dual-student-informatik']);
    expect(student.profile?.texts['en'].dream.title).toBeTruthy();
    expect(student.profile?.texts['de'].goal).toBeTruthy();
    for (const lang of ['en', 'de']) {
      expect(student.profile?.texts[lang].goalItems.map((item) => item.id)).toEqual([
        'parentsLoan',
        'carLoan',
        'dream',
        'reserve',
        'independence',
      ]);
    }
  });

  it('has an emergency reserve of three monthly expenses as a Fire project in both languages', () => {
    const monthly = student.expenses.reduce((sum, line) => sum + line.amountMinor, 0);
    for (const lang of ['en', 'de']) {
      const project = student.profile?.texts[lang].reserve?.project;
      expect(project?.buckets).toHaveLength(3);
      expect(project?.buckets.reduce((sum, bucket) => sum + bucket.targetMinor, 0)).toBe(
        3 * monthly,
      );
    }
  });

  it('keeps 500 euros a month: 34.000 a year gross, 845 of it for tax and the social insurances', () => {
    expect(student.salaryMinor).toBe(283300);
    expect(computeCashflowProfessionMonthlyCashflowMinor(student)).toBe(50000);
    const deductions = [
      'incomeTax',
      'pension',
      'healthInsurance',
      'careInsurance',
      'unemploymentInsurance',
    ];
    const taken = student.expenses
      .filter((line) => deductions.includes(line.key ?? ''))
      .reduce((sum, line) => sum + line.amountMinor, 0);
    expect(taken).toBe(84500);
  });

  it('starts with the dream as a Smile project: eight buckets, about 24.500, with notes, links and tasks, in both languages', () => {
    for (const lang of ['en', 'de']) {
      const project = student.profile!.texts[lang].dream.project!;
      expect(project.buckets).toHaveLength(8);
      expect(project.buckets.reduce((sum, bucket) => sum + bucket.targetMinor, 0)).toBe(2450000);
      expect(project.buckets.every((bucket) => bucket.notes.length > 20)).toBe(true);
      expect(project.links.length).toBeGreaterThan(2);
      expect(project.actionItems.length).toBeGreaterThan(5);
      expect(project.title).toBeTruthy();
    }
    const ids = student.profile!.texts['en'].dream.project!.buckets.map((bucket) => bucket.id);
    expect(student.profile!.texts['de'].dream.project!.buckets.map((bucket) => bucket.id)).toEqual(
      ids,
    );
  });

  it('books leisure to Splurge and the rest to Daily, and starts with two small debts (3.000 together) and almost no assets', () => {
    const picked = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'jfk-stories',
      'dual-student-informatik',
      '2026-10-25',
      'solo',
    );
    const accounts = new Map(picked.subscriptions.map((sub) => [sub.title, sub.account]));
    expect(accounts.get('Klettern')).toBe('Splurge');
    expect(accounts.get('Restaurant')).toBe('Splurge');
    expect(accounts.get('Miete')).toBe('Daily');
    expect(picked.starterKit.liabilities?.map((debt) => debt.amountMinor)).toEqual([
      150000, 150000,
    ]);
    expect(picked.starterKit.shares?.[0]).toMatchObject({ tag: 'BMW', quantity: 1 });
    // the crypto is held as shares: 3.705 coins at 0,22 are about 815
    const iota = picked.starterKit.shares?.[1];
    expect(iota?.tag).toBe('IOTA');
    expect(Math.round(((iota?.quantity ?? 0) * (iota?.priceMinor ?? 0)) / 100)).toBe(815);
  });
});

describe('CASHFLOW_GAME_SETS profession data (todo/cashflow-game.md decision 49)', () => {
  it('every Classic/Custom-JFK profession\'s monthly cashflow matches its own card\'s printed "Monatlicher Cashflow" — catches a transcription slip in any single expense line', () => {
    // { gameSetId, professionId, expectedCashflowMinor } — expectedCashflowMinor is each card's own
    // printed result, transcribed alongside every other figure on the card (JFK, 2026-09-29+, sent as
    // photos of all 12 Classic professions plus the request to add "Custom JFK").
    const expected: Array<[string, string, number]> = [
      ['cashflow', 'hausmeister', 60000],
      ['cashflow', 'lehrer', 120000],
      ['cashflow', 'pilot', 350000],
      ['cashflow', 'sekretaer', 80000],
      ['cashflow', 'manager', 160000],
      ['cashflow', 'lkwFahrer', 80000],
      ['cashflow', 'polizist', 110000],
      ['cashflow', 'mechaniker', 70000],
      ['cashflow', 'anwalt', 240000],
      ['cashflow', 'krankenpfleger', 110000],
      ['cashflow', 'ingenieur', 170000],
      ['cashflow', 'arzt', 490000],
      ['custom-jfk', 'softwareentwickler', 150000],
      ['custom-jfk', 'freiberufler', 90000],
      ['custom-jfk', 'unternehmer', 160000],
    ];

    for (const [gameSetId, professionId, expectedCashflowMinor] of expected) {
      const gameSet = CASHFLOW_GAME_SETS.find((set) => set.id === gameSetId)!;
      const profession = gameSet.professions.find((p) => p.id === professionId)!;
      expect(profession).toBeDefined();
      expect(computeCashflowProfessionMonthlyCashflowMinor(profession)).toBe(expectedCashflowMinor);
    }
  });

  it('Classic Edition kept its id ("cashflow") so an already-running game is never orphaned, even though it now shows as "Classic Edition"', () => {
    const classic = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow');
    expect(classic).toBeDefined();
    expect(classic!.professions).toHaveLength(12); // hausmeister + the 11 newly added
  });

  it('Custom JFK exists as its own game set with 3 professions', () => {
    const customJfk = CASHFLOW_GAME_SETS.find((set) => set.id === 'custom-jfk');
    expect(customJfk).toBeDefined();
    expect(customJfk!.professions.map((p) => p.id)).toEqual([
      'softwareentwickler',
      'freiberufler',
      'unternehmer',
    ]);
  });
});

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
      gameSubscriptionTitles: ['Placeholder profession Salary', 'Placeholder Expenses'],
      history: [],
    });
    expect(result.subscriptions).toHaveLength(2);
    // Salary gets a category too, same as every expense line — JFK, 2026-09-29+: "please fill in
    // the correct Categories (currently Salary is missing)".
    expect(result.subscriptions[0]).toMatchObject({
      title: 'Placeholder profession Salary',
      category: '@Salary',
    });
    // Only Savings posts immediately — Salary/Expenses become real transactions on the first
    // Payday instead, once the player has had a chance to edit their Subscriptions (JFK, 2026-09-29).
    expect(result.startingTransactions).toEqual([
      expect.objectContaining({
        account: 'Income',
        amountMinor: 0,
        category: '@Savings',
        date: '2026-09-25',
      }),
    ]);
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
  {
    title: 'Placeholder Expenses',
    account: 'Daily',
    amountMinor: -180000,
    category: '@Placeholder Expenses',
  },
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

    // Each subscription's own category carries through to its Payday transaction — JFK, 2026-09-26:
    // "when I clicked it right now, the correct categories where missing please fix this."
    expect(transactions).toEqual([
      expect.objectContaining({ account: 'Income', amountMinor: 300000, date: '2026-09-25' }),
      expect.objectContaining({
        account: 'Daily',
        amountMinor: -180000,
        date: '2026-09-25',
        category: '@Placeholder Expenses',
      }),
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
});

describe('runCashflowPayday — never gated by Charity/Downsized status', () => {
  it('still creates every transaction while an active Downsized/Charity status is showing', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: downsized } = resolveCashflowDownsized(started, gameSubscriptions);
    expect(downsized.unemployedRoundsLeft).toBe(2);

    const { state: afterPayday, transactions } = runCashflowPayday(downsized, gameSubscriptions);

    // JFK, 2026-09-26: "it's not that you have to skip two salaries" — the
    // 2 rounds are the physical board's turn order (opponents playing),
    // which this single-player tool can't see and must not guess at.
    expect(transactions.length).toBeGreaterThan(0);
    expect(afterPayday.round).toBe(1);
    expect(afterPayday.unemployedRoundsLeft).toBe(2); // untouched by Payday
  });
});

describe('clearCashflowStatus', () => {
  it('clears charity or unemployed independently, once the player says their own turns are done', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    const { state: both } = resolveCashflowDownsized(
      resolveCashflowCharity(started, gameSubscriptions).state,
      gameSubscriptions,
    );
    expect(both.charityRoundsLeft).toBe(0); // Downsized already ended it
    expect(both.unemployedRoundsLeft).toBe(2);

    const clearedUnemployed = clearCashflowStatus(both, 'unemployed');
    expect(clearedUnemployed.unemployedRoundsLeft).toBe(0);

    const { state: charitied } = resolveCashflowCharity(started, gameSubscriptions);
    const clearedCharity = clearCashflowStatus(charitied, 'charity');
    expect(clearedCharity.charityRoundsLeft).toBe(0);
  });
});

describe('computeMonthlyCashflowMinor', () => {
  it('sums every owned subscription — the loss condition once it goes negative', () => {
    const { state: started } = pickCashflowProfession(
      CASHFLOW_GAME_SETS,
      'placeholder',
      'placeholder-profession',
      '2026-09-25',
    );
    // salary 300000 + expenses -180000
    expect(computeMonthlyCashflowMinor(started, gameSubscriptions)).toBe(120000);

    const { state: borrowed } = adjustCashflowBankLoan(
      started,
      CASHFLOW_GAME_SETS[0],
      0,
      1500000, // borrowing enough that its 10%/month interest outweighs the surplus
    );
    expect(
      computeMonthlyCashflowMinor(borrowed, [
        ...gameSubscriptions,
        { title: 'Bank loan interest', account: 'Daily', amountMinor: -150000 },
      ]),
    ).toBe(-30000);
  });
});

describe('resolveCashflowBaby', () => {
  const profession = CASHFLOW_GAME_SETS.find((gs) => gs.id === 'placeholder')!.professions[0];

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
      amountMinor: -profession.perChildExpenseMinor, // 1 child
      frequency: 'monthly',
      category: '@Children Expenses',
    });

    const second = resolveCashflowBaby(state, profession);
    expect(second.state.children).toBe(2);
    expect(second.subscriptionUpsert.amountMinor).toBe(-profession.perChildExpenseMinor * 2);
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
      category: '@Charity',
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

    const { state, transactions } = resolveCashflowDownsized(charitied, gameSubscriptions);

    // Skips income (the salary subscription) entirely — only the expense line is paid, keeping its own
    // category rather than being lumped into one "Downsized" transaction (JFK, 2026-09-26).
    expect(transactions).toEqual([
      expect.objectContaining({ account: 'Daily', amountMinor: -180000 }),
    ]);
    expect(state.unemployedRoundsLeft).toBe(2);
    expect(state.charityRoundsLeft).toBe(0);
  });
});

describe('adjustCashflowBankLoan', () => {
  const gameSet = CASHFLOW_GAME_SETS.find((gs) => gs.id === 'placeholder')!; // incrementMinor 100000, monthlyInterestPercent 10

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
      category: '@Bank loan',
    });
    expect(result.state.gameSubscriptionTitles).toContain('Bank loan interest');
    // JFK, 2026-09-29+: "when I take a loan with the loan button can you add an income
    // transaction adding this amount to my balance" — borrowing must actually pay out.
    expect(result.transaction).toMatchObject({
      account: 'Daily',
      amountMinor: 200000,
      date: '2026-09-25',
      category: '@Bank loan',
    });
  });

  it('repaying in full removes the liability and the interest subscription, and debits the repayment', () => {
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
    // Repaying must cost real cash — otherwise debt could be erased for free.
    expect(repaid.transaction).toMatchObject({
      account: 'Daily',
      amountMinor: -100000,
      category: '@Bank loan',
    });
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
