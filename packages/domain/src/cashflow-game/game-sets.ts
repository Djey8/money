import type { CashflowGameSet } from './types';

/**
 * Exactly one placeholder game set, with obviously-fake numbers, so the MVP
 * loop (pick a profession, run Payday) is testable before JFK sends the real
 * card/profession data for the actual "Cashflow" edition being played
 * (todo/cashflow-game.md decision 6). Replace/extend `professions` in place
 * once that data arrives; add further entries to `CASHFLOW_GAME_SETS` for a
 * different edition or house rules (decision 5) — the engine never assumes
 * there is only one.
 */
const PLACEHOLDER_GAME_SET: CashflowGameSet = {
  id: 'placeholder',
  title: 'Placeholder set (fake numbers — replace with the real cards)',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  professions: [
    {
      id: 'placeholder-profession',
      title: 'Placeholder profession',
      salaryMinor: 300000,
      expenses: [{ title: 'Placeholder Expenses', amountMinor: 180000 }],
      perChildExpenseMinor: 6000,
      savingsMinor: 0,
      starterKit: {},
    },
  ],
  // Obviously-fake placeholder cards, just enough to exercise both the
  // "find this card" and "draw a card" flows before JFK sends the real
  // catalog (todo/cashflow-game.md decision 16).
  decks: {
    dealSmall: [
      {
        id: 'placeholder-deal-small-1',
        title: 'Placeholder Co. shares',
        assetKind: 'share',
        quantity: 10,
        priceMinor: 10000,
      },
      {
        id: 'placeholder-deal-small-2',
        title: 'Placeholder Duplex',
        assetKind: 'investment',
        depositMinor: 100000,
        mortgageMinor: 400000,
        cashflowMinor: 20000,
      },
    ],
    dealBig: [
      {
        id: 'placeholder-deal-big-1',
        title: 'Placeholder Office Building',
        assetKind: 'investment',
        depositMinor: 500000,
        mortgageMinor: 2000000,
        cashflowMinor: 80000,
      },
    ],
    market: [
      {
        id: 'placeholder-market-1',
        title: 'Placeholder Co. buyout offer',
        description: 'Anyone holding Placeholder Co. shares may sell at 150% of the last price.',
      },
    ],
    doodad: [{ id: 'placeholder-doodad-1', title: 'Placeholder gadget', costMinor: 15000 }],
  },
};

/**
 * JFK's real physical card set — "Classic Edition." Every expense line keeps
 * the card's own label as its Subscription title *and* category (todo/
 * cashflow-game.md decision 16's category fix); a zero-amount line is
 * skipped by the engine automatically. `id: 'cashflow'` is kept exactly as
 * it always was, even though the set is now labeled "Classic Edition" —
 * changing it would orphan any already-running game stored with this id
 * (todo/cashflow-game.md decision 49). Still fully placeholder `board`/
 * `decks` — only the profession pool is real so far.
 */
const CASHFLOW_GAME_SET: CashflowGameSet = {
  id: 'cashflow',
  title: 'Classic Edition (JFK’s physical card set)',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  professions: [
    {
      id: 'hausmeister',
      title: 'Hausmeister/in',
      salaryMinor: 160000, // Gehalt: 1.600 €
      expenses: [
        { title: 'Steuern', amountMinor: 30000, key: 'taxes' }, // 300 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 20000, key: 'mortgageRent' }, // 200 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 0, key: 'studentLoan' },
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 10000, key: 'creditCard' }, // 100 €
        { title: 'Sonstige Ausgaben', amountMinor: 30000, key: 'miscExpenses' }, // 300 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' }, // automated by the Bank loan feature instead
      ],
      perChildExpenseMinor: 10000, // Ausgaben pro Kind: 100 €
      savingsMinor: 60000, // Ersparnisse: 600 €
      starterKit: {
        // Bilanzblatt §4 Verbindlichkeiten — the balance, separate from the
        // matching expense line's *payment* above. BAföG Darlehen (0 €) is
        // skipped.
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 2000000, key: 'mortgage' }, // 20.000 €
          { tag: 'Autokredit', amountMinor: 400000, key: 'carLoan' }, // 4.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 300000, key: 'creditCardDebt' }, // 3.000 €
        ],
      },
    },
    {
      id: 'lehrer',
      title: 'Lehrer/in',
      salaryMinor: 330000, // 3.300 €
      expenses: [
        { title: 'Steuern', amountMinor: 50000, key: 'taxes' }, // 500 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 70000, key: 'mortgageRent' }, // 700 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 20000, key: 'creditCard' }, // 200 €
        { title: 'Sonstige Ausgaben', amountMinor: 50000, key: 'miscExpenses' }, // 500 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 20000, // 200 €
      savingsMinor: 40000, // 400 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 5000000, key: 'mortgage' }, // 50.000 €
          { tag: 'Autokredit', amountMinor: 400000, key: 'carLoan' }, // 4.000 €
          { tag: 'BAföG Darlehen', amountMinor: 1200000, key: 'studentLoanDebt' }, // 12.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 500000, key: 'creditCardDebt' }, // 5.000 €
        ],
      },
    },
    {
      id: 'pilot',
      title: 'Pilot/in',
      salaryMinor: 950000, // 9.500 €
      expenses: [
        { title: 'Steuern', amountMinor: 200000, key: 'taxes' }, // 2.000 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 100000, key: 'mortgageRent' }, // 1.000 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 70000, key: 'studentLoan' }, // 700 €
        { title: 'Autokreditzahlung', amountMinor: 30000, key: 'carLoan' }, // 300 €
        { title: 'Kreditkartenzahlung', amountMinor: 0, key: 'creditCard' },
        { title: 'Sonstige Ausgaben', amountMinor: 200000, key: 'miscExpenses' }, // 2.000 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 40000, // 400 €
      savingsMinor: 250000, // 2.500 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 9000000, key: 'mortgage' }, // 90.000 €
          { tag: 'Autokredit', amountMinor: 1500000, key: 'carLoan' }, // 15.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 2200000, key: 'creditCardDebt' }, // 22.000 €
        ],
      },
    },
    {
      id: 'sekretaer',
      title: 'Sekretär/in',
      salaryMinor: 250000, // 2.500 €
      expenses: [
        { title: 'Steuern', amountMinor: 40000, key: 'taxes' }, // 400 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 50000, key: 'mortgageRent' }, // 500 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 0, key: 'creditCard' },
        { title: 'Sonstige Ausgaben', amountMinor: 60000, key: 'miscExpenses' }, // 600 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 10000, // 100 €
      savingsMinor: 70000, // 700 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 3800000, key: 'mortgage' }, // 38.000 €
          { tag: 'Autokredit', amountMinor: 400000, key: 'carLoan' }, // 4.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 300000, key: 'creditCardDebt' }, // 3.000 €
        ],
      },
    },
    {
      id: 'manager',
      title: 'Manager/in',
      salaryMinor: 460000, // 4.600 €
      expenses: [
        { title: 'Steuern', amountMinor: 90000, key: 'taxes' }, // 900 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 70000, key: 'mortgageRent' }, // 700 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 20000, key: 'creditCard' }, // 200 €
        { title: 'Sonstige Ausgaben', amountMinor: 100000, key: 'miscExpenses' }, // 1.000 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 30000, // 300 €
      savingsMinor: 40000, // 400 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 7500000, key: 'mortgage' }, // 75.000 €
          { tag: 'Autokredit', amountMinor: 1200000, key: 'carLoan' }, // 12.000 €
          { tag: 'BAföG Darlehen', amountMinor: 600000, key: 'studentLoanDebt' }, // 6.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 400000, key: 'creditCardDebt' }, // 4.000 €
        ],
      },
    },
    {
      id: 'lkwFahrer',
      title: 'LKW-Fahrer/in',
      salaryMinor: 250000, // 2.500 €
      expenses: [
        { title: 'Steuern', amountMinor: 50000, key: 'taxes' }, // 500 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 40000, key: 'mortgageRent' }, // 400 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 0, key: 'studentLoan' },
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 10000, key: 'creditCard' }, // 100 €
        { title: 'Sonstige Ausgaben', amountMinor: 60000, key: 'miscExpenses' }, // 600 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 20000, // 200 €
      savingsMinor: 80000, // 800 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 3800000, key: 'mortgage' }, // 38.000 €
          { tag: 'Autokredit', amountMinor: 400000, key: 'carLoan' }, // 4.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 300000, key: 'creditCardDebt' }, // 3.000 €
        ],
      },
    },
    {
      id: 'polizist',
      title: 'Polizist/in',
      salaryMinor: 300000, // 3.000 €
      expenses: [
        { title: 'Steuern', amountMinor: 60000, key: 'taxes' }, // 600 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 40000, key: 'mortgageRent' }, // 400 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 0, key: 'creditCard' },
        { title: 'Sonstige Ausgaben', amountMinor: 70000, key: 'miscExpenses' }, // 700 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 20000, // 200 €
      savingsMinor: 50000, // 500 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 4600000, key: 'mortgage' }, // 46.000 €
          { tag: 'Autokredit', amountMinor: 500000, key: 'carLoan' }, // 5.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 300000, key: 'creditCardDebt' }, // 3.000 €
        ],
      },
    },
    {
      id: 'mechaniker',
      title: 'Mechaniker/in',
      salaryMinor: 200000, // 2.000 €
      expenses: [
        { title: 'Steuern', amountMinor: 40000, key: 'taxes' }, // 400 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 30000, key: 'mortgageRent' }, // 300 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 0, key: 'creditCard' },
        { title: 'Sonstige Ausgaben', amountMinor: 40000, key: 'miscExpenses' }, // 400 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 10000, // 100 €
      savingsMinor: 70000, // 700 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 3100000, key: 'mortgage' }, // 31.000 €
          { tag: 'Autokredit', amountMinor: 300000, key: 'carLoan' }, // 3.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 300000, key: 'creditCardDebt' }, // 3.000 €
        ],
      },
    },
    {
      id: 'anwalt',
      title: 'Anwalt/Anwältin',
      salaryMinor: 750000, // 7.500 €
      expenses: [
        { title: 'Steuern', amountMinor: 180000, key: 'taxes' }, // 1.800 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 110000, key: 'mortgageRent' }, // 1.100 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 20000, key: 'studentLoan' }, // 200 €
        { title: 'Autokreditzahlung', amountMinor: 30000, key: 'carLoan' }, // 300 €
        { title: 'Kreditkartenzahlung', amountMinor: 20000, key: 'creditCard' }, // 200 €
        { title: 'Sonstige Ausgaben', amountMinor: 150000, key: 'miscExpenses' }, // 1.500 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 40000, // 400 €
      savingsMinor: 200000, // 2.000 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 11500000, key: 'mortgage' }, // 115.000 €
          { tag: 'Autokredit', amountMinor: 1100000, key: 'carLoan' }, // 11.000 €
          { tag: 'BAföG Darlehen', amountMinor: 7800000, key: 'studentLoanDebt' }, // 78.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 700000, key: 'creditCardDebt' }, // 7.000 €
        ],
      },
    },
    {
      id: 'krankenpfleger',
      title: 'Krankenpfleger/in',
      salaryMinor: 310000, // 3.100 €
      expenses: [
        { title: 'Steuern', amountMinor: 60000, key: 'taxes' }, // 600 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 40000, key: 'mortgageRent' }, // 400 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 20000, key: 'creditCard' }, // 200 €
        { title: 'Sonstige Ausgaben', amountMinor: 60000, key: 'miscExpenses' }, // 600 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 20000, // 200 €
      savingsMinor: 50000, // 500 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 4700000, key: 'mortgage' }, // 47.000 €
          { tag: 'Autokredit', amountMinor: 600000, key: 'carLoan' }, // 6.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 400000, key: 'creditCardDebt' }, // 4.000 €
        ],
      },
    },
    {
      id: 'ingenieur',
      title: 'Ingenieur/in',
      salaryMinor: 490000, // 4.900 €
      expenses: [
        { title: 'Steuern', amountMinor: 70000, key: 'taxes' }, // 700 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 100000, key: 'mortgageRent' }, // 1.000 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 20000, key: 'studentLoan' }, // 200 €
        { title: 'Autokreditzahlung', amountMinor: 10000, key: 'carLoan' }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 20000, key: 'creditCard' }, // 200 €
        { title: 'Sonstige Ausgaben', amountMinor: 100000, key: 'miscExpenses' }, // 1.000 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 20000, // 200 €
      savingsMinor: 40000, // 400 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 7500000, key: 'mortgage' }, // 75.000 €
          { tag: 'Autokredit', amountMinor: 700000, key: 'carLoan' }, // 7.000 €
          { tag: 'BAföG Darlehen', amountMinor: 1200000, key: 'studentLoanDebt' }, // 12.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 500000, key: 'creditCardDebt' }, // 5.000 €
        ],
      },
    },
    {
      id: 'arzt',
      title: 'Arzt/Ärztin',
      salaryMinor: 1320000, // 13.200 €
      expenses: [
        { title: 'Steuern', amountMinor: 190000, key: 'taxes' }, // 1.900 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 320000, key: 'mortgageRent' }, // 3.200 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 20000, key: 'studentLoan' }, // 200 €
        { title: 'Autokreditzahlung', amountMinor: 30000, key: 'carLoan' }, // 300 €
        { title: 'Kreditkartenzahlung', amountMinor: 70000, key: 'creditCard' }, // 700 €
        { title: 'Sonstige Ausgaben', amountMinor: 200000, key: 'miscExpenses' }, // 2.000 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 70000, // 700 €
      savingsMinor: 350000, // 3.500 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 20200000, key: 'mortgage' }, // 202.000 €
          { tag: 'Autokredit', amountMinor: 1900000, key: 'carLoan' }, // 19.000 €
          { tag: 'BAföG Darlehen', amountMinor: 15000000, key: 'studentLoanDebt' }, // 150.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 1000000, key: 'creditCardDebt' }, // 10.000 €
        ],
      },
    },
  ],
};

/**
 * "Custom JFK" — same shape/rules as Classic Edition, just different
 * professions and numbers, for now (JFK, 2026-09-29+: "for custom-jfk for
 * the moment Classic with different flavour/numbers, BUT in the future not
 * today I want to modify the whole game mechanic with these different
 * sets" — todo/cashflow-game.md decision 49). Deliberately no starterKit
 * assets/investments/shares yet: pickProfession only materializes the
 * balance-sheet position for those, it doesn't create the ongoing passive-
 * income Subscription a bought investment gets via executeDeal, so giving a
 * profession a starting investment here would be a half-working feature,
 * not a real capability showcase — left for whenever the mechanic itself
 * changes. Unternehmer/in's starting "Bankdarlehen" liability is genuinely
 * new among all the professions (every Classic one has 0 there) but isn't a
 * new *mechanic* — it's the existing liability field, just non-zero for the
 * first time, so its own "Bankdarlehenszahlungen" expense line finally does
 * something instead of always being 0.
 */
const CUSTOM_JFK_GAME_SET: CashflowGameSet = {
  id: 'custom-jfk',
  title: 'Custom JFK (community-created professions)',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  professions: [
    {
      id: 'softwareentwickler',
      title: 'Softwareentwickler/in',
      salaryMinor: 500000, // 5.000 €
      expenses: [
        { title: 'Steuern', amountMinor: 100000, key: 'taxes' }, // 1.000 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 90000, key: 'mortgageRent' }, // 900 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 30000, key: 'studentLoan' }, // 300 €
        { title: 'Autokreditzahlung', amountMinor: 20000, key: 'carLoan' }, // 200 €
        { title: 'Kreditkartenzahlung', amountMinor: 20000, key: 'creditCard' }, // 200 €
        { title: 'Sonstige Ausgaben', amountMinor: 90000, key: 'miscExpenses' }, // 900 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 30000, // 300 €
      savingsMinor: 150000, // 1.500 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 8000000, key: 'mortgage' }, // 80.000 €
          { tag: 'Autokredit', amountMinor: 800000, key: 'carLoan' }, // 8.000 €
          { tag: 'BAföG Darlehen', amountMinor: 2500000, key: 'studentLoanDebt' }, // 25.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 400000, key: 'creditCardDebt' }, // 4.000 €
        ],
      },
    },
    {
      id: 'freiberufler',
      title: 'Freiberufler/in',
      salaryMinor: 280000, // 2.800 € — irregular/lower base, matching freelance income reality
      expenses: [
        { title: 'Steuern', amountMinor: 40000, key: 'taxes' }, // 400 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 60000, key: 'mortgageRent' }, // 600 € — rents, no mortgage
        { title: 'BAföG Darlehenszahlung', amountMinor: 10000, key: 'studentLoan' }, // 100 €
        { title: 'Autokreditzahlung', amountMinor: 0, key: 'carLoan' }, // no car loan
        { title: 'Kreditkartenzahlung', amountMinor: 30000, key: 'creditCard' }, // 300 €
        { title: 'Sonstige Ausgaben', amountMinor: 50000, key: 'miscExpenses' }, // 500 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0, key: 'bankLoanPayment' },
      ],
      perChildExpenseMinor: 15000, // 150 €
      savingsMinor: 30000, // 300 € — thin margins
      starterKit: {
        liabilities: [
          { tag: 'BAföG Darlehen', amountMinor: 1500000, key: 'studentLoanDebt' }, // 15.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 600000, key: 'creditCardDebt' }, // 6.000 € — thin margins show up here too
        ],
      },
    },
    {
      id: 'unternehmer',
      title: 'Unternehmer/in',
      salaryMinor: 600000, // 6.000 €
      expenses: [
        { title: 'Steuern', amountMinor: 120000, key: 'taxes' }, // 1.200 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 100000, key: 'mortgageRent' }, // 1.000 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 0, key: 'studentLoan' },
        { title: 'Autokreditzahlung', amountMinor: 30000, key: 'carLoan' }, // 300 €
        { title: 'Kreditkartenzahlung', amountMinor: 30000, key: 'creditCard' }, // 300 €
        { title: 'Sonstige Ausgaben', amountMinor: 100000, key: 'miscExpenses' }, // 1.000 €
        // 10% of the starting 6.000 € Bankdarlehen below — the same monthly-interest rule the
        // in-game Bank Loan feature itself uses, just already running from day one.
        { title: 'Bankdarlehenszahlungen', amountMinor: 60000, key: 'bankLoanPayment' }, // 600 €
      ],
      perChildExpenseMinor: 30000, // 300 €
      savingsMinor: 200000, // 2.000 €
      starterKit: {
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 10000000, key: 'mortgage' }, // 100.000 €
          { tag: 'Autokredit', amountMinor: 1000000, key: 'carLoan' }, // 10.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 500000, key: 'creditCardDebt' }, // 5.000 €
          { tag: 'Bankdarlehen', amountMinor: 600000, key: 'bankLoan' }, // 6.000 € — an existing business loan, not the in-game Bank Loan feature's own liability (that always uses the literal untranslated tag "Bank loan")
        ],
      },
    },
  ],
};

export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [
  CASHFLOW_GAME_SET,
  CUSTOM_JFK_GAME_SET,
  PLACEHOLDER_GAME_SET,
];

export function findCashflowGameSet(
  gameSets: CashflowGameSet[],
  gameSetId: string,
): CashflowGameSet {
  const gameSet = gameSets.find((candidate) => candidate.id === gameSetId);
  if (!gameSet) throw new Error(`Unknown Cashflow game set: ${gameSetId}`);
  return gameSet;
}

export function findCashflowProfession(gameSet: CashflowGameSet, professionId: string) {
  const profession = gameSet.professions.find((candidate) => candidate.id === professionId);
  if (!profession) {
    throw new Error(`Unknown Cashflow profession: ${professionId} (game set ${gameSet.id})`);
  }
  return profession;
}
