import { MoneyLocation } from '../interfaces/location';

/** The part of a transaction (or transfer leg) that moves a location balance. */
export interface LocationBooking {
  /** The main location: gets what is not sent elsewhere. */
  locationId?: string | null;
  /** Signed: negative for an expense, positive for income. */
  amount: number;
  /** Amounts that go to OTHER locations (signed like `amount`). */
  locationSplits?: { locationId: string; amount: number }[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Every location a booking touches with the amount it gets, main first. The main location's share is the
 * remainder (amount minus what goes elsewhere), so the legs always add up to the amount.
 * Same rule as `bookingLegs` in packages/domain/src/locations/location-split.ts (minor units there).
 */
export function bookingLegs(booking: LocationBooking): { locationId: string; amount: number }[] {
  const extras = (booking.locationSplits ?? []).filter(
    (leg) => !!leg.locationId && Number.isFinite(leg.amount) && leg.amount !== 0,
  );
  const extrasTotal = extras.reduce((sum, leg) => sum + Math.round(leg.amount * 100), 0);
  const legs: { locationId: string; amount: number }[] = [];
  if (booking.locationId) {
    legs.push({
      locationId: booking.locationId,
      amount: (Math.round(booking.amount * 100) - extrasTotal) / 100,
    });
  }
  legs.push(...extras);
  return legs;
}

/** Adds `delta` to one location. Unknown ids (deleted location) are ignored. Returns whether anything moved. */
export function applyLocationDelta(
  locations: MoneyLocation[],
  locationId: string | null | undefined,
  delta: number,
): boolean {
  if (!locationId || !Number.isFinite(delta) || delta === 0) return false;
  const location = locations.find((l) => l.id === locationId);
  if (!location) return false;
  location.amount = round2(location.amount + delta);
  return true;
}

/**
 * One reconciliation for every create / edit / delete: reverse the old booking, apply the new one.
 *   create: before = null, after = booking
 *   delete: before = booking, after = null
 *   edit:   before = old, after = new (a changed location or amount is handled by the same two steps)
 * Returns whether any location balance changed (so the caller knows to persist locations).
 */
export function reconcileLocationBooking(
  locations: MoneyLocation[],
  before: LocationBooking | null,
  after: LocationBooking | null,
): boolean {
  let changed = false;
  if (before) {
    for (const leg of bookingLegs(before)) {
      changed = applyLocationDelta(locations, leg.locationId, -leg.amount) || changed;
    }
  }
  if (after) {
    for (const leg of bookingLegs(after)) {
      changed = applyLocationDelta(locations, leg.locationId, leg.amount) || changed;
    }
  }
  return changed;
}

/**
 * The location of the most recently booked transaction that still points at an existing location.
 * Drives the picker's pre-selection: whatever you used last, you will most likely use again.
 */
export function lastUsedLocationId(
  transactions: { locationId?: string | null }[],
  locations: MoneyLocation[],
): string | null {
  for (let i = transactions.length - 1; i >= 0; i--) {
    const id = transactions[i].locationId;
    if (id && locations.some((l) => l.id === id)) return id;
  }
  return null;
}

/**
 * A deleted location also disappears from the split of every booking that sent money there (the rest of the
 * booking stays), and from every subscription: as its main location (the whole rule goes with it) or as one
 * of the split locations. Returns how many records changed.
 */
export function clearLocationFromSplits(
  transactions: { locationSplits?: { locationId: string; amount: number }[] }[],
  subscriptions: {
    locationId?: string;
    locationSplit?: { locationId: string; percent?: number; amount?: number }[];
  }[],
  locationId: string,
): number {
  let count = 0;
  for (const transaction of transactions) {
    if (!transaction.locationSplits) continue;
    const kept = transaction.locationSplits.filter((leg) => leg.locationId !== locationId);
    if (kept.length === transaction.locationSplits.length) continue;
    count++;
    if (kept.length > 0) transaction.locationSplits = kept;
    else delete transaction.locationSplits;
  }
  for (const subscription of subscriptions) {
    if (subscription.locationId === locationId) {
      delete subscription.locationId;
      delete subscription.locationSplit;
      count++;
    } else if (subscription.locationSplit) {
      const kept = subscription.locationSplit.filter((leg) => leg.locationId !== locationId);
      if (kept.length !== subscription.locationSplit.length) {
        count++;
        if (kept.length > 0) subscription.locationSplit = kept;
        else delete subscription.locationSplit;
      }
    }
  }
  return count;
}

/** Orphans every reference to a deleted location. Returns how many records were changed. */
export function clearLocationReferences(
  records: { locationId?: string | null }[],
  locationId: string,
): number {
  let count = 0;
  for (const record of records) {
    if (record.locationId === locationId) {
      delete record.locationId;
      count++;
    }
  }
  return count;
}

/** Display name for a record's location; falls back for a reference to a deleted location. */
export function locationName(
  locations: MoneyLocation[],
  locationId: string | null | undefined,
): string | null {
  if (!locationId) return null;
  return locations.find((l) => l.id === locationId)?.name ?? null;
}

/** Bulk delete: gives every removed booking back to its location. Returns whether any balance changed. */
export function releaseLocationBookings(
  locations: MoneyLocation[],
  removed: LocationBooking[],
): boolean {
  let changed = false;
  for (const booking of removed)
    changed = reconcileLocationBooking(locations, booking, null) || changed;
  return changed;
}

/**
 * The picker's order: the location used by the latest transaction first, then the one before it, and so on;
 * locations never used (or not used lately enough to matter) follow in their normal list order.
 */
export function locationsByRecentUse<T extends { id: string }>(
  transactions: { locationId?: string | null }[],
  locations: T[],
): T[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (let i = transactions.length - 1; i >= 0 && seen.size < byId.size; i--) {
    const id = transactions[i].locationId;
    if (!id || seen.has(id)) continue;
    const location = byId.get(id);
    if (!location) continue;
    seen.add(id);
    ordered.push(location);
  }
  return [...ordered, ...locations.filter((l) => !seen.has(l.id))];
}

/** The part of a transfer that moves balances (decimal; the amount is always positive). */
export interface TransferBooking {
  fromLocationId?: string | null;
  toLocationId?: string | null;
  amount: number;
}

/**
 * One reconciliation for every create / edit / delete of a transfer: reverse the old one, apply the new one.
 * The source loses the amount and the destination gains it, so the total across locations never changes.
 * A transfer whose other end was deleted still moves the end that remains.
 */
export function reconcileTransfer(
  locations: MoneyLocation[],
  before: TransferBooking | null,
  after: TransferBooking | null,
): boolean {
  let changed = false;
  if (before) {
    changed = applyLocationDelta(locations, before.fromLocationId, before.amount) || changed;
    changed = applyLocationDelta(locations, before.toLocationId, -before.amount) || changed;
  }
  if (after) {
    changed = applyLocationDelta(locations, after.fromLocationId, -after.amount) || changed;
    changed = applyLocationDelta(locations, after.toLocationId, after.amount) || changed;
  }
  return changed;
}

/** A deleted location is dropped from the transfers that used it (the transfer itself stays). Returns how many changed. */
export function clearLocationFromTransfers(
  transfers: { fromLocationId?: string; toLocationId?: string }[],
  locationId: string,
): number {
  let count = 0;
  for (const transfer of transfers) {
    let touched = false;
    if (transfer.fromLocationId === locationId) {
      delete transfer.fromLocationId;
      touched = true;
    }
    if (transfer.toLocationId === locationId) {
      delete transfer.toLocationId;
      touched = true;
    }
    if (touched) count++;
  }
  return count;
}

/** Bulk delete: gives every removed transfer's amount back (the source regains it, the destination loses it). */
export function releaseTransfers(locations: MoneyLocation[], removed: TransferBooking[]): boolean {
  let changed = false;
  for (const transfer of removed) changed = reconcileTransfer(locations, transfer, null) || changed;
  return changed;
}

/**
 * A deleted location also deletes the recurring transfers that point at it (a rule between two locations cannot
 * survive losing one); the transfers they already made stay. Returns how many rules were removed.
 */
export function clearLocationFromRecurring(
  rules: { fromLocationId: string; toLocationId: string }[],
  locationId: string,
): number {
  let removed = 0;
  for (let i = rules.length - 1; i >= 0; i--) {
    if (rules[i].fromLocationId === locationId || rules[i].toLocationId === locationId) {
      rules.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

/**
 * Where the Cashflow sits: every location with its balance, their total, and what the locations do not account
 * for (`cashflow - total`; positive = money that is not in any location yet, negative = locations hold more than
 * the Cashflow shows). Rounded to the cent so float noise never shows up as a difference.
 */
export function cashflowByLocation(
  cashflow: number,
  locations: readonly MoneyLocation[],
): { rows: MoneyLocation[]; total: number; unassigned: number } {
  const round = (n: number) => Math.round(n * 100) / 100;
  const total = round(locations.reduce((sum, l) => sum + l.amount, 0));
  return { rows: [...locations], total, unassigned: round(cashflow - total) };
}
