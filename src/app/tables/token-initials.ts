/**
 * The letters on a player's token (JFK, 2026-10-18): chosen before joining a table, kept on this device and sent with the join, so
 * the other players see them on the board. Empty means the default - the first two letters of the player's name.
 */
const KEY = 'mm.tables.initials';

/** What the player typed, or '' (nothing saved). */
export function savedInitials(): string {
  try {
    return cleanInitials(localStorage.getItem(KEY) ?? '');
  } catch {
    return '';
  }
}

export function saveInitials(raw: string): string {
  const value = cleanInitials(raw);
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // a convenience only
  }
  return value;
}

/** Up to two letters or digits, upper case (the same rule the table applies). */
export function cleanInitials(raw: string): string {
  return Array.from(raw)
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** The default letters for a name. */
export function defaultInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}
