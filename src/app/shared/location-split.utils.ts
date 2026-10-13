import {
  bookingLegs,
  resolveLocationSplit,
  SplitRuleLeg,
  validateLocationSplitRule,
} from '@money/domain';
import { MoneyLocation } from '../interfaces/location';
import { locationLabel } from './location.utils';

/**
 * One line of the "split across locations" editor: an OTHER location and its share, as a percentage of the
 * booking or as a fixed amount (always entered positive). The main location gets the rest and is not a row.
 */
export interface SplitRow {
  locationId: string | null;
  mode: 'percent' | 'amount';
  value: number | null;
}

/** The stored rule of a subscription: a percent OR an amount (major units, positive) per other location. */
export interface StoredSplitRule {
  locationId: string;
  percent?: number;
  amount?: number;
}

/** The stored amounts of one booking that went to other locations (signed, major units). */
export interface StoredSplit {
  locationId: string;
  amount: number;
}

const toCents = (major: number): number => Math.round(major * 100);
const toMajor = (cents: number): number => cents / 100;

/** The rows that are actually filled in; a half-edited row is ignored until it is complete. */
function filledRows(rows: readonly SplitRow[]): SplitRow[] {
  return rows.filter(
    (row) =>
      !!row.locationId && row.value !== null && row.value !== undefined && `${row.value}` !== '',
  );
}

export function rowsToRule(rows: readonly SplitRow[]): SplitRuleLeg[] {
  return filledRows(rows).map((row) =>
    row.mode === 'percent'
      ? { locationId: row.locationId as string, percent: Number(row.value) }
      : { locationId: row.locationId as string, amountMinor: toCents(Number(row.value)) },
  );
}

/** A problem to show next to the editor, or null. Rows that are not filled in yet are not a problem. */
export function splitProblem(
  rows: readonly SplitRow[],
  mainLocationId: string | null | undefined,
): string | null {
  return validateLocationSplitRule(rowsToRule(rows), mainLocationId);
}

/** For a subscription: the rule in the shape it is stored in. */
export function rowsToStoredRule(rows: readonly SplitRow[]): StoredSplitRule[] {
  return rowsToRule(rows).map((leg) =>
    leg.percent !== undefined
      ? { locationId: leg.locationId, percent: leg.percent }
      : { locationId: leg.locationId, amount: toMajor(leg.amountMinor as number) },
  );
}

export function storedRuleToRows(rule: readonly StoredSplitRule[] | undefined): SplitRow[] {
  return (rule ?? []).map((leg) =>
    leg.percent !== undefined
      ? { locationId: leg.locationId, mode: 'percent', value: leg.percent }
      : { locationId: leg.locationId, mode: 'amount', value: leg.amount ?? 0 },
  );
}

/** For a transaction: what to store as the other-location amounts for this booking, resolved to the cent. */
export function resolveStoredSplits(amount: number, rows: readonly SplitRow[]): StoredSplit[] {
  return resolveLocationSplit(toCents(amount), rowsToRule(rows)).map((leg) => ({
    locationId: leg.locationId,
    amount: toMajor(leg.amountMinor),
  }));
}

/**
 * Editing a booking that is already split: its other-location amounts become fixed-amount rows (positive),
 * so saving keeps them exactly and only the main location absorbs a changed total.
 */
export function splitsToRows(splits: readonly StoredSplit[] | undefined): SplitRow[] {
  return (splits ?? []).map((split) => ({
    locationId: split.locationId,
    mode: 'amount',
    value: Math.abs(split.amount),
  }));
}

export interface SplitPreviewLine {
  locationId: string;
  label: string;
  amount: number;
}

/** What each location would get, main first - the live preview under the editor. */
export function splitPreview(
  amount: number,
  mainLocationId: string | null | undefined,
  rows: readonly SplitRow[],
  locations: readonly MoneyLocation[],
): SplitPreviewLine[] {
  if (!mainLocationId || !Number.isFinite(amount)) return [];
  const extras = resolveLocationSplit(toCents(amount), rowsToRule(rows));
  return bookingLegs({
    amountMinor: toCents(amount),
    locationId: mainLocationId,
    locationSplits: extras,
  }).map((leg) => ({
    locationId: leg.locationId,
    label: locationLabel(locations.find((l) => l.id === leg.locationId)) || leg.locationId,
    amount: toMajor(leg.amountMinor),
  }));
}
