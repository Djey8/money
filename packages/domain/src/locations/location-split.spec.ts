import { bookingLegs, resolveLocationSplit, validateLocationSplitRule } from './location-split';
import { locationBalanceDeltas, transferBalanceDeltas } from './location-balance';

describe('bookingLegs', () => {
  it('gives the main location the remainder after the other amounts', () => {
    expect(
      bookingLegs({
        amountMinor: 300000,
        locationId: 'main',
        locationSplits: [{ locationId: 'savings', amountMinor: 60000 }],
      }),
    ).toEqual([
      { locationId: 'main', amountMinor: 240000 },
      { locationId: 'savings', amountMinor: 60000 },
    ]);
  });

  it('a booking without splits is one leg; without a location it is none', () => {
    expect(bookingLegs({ amountMinor: -500, locationId: 'cash' })).toEqual([
      { locationId: 'cash', amountMinor: -500 },
    ]);
    expect(bookingLegs({ amountMinor: -500 })).toEqual([]);
  });

  it('follows the amount when it changes later (the main location absorbs the difference)', () => {
    const splits = [{ locationId: 'savings', amountMinor: 60000 }];
    const capped = bookingLegs({ amountMinor: 100000, locationId: 'main', locationSplits: splits });
    expect(capped.map((l) => l.amountMinor)).toEqual([40000, 60000]);
  });

  it('works for an expense: every leg is negative', () => {
    expect(
      bookingLegs({
        amountMinor: -10000,
        locationId: 'main',
        locationSplits: [{ locationId: 'cash', amountMinor: -2500 }],
      }),
    ).toEqual([
      { locationId: 'main', amountMinor: -7500 },
      { locationId: 'cash', amountMinor: -2500 },
    ]);
  });

  it('ignores empty or zero legs', () => {
    expect(
      bookingLegs({
        amountMinor: 100,
        locationId: 'main',
        locationSplits: [
          { locationId: '', amountMinor: 10 },
          { locationId: 'x', amountMinor: 0 },
        ],
      }),
    ).toEqual([{ locationId: 'main', amountMinor: 100 }]);
  });
});

describe('resolveLocationSplit', () => {
  it('takes a percentage of the amount: 20 % of a 3000.00 salary', () => {
    expect(resolveLocationSplit(300000, [{ locationId: 'savings', percent: 20 }])).toEqual([
      { locationId: 'savings', amountMinor: 60000 },
    ]);
  });

  it('keeps the sign of an expense', () => {
    expect(resolveLocationSplit(-10000, [{ locationId: 'cash', percent: 25 }])).toEqual([
      { locationId: 'cash', amountMinor: -2500 },
    ]);
  });

  it('uses a fixed amount as it is', () => {
    expect(resolveLocationSplit(300000, [{ locationId: 'cash', amountMinor: 10000 }])).toEqual([
      { locationId: 'cash', amountMinor: 10000 },
    ]);
  });

  it('rounds to the cent and the main location keeps the rounding remainder', () => {
    const extras = resolveLocationSplit(1000, [{ locationId: 'a', percent: 33.333 }]);
    expect(extras).toEqual([{ locationId: 'a', amountMinor: 333 }]);
    const legs = bookingLegs({ amountMinor: 1000, locationId: 'main', locationSplits: extras });
    expect(legs.reduce((s, l) => s + l.amountMinor, 0)).toBe(1000);
  });

  it('combines percentages and fixed amounts', () => {
    expect(
      resolveLocationSplit(100000, [
        { locationId: 'a', percent: 10 },
        { locationId: 'b', amountMinor: 5000 },
      ]),
    ).toEqual([
      { locationId: 'a', amountMinor: 10000 },
      { locationId: 'b', amountMinor: 5000 },
    ]);
  });

  it('never gives away more than the booking has', () => {
    expect(
      resolveLocationSplit(1000, [
        { locationId: 'a', amountMinor: 800 },
        { locationId: 'b', amountMinor: 800 },
      ]),
    ).toEqual([
      { locationId: 'a', amountMinor: 800 },
      { locationId: 'b', amountMinor: 200 },
    ]);
  });

  it('returns nothing for no rule or a zero amount', () => {
    expect(resolveLocationSplit(1000, undefined)).toEqual([]);
    expect(resolveLocationSplit(1000, [])).toEqual([]);
    expect(resolveLocationSplit(0, [{ locationId: 'a', percent: 50 }])).toEqual([]);
  });
});

describe('validateLocationSplitRule', () => {
  it('accepts an empty rule and a sound one', () => {
    expect(validateLocationSplitRule([], null)).toBeNull();
    expect(validateLocationSplitRule([{ locationId: 'b', percent: 20 }], 'a')).toBeNull();
  });

  it.each([
    ['no main location', [{ locationId: 'b', percent: 20 }], null],
    ['the main as a split', [{ locationId: 'a', percent: 20 }], 'a'],
    [
      'a repeated location',
      [
        { locationId: 'b', percent: 10 },
        { locationId: 'b', percent: 10 },
      ],
      'a',
    ],
    ['both percent and amount', [{ locationId: 'b', percent: 10, amountMinor: 5 }], 'a'],
    ['neither percent nor amount', [{ locationId: 'b' }], 'a'],
    ['a percentage over 100', [{ locationId: 'b', percent: 120 }], 'a'],
    ['a zero percentage', [{ locationId: 'b', percent: 0 }], 'a'],
    ['a fractional amount', [{ locationId: 'b', amountMinor: 1.5 }], 'a'],
    [
      'percentages over 100 together',
      [
        { locationId: 'b', percent: 60 },
        { locationId: 'c', percent: 50 },
      ],
      'a',
    ],
  ])('rejects %s', (_label, rule, main) => {
    expect(validateLocationSplitRule(rule, main)).not.toBeNull();
  });
});

describe('location balance deltas with splits', () => {
  it('books a split salary on both locations', () => {
    expect(
      locationBalanceDeltas(
        [],
        [
          {
            amountMinor: 300000,
            locationId: 'main',
            locationSplits: [{ locationId: 'savings', amountMinor: 60000 }],
          },
        ],
      ),
    ).toEqual({ main: 240000, savings: 60000 });
  });

  it('an edit that changes only the amount moves the main location by the difference', () => {
    const splits = [{ locationId: 'savings', amountMinor: 60000 }];
    expect(
      locationBalanceDeltas(
        [{ amountMinor: 300000, locationId: 'main', locationSplits: splits }],
        [{ amountMinor: 320000, locationId: 'main', locationSplits: splits }],
      ),
    ).toEqual({ main: 20000 });
  });

  it('removing the split restores the savings location and charges the rest to main', () => {
    expect(
      locationBalanceDeltas(
        [
          {
            amountMinor: 300000,
            locationId: 'main',
            locationSplits: [{ locationId: 'savings', amountMinor: 60000 }],
          },
        ],
        [{ amountMinor: 300000, locationId: 'main' }],
      ),
    ).toEqual({ main: 60000, savings: -60000 });
  });

  it('deleting a split booking gives everything back', () => {
    expect(
      locationBalanceDeltas(
        [
          {
            amountMinor: 300000,
            locationId: 'main',
            locationSplits: [{ locationId: 'savings', amountMinor: 60000 }],
          },
        ],
        [],
      ),
    ).toEqual({ main: -240000, savings: -60000 });
  });
});

describe('transferBalanceDeltas', () => {
  const atm = { fromLocationId: 'bank', toLocationId: 'cash', amountMinor: 10000 };

  it('moves the amount from the source to the destination: the total never changes', () => {
    const deltas = transferBalanceDeltas([], [atm]);
    expect(deltas).toEqual({ bank: -10000, cash: 10000 });
    expect(Object.values(deltas).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('deleting a transfer gives it back', () => {
    expect(transferBalanceDeltas([atm], [])).toEqual({ bank: 10000, cash: -10000 });
  });

  it('an unchanged transfer moves nothing; an amount edit moves the difference', () => {
    expect(transferBalanceDeltas([atm], [{ ...atm }])).toEqual({});
    expect(transferBalanceDeltas([atm], [{ ...atm, amountMinor: 15000 }])).toEqual({
      bank: -5000,
      cash: 5000,
    });
  });

  it('changing the destination restores the first and charges the second', () => {
    expect(transferBalanceDeltas([atm], [{ ...atm, toLocationId: 'wallet' }])).toEqual({
      cash: -10000,
      wallet: 10000,
    });
  });

  it('a transfer whose other end was deleted still moves the end that remains', () => {
    expect(transferBalanceDeltas([], [{ toLocationId: 'cash', amountMinor: 500 }])).toEqual({
      cash: 500,
    });
  });
});
