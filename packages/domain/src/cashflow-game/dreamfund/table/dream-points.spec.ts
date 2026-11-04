import { buildDreamfundBoard, describeBoard } from '../../dreamfund-board';
import { normalizeDreamSettings } from './settings';
import { goalsOf, isWon } from './scoring';
import { DreamPlayer } from '../player';

describe('playing for dream points, or for the life dream alone', () => {
  it('asks for 10 dream points unless the table says otherwise, and takes 0 for the life dream alone', () => {
    expect(normalizeDreamSettings({ name: 'T' } as never, 10).dreamPoints).toBe(10);
    expect(normalizeDreamSettings({ name: 'T', dreamPoints: 0 } as never, 10).dreamPoints).toBe(0);
    expect(() => normalizeDreamSettings({ name: 'T', dreamPoints: -1 } as never, 10)).toThrow();
  });

  it('a map for the life dream alone has no Smile tiles, and the Opportunity tiles take their place', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const base = { shape: 'ring' as const, size, seed: 3 };
      const withDreams = describeBoard(buildDreamfundBoard(base).board);
      const alone = describeBoard(buildDreamfundBoard({ ...base, dreams: false }).board);
      expect(withDreams['dream']).toBeGreaterThan(0);
      expect(alone['dream'] ?? 0).toBe(0);
      expect(alone['opportunity']).toBe(withDreams['opportunity'] + withDreams['dream']);
      expect(Object.values(alone).reduce((a, b) => a + b, 0)).toBe(
        Object.values(withDreams).reduce((a, b) => a + b, 0),
      );
    }
  });

  it('with dream points asked for, a win needs them as well: the goal is a share of the points', () => {
    const p = DreamPlayer.fromSeed({
      seed: 4,
      professionId: 'dual-student-informatik',
      rules: { mode: 'free' } as never,
    });
    expect(goalsOf(p).points).toBeUndefined();
    expect(goalsOf(p, 10).points).toBe(0);
    p.dreamPoints = 4;
    expect(goalsOf(p, 10).points).toBeCloseTo(0.4);
    const all = { reserve: 1, debts: 1, dream: 1, independence: 1 };
    expect(isWon({ ...all, points: 0.4 })).toBe(false);
    expect(isWon({ ...all, points: 1 })).toBe(true);
    expect(isWon(all)).toBe(true);
  });

  it('a life made for the life dream alone is dealt on that map and keeps it', () => {
    const p = DreamPlayer.fromSeed({
      seed: 6,
      professionId: 'dual-student-informatik',
      dreamTiles: false,
      rules: { mode: 'free' } as never,
    });
    expect(p.board.some((space) => space.kind === 'dream')).toBe(false);
    const again = DreamPlayer.restore(p.snapshot(), () => 0.5);
    expect(again.board.some((space) => space.kind === 'dream')).toBe(false);
  });
});
