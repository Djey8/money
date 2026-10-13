import { LOCATION_KINDS } from '../interfaces/location';
import { cashflowMismatch, locationColor, locationIcon, locationShares } from './location-icons';

describe('location icons and shares', () => {
  it('shares add up to 100 and ignore negative balances', () => {
    const shares = locationShares([300, 100, -50]);
    expect(shares[0]).toBeCloseTo(75);
    expect(shares[1]).toBeCloseTo(25);
    expect(shares[2]).toBe(0);
  });

  it('shares are all 0 when nothing is held', () => {
    expect(locationShares([0, -5])).toEqual([0, 0]);
    expect(locationShares([])).toEqual([]);
  });

  it('flags a Cashflow mismatch from one cent up, not for rounding noise', () => {
    expect(cashflowMismatch(100, 100)).toBe(false);
    expect(cashflowMismatch(100.004, 100)).toBe(false);
    expect(cashflowMismatch(100.02, 100)).toBe(true);
  });

  it('falls back to the "other" look for a missing or unknown type', () => {
    expect(locationIcon(undefined)).toBe(locationIcon('other'));
    expect(locationColor(undefined)).toBe(locationColor('other'));
    expect(locationColor('nonsense' as any)).toBe(locationColor('other'));
  });

  it('every location type has an icon and a colour, and the three newest are all there', () => {
    expect(LOCATION_KINDS).toEqual([
      'bank',
      'savings',
      'cash',
      'crypto',
      'wallet',
      'broker',
      'card',
      'other',
    ]);
    for (const kind of LOCATION_KINDS) {
      expect(locationIcon(kind)).toMatch(/^assets\/icons\//);
      expect(locationColor(kind)).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // distinct colours so the distribution bar can tell the types apart
    expect(new Set(LOCATION_KINDS.map((k) => locationColor(k))).size).toBe(LOCATION_KINDS.length);
  });
});
