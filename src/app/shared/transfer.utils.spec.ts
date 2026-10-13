import { newTransferId, transferProblem } from './transfer.utils';
import { clearLocationFromTransfers, reconcileTransfer } from './location-balance';
import { MoneyLocation } from '../interfaces/location';

describe('transfers', () => {
  let locations: MoneyLocation[];
  beforeEach(() => {
    locations = [
      { id: 'bank', name: 'Bank', amount: 1000 },
      { id: 'cash', name: 'Cash', amount: 50 },
      { id: 'wallet', name: 'Wallet', amount: 0 },
    ];
  });
  const total = () => locations.reduce((sum, l) => sum + l.amount, 0);

  it('mints unique xfer_ ids', () => {
    expect(newTransferId()).toMatch(/^xfer_[0-9a-f-]{36}$/);
    expect(newTransferId()).not.toBe(newTransferId());
  });

  it('accepts a sound draft and explains what is wrong otherwise', () => {
    const ok = { fromLocationId: 'a', toLocationId: 'b', amount: 10, date: '2026-10-05' };
    expect(transferProblem(ok)).toBeNull();
    expect(transferProblem({ ...ok, fromLocationId: null })).toMatch(/from/i);
    expect(transferProblem({ ...ok, toLocationId: '' })).toMatch(/goes to/i);
    expect(transferProblem({ ...ok, toLocationId: 'a' })).toMatch(/different/i);
    expect(transferProblem({ ...ok, amount: 0 })).toMatch(/greater than 0/);
    expect(transferProblem({ ...ok, amount: NaN })).toMatch(/greater than 0/);
    expect(transferProblem({ ...ok, date: '' })).toMatch(/date/i);
  });

  it('a transfer moves money between locations and never changes the total', () => {
    reconcileTransfer(locations, null, {
      fromLocationId: 'bank',
      toLocationId: 'cash',
      amount: 100,
    });
    expect(locations.map((l) => l.amount)).toEqual([900, 150, 0]);
    expect(total()).toBe(1050);
  });

  it('an edit reverses the old transfer and applies the new one', () => {
    const before = { fromLocationId: 'bank', toLocationId: 'cash', amount: 100 };
    reconcileTransfer(locations, null, before);
    reconcileTransfer(locations, before, {
      fromLocationId: 'bank',
      toLocationId: 'wallet',
      amount: 150,
    });
    expect(locations.map((l) => l.amount)).toEqual([850, 50, 150]);
    expect(total()).toBe(1050);
  });

  it('deleting gives the money back', () => {
    const t = { fromLocationId: 'bank', toLocationId: 'cash', amount: 100 };
    reconcileTransfer(locations, null, t);
    reconcileTransfer(locations, t, null);
    expect(locations.map((l) => l.amount)).toEqual([1000, 50, 0]);
  });

  it('a transfer whose other end was deleted still moves the end that remains', () => {
    reconcileTransfer(locations, null, { toLocationId: 'cash', amount: 20 });
    expect(locations[1].amount).toBe(70);
  });

  it('a deleted location is dropped from the transfers that used it, the rest stays', () => {
    const transfers: { fromLocationId?: string; toLocationId?: string }[] = [
      { fromLocationId: 'bank', toLocationId: 'cash' },
      { fromLocationId: 'cash', toLocationId: 'wallet' },
      { fromLocationId: 'bank', toLocationId: 'wallet' },
    ];
    expect(clearLocationFromTransfers(transfers, 'cash')).toBe(2);
    expect(transfers[0]).toEqual({ fromLocationId: 'bank' });
    expect(transfers[1]).toEqual({ toLocationId: 'wallet' });
    expect(transfers[2]).toEqual({ fromLocationId: 'bank', toLocationId: 'wallet' });
  });
});
