/**
 * Money moved between two of the user's own locations (an ATM withdrawal, crypto to bank, 50 EUR into the shared
 * account). NOT a transaction: it never enters the transaction list and so never changes the income statement,
 * Cashflow, KPIs, the budget or any fund. It only moves a balance from one location to another; no fees.
 */
export interface Transfer {
  /** Stable id (`xfer_<uuid>`). */
  id: string;
  /** Where the money came from. Absent when that location was deleted afterwards. */
  fromLocationId?: string;
  /** Where it went. Absent when that location was deleted afterwards. */
  toLocationId?: string;
  /** Always positive; the direction is from -> to. */
  amount: number;
  date: string;
  time: string;
  comment: string;
}
