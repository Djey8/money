import type { CashflowGameSet } from '@money/domain';

/**
 * The Firebase edition's stand-in for `cashflow-content.ts`: no game sets at all. With nothing to play,
 * `CashflowGameService.isCashflowGame()` is false and the game never appears, even for an account whose
 * email says "cashflow". Swapped in by angular.json for the `firebase` and `production` builds.
 */
export const CASHFLOW_GAME_SETS: CashflowGameSet[] = [];
