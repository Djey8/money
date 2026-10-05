import { CASHFLOW_GAME_SETS as firebaseSets } from './cashflow-content.firebase';
import { CASHFLOW_GAME_SETS as realSets } from './cashflow-content';

describe('Cashflow game content per edition', () => {
  it('the Firebase builds carry no game content at all', () => {
    expect(firebaseSets).toEqual([]);
  });

  it('the real content has the Classic Edition (self-hosted and local development)', () => {
    expect(realSets.some((set) => set.id === 'cashflow')).toBe(true);
  });
});
