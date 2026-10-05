import { cashOnHandMinor, loanForShortfallMinor, type CashAllocation } from './cash';

const ALLOCATION: CashAllocation = { daily: 60, splurge: 10, smile: 10, fire: 20 };

const tx = (account: string, amountMinor: number) => ({ account, amountMinor });

describe('cashOnHandMinor', () => {
  it('adds each account’s own entries and its share of Income, and ignores other accounts', () => {
    expect(
      cashOnHandMinor(
        [tx('Income', 100000), tx('Daily', -20000), tx('Fire', -5000), tx('Mojo', 999999)],
        ALLOCATION,
      ),
    ).toBe(75000);
  });

  it('is zero with no transactions', () => {
    expect(cashOnHandMinor([], ALLOCATION)).toBe(0);
  });

  it('does not depend on the ratios when the shares add back up cleanly', () => {
    const even = { daily: 25, splurge: 25, smile: 25, fire: 25 };
    expect(cashOnHandMinor([tx('Income', 100000)], even)).toBe(100000);
    expect(cashOnHandMinor([tx('Income', 100000)], ALLOCATION)).toBe(100000);
  });

  it('PINNED QUIRK: each share is rounded to the cent on its own, so 0.05 reads as 0.06', () => {
    expect(cashOnHandMinor([tx('Income', 5)], ALLOCATION)).toBe(6);
  });

  /**
   * The legacy algorithm, verbatim: `AppStateService.getAmount` summed by `CashflowGameService.cash`, on
   * decimal amounts. The domain port must agree with it in every case, because the UI and the API have to
   * show the same cash to the cent.
   */
  function legacyCash(
    transactions: { account: string; amount: number }[],
    allocation: CashAllocation,
  ): number {
    const getAmount = (account: string, p: number) => {
      let result = 0.0;
      for (const t of transactions) {
        if (t.account == account) result += t.amount;
        else if (t.account == 'Income')
          result += Math.round((t.amount * p + Number.EPSILON) * 100) / 100;
      }
      return result;
    };
    return (
      Math.round(
        (getAmount('Daily', allocation.daily / 100) +
          getAmount('Splurge', allocation.splurge / 100) +
          getAmount('Smile', allocation.smile / 100) +
          getAmount('Fire', allocation.fire / 100)) *
          100,
      ) / 100
    );
  }

  /** A small deterministic generator, so a failure is reproducible. */
  function mulberry32(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('agrees with the legacy float algorithm to the cent on 100,000 random books', () => {
    const random = mulberry32(20261005);
    const accounts = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income', 'Income', 'Income', 'Mojo'];
    for (let run = 0; run < 100000; run++) {
      const count = 1 + Math.floor(random() * 6);
      const minor: { account: string; amountMinor: number }[] = [];
      for (let i = 0; i < count; i++) {
        const scale = random() < 0.3 ? 20 : 500000; // small amounts hit the half-cent edges hardest
        minor.push({
          account: accounts[Math.floor(random() * accounts.length)],
          amountMinor: Math.floor((random() - 0.35) * scale),
        });
      }
      const allocation: CashAllocation = {
        daily: Math.floor(random() * 101),
        splurge: Math.floor(random() * 101),
        smile: Math.floor(random() * 101),
        fire: Math.floor(random() * 101),
      };
      const expected = Math.round(
        legacyCash(
          minor.map((t) => ({ account: t.account, amount: t.amountMinor / 100 })),
          allocation,
        ) * 100,
      );
      const actual = cashOnHandMinor(minor, allocation);
      if (actual !== expected) {
        throw new Error(
          `cash differs: ${actual} vs legacy ${expected} for ${JSON.stringify({ minor, allocation })}`,
        );
      }
    }
  });
});

describe('loanForShortfallMinor', () => {
  it('lends nothing when cash covers the cost', () => {
    expect(loanForShortfallMinor(50000, 50000, 100000)).toBe(0);
    expect(loanForShortfallMinor(50000, 90000, 100000)).toBe(0);
  });

  it('rounds the shortfall up to the next loan step', () => {
    expect(loanForShortfallMinor(150000, 0, 100000)).toBe(200000);
    expect(loanForShortfallMinor(100000, 0, 100000)).toBe(100000);
    expect(loanForShortfallMinor(100001, 0, 100000)).toBe(200000);
    expect(loanForShortfallMinor(300000, 120000, 100000)).toBe(200000);
  });

  it('treats negative cash as a bigger shortfall', () => {
    expect(loanForShortfallMinor(50000, -50000, 100000)).toBe(100000);
  });

  it('lends exactly the shortfall when the game set has no loan step', () => {
    expect(loanForShortfallMinor(12345, 345, 0)).toBe(12000);
  });
});
