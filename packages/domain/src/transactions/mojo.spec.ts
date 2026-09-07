import { applyMojoTransaction, computeMojoStatus } from './mojo';

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

describe('computeMojoStatus', () => {
  it('computes remainingMinor and percentFilled for a partially-filled balance', () => {
    expect(computeMojoStatus({ amountMinor: 7500, targetMinor: 10000 })).toEqual({
      amountMinor: 7500,
      targetMinor: 10000,
      remainingMinor: 2500,
      percentFilled: 75,
    });
  });

  it('floors remainingMinor at 0 once the target is reached or exceeded', () => {
    expect(computeMojoStatus({ amountMinor: 12000, targetMinor: 10000 }).remainingMinor).toBe(0);
  });

  it('does not clamp percentFilled to 100 when amountMinor exceeds targetMinor', () => {
    expect(computeMojoStatus({ amountMinor: 12000, targetMinor: 10000 }).percentFilled).toBe(120);
  });

  it('returns a zero percentFilled without dividing by zero when targetMinor is 0', () => {
    expect(computeMojoStatus({ amountMinor: 500, targetMinor: 0 }).percentFilled).toBe(0);
  });
});
