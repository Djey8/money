import { addPlanned, planPayday, shiftGameRows, shiftMonth } from './game-budget';

const row = (date: string, tag: string, amount: number, game = true) => ({
  date,
  tag,
  amount,
  ...(game ? { game } : {}),
});

describe('the budget a game plans', () => {
  it('moves months across a year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('moves only the rows of the game back, never one the player planned', () => {
    const rows = [row('2026-10', '@Kids', 400), row('2026-10', '@Gym', 30, false)];
    expect(shiftGameRows(rows, -1)).toEqual([
      row('2026-10', '@Gym', 30, false),
      row('2026-09', '@Kids', 400),
    ]);
  });

  it('a Payday moves the earlier rows back and plans its own month', () => {
    const before = [row('2026-10', '@Kids', 400), row('2026-10', '@Taxes', 900)];
    const after = planPayday(
      before,
      [row('2026-10', '@Kids', 400), row('2026-10', '@Taxes', 900)],
      null,
    );
    expect(after).toEqual([
      row('2026-09', '@Kids', 400),
      row('2026-09', '@Taxes', 900),
      row('2026-10', '@Kids', 400),
      row('2026-10', '@Taxes', 900),
    ]);
  });

  it('a new expense of the game (a second child) shows from its Payday on, the months before keep their plan', () => {
    const month1 = planPayday([], [row('2026-10', '@Kids', 400)], null);
    const month2 = planPayday(month1, [row('2026-10', '@Kids', 800)], null);
    expect(month2).toEqual([row('2026-09', '@Kids', 400), row('2026-10', '@Kids', 800)]);
  });

  it('a game from before gets its last month planned from what the subscriptions cost now, once', () => {
    const standing = [{ date: '2026-10', tag: '@Taxes', amount: 900 }];
    const first = planPayday([], [row('2026-10', '@Taxes', 900)], standing);
    expect(first).toEqual([row('2026-09', '@Taxes', 900), row('2026-10', '@Taxes', 900)]);
    // the next Payday does not plan the past again
    const second = planPayday(first, [row('2026-10', '@Taxes', 900)], standing);
    expect(second.map((r) => r.date).sort()).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('adds into a row the player made instead of making a second row of the same month and category', () => {
    expect(
      addPlanned(
        [row('2026-10', '@Gym', 30, false)],
        [{ date: '2026-10', tag: '@Gym', amount: 20 }],
      ),
    ).toEqual([row('2026-10', '@Gym', 50, false)]);
  });
});
