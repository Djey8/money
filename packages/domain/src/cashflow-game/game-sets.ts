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
      startingCashMinor: 300000,
      salaryMinor: 300000,
      taxesAndExpensesMinor: -180000,
      perChildExpenseMinor: -6000,
      starterKit: {
        subscriptions: [
          {
            title: 'Placeholder profession Salary',
            account: 'Income',
            amountMinor: 300000,
            frequency: 'monthly',
          },
          {
            title: 'Placeholder profession Taxes & Expenses',
            account: 'Daily',
            amountMinor: -180000,
            frequency: 'monthly',
          },
        ],
      },
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

export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [PLACEHOLDER_GAME_SET];

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
