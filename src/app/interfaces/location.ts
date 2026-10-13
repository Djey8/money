/** Cosmetic grouping only — never changes any calculation. */
export type LocationKind =
  'bank' | 'savings' | 'cash' | 'crypto' | 'wallet' | 'broker' | 'card' | 'other';

/** In the order the type dropdown shows them. `wallet` is shown as PayPal, `broker` as broker cash, `card` as prepaid / gift card. */
export const LOCATION_KINDS: LocationKind[] = [
  'bank',
  'savings',
  'cash',
  'crypto',
  'wallet',
  'broker',
  'card',
  'other',
];

/**
 * A place where money physically sits (bank account, cash, PayPal, a crypto exchange ...).
 * Orthogonal to the Barefoot buckets: a bucket says what money is for, a location says where it is.
 * Named MoneyLocation so it never shadows the DOM `Location` type.
 */
export interface MoneyLocation {
  /** Stable id; transactions and transfers reference it, so a location can be renamed freely. */
  id: string;
  name: string;
  /** Optional second line, e.g. "Main" or "Instant Savings" for N26 sub-accounts. Not shown when empty. */
  subName?: string;
  /** Live counter: edited by hand and moved automatically by booked transactions and transfers. */
  amount: number;
  kind?: LocationKind;
}
