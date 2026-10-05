/**
 * The printed Cashflow game content (professions and the Classic card piles), kept out of the domain
 * package's main entry on purpose. The Firebase builds swap this file for `cashflow-content.firebase.ts`
 * (angular.json fileReplacements), so none of it ships to the public site - the game is a self-hosted
 * feature (JFK, 2026-10-05). Always import the game sets from here, never from the domain package.
 */
export { CASHFLOW_GAME_SETS } from '@money/domain/dist/cashflow-content';
