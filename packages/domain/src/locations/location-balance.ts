import { bookingLegs, LocationLeg } from './location-split';

/** The part of a transaction that moves location balances (integer minor units, signed). */
export interface LocationBookingMinor {
  locationId?: string | null;
  amountMinor: number;
  /** Amounts that go to other locations; the main one gets the remainder (see location-split.ts). */
  locationSplits?: LocationLeg[];
}

/**
 * Net change per location when a transaction list goes from `before` to `after`:
 * every old booking is reversed and every new one applied, so unchanged transactions cancel out exactly
 * (integer arithmetic) and an edit that changes the amount, the location, the split, or all of them falls
 * out naturally.
 *
 * Mirrors the Angular app's `src/app/shared/location-balance.ts` (decimal) — same rules, in minor units.
 * Only non-zero deltas are returned. Ids that match no stored location are the caller's to ignore.
 */
export function locationBalanceDeltas(
  before: readonly LocationBookingMinor[],
  after: readonly LocationBookingMinor[],
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const add = (locationId: string | null | undefined, amountMinor: number) => {
    if (!locationId || !Number.isFinite(amountMinor)) return;
    deltas[locationId] = (deltas[locationId] ?? 0) + amountMinor;
  };
  for (const booking of before) {
    for (const leg of bookingLegs(booking)) add(leg.locationId, -leg.amountMinor);
  }
  for (const booking of after) {
    for (const leg of bookingLegs(booking)) add(leg.locationId, leg.amountMinor);
  }
  for (const id of Object.keys(deltas)) if (deltas[id] === 0) delete deltas[id];
  return deltas;
}

/** A move of money between two of the user's own locations (integer minor units, always positive). */
export interface TransferBookingMinor {
  /** Where the money came from. Absent when that location was deleted afterwards. */
  fromLocationId?: string | null;
  /** Where it went. Absent when that location was deleted afterwards. */
  toLocationId?: string | null;
  amountMinor: number;
}

/**
 * Net change per location when a list of transfers goes from `before` to `after`: the source loses the amount,
 * the destination gains it. Same reverse-then-apply rule as `locationBalanceDeltas`, so an edit that changes the
 * amount or either location falls out naturally, and a transfer whose other end was deleted still moves the end
 * that remains. A transfer is not a transaction: it never touches income, expenses, Cashflow or any fund.
 */
export function transferBalanceDeltas(
  before: readonly TransferBookingMinor[],
  after: readonly TransferBookingMinor[],
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const add = (locationId: string | null | undefined, amountMinor: number) => {
    if (!locationId || !Number.isFinite(amountMinor)) return;
    deltas[locationId] = (deltas[locationId] ?? 0) + amountMinor;
  };
  for (const transfer of before) {
    add(transfer.fromLocationId, transfer.amountMinor);
    add(transfer.toLocationId, -transfer.amountMinor);
  }
  for (const transfer of after) {
    add(transfer.fromLocationId, -transfer.amountMinor);
    add(transfer.toLocationId, transfer.amountMinor);
  }
  for (const id of Object.keys(deltas)) if (deltas[id] === 0) delete deltas[id];
  return deltas;
}
