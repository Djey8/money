/**
 * The German of the card texts (see `cashflow-card-text-de-data.ts`) is loaded by the game's content loader when a game is played, and
 * registered here: it is a big table that the first screen of the app does not need, and the Firebase edition has none.
 */
let dictionary: Record<string, string> = {};

export function registerCardTextDe(table: Record<string, string>): void {
  dictionary = table ?? {};
}

/** The text in the language of the game: German where there is a translation, else the text as it is. */
export function cardText(text: string, lang: 'en' | 'de'): string {
  return lang === 'de' ? (dictionary[text] ?? text) : text;
}
