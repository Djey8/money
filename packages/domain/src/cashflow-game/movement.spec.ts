import { CLASSIC_RAT_RACE_BOARD as board } from './board';
import { diceAllowed, moveToken, rollDice } from './movement';
import { seededRng } from './rng';

describe('dice', () => {
  it('one die is 1-6; two dice add up and each is kept', () => {
    expect(rollDice(1, () => 0)).toEqual({ dice: [1], total: 1 });
    const values = [0, 0.9999999];
    let i = 0;
    expect(rollDice(2, () => values[i++])).toEqual({ dice: [1, 6], total: 7 });
  });

  it('are fair and repeat from a seed', () => {
    const roll = (seed: number) => {
      const rng = seededRng(seed);
      return Array.from({ length: 20 }, () => rollDice(2, rng).total);
    };
    expect(roll(3)).toEqual(roll(3));
    expect(roll(3).every((t) => t >= 2 && t <= 12)).toBe(true);
  });

  it('two dice only while Charity lasts, and only when chosen', () => {
    expect(diceAllowed(0, 2)).toBe(1);
    expect(diceAllowed(0)).toBe(1);
    expect(diceAllowed(3, 2)).toBe(2);
    expect(diceAllowed(3, 1)).toBe(1);
    expect(diceAllowed(3)).toBe(1);
  });
});

describe('moving the token', () => {
  it('from START a roll of n lands on space n - 1', () => {
    expect(moveToken(board, null, 1).to).toBe(0);
    expect(moveToken(board, null, 1).landed.kind).toBe('deal');
    expect(moveToken(board, null, 6).to).toBe(5);
    expect(moveToken(board, null, 6).landed.kind).toBe('payday');
  });

  it('lists every space entered, in order, ending on the landing', () => {
    const move = moveToken(board, 2, 3);
    expect(move.entered.map((space) => space.index)).toEqual([3, 4, 5]);
    expect(move.landed.index).toBe(5);
    expect(move.from).toBe(2);
  });

  it('landing on a Payday pays once and is not a pass', () => {
    const move = moveToken(board, 2, 3);
    expect([move.paydays, move.passedPaydays, move.landedOnPayday]).toEqual([1, 0, true]);
  });

  it('passing a Payday pays once and is not a landing', () => {
    const move = moveToken(board, 3, 4); // 4 5 6 7 - passes 5
    expect([move.paydays, move.passedPaydays, move.landedOnPayday]).toEqual([1, 1, false]);
    expect(move.landed.index).toBe(7);
  });

  it('a move that crosses no Payday pays nothing', () => {
    const move = moveToken(board, 6, 3); // 7 8 9
    expect([move.paydays, move.passedPaydays, move.landedOnPayday]).toEqual([0, 0, false]);
  });

  it('from START the first Payday is passed or landed on like any other', () => {
    expect(moveToken(board, null, 12).paydays).toBe(1); // spaces 0-11 include 5
    expect(moveToken(board, null, 5).paydays).toBe(0); // spaces 0-4
  });

  it('wraps round the ring and counts the Payday at 21 and the next lap’s 5', () => {
    const move = moveToken(board, 20, 12); // 21 22 23 0 1 2 3 4 5 6 7 8
    expect(move.to).toBe(8);
    expect(move.paydays).toBe(2);
    expect(move.passedPaydays).toBe(2);
    expect(moveToken(board, 23, 1).to).toBe(0);
  });

  it('a whole lap pays all three Paydays; no turn of 1-2 dice can pay twice from one Payday to the next', () => {
    expect(moveToken(board, 23, 24).paydays).toBe(3);
    // the paydays are 8 apart and a turn is at most 12, so two can be crossed only when a turn is long enough
    for (let from = 0; from < 24; from++) {
      for (let steps = 1; steps <= 12; steps++) {
        expect(moveToken(board, from, steps).paydays).toBeLessThanOrEqual(2);
      }
    }
  });

  it('refuses a move that is not at least one space', () => {
    expect(() => moveToken(board, 0, 0)).toThrow();
    expect(() => moveToken(board, 0, 1.5)).toThrow();
  });

  it('every landing a seeded game makes is on the ring', () => {
    const rng = seededRng(11);
    let position: number | null = null;
    for (let turn = 0; turn < 500; turn++) {
      const move = moveToken(board, position, rollDice(turn % 3 === 0 ? 2 : 1, rng).total);
      expect(move.to).toBeGreaterThanOrEqual(0);
      expect(move.to).toBeLessThan(24);
      position = move.to;
    }
  });
});
