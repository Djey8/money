import { DreamPlayer, type DreamPlayerData } from '../player';

/**
 * The fact table of a finished game (JFK, 2026-11-06: "a fact table that we fill with these stats"): what one player's life came to,
 * in the four places of the Barefoot method - Grow (what was bought and sold), Fire (reserve, debts, emergencies), Smile (dreams) and
 * the income (what the month pays). Flat numbers, so a profile can add them up over all its games and show the sum or the average.
 * Money is in minor units; a yes-or-no is 1 or 0. Pure.
 */

export type DreamGameFacts = Record<(typeof FACT_KEYS)[number], number>;

export const FACT_KEYS = [
  'rounds',
  'turns',
  // Grow
  'growBought',
  'growSold',
  'growHeld',
  'growShares',
  'growProperties',
  'growBusinesses',
  'growPensions',
  'growCourses',
  'growInvestedMinor',
  // Fire
  'fireReserveMinor',
  'fireReserveFull',
  'fireDebtsLeftMinor',
  'fireDebtsRepaid',
  'fireBankLoanMinor',
  'fireEmergencies',
  'fireEmergenciesMinor',
  // Smile
  'smileLifeDreamLived',
  'smileDreamsLived',
  'smileDreamsLivedMinor',
  'smileDreamsOpen',
  'smileSavedMinor',
  'smilePoints',
  // income
  'incomePassiveMinor',
  'incomeSalaryMinor',
  'incomeCashflowMinor',
  'incomeExpensesMinor',
  'incomeCardsEarnedMinor',
  'incomeIndependent',
  'netWorthMinor',
] as const;

/** What a life came to. */
export function factsOfLife(life: DreamPlayerData, rounds: number): DreamGameFacts {
  const p = DreamPlayer.restore(life, () => 0.5, { sharedMarkets: true });
  const finances = p.finances();
  const holdings = p.state.holdings ?? [];
  const cardOf = (cardId: string) => p.cards.find((card) => card.id === cardId);
  let shares = 0;
  let properties = 0;
  let businesses = 0;
  let pensions = 0;
  let courses = 0;
  let invested = 0;
  let earned = 0;
  for (const holding of holdings) {
    const card = cardOf(holding.cardId);
    invested += holding.paidMinor ?? 0;
    // what a card paid while it ran: its monthly line for the Paydays since it started to pay
    earned +=
      Math.max(0, holding.cashflowMinor) * Math.max(0, holding.paydays - (holding.rampLeft ?? 0));
    if (!card) continue;
    if (card.share) shares += 1;
    else if (card.property) properties += 1;
    else if (card.contribution) pensions += 1;
    else if (card.unsellable) courses += 1;
    else if (holding.monthlySavingsMinor === undefined) businesses += 1;
  }
  const bankLoan = p.books.liabilities.find((l) => l.tag === 'Bank loan')?.amountMinor ?? 0;
  const done = life.done ?? [];
  const lived = done.filter((entry) => entry.kind === 'smile');
  const emergencies = done.filter((entry) => entry.kind === 'emergency');
  const expenses = p.monthlyExpenses();
  return {
    rounds,
    turns: p.turns,
    growBought: holdings.length,
    growSold: holdings.filter((holding) => holding.ended).length,
    growHeld: holdings.filter((holding) => !holding.ended).length,
    growShares: shares,
    growProperties: properties,
    growBusinesses: businesses,
    growPensions: pensions,
    growCourses: courses,
    growInvestedMinor: invested,
    fireReserveMinor: p.reserveMinor,
    fireReserveFull: expenses > 0 && p.reserveMinor >= expenses * 3 ? 1 : 0,
    fireDebtsLeftMinor: p.debtsMinor(),
    fireDebtsRepaid: p.debtsMinor() === 0 ? 1 : 0,
    fireBankLoanMinor: bankLoan,
    fireEmergencies: emergencies.length,
    fireEmergenciesMinor: emergencies.reduce((sum, entry) => sum + entry.totalMinor, 0),
    smileLifeDreamLived: p.dreamLived ? 1 : 0,
    smileDreamsLived: lived.length,
    smileDreamsLivedMinor: lived.reduce((sum, entry) => sum + entry.totalMinor, 0),
    smileDreamsOpen: p.smile.length,
    smileSavedMinor: p.dreamSavedMinor + p.smile.reduce((sum, d) => sum + d.savedMinor, 0),
    smilePoints: p.dreamPoints + p.bonusPoints,
    incomePassiveMinor: finances.passiveIncomeMinor,
    incomeSalaryMinor: finances.salaryMinor,
    incomeCashflowMinor: finances.monthlyCashflowMinor,
    incomeExpensesMinor: finances.expensesMinor,
    incomeCardsEarnedMinor: earned,
    incomeIndependent: finances.escapedRatRace ? 1 : 0,
    netWorthMinor: p.netWorth(),
  };
}

/** Facts added up (a profile's totals): a missing key counts as 0. */
export function addFacts(
  total: Partial<Record<string, number>>,
  facts: Partial<Record<string, number>>,
): Record<string, number> {
  const sum: Record<string, number> = { ...(total as Record<string, number>) };
  for (const key of FACT_KEYS) sum[key] = (sum[key] ?? 0) + (facts[key] ?? 0);
  return sum;
}
