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

  it('sets the plan into the budget (never added onto what was there), and takes back what the game planned when it changes', () => {
    const before = withPayday([], '2026-10', rows(['@Taxes', 90000]));
    const stale = [
      { date: '2026-10', tag: '@Taxes', amount: 4100 }, // left by an earlier version or game
      { date: '2026-10', tag: '@Mine', amount: 5 },
    ];
    const withPlan = applyPlanChange(stale, [], before);
    expect(withPlan.find((b) => b.tag === '@Taxes')?.amount).toBe(900);
    // the next Payday moves the month back: both months are set
    const after = withPayday(before, '2026-10', rows(['@Taxes', 90000]));
    const next = applyPlanChange(withPlan, before, after);
    expect(
      next
        .filter((b) => b.tag === '@Taxes')
        .map((b) => [b.date, b.amount])
        .sort(),
    ).toEqual([
      ['2026-09', 900],
      ['2026-10', 900],
    ]);
    // everything the game planned goes with the plan; the player's own cell stays
    expect(applyPlanChange(next, after, [])).toEqual([
      { date: '2026-10', tag: '@Mine', amount: 5 },
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
