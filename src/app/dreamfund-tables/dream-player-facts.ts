/**
 * The fact table of a Dreamfund player as the profile shows it (JFK, 2026-11-06): the sums the backend keeps over the games, in the
 * four places of the method, each as a total and per game. Pure: the words come in as `text`.
 */

export type FactKind = 'count' | 'money' | 'share';

interface FactDef {
  key: string;
  kind: FactKind;
}

export const FACT_GROUPS: { id: 'grow' | 'fire' | 'smile' | 'income'; facts: FactDef[] }[] = [
  {
    id: 'grow',
    facts: [
      { key: 'growBought', kind: 'count' },
      { key: 'growSold', kind: 'count' },
      { key: 'growHeld', kind: 'count' },
      { key: 'growShares', kind: 'count' },
      { key: 'growProperties', kind: 'count' },
      { key: 'growBusinesses', kind: 'count' },
      { key: 'growPensions', kind: 'count' },
      { key: 'growCourses', kind: 'count' },
      { key: 'growInvestedMinor', kind: 'money' },
    ],
  },
  {
    id: 'fire',
    facts: [
      { key: 'fireReserveFull', kind: 'share' },
      { key: 'fireReserveMinor', kind: 'money' },
      { key: 'fireDebtsRepaid', kind: 'share' },
      { key: 'fireDebtsLeftMinor', kind: 'money' },
      { key: 'fireBankLoanMinor', kind: 'money' },
      { key: 'fireEmergencies', kind: 'count' },
      { key: 'fireEmergenciesMinor', kind: 'money' },
    ],
  },
  {
    id: 'smile',
    facts: [
      { key: 'smileLifeDreamLived', kind: 'share' },
      { key: 'smileDreamsLived', kind: 'count' },
      { key: 'smileDreamsLivedMinor', kind: 'money' },
      { key: 'smileDreamsOpen', kind: 'count' },
      { key: 'smileSavedMinor', kind: 'money' },
      { key: 'smilePoints', kind: 'count' },
    ],
  },
  {
    id: 'income',
    facts: [
      { key: 'incomeIndependent', kind: 'share' },
      { key: 'incomePassiveMinor', kind: 'money' },
      { key: 'incomeSalaryMinor', kind: 'money' },
      { key: 'incomeCashflowMinor', kind: 'money' },
      { key: 'incomeExpensesMinor', kind: 'money' },
      { key: 'incomeCardsEarnedMinor', kind: 'money' },
      { key: 'netWorthMinor', kind: 'money' },
    ],
  },
];

export interface FactRow {
  label: string;
  /** The sum over all games (a yes-or-no counts the games it was yes in; money is money). */
  total: string;
  /** The average per game (a yes-or-no: the share of the games). */
  perGame: string;
}

export interface FactGroup {
  id: string;
  title: string;
  rows: FactRow[];
}

const number = (value: number, digits = 0) =>
  value.toLocaleString('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** The groups of rows for a profile's facts, or none when no game has one yet. */
export function factGroups(
  facts: { games: number; totals: Record<string, number> } | undefined,
  text: { groups: Record<string, string>; labels: Record<string, string> },
): FactGroup[] {
  if (!facts || facts.games <= 0) return [];
  const games = facts.games;
  return FACT_GROUPS.map((group) => ({
    id: group.id,
    title: text.groups[group.id] ?? group.id,
    rows: group.facts.map((fact): FactRow => {
      const sum = facts.totals[fact.key] ?? 0;
      const value = fact.kind === 'money' ? sum / 100 : sum;
      return {
        label: text.labels[fact.key] ?? fact.key,
        total: number(value),
        perGame:
          fact.kind === 'share'
            ? `${number((sum / games) * 100)}%`
            : number(value / games, fact.kind === 'money' ? 0 : 1),
      };
    }),
  }));
}
