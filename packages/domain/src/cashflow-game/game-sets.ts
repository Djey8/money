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
 * JFK's real physical card set, filled in profession by profession as he
 * sends each card (2026-09-26 note: "I give you all of the professions I
 * have here as cards... currently, let's play like this"). Still fully
 * placeholder `board`/`decks` — only the profession pool is real so far.
 */
const CASHFLOW_GAME_SET: CashflowGameSet = {
  id: 'cashflow',
  title: 'Cashflow (real professions, board/cards still to come)',
  loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
  professions: [
    {
      // From the physical "Hausmeister/in" profession card, transcribed
      // exactly — every expense line keeps the card's own label as its
      // Subscription title *and* category (todo/cashflow-game.md decision
      // 16's category fix). A zero-amount line (BAföG, Bankdarlehen) is
      // skipped by the engine automatically.
      id: 'hausmeister',
      title: 'Hausmeister/in',
      salaryMinor: 160000, // Gehalt: 1.600 €
      expenses: [
        { title: 'Steuern', amountMinor: 30000 }, // 300 €
        { title: 'Eigenheim-Hypothek / Miete', amountMinor: 20000 }, // 200 €
        { title: 'BAföG Darlehenszahlung', amountMinor: 0 },
        { title: 'Autokreditzahlung', amountMinor: 10000 }, // 100 €
        { title: 'Kreditkartenzahlung', amountMinor: 10000 }, // 100 €
        { title: 'Sonstige Ausgaben', amountMinor: 30000 }, // 300 €
        { title: 'Bankdarlehenszahlungen', amountMinor: 0 }, // automated by the Bank loan feature instead
      ],
      perChildExpenseMinor: 10000, // Ausgaben pro Kind: 100 €
      savingsMinor: 60000, // Ersparnisse: 600 €
      starterKit: {
        // Bilanzblatt §4 Verbindlichkeiten — the balance, separate from the
        // matching expense line's *payment* above. BAföG Darlehen (0 €) is
        // skipped.
        liabilities: [
          { tag: 'Eigenheim-Hypothek', amountMinor: 2000000 }, // 20.000 €
          { tag: 'Autokredit', amountMinor: 400000 }, // 4.000 €
          { tag: 'Kreditkartenschulden', amountMinor: 300000 }, // 3.000 €
        ],
      },
    },
  ],
};

export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [CASHFLOW_GAME_SET, PLACEHOLDER_GAME_SET];

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
