import { rankPlayers } from './turns';
import type { Table } from './types';

/** A player whose books show a salary, some expenses and some passive income (minor units). */
function player(id: string, passive: number, expenses: number) {
  return {
    id,
    status: 'active',
    books: {
      state: { gameSubscriptionTitles: ['Salary', 'Rent', 'EFH Cashflow'] },
      subscriptions: [
        { title: 'Salary', amountMinor: 500_000 },
        { title: 'Rent', amountMinor: -expenses },
        { title: 'EFH Cashflow', amountMinor: passive },
      ],
    },
  };
}

const table = (...players: ReturnType<typeof player>[]) =>
  ({ players, finishers: [] }) as unknown as Table;

describe('placing those still playing', () => {
  it('goes by how close they are to escaping, not by the raw passive income', () => {
    // 3000 of passive income against 6000 of expenses is half way; 2500 against 3000 is five sixths
    const ranking = rankPlayers(
      table(player('big', 300_000, 600_000), player('small', 250_000, 300_000)),
    );
    expect(ranking.map((r) => r.playerId)).toEqual(['small', 'big']);
    expect(ranking[0].expensesMinor).toBe(300_000);
  });

  it('a loan counts: its payment is an expense, so the borrower is further from escaping', () => {
    const ranking = rankPlayers(
      table(player('loan', 200_000, 500_000), player('clean', 200_000, 300_000)),
    );
    expect(ranking.map((r) => r.playerId)).toEqual(['clean', 'loan']);
  });

  it('equal progress falls back to the passive income', () => {
    const ranking = rankPlayers(
      table(player('a', 100_000, 200_000), player('b', 200_000, 400_000)),
    );
    expect(ranking.map((r) => r.playerId)).toEqual(['b', 'a']);
  });
});
