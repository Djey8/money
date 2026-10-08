import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { PRESET_POLICIES } from '../simulation/strategies';
import { SimGame } from '../simulation/session';
import { bandOf, describeProgress, progressPoints, type ProgressBands } from './progress';
import { snapshotFromBooks } from './snapshot-from-books';

const policy = PRESET_POLICIES.find((candidate) => candidate.id === 'all-rounder')!;

describe('bandOf', () => {
  it('puts a share of the expenses into one of five bands', () => {
    expect([0, 0.049, 0.05, 0.099, 0.1, 0.19, 0.2, 0.39, 0.4, 1.4].map(bandOf)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });
});

describe('progressPoints', () => {
  const game = new SimGame({
    gameSets: CASHFLOW_GAME_SETS,
    gameSetId: 'cashflow',
    professionId: 'lehrer',
    policy,
    seed: 3,
  });
  for (let turn = 0; turn < 12; turn += 1) game.playTurn();
  const live = snapshotFromBooks(game.books);
  const bands: ProgressBands = {
    'all-rounder|10': [
      { games: 100, escaped: 20, bankrupt: 30 },
      { games: 100, escaped: 40, bankrupt: 20 },
      { games: 100, escaped: 50, bankrupt: 10 },
      { games: 100, escaped: 80, bankrupt: 5 },
      { games: 100, escaped: 95, bankrupt: 1 },
    ],
    'all-rounder|20': [{ games: 100, escaped: 1, bankrupt: 1 }],
  };

  it('reads the game at the rolls it got to, and says how games that stood there ended', () => {
    const points = progressPoints([], live, { gameSets: CASHFLOW_GAME_SETS, bands });
    expect(points.map((point) => point.roll)).toEqual([10]);
    const [point] = points;
    expect(point.games).toBe(100);
    expect(point.escapeChance).toBe(bands['all-rounder|10'][point.band].escaped / 100);
    expect(describeProgress(points)).toContain('Roll 10');
  });

  it('leaves out a roll the lab has too few games for', () => {
    const thin: ProgressBands = { 'all-rounder|10': [{ games: 3, escaped: 1, bankrupt: 0 }] };
    expect(progressPoints([], live, { gameSets: CASHFLOW_GAME_SETS, bands: thin })).toEqual([]);
    expect(describeProgress([])).toBe('');
  });
});
