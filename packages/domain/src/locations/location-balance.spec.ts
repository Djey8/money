import { locationBalanceDeltas } from './location-balance';

describe('locationBalanceDeltas', () => {
  it('a new booking moves its location by the signed amount', () => {
    expect(locationBalanceDeltas([], [{ locationId: 'a', amountMinor: -3000 }])).toEqual({
      a: -3000,
    });
  });

  it('a deleted booking is given back', () => {
    expect(locationBalanceDeltas([{ locationId: 'a', amountMinor: -3000 }], [])).toEqual({
      a: 3000,
    });
  });

  it('unchanged bookings cancel out and are not reported', () => {
    const same = [{ locationId: 'a', amountMinor: -3000 }];
    expect(locationBalanceDeltas(same, [...same])).toEqual({});
  });

  it('an amount edit at the same location applies only the difference', () => {
    expect(
      locationBalanceDeltas(
        [{ locationId: 'a', amountMinor: -3000 }],
        [{ locationId: 'a', amountMinor: -4500 }],
      ),
    ).toEqual({ a: -1500 });
  });

  it('moving a booking restores the first location and charges the second', () => {
    expect(
      locationBalanceDeltas(
        [{ locationId: 'a', amountMinor: -3000 }],
        [{ locationId: 'b', amountMinor: -3000 }],
      ),
    ).toEqual({ a: 3000, b: -3000 });
  });

  it('clearing the location restores it; adding one charges it', () => {
    expect(
      locationBalanceDeltas([{ locationId: 'a', amountMinor: -3000 }], [{ amountMinor: -3000 }]),
    ).toEqual({ a: 3000 });
    expect(
      locationBalanceDeltas([{ amountMinor: -3000 }], [{ locationId: 'b', amountMinor: -3000 }]),
    ).toEqual({ b: -3000 });
  });

  it('bookings without a location never move anything', () => {
    expect(
      locationBalanceDeltas([{ amountMinor: 5 }], [{ locationId: null, amountMinor: 9 }]),
    ).toEqual({});
  });
});
