import type { CashflowGameSet } from '@money/domain';

/**
 * The printed Cashflow game content (professions and the Classic card piles), kept out of the domain
 * package's main entry on purpose. The Firebase builds swap this file for `cashflow-content.firebase.ts`
 * (angular.json fileReplacements), so none of it ships to the public site - the game is a self-hosted
 * feature (JFK, 2026-10-05). Always import the game sets from here, never from the domain package.
 *
 * The content is big (about a megabyte of cards, texts and links): it is a chunk of its own, loaded when a game
 * account signs in or opens the game's manual, and not with the first screen (JFK, 2026-11). `CASHFLOW_GAME_SETS`
 * is the same array all along; it is filled in place when the content arrives, so what holds it sees the sets
 * once they are there. Until then it is empty, which is also what "this is not a game account" looks like.
 */
export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [];

/** This build can carry the game (the Firebase builds cannot). */
export const CASHFLOW_CONTENT_AVAILABLE = true;

let loading: Promise<void> | null = null;

/** Loads the game content once; the sets are there when it resolves. A failure is logged and the promise still resolves. */
export function ensureCashflowContent(): Promise<void> {
  loading ??= Promise.all([
    import('@money/domain/dist/cashflow-content'),
    import('@money/domain/dist/cashflow-game/table/default-game-sets'),
  ])
    .then(([content, registry]) => {
      // the package is CommonJS: the sets are on the module or, through the loader, on its default
      const sets: CashflowGameSet[] =
        (content as { CASHFLOW_GAME_SETS?: CashflowGameSet[] }).CASHFLOW_GAME_SETS ??
        (content as { default?: { CASHFLOW_GAME_SETS?: CashflowGameSet[] } }).default
          ?.CASHFLOW_GAME_SETS ??
        [];
      CASHFLOW_GAME_SETS.splice(0, CASHFLOW_GAME_SETS.length, ...sets);
      // the table rules of the domain package look their sets up where the caller registered them
      const table = registry as {
        setDefaultTableGameSets?: (sets: CashflowGameSet[]) => void;
        default?: { setDefaultTableGameSets?: (sets: CashflowGameSet[]) => void };
      };
      (table.setDefaultTableGameSets ?? table.default?.setDefaultTableGameSets)?.(
        CASHFLOW_GAME_SETS,
      );
    })
    .catch((error) => {
      loading = null;
      console.error('The game content could not be loaded:', error);
    });
  return loading;
}

/** A signed-in account whose email says "cashflow" is a game account: its content starts loading at once, before the game is opened. */
export function preloadCashflowContentFor(mail: string | undefined | null): void {
  if (mail && mail.includes('cashflow')) void ensureCashflowContent();
}

/** The German of the card texts: loaded when a game is played, not with the first screen (a table of ~40 kB). */
export const loadCardTextDe = (): Promise<Record<string, string>> =>
  import('@money/domain/dist/cashflow-card-text-de-data').then(
    // the package is CommonJS: the table is on the module or, through the loader, on its default
    (module: {
      CARD_TEXT_DE?: Record<string, string>;
      default?: { CARD_TEXT_DE?: Record<string, string> };
    }) => module.CARD_TEXT_DE ?? module.default?.CARD_TEXT_DE ?? {},
  );
