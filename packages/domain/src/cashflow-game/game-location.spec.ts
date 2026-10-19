import { GAME_BANK_LOCATION_ID, isGameBankLocation } from './game-location';

describe('the default location of a game', () => {
  it('is found by its stable id, whatever its name has become', () => {
    expect(isGameBankLocation(GAME_BANK_LOCATION_ID)).toBe(true);
    expect(isGameBankLocation('loc_123')).toBe(false);
    expect(isGameBankLocation(null)).toBe(false);
    expect(isGameBankLocation(undefined)).toBe(false);
  });
});
