export interface Transaction {
  /**
   * Stable id (`tx_<uuid>`). Self-hosted only: minted at the write boundary
   * (`ensureTransactionIds`) and kept on load. Absent on Firebase and on a
   * transaction that has not been saved yet. Not the accounting table's
   * numeric row index, which lives on a display copy.
   */
  id?: string;
  account: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  comment: string;
  /** Where the money physically moved (MoneyLocation.id). Optional; absent = not tracked. */
  locationId?: string;
  /**
   * Money that went to OTHER locations (signed like `amount`); the main one (`locationId`) gets the rest, so the
   * parts always add up. Absent = not split.
   */
  locationSplits?: { locationId: string; amount: number }[];
}
