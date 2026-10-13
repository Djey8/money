import {
  resolveStoredSplits,
  rowsToStoredRule,
  splitPreview,
  splitProblem,
  splitsToRows,
  storedRuleToRows,
  SplitRow,
} from './location-split.utils';

const locations = [
  { id: 'main', name: 'N26', subName: 'Main', amount: 0 },
  { id: 'sav', name: 'N26', subName: 'Instant Savings', amount: 0 },
  { id: 'cash', name: 'Cash', amount: 0 },
];

describe('location split utils', () => {
  const percent = (locationId: string, value: number | null): SplitRow => ({
    locationId,
    mode: 'percent',
    value,
  });

  it('resolves 20 % of a 3000 salary to a stored 600 for the savings location', () => {
    expect(resolveStoredSplits(3000, [percent('sav', 20)])).toEqual([
      { locationId: 'sav', amount: 600 },
    ]);
  });

  it('keeps the sign for an expense and works for fixed amounts', () => {
    expect(resolveStoredSplits(-100, [percent('cash', 25)])).toEqual([
      { locationId: 'cash', amount: -25 },
    ]);
    expect(resolveStoredSplits(3000, [{ locationId: 'cash', mode: 'amount', value: 100 }])).toEqual(
      [{ locationId: 'cash', amount: 100 }],
    );
  });

  it('ignores a row that is not filled in yet', () => {
    expect(resolveStoredSplits(3000, [percent('sav', null), percent('', 10)])).toEqual([]);
    expect(splitProblem([percent('sav', null)], 'main')).toBeNull();
  });

  it('reports what is wrong with the rows', () => {
    expect(splitProblem([percent('sav', 20)], null)).toMatch(/main/i);
    expect(splitProblem([percent('main', 20)], 'main')).toMatch(/main/i);
    expect(splitProblem([percent('sav', 120)], 'main')).toMatch(/100/);
    expect(splitProblem([percent('sav', 60), percent('cash', 50)], 'main')).toMatch(/100/);
    expect(splitProblem([percent('sav', 20)], 'main')).toBeNull();
  });

  it('round-trips a subscription rule through the rows', () => {
    const stored = [
      { locationId: 'sav', percent: 20 },
      { locationId: 'cash', amount: 50 },
    ];
    expect(rowsToStoredRule(storedRuleToRows(stored))).toEqual(stored);
  });

  it('editing a split booking shows its other amounts as fixed positive rows', () => {
    expect(splitsToRows([{ locationId: 'cash', amount: -25 }])).toEqual([
      { locationId: 'cash', mode: 'amount', value: 25 },
    ]);
    // saving them again resolves to the same signed amount
    expect(resolveStoredSplits(-100, splitsToRows([{ locationId: 'cash', amount: -25 }]))).toEqual([
      { locationId: 'cash', amount: -25 },
    ]);
  });

  it('previews main first with the remainder', () => {
    expect(splitPreview(3000, 'main', [percent('sav', 20)], locations)).toEqual([
      { locationId: 'main', label: 'N26 - Main', amount: 2400 },
      { locationId: 'sav', label: 'N26 - Instant Savings', amount: 600 },
    ]);
    expect(splitPreview(3000, null, [percent('sav', 20)], locations)).toEqual([]);
    expect(splitPreview(NaN, 'main', [], locations)).toEqual([]);
  });
});
