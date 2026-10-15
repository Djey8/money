import { PRESET_SPECS } from '../simulation/strategies';
import { botProfiles, botPolicy, botProfile } from './bot-catalog';
import { playMatch } from './tournament';

describe('the bot catalog', () => {
  it('has unique ids and names, a difficulty and a description for every bot', () => {
    expect(new Set(botProfiles().map((b) => b.id)).size).toBe(botProfiles().length);
    expect(new Set(botProfiles().map((b) => b.name)).size).toBe(botProfiles().length);
    for (const b of botProfiles()) {
      expect(b.description.length).toBeGreaterThan(10);
      expect(['easy', 'medium', 'hard', 'champion']).toContain(b.difficulty);
      expect(b.id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/); // what a table accepts as a bot's strategy id
      expect(b.spec.id === b.id || b.build !== undefined).toBe(true);
    }
  });

  it('offers every preset strategy of the lab, at every level of difficulty up to the champion', () => {
    for (const spec of PRESET_SPECS) expect(botProfile(spec.id)).toBeDefined();
    expect(new Set(botProfiles().map((b) => b.difficulty))).toEqual(
      new Set(['easy', 'medium', 'hard', 'champion']),
    );
  });

  it('gives a playable strategy per id, the same object each time, and null for an unknown one', () => {
    expect(botPolicy('all-rounder')).toBe(botPolicy('all-rounder'));
    expect(botPolicy('all-rounder')!.id).toBe('all-rounder');
    expect(botPolicy('nonsense')).toBeNull();
  });

  it('every bot plays a whole table to an end', () => {
    for (const b of botProfiles()) {
      const match = playMatch({
        seed: 21,
        policies: [botPolicy(b.id)!, botPolicy('all-rounder')!],
        professionIds: ['lehrer', 'lehrer'],
      });
      expect(match.problems).toEqual([]);
      expect(match.cutOff).toBe(false);
    }
  });
});

describe('the champion', () => {
  // Fresh seeds, apart from the ones the search used (70000..) and its verdict (9,000,000..): a small replay of the verdict. If a
  // rules change breaks this, search again and freeze a v2 - do not loosen the check.
  it('still beats the best hand-built strategy head to head, across professions', () => {
    const professions = [
      'hausmeister',
      'lehrer',
      'manager',
      'krankenpfleger',
      'arzt',
      'unternehmer',
    ];
    let champion = 0;
    let allRounder = 0;
    let tables = 0;
    for (const [i, professionId] of professions.entries()) {
      for (let n = 0; n < 24; n += 1) {
        const seed = 12_000_000 + i * 1000 + n;
        const match = playMatch({
          seed,
          policies:
            n % 2 === 0
              ? [botPolicy('champion-v1')!, botPolicy('all-rounder')!]
              : [botPolicy('all-rounder')!, botPolicy('champion-v1')!],
          professionIds: [professionId, professionId],
        });
        expect(match.problems).toEqual([]);
        tables += 1;
        if (match.winnerSeat !== null) {
          if (match.seats[match.winnerSeat].policyId === 'champion-v1') champion += 1;
          else allRounder += 1;
        }
      }
    }
    expect(tables).toBe(144);
    expect(champion).toBeGreaterThan(allRounder);
  });

  it('is a champion in the catalog, with its numbers on record', () => {
    expect(botProfile('champion-v1')?.difficulty).toBe('champion');
    expect(botProfile('champion-v1')?.spec.overrides.catchUp).toBeTruthy();
  });
});
