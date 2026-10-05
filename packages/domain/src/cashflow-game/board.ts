/**
 * The rat-race board for solo play (todo/cashflow-game-pro.md slice B1): a ring of spaces the token walks clockwise.
 * Transcribed from JFK's picture of the German "Cashflow - Verlasse das Hamsterrad!" board (plan §3.1); the outer
 * Fast Track is out of scope. Pure data and geometry - movement and turns come in B2/B3.
 */

/**
 * What a space on the ring is. `deal` is one kind for both piles: the board does not fix Small or Big, the player picks
 * the pile when landing (JFK, 2026-10-05), so that choice is part of the turn's pending decision, not of the board.
 */
export type RatRaceSpaceKind =
  'deal' | 'doodad' | 'payday' | 'market' | 'charity' | 'downsized' | 'baby';

export interface RatRaceSpace {
  /** Position on the ring: 0 is the space next to START, counted clockwise. */
  index: number;
  kind: RatRaceSpaceKind;
  /** What the board prints, for the picture-faithful label (German - the game's own words are translated by the UI). */
  printed: string;
}

export type RatRaceBoard = readonly RatRaceSpace[];

const PRINTED: Record<RatRaceSpaceKind, string> = {
  deal: 'Deals',
  doodad: 'Schnickschnack',
  payday: 'Zahltag',
  market: 'Der Markt',
  charity: 'Wohltätigkeit',
  downsized: 'Arbeitslos',
  baby: 'Baby',
};

/** The Classic board's 24 spaces, clockwise from START, in the order of the picture. */
const CLASSIC_LAYOUT: RatRaceSpaceKind[] = [
  'deal',
  'doodad',
  'deal',
  'charity',
  'deal',
  'payday',
  'deal',
  'market',
  'deal',
  'doodad',
  'deal',
  'downsized',
  'deal',
  'payday',
  'deal',
  'market',
  'deal',
  'doodad',
  'deal',
  'baby',
  'deal',
  'payday',
  'deal',
  'market',
];

function makeBoard(kinds: RatRaceSpaceKind[]): RatRaceBoard {
  return Object.freeze(
    kinds.map((kind, index) => Object.freeze({ index, kind, printed: PRINTED[kind] })),
  );
}

export const CLASSIC_RAT_RACE_BOARD: RatRaceBoard = makeBoard(CLASSIC_LAYOUT);

/** The problems with a board, empty when it can be played: a closed ring with every kind present, and a Payday. */
export function validateRatRaceBoard(board: RatRaceBoard): string[] {
  const problems: string[] = [];
  if (board.length < 2) problems.push('A ring needs at least 2 spaces.');
  board.forEach((space, index) => {
    if (space.index !== index) problems.push(`Space ${index} has index ${space.index}.`);
  });
  const present = new Set(board.map((space) => space.kind));
  for (const kind of Object.keys(PRINTED) as RatRaceSpaceKind[]) {
    if (!present.has(kind)) problems.push(`The board has no ${kind} space.`);
  }
  return problems;
}

/** The space at a ring position; positions beyond the ring wrap around, negative ones count back from the end. */
export function spaceAt(board: RatRaceBoard, position: number): RatRaceSpace {
  const length = board.length;
  return board[((position % length) + length) % length];
}

/**
 * Where a space sits for drawing the ring: degrees clockwise from the top (0 = 12 o'clock). START sits half a step
 * before space 0, so space 0 is centred half a step after the top.
 */
export function spaceAngle(board: RatRaceBoard, index: number): number {
  const step = 360 / board.length;
  return (index + 0.5) * step;
}

/** Where START sits, for drawing: the gap between the last space and space 0. */
export function startAngle(): number {
  return 0;
}
