import type { CashflowGameSet } from '@money/domain';

/**
 * The Firebase edition's stand-in for `cashflow-content.ts`: no game sets at all. With nothing to play,
 * `CashflowGameService.isCashflowGame()` is false and the game never appears, even for an account whose
 * email says "cashflow". Swapped in by angular.json for the `firebase` and `production` builds.
 */
export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [];

/** This build carries no game. */
export const CASHFLOW_CONTENT_AVAILABLE = false;

/** Nothing to load. */
export const ensureCashflowContent = (): Promise<void> => Promise.resolve();

export const preloadCashflowContentFor = (_mail: string | undefined | null): void => undefined;

/** No game, no card texts. */
export const loadCardTextDe = (): Promise<Record<string, string>> => Promise.resolve({});
