import { fromMinorUnits, toMinorUnits } from '../money/minor-units';

/**
 * Cash on hand and bank-loan arithmetic for the Cashflow game — the pieces the Angular service had copied in
 * several places (todo/cashflow-game-pro-inventory.md, F5 and U3), now shared with the Pro API.
 */

/** The account allocation ratios, in percent (what Settings stores: daily 60, splurge 10, smile 10, fire 20). */
export interface CashAllocation {
  daily: number;
  splurge: number;
  smile: number;
  fire: number;
}

export interface CashTransaction {
  account: string;
  amountMinor: number;
}

/**
 * One account's balance exactly as the Home dashboard computes it (`AppStateService.getAmount`): the
 * account's own transactions plus its share of every `Income` transaction, **each share rounded to the cent on
 * its own**.
 *
 * That per-entry rounding is a known quirk: the four shares of an Income entry do not always add back up to
 * the entry (0.05 split 60/10/10/20 is 0.03 + 0.01 + 0.01 + 0.01 = 0.06). The game's "cash" hangs on it - every
 * automatic bank loan is decided from it - so the API has to reproduce it **to the cent**. An all-integer
 * rewrite does not: it disagrees in about 1% of random cases, at half-cent boundaries where the float
 * arithmetic below decides the rounding. So this is a deliberate, isolated port of the legacy arithmetic
 * (including `Number.EPSILON`), proven identical by a fuzz test against the original. Fixing the quirk is a
 * separate, deliberate change to make in the UI and here together.
 */
function accountBalance(transactions: CashTransaction[], account: string, percent: number): number {
  const share = percent / 100;
  let result = 0.0;
  for (const transaction of transactions) {
    const amount = fromMinorUnits(transaction.amountMinor);
    if (transaction.account === account) {
      result += amount;
    } else if (transaction.account === 'Income') {
      result += Math.round((amount * share + Number.EPSILON) * 100) / 100;
    }
  }
  return result;
}

/**
 * Total cash on hand in minor units: the Daily + Splurge + Smile + Fire balances. The same figure the Home
 * dashboard shows, and the one every automatic loan decision uses.
 */
export function cashOnHandMinor(
  transactions: CashTransaction[],
  allocation: CashAllocation,
): number {
  const total =
    accountBalance(transactions, 'Daily', allocation.daily) +
    accountBalance(transactions, 'Splurge', allocation.splurge) +
    accountBalance(transactions, 'Smile', allocation.smile) +
    accountBalance(transactions, 'Fire', allocation.fire);
  return toMinorUnits(Math.round(total * 100) / 100);
}

/**
 * The bank loan a purchase needs: whatever cash is short, rounded **up** to the game set's loan step. Zero when
 * cash covers it. A step of 0 (no rule) lends exactly the shortfall.
 */
export function loanForShortfallMinor(
  costMinor: number,
  cashMinor: number,
  incrementMinor: number,
): number {
  const shortfallMinor = Math.max(0, costMinor - cashMinor);
  if (shortfallMinor === 0) return 0;
  return incrementMinor > 0
    ? Math.ceil(shortfallMinor / incrementMinor) * incrementMinor
    : shortfallMinor;
}
