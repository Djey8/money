import {
  classicRulesOfMode,
  CUSTOM_RULE_PRESETS,
  isPresetMode,
  normalizeCustomRules,
} from './custom-rules';

describe('the rules of the Custom JFK edition', () => {
  it('free is open, strict lets the cards decide, guided is in between', () => {
    const { free, guided, strict } = CUSTOM_RULE_PRESETS;
    expect(free).toMatchObject({
      cardChoice: 'free',
      emergencySettle: 'never',
      lifeMayDecline: true,
      ownProjects: true,
      careerMustRoll: false,
    });
    expect(guided).toMatchObject({
      cardChoice: 'random',
      emergencySettle: 'payNow',
      careerMustRoll: true,
      dreamMayDecline: true,
      ownProjects: true,
    });
    expect(strict).toMatchObject({
      cardChoice: 'random',
      emergencySettle: 'all',
      lifeMayDecline: false,
      dreamMayDecline: true,
      ownProjects: false,
      bankInterestPercent: 10,
    });
  });

  it('fills in what is missing from the mode and keeps what is valid', () => {
    expect(normalizeCustomRules(undefined)).toEqual(CUSTOM_RULE_PRESETS.free);
    expect(normalizeCustomRules({ mode: 'strict' })).toEqual(CUSTOM_RULE_PRESETS.strict);
    const mixed = normalizeCustomRules({ mode: 'strict', dreamOffers: 3, ownProjects: true });
    expect(mixed).toMatchObject({
      mode: 'strict',
      dreamOffers: 3,
      ownProjects: true,
      lifeMayDecline: false,
    });
    expect(isPresetMode(mixed)).toBe(false);
    expect(isPresetMode(CUSTOM_RULE_PRESETS.guided)).toBe(true);
    // nonsense is clamped
    expect(normalizeCustomRules({ dreamOffers: 99, maxOpenDreams: 0 })).toMatchObject({
      dreamOffers: 3,
      maxOpenDreams: 1,
    });
  });

  it('the classic rules the engine enforces are those of the mode', () => {
    expect(classicRulesOfMode('strict')).toMatchObject({
      preset: 'strict',
      manualTransactions: 'forbidden',
    });
    expect(classicRulesOfMode('free').preset).toBe('free');
  });
});
