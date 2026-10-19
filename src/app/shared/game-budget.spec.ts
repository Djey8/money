import {
  applyPlanChange,
  fillMissing,
  healLegacyRows,
  layout,
  planFromPaydays,
  shiftMonth,
  withPayday,
} from './game-budget';

const rows = (...pairs: [string, number][]) =>
  pairs.map(([tag, amountMinor]) => ({ tag, amountMinor }));

describe('the budget a game plans', () => {
  it('moves months across a year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('every Payday moves the earlier months back and the new one becomes the current month', () => {
    let plan = withPayday([], '2026-10', rows(['@Taxes', 90000]));
    plan = withPayday(plan, '2026-10', rows(['@Taxes', 90000], ['@Kids', 40000]));
    plan = withPayday(plan, '2026-10', rows(['@Taxes', 90000], ['@Kids', 40000]));
    expect(plan.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(plan[0].rows).toEqual(rows(['@Taxes', 90000])); // what that month planned stays with it
    expect(plan[2].rows).toHaveLength(2);
  });

  it('a plan lays itself out one month apart ending at the current month', () => {
    const plan = layout(
      [
        { month: 'x', rows: [] },
        { month: 'y', rows: [] },
      ],
      '2027-01',
    );
    expect(plan.map((m) => m.month)).toEqual(['2026-12', '2027-01']);
  });

  it('puts the plan into the budget, and takes back exactly what the game put there when the plan changes', () => {
    const before = withPayday([], '2026-10', rows(['@Taxes', 90000]));
    const mine = { date: '2026-10', tag: '@Taxes', amount: 100 }; // the player planned 100 on the same cell
    const withPlan = applyPlanChange([mine], [], before);
    expect(withPlan).toEqual([{ date: '2026-10', tag: '@Taxes', amount: 1000 }]);
    // the next Payday moves the game's 900 back a month; the player's 100 stays where it is
    const after = withPayday(before, '2026-10', rows(['@Taxes', 90000]));
    const next = applyPlanChange(withPlan, before, after);
    expect(next.find((b) => b.date === '2026-09')?.amount).toBe(900);
    expect(next.find((b) => b.date === '2026-10')?.amount).toBe(1000);
    // everything goes with the plan
    expect(applyPlanChange(next, after, [])).toEqual([
      { date: '2026-10', tag: '@Taxes', amount: 100 },
    ]);
  });

  it('a game from before: its plan comes from its Paydays, replacing rows an earlier version left', () => {
    const plan = planFromPaydays([rows(['@Taxes', 90000]), rows(['@Taxes', 90000])], '2026-10');
    expect(plan.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
    const healed = healLegacyRows(
      [
        { date: '2026-10', tag: '@Taxes', amount: 900 }, // doubled by the first version
        { date: '2026-10', tag: '@Mine', amount: 5 },
        { date: '2026-08', tag: '@Old', amount: 7, game: true },
      ],
      plan,
    );
    expect(healed.filter((b) => b.tag === '@Taxes').map((b) => b.amount)).toEqual([900, 900]);
    expect(healed.some((b) => b.tag === '@Mine')).toBe(true);
    expect(healed.some((b) => b.tag === '@Old')).toBe(false);
  });

  it('only adds the cells the budget lacks', () => {
    const plan = withPayday([], '2026-10', rows(['@Taxes', 90000]));
    const kept = [{ date: '2026-10', tag: '@Taxes', amount: 5 }];
    expect(fillMissing(kept, plan)).toEqual(kept);
    expect(fillMissing([], plan)).toEqual([{ date: '2026-10', tag: '@Taxes', amount: 900 }]);
  });
});
