import { applyMojoTransaction } from './mojo';

const mojo = { amountMinor: 9000, targetMinor: 10000 };
const transaction = (overrides: object) => ({
  id: 'tx',
  account: 'Daily',
  amountMinor: -500,
  currency: 'EUR',
  date: '2026-09-06',
  time: '09:00',
  category: '@Mojo',
  comment: '',
  ...overrides,
});

describe('applyMojoTransaction', () => {
  it('caps an @Mojo contribution at the target without mutating the balance', () => {
    expect(applyMojoTransaction(mojo, transaction({ amountMinor: -2500 }))).toEqual({
      amountMinor: 10000,
      targetMinor: 10000,
    });
    expect(mojo.amountMinor).toBe(9000);
  });

  it('applies spending from the Mojo account after the contribution update', () => {
    expect(
      applyMojoTransaction(
        { amountMinor: 5000, targetMinor: 10000 },
        transaction({ account: 'Mojo', category: '@Food', amountMinor: -1200 }),
      ),
    ).toEqual({ amountMinor: 3800, targetMinor: 10000 });
  });
});
