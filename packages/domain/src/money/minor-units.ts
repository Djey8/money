/**
 * Conversion between the decimal-float money representation used
 * throughout today's app (see docs/discovery/DOMAIN_MODEL.md) and the
 * integer-minor-units representation the Pro API and domain package use
 * going forward. See docs/adr/0002-money-minor-units-migration.md.
 *
 * Rounding: round-half-away-from-zero at the target precision (matches
 * the common financial convention — e.g. Python's `decimal.ROUND_HALF_UP`
 * — and is symmetric for the negative amounts this app stores for
 * expenses). This is `Math.round`'s native behavior for positive numbers;
 * negative numbers are handled by rounding the absolute value and
 * restoring the sign, since `Math.round` alone rounds -2.5 to -2 (towards
 * +Infinity), not -3 (away from zero).
 */

/** Converts a decimal amount (e.g. 42.5) to integer minor units (e.g. 4250 for 2-digit currencies). */
export function toMinorUnits(decimal: number, minorUnitDigits = 2): number {
  const factor = 10 ** minorUnitDigits;
  const scaled = decimal * factor;
  return scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
}

/** Converts integer minor units back to a decimal amount. */
export function fromMinorUnits(minorUnits: number, minorUnitDigits = 2): number {
  return minorUnits / 10 ** minorUnitDigits;
}

/**
 * True if converting `decimal` to minor units and back reproduces the
 * exact original value. A `false` result doesn't necessarily mean the
 * value is wrong — it usually means the stored float already carried more
 * precision than the currency's minor unit allows (a pre-existing
 * floating-point artifact from arithmetic elsewhere in the app) — but it's
 * exactly the case the migration tool's --dry-run flags for manual review
 * before a real run, per docs/adr/0002.
 */
export function isCleanlyRepresentable(decimal: number, minorUnitDigits = 2): boolean {
  const minor = toMinorUnits(decimal, minorUnitDigits);
  return Math.abs(fromMinorUnits(minor, minorUnitDigits) - decimal) < 1e-9;
}
