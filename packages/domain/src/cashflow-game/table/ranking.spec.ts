import { rankPlayers } from './turns';
import type { Table } from './types';

/** A player whose books show a salary, some expenses and some passive income (minor units). */
function player(id: string, passive: number, expenses: number, cash = 0, debt = 0) {
  return {
    id,
    status: 'active',
    books: {
      allocation: { daily: 100, splurge: 0, smile: 0, fire: 0 },
      transactions: [{ account: 'Daily', amountMinor: cash }],
      liabilities: debt ? [{ tag: 'Bank loan', amountMinor: debt }] : [],
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

  it('level on every figure of the game: the one with more cash is ahead, then the one with fewer debts, then the first seat', () => {
    const level = (...ids: [string, number, number][]) =>
      rankPlayers(
        table(...ids.map(([id, cash, debt]) => player(id, 100_000, 200_000, cash, debt))),
      ).map((r) => r.playerId);
    expect(level(['poor', 100_00, 0], ['rich', 900_00, 0])).toEqual(['rich', 'poor']);
    expect(level(['loaned', 500_00, 800_000], ['clean', 500_00, 0])).toEqual(['clean', 'loaned']);
    expect(level(['first', 500_00, 0], ['second', 500_00, 0])).toEqual(['first', 'second']);
  });
});
