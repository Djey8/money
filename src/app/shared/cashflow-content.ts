/**
 * The printed Cashflow game content (professions and the Classic card piles), kept out of the domain
 * package's main entry on purpose. The Firebase builds swap this file for `cashflow-content.firebase.ts`
 * (angular.json fileReplacements), so none of it ships to the public site - the game is a self-hosted
 * feature (JFK, 2026-10-05). Always import the game sets from here, never from the domain package.
 */
export { CASHFLOW_GAME_SETS } from '@money/domain/dist/cashflow-content';

/** The German of the card texts: loaded when a game is played, not with the first screen (a table of ~40 kB). */
export const loadCardTextDe = (): Promise<Record<string, string>> =>
  import('@money/domain/dist/cashflow-card-text-de-data').then(
    // the package is CommonJS: the table is on the module or, through the loader, on its default
    (module: {
      CARD_TEXT_DE?: Record<string, string>;
      default?: { CARD_TEXT_DE?: Record<string, string> };
    }) => module.CARD_TEXT_DE ?? module.default?.CARD_TEXT_DE ?? {},
  );
