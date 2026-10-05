import {
  CLASSIC_RAT_RACE_BOARD as board,
  spaceAngle,
  spaceAt,
  validateRatRaceBoard,
  type RatRaceSpaceKind,
} from './board';

/** Plan §3.1 as the picture printed it, space by space (the German words), clockwise from START. */
const TRANSCRIPTION = [
  'Deals',
  'Schnickschnack',
  'Deals',
  'Wohltätigkeit',
  'Deals',
  'Zahltag',
  'Deals',
  'Der Markt',
  'Deals',
  'Schnickschnack',
  'Deals',
  'Arbeitslos',
  'Deals',
  'Zahltag',
  'Deals',
  'Der Markt',
  'Deals',
  'Schnickschnack',
  'Deals',
  'Baby',
  'Deals',
  'Zahltag',
  'Deals',
  'Der Markt',
];

describe('the Classic rat-race board', () => {
  it('is the transcription of the picture, space by space', () => {
    expect(board.map((space) => space.printed)).toEqual(TRANSCRIPTION);
  });

  it('has 24 spaces: 12 deals, 3 doodads, 3 paydays, 3 markets, one each of charity, downsized and baby', () => {
    const count = (kind: RatRaceSpaceKind) => board.filter((space) => space.kind === kind).length;
    expect(board).toHaveLength(24);
    expect([count('deal'), count('doodad'), count('payday'), count('market')]).toEqual([
      12, 3, 3, 3,
    ]);
    expect([count('charity'), count('downsized'), count('baby')]).toEqual([1, 1, 1]);
  });

  it('repeats its pattern every 8 spaces (the check that the transcription is right)', () => {
    for (let i = 0; i < 8; i++) {
      for (const lap of [1, 2]) {
        const a = board[i].kind;
        const b = board[i + lap * 8].kind;
        if (i === 3) expect(['charity', 'downsized', 'baby']).toContain(b);
        else expect(b).toBe(a);
      }
    }
  });

  it('is a valid ring, numbered from 0, and cannot be changed', () => {
    expect(validateRatRaceBoard(board)).toEqual([]);
    expect(board.map((space) => space.index)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(Object.isFrozen(board)).toBe(true);
    expect(Object.isFrozen(board[0])).toBe(true);
  });

  it('wraps around the ring, forwards and backwards', () => {
    expect(spaceAt(board, 0).index).toBe(0);
    expect(spaceAt(board, 24).index).toBe(0);
    expect(spaceAt(board, 29).index).toBe(5);
    expect(spaceAt(board, 29).kind).toBe('payday');
    expect(spaceAt(board, -1).index).toBe(23);
  });

  it('lays the spaces out evenly round the circle, START in the gap before space 0', () => {
    expect(spaceAngle(board, 0)).toBe(7.5);
    expect(spaceAngle(board, 23)).toBe(352.5);
    expect(spaceAngle(board, 6) - spaceAngle(board, 5)).toBe(15);
  });
});

describe('validating a board', () => {
  it('names what is wrong', () => {
    expect(validateRatRaceBoard([])).toEqual(
      expect.arrayContaining(['A ring needs at least 2 spaces.', 'The board has no payday space.']),
    );
    const noPayday = board
      .filter((space) => space.kind !== 'payday')
      .map((s, index) => ({ ...s, index }));
    expect(validateRatRaceBoard(noPayday)).toEqual(['The board has no payday space.']);
    expect(validateRatRaceBoard(board.slice(1))).toContain('Space 0 has index 1.');
  });
});
