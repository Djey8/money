import { drawRandomCard } from './cards';
import { pickOne, rollDie, seededRng, systemRng } from './rng';

describe('the game’s source of chance', () => {
  it('a seed always gives the same sequence, and different seeds differ', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const first = [a(), a(), a(), a()];
    expect([b(), b(), b(), b()]).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(seededRng(43)()).not.toBe(first[0]);
  });

  it('the system source follows Math.random, even when a test replaces it', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(systemRng()).toBe(0.25);
    expect(rollDie()).toBe(2);
    spy.mockRestore();
  });

  it('a die is 1 to 6 at the edges of the range, and fair over many rolls', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.9999999)).toBe(6);
    const rng = seededRng(7);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[rollDie(rng) - 1]++;
    for (const count of counts) expect(count).toBeGreaterThan(850);
  });

  it('picks evenly from a list, never out of range, and refuses an empty one', () => {
    expect(pickOne(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickOne(['a', 'b', 'c'], () => 0.5)).toBe('b');
    expect(pickOne(['a', 'b', 'c'], () => 0.9999999)).toBe('c');
    expect(pickOne(['a'], () => 1)).toBe('a');
    expect(() => pickOne([], () => 0)).toThrow();
  });

  it('drawing a card uses the given source: the same seed draws the same cards', () => {
    const deck = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const play = (seed: number) => {
      const rng = seededRng(seed);
      let drawn: string[] = [];
      const order: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = drawRandomCard(deck, drawn, rng);
        drawn = result.drawnIds;
        order.push(result.card.id);
      }
      return order;
    };
    expect(play(1)).toEqual(play(1));
    expect([...play(1)].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(drawRandomCard(deck, [], () => 0).card.id).toBe('a');
    expect(drawRandomCard(deck, ['a'], () => 0).card.id).toBe('b');
  });
});
