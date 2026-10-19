/**
 * Every game starts with one place for its money (JFK, 2026-10-19): the location "Bank" - "Main". All the game's bookings (payday,
 * Doodads, deals, subscriptions) use it. It is found by this id, never by its name: the player may rename it and the name is
 * translated into the language the game was started in. It cannot be deleted.
 */
export const GAME_BANK_LOCATION_ID = 'game-bank';

export function isGameBankLocation(id: string | null | undefined): boolean {
  return id === GAME_BANK_LOCATION_ID;
}
