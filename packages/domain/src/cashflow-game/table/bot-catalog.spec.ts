import { PRESET_SPECS } from '../simulation/strategies';
import {
  botIdWithLevel,
  botPolicy,
  botProfile,
  botProfiles,
  splitBotId,
  type BotLevel,
} from './bot-catalog';
import { playMatch } from './tournament';

describe('the bot catalog', () => {
  it('has unique ids and names, a difficulty and a description for every bot', () => {
    expect(new Set(botProfiles().map((b) => b.id)).size).toBe(botProfiles().length);
    expect(new Set(botProfiles().map((b) => b.name)).size).toBe(botProfiles().length);
    for (const b of botProfiles()) {
      expect(b.description.length).toBeGreaterThan(10);
      expect(['easy', 'medium', 'hard', 'champion']).toContain(b.difficulty);
      expect(b.id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/); // what a table accepts as a bot's strategy id
      expect(b.spec.id === b.id || b.build !== undefined || b.id === 'champion-latest').toBe(true);
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

describe('skill levels', () => {
  it('splits a leveled id into the bot and the level, and refuses a level that does not exist', () => {
    expect(splitBotId('all-rounder')).toEqual({ base: 'all-rounder', level: 'master' });
    expect(splitBotId('champion-v1--casual')).toEqual({ base: 'champion-v1', level: 'casual' });
    expect(splitBotId('champion-v1--genius')).toBeNull();
    expect(botIdWithLevel('all-rounder', 'master')).toBe('all-rounder');
    expect(botIdWithLevel('all-rounder', 'beginner')).toBe('all-rounder--beginner');
  });

  it('a leveled bot is a profile of its own: a lower tier, its level in the name, a playable id', () => {
    const casual = botProfile('all-rounder--casual')!;
    expect(casual.name).toBe('Allie All-Round (casual)');
    expect(casual.difficulty).toBe('easy'); // hard, two steps down
    expect(botProfile('champion-v1--strong')!.difficulty).toBe('hard');
    expect(botProfile('all-rounder--beginner')!.difficulty).toBe('easy');
    expect(botProfile('nope--casual')).toBeUndefined();
    expect(botProfile('all-rounder--genius')).toBeUndefined();
    expect(casual.id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
  });

  it('a level that slips plays the same game every time (the slips come from the position, not from chance)', () => {
    const config = {
      seed: 5,
      policies: [botPolicy('champion-v1--casual')!, botPolicy('all-rounder')!],
      professionIds: ['lehrer', 'lehrer'],
    };
    expect(playMatch(config)).toEqual(playMatch(config));
    expect(playMatch(config).problems).toEqual([]);
  });

  it('the lower the level, the fewer tables it wins against the same strategy at master', () => {
    const wins = (level: BotLevel) => {
      let won = 0;
      for (let seed = 1; seed <= 90; seed += 1) {
        const mine = botPolicy(botIdWithLevel('champion-v1', level))!;
        const master = botPolicy('champion-v1')!;
        const policies = seed % 2 ? [mine, master] : [master, mine];
        const match = playMatch({
          seed: 700 + seed,
          policies,
          professionIds: ['lehrer', 'lehrer'],
        });
        const ours = seed % 2 ? 0 : 1;
        if (match.winnerSeat === ours) won += 1;
      }
      return won;
    };
    const master = wins('master');
    const beginner = wins('beginner');
    expect(beginner).toBeLessThan(master);
    expect(master).toBeGreaterThan(30); // a master against itself wins about half
    expect(beginner).toBeLessThan(30);
  });
});
