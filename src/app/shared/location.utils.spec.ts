import { isDuplicateLocationName, locationLabel } from './location.utils';
import { newLocationId } from './location-ids';
import { MoneyLocation } from '../interfaces/location';

describe('location utils', () => {
  const locations: MoneyLocation[] = [
    { id: 'loc_1', name: 'Bank 1', amount: 100 },
    { id: 'loc_2', name: 'Cash', amount: 20 },
  ];

  it('detects duplicate names case-insensitively and ignoring surrounding spaces', () => {
    expect(isDuplicateLocationName(' bank 1 ', undefined, locations)).toBe(true);
    expect(isDuplicateLocationName('PayPal', undefined, locations)).toBe(false);
  });

  it('ignores the location being edited', () => {
    expect(isDuplicateLocationName('Bank 1', '', locations, 'loc_1')).toBe(false);
    expect(isDuplicateLocationName('Cash', '', locations, 'loc_1')).toBe(true);
  });

  it('treats the same name with a different sub name as a different location', () => {
    const n26 = [{ id: 'loc_9', name: 'N26', subName: 'Main', amount: 0 }];
    expect(isDuplicateLocationName('N26', 'Instant Savings', n26)).toBe(false);
    expect(isDuplicateLocationName('n26', ' main ', n26)).toBe(true);
    expect(isDuplicateLocationName('N26', undefined, n26)).toBe(false);
  });

  it('labels a location with its sub name only when there is one', () => {
    expect(locationLabel({ name: 'N26', subName: 'Main' })).toBe('N26 - Main');
    expect(locationLabel({ name: 'Cash', subName: '  ' })).toBe('Cash');
    expect(locationLabel(undefined)).toBe('');
  });

  it('mints unique prefixed ids', () => {
    const a = newLocationId();
    const b = newLocationId();
    expect(a).toMatch(/^loc_[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});
