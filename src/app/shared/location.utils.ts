import { MoneyLocation } from '../interfaces/location';

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * A location is identified by its name plus its optional sub name, case-insensitively:
 * "N26 - Main" and "N26 - Instant Savings" can coexist, two "N26 - Main" cannot (the picker would
 * otherwise show two identical entries).
 */
export function isDuplicateLocationName(
  name: string,
  subName: string | undefined,
  locations: MoneyLocation[],
  ignoreId?: string,
): boolean {
  return locations.some(
    (l) => l.id !== ignoreId && norm(l.name) === norm(name) && norm(l.subName) === norm(subName),
  );
}

/** "N26 - Main", or just "Bank 1" when there is no sub name. Used wherever a location is picked or named. */
export function locationLabel(
  location: Pick<MoneyLocation, 'name' | 'subName'> | null | undefined,
): string {
  if (!location) return '';
  const sub = (location.subName ?? '').trim();
  return sub ? `${location.name} - ${sub}` : location.name;
}
