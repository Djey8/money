/**
 * The text the game writes into the account - subscription titles, categories, notes, history labels - in the
 * language the game was started in (JFK, 2026-10-05: the account's language, fixed for the whole game).
 *
 * The engine never imports a translation library. It is handed one function: the Angular app passes
 * ngx-translate's `instant`, the backend passes a lookup over the same `src/assets/i18n/*.json` catalogs. A key
 * the catalog does not know comes back unchanged, exactly like ngx-translate's missing-key handler, which is what
 * `textOrFallback` relies on.
 */
export type GameText = (key: string, params?: Record<string, string | number>) => string;

/**
 * The translation for `key`, or `fallback` (the game set's own string) when the catalog has none yet - the same
 * behaviour the Angular service has always had for profession, expense and liability names.
 */
export function textOrFallback(text: GameText, key: string, fallback: string): string {
  const translated = text(key);
  return translated === key ? fallback : translated;
}

/** A text function that never translates: every key comes back as itself. For tests and language-neutral callers. */
export const identityText: GameText = (key) => key;
