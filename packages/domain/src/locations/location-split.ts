/**
 * Splitting one booking across several locations (todo/locations.md §18).
 *
 * A booking has a MAIN location (`locationId`) and, optionally, amounts that go to OTHER locations
 * (`locationSplits`). Only the other amounts are stored: the main location always receives the
 * remainder (`amountMinor` minus everything sent elsewhere). That makes the parts add up to the
 * amount by construction, whatever later changes the amount (a fund cap, an edit).
 *
 * Amounts are signed like the transaction: an expense is negative at every location it touches.
 * All amounts are integer minor units; the Angular app (decimal) converts at its boundary.
 */

/** Money booked at one location (signed minor units). */
export interface LocationLeg {
  locationId: string;
  amountMinor: number;
}

/** What a subscription says about the other locations: a percentage OR a fixed amount, always positive. */
export interface SplitRuleLeg {
  locationId: string;
  /** 0 < percent <= 100, of the booking's absolute amount. */
  percent?: number;
  /** Fixed amount in minor units (> 0), in the sign direction of the booking. */
  amountMinor?: number;
}

/** The part of a transaction that decides where its money lands. */
export interface SplitBooking {
  amountMinor: number;
  /** The main location: gets what is not sent elsewhere. */
  locationId?: string | null;
  /** The amounts that go to other locations. */
  locationSplits?: LocationLeg[];
}

/**
 * Every location a booking touches with the amount it gets, main first. The main location's share is
 * the remainder, so the legs always sum to `amountMinor` (when there is a main location).
 */
export function bookingLegs(booking: SplitBooking): LocationLeg[] {
  const extras = (booking.locationSplits ?? []).filter(
    (leg) => !!leg.locationId && Number.isFinite(leg.amountMinor) && leg.amountMinor !== 0,
  );
  const extrasTotal = extras.reduce((sum, leg) => sum + leg.amountMinor, 0);
  const legs: LocationLeg[] = [];
  if (booking.locationId) {
    legs.push({ locationId: booking.locationId, amountMinor: booking.amountMinor - extrasTotal });
  }
  legs.push(...extras);
  return legs;
}

/**
 * Turns a rule into the amounts for one booking: percentages are taken from the absolute amount and
 * rounded to the cent, fixed amounts are used as they are, and the sign follows the booking. An amount
 * that would take more than the booking has is cut back to what is left, so the main location never
 * ends up with the wrong sign.
 */
export function resolveLocationSplit(
  amountMinor: number,
  rule: readonly SplitRuleLeg[] | undefined | null,
): LocationLeg[] {
  if (!rule || rule.length === 0 || !Number.isFinite(amountMinor) || amountMinor === 0) return [];
  const sign = amountMinor < 0 ? -1 : 1;
  let remaining = Math.abs(amountMinor);
  const legs: LocationLeg[] = [];
  for (const leg of rule) {
    if (!leg.locationId) continue;
    const wanted =
      leg.amountMinor !== undefined
        ? leg.amountMinor
        : Math.round((Math.abs(amountMinor) * (leg.percent ?? 0)) / 100);
    const magnitude = Math.min(Math.max(wanted, 0), remaining);
    if (magnitude <= 0) continue;
    remaining -= magnitude;
    legs.push({ locationId: leg.locationId, amountMinor: sign * magnitude });
  }
  return legs;
}

/** `null` when the rule is usable, otherwise a message saying what is wrong. */
export function validateLocationSplitRule(
  rule: readonly SplitRuleLeg[] | undefined | null,
  mainLocationId: string | null | undefined,
): string | null {
  if (!rule || rule.length === 0) return null;
  if (!mainLocationId) return 'Choose the main location that receives the rest.';
  const seen = new Set<string>();
  let percentTotal = 0;
  for (const leg of rule) {
    if (typeof leg.locationId !== 'string' || leg.locationId === '') {
      return 'Every split needs a location.';
    }
    if (leg.locationId === mainLocationId) {
      return 'The main location cannot also be one of the split locations.';
    }
    if (seen.has(leg.locationId)) return 'A location can appear only once in a split.';
    seen.add(leg.locationId);
    const hasPercent = leg.percent !== undefined && leg.percent !== null;
    const hasAmount = leg.amountMinor !== undefined && leg.amountMinor !== null;
    if (hasPercent === hasAmount) return 'Give each split either a percentage or an amount.';
    if (hasPercent) {
      const percent = leg.percent as number;
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return 'A percentage must be more than 0 and at most 100.';
      }
      percentTotal += percent;
    } else {
      const amount = leg.amountMinor as number;
      if (!Number.isInteger(amount) || amount <= 0) return 'A split amount must be more than 0.';
    }
  }
  if (percentTotal > 100) return 'The percentages add up to more than 100.';
  return null;
}
