/**
 * The printed Cashflow game content: professions and the Classic card piles. Deliberately NOT part of the
 * package's main entry (`index.ts`): the Firebase edition builds with an empty stand-in for this module, so
 * none of it ships to the public site (JFK, 2026-10-05; src/app/shared/cashflow-content.ts).
 */
import { EMERGENCY_CARDS } from './cashflow-emergency-cards';
import { DREAM_CARDS } from './cashflow-dream-cards';
import { DUAL_STUDENT_CAREER } from './cashflow-career-dual-student';
import { LIFE_CARDS } from './cashflow-life-cards';
import { CLASSIC_DEAL_BIG } from './cashflow-game/classic-deal-big';
import { CLASSIC_DEAL_SMALL } from './cashflow-game/classic-deal-small';
import { CLASSIC_DOODAD } from './cashflow-game/classic-doodad';
import { CLASSIC_MARKET } from './cashflow-game/classic-market';
import type {
  CashflowDreamProject,
  CashflowExpenseLine,
  CashflowGameSet,
} from './cashflow-game/types';

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
 * `decks` — the profession pool plus the Small Deal share cards added so far.
 */
const CASHFLOW_GAME_SET: CashflowGameSet = {
  id: 'cashflow',
  title: 'Classic Edition',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  decks: {
    dealSmall: CLASSIC_DEAL_SMALL,
    dealBig: CLASSIC_DEAL_BIG,
    doodad: CLASSIC_DOODAD,
    market: CLASSIC_MARKET,
  },
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
  title: 'Custom JFK',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  decks: {
    dealSmall: CLASSIC_DEAL_SMALL,
    dealBig: CLASSIC_DEAL_BIG,
    doodad: CLASSIC_DOODAD,
    market: CLASSIC_MARKET,
  }, // same card piles as Classic until this set gets its own
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

const VDBS_PAGE = 'https://www.vdbs.de/werden/bergfuehrer-werden.html';
const VDBS_INFO_PDF =
  'https://www.alpinewelten.com/cdn/uploads/information-zur-berg-skifhrer-ausbild-ung-2026.pdf';
const DAV_ARTICLE =
  'https://www.alpenverein.de/artikel/bergfuehrer-berufsbild-im-wandel_48dd1c30-e9e1-45f6-bd65-da76f921c559';
const COURSE_PROVIDER = 'https://www.alpinewelten.com/unternehmen/bergfuehrer-werden';

const DUAL_STUDENT_EXPENSES: CashflowExpenseLine[] = [
  // Where it is paid from (JFK, 2026-10-25): the income splits 60 Daily / 10 Splurge / 10 Smile / 20 Fire. Daily carries tax, pension,
  // rent, bills and groceries (1.693 of 1.700), Splurge the treats (269 of 283), Fire the insurances (371 of 567, the rest is for the
  // Mojo reserve); Smile stays free for the dream.
  // what the state and the social insurances take from the gross salary: 845 €
  { title: 'Lohnsteuer', amountMinor: 23500, key: 'incomeTax' }, // 235 €
  { title: 'Rentenversicherung', amountMinor: 26300, key: 'pension' }, // 263 € (9,3 %)
  { title: 'Krankenversicherung', amountMinor: 24200, key: 'healthInsurance', account: 'Fire' }, // 242 €
  { title: 'Pflegeversicherung', amountMinor: 6800, key: 'careInsurance', account: 'Fire' }, // 68 €
  {
    title: 'Arbeitslosenversicherung',
    amountMinor: 3700,
    key: 'unemploymentInsurance',
    account: 'Fire',
  }, // 37 € (1,3 %)
  // fixed costs: 919 €
  { title: 'Miete', amountMinor: 80000, key: 'rent' }, // 800 €
  // the two insurances of the stack of emergencies (premiums 8,39 and 15,61 = 24 €): while they are held an insured card costs 500 at most
  {
    title: 'Haftpflichtversicherung',
    amountMinor: 839,
    key: 'liabilityInsurance',
    account: 'Fire',
    insurance: 'liability',
  }, // 8,39 €
  {
    title: 'Hausratversicherung',
    amountMinor: 1561,
    key: 'householdInsurance',
    account: 'Fire',
    insurance: 'household',
  }, // 15,61 €
  { title: 'Nebenkosten & Telekom', amountMinor: 7100, key: 'utilities' }, // 71 €: internet, phone, electricity, broadcasting fee
  { title: 'Abos', amountMinor: 2400, key: 'subscriptions' }, // 24 €
  // daily living: 395 €
  { title: 'Lebensmittel', amountMinor: 30000, key: 'groceries' }, // 300 €
  { title: 'Essen to go', amountMinor: 5000, key: 'takeaway', account: 'Splurge' }, // 50 €
  { title: 'Drogerie & Hygiene', amountMinor: 3000, key: 'hygiene', account: 'Splurge' }, // 30 €
  { title: 'Friseur', amountMinor: 1500, key: 'haircut', account: 'Splurge' }, // 15 €
  // hobbies and going out: 174 €
  { title: 'Restaurant', amountMinor: 6000, key: 'restaurant', account: 'Splurge' }, // 60 €
  { title: 'Klettern', amountMinor: 4500, key: 'climbing', account: 'Splurge' }, // 45 €
  { title: 'Tennis', amountMinor: 3000, key: 'tennis', account: 'Splurge' }, // 30 €
  { title: 'Hobbys', amountMinor: 3900, key: 'hobbies', account: 'Splurge' }, // 39 €
];

const MOJO_BOOK = 'https://www.barefootinvestor.com/';

/**
 * The Mojo of a character (JFK, 2026-10-25): the emergency reserve of three monthly expenses that every character has to build on
 * their own to win. It is a Fire project from the first day; the advice follows the usual finance literature (three to six months
 * of expenses in an easy-to-reach account, apart from the money for goals) and is said so in the notes.
 */
function reserveProject(lang: 'en' | 'de', monthlyExpensesMinor: number): CashflowDreamProject {
  const en = lang === 'en';
  const t = (english: string, german: string) => (en ? english : german);
  const month = (n: number) => ({
    id: `month${n}`,
    title: t(`Month ${n}`, `Monat ${n}`),
    targetMinor: monthlyExpensesMinor,
    notes: t(
      n === 1
        ? 'The first month of expenses is the most important one: it covers the small emergencies (a broken phone, a repair, a dentist) so that they never need a loan.'
        : n === 2
          ? 'Two months bridge a short gap: a delayed salary, a bigger repair or a few weeks without work.'
          : 'Three months of expenses is the minimum the finance books ask for before you invest: the time to find a new job without selling anything at a bad price.',
      n === 1
        ? 'Der erste Monat an Ausgaben ist der wichtigste: er deckt die kleinen Notfälle (ein kaputtes Handy, eine Reparatur, der Zahnarzt), damit dafür nie ein Kredit nötig wird.'
        : n === 2
          ? 'Zwei Monate überbrücken eine kurze Lücke: ein verspätetes Gehalt, eine größere Reparatur oder ein paar Wochen ohne Arbeit.'
          : 'Drei Monate an Ausgaben sind das Minimum, das die Finanzbücher verlangen, bevor man investiert: die Zeit, eine neue Stelle zu finden, ohne etwas zu schlechten Kursen verkaufen zu müssen.',
    ),
  });
  return {
    title: t('Emergency reserve', 'Notgroschen'),
    sub: t(
      'Three months of expenses, for emergencies only',
      'Drei Monatsausgaben, nur für Notfälle',
    ),
    description: t(
      'An emergency reserve is money that waits for the day something goes wrong: a job lost, a repair, a medical bill. Almost every book on personal finance starts here, before investing and before big goals, because without it one bad month turns into debt. The usual rule is three to six months of your expenses in an account you can reach at once. Here the first goal is three. Fill it with payment plans, a little every Payday; use it when you really have to pay for an emergency, and fill it up again afterwards. The game is won only with the reserve full.',
      'Ein Notgroschen ist Geld, das auf den Tag wartet, an dem etwas schiefgeht: ein verlorener Job, eine Reparatur, eine Arztrechnung. Fast jedes Buch über persönliche Finanzen beginnt hier, vor dem Investieren und vor großen Zielen, denn ohne ihn wird aus einem schlechten Monat Schulden. Die übliche Regel sind drei bis sechs Monatsausgaben auf einem Konto, an das man sofort herankommt. Hier ist das erste Ziel drei. Fülle ihn mit Zahlplänen, jeden Zahltag ein wenig; nutze ihn, wenn du wirklich einen Notfall bezahlen musst, und fülle ihn danach wieder auf. Das Spiel gewinnst du nur mit vollem Notgroschen.',
    ),
    buckets: [month(1), month(2), month(3)],
    links: [
      {
        label: t(
          'The Barefoot Investor (the Mojo account)',
          'The Barefoot Investor (das Mojo-Konto)',
        ),
        url: MOJO_BOOK,
      },
    ],
    actionItems: [
      {
        text: t(
          'Set up a payment plan that fills the reserve over several Paydays',
          'Richte einen Zahlplan ein, der den Notgroschen über mehrere Zahltage füllt',
        ),
        priority: 'high',
      },
      {
        text: t(
          'After an emergency, fill the reserve up again before anything else',
          'Nach einem Notfall den Notgroschen zuerst wieder auffüllen',
        ),
        priority: 'medium',
      },
    ],
    notes: [
      t(
        "Why three months: Ramit Sethi, Dave Ramsey, Suze Orman and Barefoot's Mojo all give the same advice - a cushion of several months of expenses (not of income) before you invest.",
        'Warum drei Monate: Ramit Sethi, Dave Ramsey, Suze Orman und Barefoots Mojo geben denselben Rat - ein Polster von mehreren Monatsausgaben (nicht Einkommen), bevor man investiert.',
      ),
      t(
        'The reserve is for emergencies, not for wishes: a sale or a holiday is not one.',
        'Der Notgroschen ist für Notfälle, nicht für Wünsche: ein Angebot oder ein Urlaub sind keiner.',
      ),
    ],
  };
}

/** What the expenses of a profession cost in a month. */
function monthlyExpensesOf(expenses: CashflowExpenseLine[]): number {
  return expenses.reduce((sum, line) => sum + line.amountMinor, 0);
}

/**
 * The dream of the dual student: to become a state-certified mountain and ski guide (staatlich geprüfter Berg- und Skiführer,
 * VDBS, Germany). The structure follows the VDBS information of April 2025; the costs are estimates in game money - the course
 * fees are about 17.000 (VDBS), a commercial provider names 25.660 with the voluntary preparation and at least 32.000 with travel,
 * lodging and equipment - and are said so in the project's notes.
 */
function mountainGuideProject(lang: 'en' | 'de'): CashflowDreamProject {
  const en = lang === 'en';
  const t = (english: string, german: string) => (en ? english : german);
  return {
    title: t('Mountain guide', 'Bergführer'),
    sub: t(
      'State-certified mountain and ski guide (VDBS)',
      'Staatlich geprüfter Berg- und Skiführer (VDBS)',
    ),
    description: t(
      'The way to the guide licence in Germany: first the proof that you can do it (three years of tours, climbing level, first aid), then the entrance exams, then about three years of courses in rock, ice, ski and avalanche rescue with an internship of 36 days, and the state exams at the TU München. Every bucket is one part of the way; the project is done when all of them are full.',
      'Der Weg zur Führerlizenz in Deutschland: zuerst der Nachweis, dass du es kannst (drei Jahre Touren, Kletterniveau, Erste Hilfe), dann die Eignungsprüfungen, dann rund drei Jahre Kurse in Fels, Eis, Ski und Lawinenrettung mit einem Praktikum von 36 Tagen und die Staatsprüfungen an der TU München. Jeder Topf ist ein Stück des Weges; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: [
      {
        id: 'equipment',
        title: t('Equipment', 'Ausrüstung'),
        targetMinor: 350000,
        notes: t(
          'Rock, ice and ski-touring kit: harness, helmet, ropes, quickdraws, ice axes, crampons, touring skis with skins, avalanche transceiver, probe and shovel. The organisers send the list for each course about four weeks before. The price is an estimate.',
          'Ausrüstung für Fels, Eis und Skitour: Gurt, Helm, Seile, Expressen, Eisgeräte, Steigeisen, Tourenski mit Fellen, Lawinen-Verschüttetensuchgerät, Sonde und Schaufel. Die Veranstalter schicken die Liste zu jedem Kurs etwa vier Wochen vorher. Der Preis ist eine Schätzung.',
        ),
        links: [{ label: t('VDBS: becoming a guide', 'VDBS: Bergführer werden'), url: VDBS_PAGE }],
      },
      {
        id: 'preparation',
        title: t('Tours & preparation', 'Touren & Vorbereitung'),
        targetMinor: 180000,
        notes: t(
          'A tour report of at least three years split into rock, ice and ski, and the level for the entrance exams: sport routes 6b+, alpine 6a to 6b, mixed up to M5-M6, water ice up to WI5. Voluntary preparation courses (for example the ski preparation course for the entrance exam, about 545) and travel to the tours belong here.',
          'Ein Tourenbericht über mindestens drei Jahre, aufgeteilt in Fels, Eis und Ski, und das Niveau für die Eignungsprüfungen: Plaisir-Routen 6b+, alpin 6a bis 6b, Mixed bis M5-M6, Wassereis bis WI5. Freiwillige Vorbereitungslehrgänge (zum Beispiel der Ski-Vorbereitungslehrgang für die Eignungsprüfung, etwa 545) und die Anreise zu den Touren gehören hierher.',
        ),
        links: [
          {
            label: t(
              'Information on the training (VDBS, PDF)',
              'Information zur Ausbildung (VDBS, PDF)',
            ),
            url: VDBS_INFO_PDF,
          },
        ],
      },
      {
        id: 'papers',
        title: t('Papers & first aid', 'Papiere & Erste Hilfe'),
        targetMinor: 45000,
        notes: t(
          'A first-aid course of 16 units (not older than one year), a medical certificate and a police clearance certificate (Führungszeugnis), both not older than three months, and the application with the tour report. The application is open all year, the deadline for the exams of next year is 31 October.',
          'Ein Erste-Hilfe-Kurs mit 16 Unterrichtseinheiten (höchstens ein Jahr alt), ein ärztliches Attest und ein Führungszeugnis, beide höchstens drei Monate alt, und der Antrag mit dem Tourenbericht. Die Bewerbung ist ganzjährig möglich, Frist für die Prüfungen des nächsten Jahres ist der 31. Oktober.',
        ),
      },
      {
        id: 'entrance',
        title: t('Entrance exams', 'Eignungsprüfungen'),
        targetMinor: 195000,
        notes: t(
          'Ice (2 days), ski (2.5 to 3 days) and rock/ice (8 days). Passing all three makes you a candidate, and the membership in the VDBS is then mandatory. Lodging and food in the organised quarters are paid on top of the fees.',
          'Eis (2 Tage), Ski (2,5 bis 3 Tage) und Fels/Eis (8 Tage). Wer alle drei besteht, ist Kandidat, danach ist die Mitgliedschaft im VDBS Pflicht. Unterkunft und Verpflegung in den organisierten Quartieren kommen zu den Gebühren dazu.',
        ),
      },
      {
        id: 'year1',
        title: t('Courses, year 1', 'Kurse, Jahr 1'),
        targetMinor: 520000,
        notes: t(
          'Rock climbing methods (7-8 days), mountain rescue (7), alpine rock (13) and theory I (3): about 30 days. Alpine rock and the ice and ski courses of year 2 give you the status of aspirant.',
          'Felsklettern Methodik (7-8 Tage), Bergrettung (7), Fels alpin (13) und Theorie I (3): rund 30 Tage. Fels alpin und die Eis- und Skikurse des 2. Jahres bringen den Aspirantenstatus.',
        ),
      },
      {
        id: 'year2',
        title: t('Courses, year 2', 'Kurse, Jahr 2'),
        targetMinor: 630000,
        notes: t(
          'Avalanches (8 days), ski tour (7-8), ice climbing (5), ski technique (7), off-piste skiing (6), personal skills exams (3), ice/combination (10) and theory II (4): the biggest year.',
          'Lawinen (8 Tage), Skitour (7-8), Eisfallklettern (5), Skitechnik (7), Variantenskilauf (6), Prüfung Persönliches Können (3), Eis/Kombi (10) und Theorie II (4): das größte Jahr.',
        ),
      },
      {
        id: 'year3',
        title: t('Year 3 & internship', 'Jahr 3 & Praktikum'),
        targetMinor: 370000,
        notes: t(
          'Ski high tours (7 days) and winter mountaineering (7), and an internship of at least 36 days with a guide in rock, ice/high tours and ski, which pays only a small honorarium. A lot of lost earnings come on top, and they are the main hurdle.',
          'Skihochtouren (7 Tage) und Winterbergsteigen (7) sowie ein Praktikum von mindestens 36 Tagen bei einem Bergführer in Fels, Eis/Hochtour und Ski, das nur ein kleines Honorar bringt. Dazu kommt viel entgangener Verdienst, und der ist die größte Hürde.',
        ),
        links: [
          {
            label: t('Berufsbild im Wandel (DAV)', 'Berufsbild im Wandel (DAV)'),
            url: DAV_ARTICLE,
          },
        ],
      },
      {
        id: 'exams',
        title: t('State exams', 'Staatsprüfungen'),
        targetMinor: 160000,
        notes: t(
          'Four exams run by the TU München: rock, ice/high tour, ski high tour and theory (12 days in summer, 6 in winter and 2 for the theory). Each can be repeated twice.',
          'Vier Prüfungen der TU München: Fels, Eis/Hochtour, Skihochtour und Theorie (12 Tage im Sommer, 6 im Winter und 2 für die Theorie). Jede kann zweimal wiederholt werden.',
        ),
      },
    ],
    links: [
      { label: t('VDBS: becoming a guide', 'VDBS: Bergführer werden'), url: VDBS_PAGE },
      {
        label: t(
          'Information on the training (VDBS, PDF, April 2025)',
          'Information zur Ausbildung (VDBS, PDF, April 2025)',
        ),
        url: VDBS_INFO_PDF,
      },
      {
        label: t('Course provider: becoming a guide', 'Kursanbieter: Bergführer werden'),
        url: COURSE_PROVIDER,
      },
      {
        label: t('DAV: the guide profession is changing', 'DAV: Das Berufsbild im Wandel'),
        url: DAV_ARTICLE,
      },
    ],
    actionItems: [
      {
        text: t(
          'Write the tour report: rock, ice and ski of three years',
          'Den Tourenbericht schreiben: Fels, Eis und Ski aus drei Jahren',
        ),
        priority: 'high',
      },
      {
        text: t(
          'Reach the climbing level of the entrance exams (6b+)',
          'Das Kletterniveau der Eignungsprüfung erreichen (6b+)',
        ),
        priority: 'high',
      },
      {
        text: t(
          'Take the first-aid course of 16 units',
          'Den Erste-Hilfe-Kurs mit 16 Einheiten machen',
        ),
        priority: 'medium',
      },
      {
        text: t(
          'Get the medical certificate and the Führungszeugnis',
          'Das ärztliche Attest und das Führungszeugnis besorgen',
        ),
        priority: 'medium',
      },
      {
        text: t(
          'Apply before 31 October of the year before the exams',
          'Bewerben bis zum 31. Oktober des Jahres vor den Prüfungen',
        ),
        priority: 'high',
      },
      {
        text: t(
          'Pass the entrance exams: ice, ski and rock/ice',
          'Die Eignungsprüfungen bestehen: Eis, Ski und Fels/Eis',
        ),
        priority: 'high',
      },
      {
        text: t('Join the VDBS as a candidate', 'Dem VDBS als Kandidat beitreten'),
        priority: 'medium',
      },
      {
        text: t(
          'Do the courses of the three years and the 36-day internship',
          'Die Kurse der drei Jahre und das Praktikum von 36 Tagen machen',
        ),
        priority: 'medium',
      },
      {
        text: t(
          'Pass the four state exams at the TU München',
          'Die vier Staatsprüfungen an der TU München bestehen',
        ),
        priority: 'high',
      },
    ],
    notes: [
      t(
        'The costs here are estimates in game money. The course fees alone are about 17.000 (VDBS); a course provider names about 25.700 with the voluntary preparation and says to plan at least 32.000 with travel, lodging and equipment. Austria trains for less (about 15.000). Check before you pay.',
        'Die Kosten hier sind Schätzungen in Spielgeld. Allein die Kursgebühren liegen bei etwa 17.000 (VDBS); ein Kursanbieter nennt rund 25.700 mit der freiwilligen Vorbereitung und rät zu mindestens 32.000 mit Reise, Unterkunft und Ausrüstung. Österreich bildet günstiger aus (etwa 15.000). Prüfe es, bevor du zahlst.',
      ),
      t(
        'Only about 100 guides in Germany live from guiding alone; most work part-time next to another job. That is fine: this is a dream first and a job second.',
        'Nur etwa 100 Bergführer in Deutschland leben allein vom Führen; die meisten arbeiten nebenbei in einem anderen Beruf. Das ist in Ordnung: Es ist zuerst ein Traum und danach ein Beruf.',
      ),
    ],
  };
}

/**
 * The custom edition (JFK, 2026-10-25): characters with a story and a dream, built from real lives - the first is a dual student
 * in computer science whose dream is the mountains. Numbers are the monthly picture of a real budget, grouped into a few lines
 * (the habits behind them - when and how much - follow with the spending variation). The card piles are the classic ones until
 * this edition gets its own.
 */
const JFK_STORIES_GAME_SET: CashflowGameSet = {
  id: 'jfk-stories',
  title: 'Custom JFK',
  edition: 'custom',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  decks: {
    dealSmall: CLASSIC_DEAL_SMALL,
    dealBig: CLASSIC_DEAL_BIG,
    doodad: CLASSIC_DOODAD,
    market: CLASSIC_MARKET,
    emergency: EMERGENCY_CARDS,
    life: LIFE_CARDS,
    dream: DREAM_CARDS,
  }, // the Emergency stack is its own; the other piles are the classic ones until this set gets its own
  professions: [
    {
      id: 'dual-student-informatik',
      career: DUAL_STUDENT_CAREER,
      title: 'Dualer Student Informatik',
      // 34.000 € a year before tax, 2.833 € a month; the German deductions are expense lines (estimates for a single person)
      salaryMinor: 283300,
      expenses: DUAL_STUDENT_EXPENSES,
      perChildExpenseMinor: 30000, // 300 €
      savingsMinor: 50000, // 500 €
      starterKit: {
        // a first share and some crypto: almost nothing yet
        shares: [
          { tag: 'BMW', quantity: 1, priceMinor: 7928 }, // 79,28
          { tag: 'IOTA', quantity: 3705, priceMinor: 22 }, // 3.705 coins at 0,22 = 815,10
        ],
        liabilities: [
          { tag: 'Eltern-Darlehen', amountMinor: 150000, key: 'parentsLoan' }, // 1.500 €, no monthly payment
          { tag: 'Autokredit', amountMinor: 150000, key: 'carLoan' }, // 1.500 €, no monthly payment
        ],
      },
      profile: {
        texts: {
          en: {
            name: 'Jonas',
            tagline: 'Dual student in computer science, dreaming of the mountains',
            background:
              'Jonas studies computer science and works half-time at an IT company. Money is tight: the rent takes most of his pay, the rest goes on groceries, the climbing gym and the odd gadget. He has no real savings yet - a little cash, one BMW share and a bit of crypto - and owes his parents and a car loan.',
            values: [
              'Independence: one day he wants to live from money that works for him',
              'The mountains: every free weekend is climbing or a ski tour',
              'Step by step: he saves for gear and courses instead of borrowing for them',
            ],
            goal: 'Everything on this list has to come true:',
            goalItems: [
              { id: 'parentsLoan', text: 'Pay back the loan from your parents (1,500 DT)' },
              { id: 'carLoan', text: 'Pay back the car loan (1,500 DT)' },
              {
                id: 'dream',
                text: 'Fund and complete the mountain-guide dream: every bucket of the project full',
              },
              {
                id: 'reserve',
                text: 'Build the emergency reserve: three monthly expenses in the Mojo',
              },
              {
                id: 'independence',
                text: 'Become financially independent: passive income covers all monthly expenses',
              },
            ],
            dream: {
              title: 'Certified mountain guide',
              summary:
                'Become a state-certified mountain and ski guide (VDBS, Germany): a training of about three years with rock, ice, ski and avalanche courses, an entrance exam, equipment and a lot of tours. The course fees alone are around 17,000 DT. In this game it is his first Smile project.',
              project: mountainGuideProject('en'),
            },
            reserve: {
              summary:
                'Every character has to build an emergency reserve of three monthly expenses on their own. It is a Fire project from the first day: fill it with payment plans, use it for emergencies, never delete it.',
              project: reserveProject('en', monthlyExpensesOf(DUAL_STUDENT_EXPENSES)),
            },
          },
          de: {
            name: 'Jonas',
            tagline: 'Dualer Student der Informatik, mit dem Kopf in den Bergen',
            background:
              'Jonas studiert Informatik und arbeitet halbtags in einem IT-Unternehmen. Das Geld ist knapp: die Miete frisst den größten Teil seines Gehalts, der Rest geht für Essen, die Kletterhalle und das eine oder andere Gadget drauf. Rücklagen hat er kaum - etwas Bargeld, eine BMW-Aktie und ein bisschen Krypto - und er schuldet seinen Eltern und für das Auto noch Geld.',
            values: [
              'Unabhängigkeit: eines Tages will er von Geld leben, das für ihn arbeitet',
              'Die Berge: jedes freie Wochenende ist Klettern oder Skitour',
              'Schritt für Schritt: er spart für Ausrüstung und Kurse, statt sich dafür zu verschulden',
            ],
            goal: 'Alles auf dieser Liste muss wahr werden:',
            goalItems: [
              { id: 'parentsLoan', text: 'Zahle das Darlehen deiner Eltern zurück (1.500 TT)' },
              { id: 'carLoan', text: 'Zahle den Autokredit zurück (1.500 TT)' },
              {
                id: 'dream',
                text: 'Finanziere und erfülle den Traum vom Berg- und Skiführer: jeder Topf des Projekts voll',
              },
              { id: 'reserve', text: 'Baue den Notgroschen auf: drei Monatsausgaben im Mojo' },
              {
                id: 'independence',
                text: 'Werde finanziell unabhängig: passives Einkommen deckt alle monatlichen Ausgaben',
              },
            ],
            dream: {
              title: 'Staatlich geprüfter Berg- und Skiführer',
              summary:
                'Staatlich geprüfter Berg- und Skiführer werden (VDBS, Deutschland): eine Ausbildung von rund drei Jahren mit Fels-, Eis-, Ski- und Lawinenkursen, Eignungsprüfung, Ausrüstung und vielen Touren. Allein die Kursgebühren liegen bei etwa 17.000 TT. Im Spiel ist es sein erstes Smile-Projekt.',
              project: mountainGuideProject('de'),
            },
            reserve: {
              summary:
                'Jeder Charakter muss einen Notgroschen von drei Monatsausgaben aus eigener Kraft aufbauen. Er ist vom ersten Tag an ein Fire-Projekt: fülle ihn mit Zahlplänen, nutze ihn für Notfälle, lösche ihn nie.',
              project: reserveProject('de', monthlyExpensesOf(DUAL_STUDENT_EXPENSES)),
            },
          },
        },
      },
    },
  ],
};

export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [
  CASHFLOW_GAME_SET,
  JFK_STORIES_GAME_SET,
  CUSTOM_JFK_GAME_SET,
  PLACEHOLDER_GAME_SET,
];
