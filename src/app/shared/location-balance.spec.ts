import {
  applyLocationDelta,
  bookingLegs,
  clearLocationFromSplits,
  clearLocationReferences,
  lastUsedLocationId,
  locationName,
  locationsByRecentUse,
  reconcileLocationBooking,
} from './location-balance';
import { MoneyLocation } from '../interfaces/location';

describe('location balance', () => {
  let locations: MoneyLocation[];
  beforeEach(() => {
    locations = [
      { id: 'a', name: 'Bank 1', amount: 100 },
      { id: 'b', name: 'Cash', amount: 50 },
    ];
  });

  it('create: an expense lowers, income raises the location', () => {
    reconcileLocationBooking(locations, null, { locationId: 'a', amount: -30 });
    reconcileLocationBooking(locations, null, { locationId: 'a', amount: 10 });
    expect(locations[0].amount).toBe(80);
  });

  it('delete reverses the booking', () => {
    reconcileLocationBooking(locations, { locationId: 'a', amount: -30 }, null);
    expect(locations[0].amount).toBe(130);
  });

  it('edit with the same location only applies the amount difference', () => {
    reconcileLocationBooking(
      locations,
      { locationId: 'a', amount: -30 },
      { locationId: 'a', amount: -45 },
    );
    expect(locations[0].amount).toBe(85);
  });

  it('edit moving the booking to another location restores the first and charges the second', () => {
    reconcileLocationBooking(
      locations,
      { locationId: 'a', amount: -30 },
      { locationId: 'b', amount: -30 },
    );
    expect(locations.map((l) => l.amount)).toEqual([130, 20]);
  });

  it('edit clearing the location restores the old one', () => {
    reconcileLocationBooking(
      locations,
      { locationId: 'a', amount: -30 },
      { locationId: null, amount: -30 },
    );
    expect(locations[0].amount).toBe(130);
  });

  it('edit adding a location to a booking that had none charges it', () => {
    reconcileLocationBooking(locations, { amount: -30 }, { locationId: 'b', amount: -30 });
    expect(locations[1].amount).toBe(20);
  });

  it('a reference to a deleted location is ignored and reports no change', () => {
    expect(reconcileLocationBooking(locations, { locationId: 'gone', amount: -5 }, null)).toBe(
      false,
    );
    expect(locations.map((l) => l.amount)).toEqual([100, 50]);
  });

  it('does not accumulate float drift', () => {
    for (let i = 0; i < 10; i++) applyLocationDelta(locations, 'a', 0.1);
    expect(locations[0].amount).toBe(101);
  });

  it('picks the most recent transaction location that still exists', () => {
    const txs = [{ locationId: 'b' }, { locationId: 'a' }, { locationId: 'gone' }, {}];
    expect(lastUsedLocationId(txs, locations)).toBe('a');
    expect(lastUsedLocationId([{}], locations)).toBeNull();
  });

  it('orphans references on delete', () => {
    const txs: { locationId?: string }[] = [{ locationId: 'a' }, { locationId: 'b' }, {}];
    expect(clearLocationReferences(txs, 'a')).toBe(1);
    expect('locationId' in txs[0]).toBe(false);
    expect(txs[1].locationId).toBe('b');
  });

  it('resolves names', () => {
    expect(locationName(locations, 'a')).toBe('Bank 1');
    expect(locationName(locations, 'gone')).toBeNull();
    expect(locationName(locations, undefined)).toBeNull();
  });

  it('orders the picker by latest use first, then the unused ones in their normal order', () => {
    const all = [
      { id: 'a', name: 'A', amount: 0 },
      { id: 'b', name: 'B', amount: 0 },
      { id: 'c', name: 'C', amount: 0 },
      { id: 'd', name: 'D', amount: 0 },
    ];
    const txs = [
      { locationId: 'a' },
      { locationId: 'c' },
      {},
      { locationId: 'a' },
      { locationId: 'gone' },
      { locationId: 'c' },
    ];
    // newest -> oldest: c, (gone), a, c, ... => c, a, then b, d untouched in list order
    expect(locationsByRecentUse(txs, all).map((l) => l.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(locationsByRecentUse([], all).map((l) => l.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(locationsByRecentUse(txs, [])).toEqual([]);
  });

  describe('split bookings', () => {
    it('the main location gets the remainder, the other location its share', () => {
      reconcileLocationBooking(locations, null, {
        locationId: 'a',
        amount: 300,
        locationSplits: [{ locationId: 'b', amount: 60 }],
      });
      expect(locations.map((l) => l.amount)).toEqual([340, 110]);
    });

    it('an amount edit only moves the main location', () => {
      const splits = [{ locationId: 'b', amount: 60 }];
      reconcileLocationBooking(
        locations,
        { locationId: 'a', amount: 300, locationSplits: splits },
        { locationId: 'a', amount: 320, locationSplits: splits },
      );
      expect(locations.map((l) => l.amount)).toEqual([120, 50]);
    });

    it('delete gives both back; legs always add up to the amount', () => {
      const booking = {
        locationId: 'a',
        amount: 99.99,
        locationSplits: [{ locationId: 'b', amount: 33.33 }],
      };
      expect(bookingLegs(booking).reduce((sum, leg) => sum + Math.round(leg.amount * 100), 0)).toBe(
        9999,
      );
      reconcileLocationBooking(locations, booking, null);
      expect(locations.map((l) => l.amount)).toEqual(
        [100 - 66.66, 50 - 33.33].map((n) => Math.round(n * 100) / 100),
      );
    });

    it('a deleted location disappears from splits and subscriptions', () => {
      const txs = [
        {
          locationSplits: [
            { locationId: 'b', amount: 5 },
            { locationId: 'c', amount: 1 },
          ],
        },
        { locationSplits: [{ locationId: 'b', amount: 5 }] },
        {},
      ];
      const subs: {
        locationId?: string;
        locationSplit?: { locationId: string; percent?: number }[];
      }[] = [
        { locationId: 'a', locationSplit: [{ locationId: 'b', percent: 20 }] },
        { locationId: 'b', locationSplit: [{ locationId: 'c', percent: 10 }] },
      ];
      expect(clearLocationFromSplits(txs, subs, 'b')).toBe(4);
      expect(txs[0].locationSplits).toEqual([{ locationId: 'c', amount: 1 }]);
      expect('locationSplits' in txs[1]).toBe(false);
      expect(subs[0].locationId).toBe('a');
      expect('locationSplit' in subs[0]).toBe(false);
      expect('locationId' in subs[1]).toBe(false);
      expect('locationSplit' in subs[1]).toBe(false);
    });
  });
});
