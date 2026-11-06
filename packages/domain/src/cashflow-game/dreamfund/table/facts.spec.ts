import { DreamPlayer } from '../player';
import { addFacts, factsOfLife, FACT_KEYS } from './facts';

describe('the facts of a finished game', () => {
  it('reads a life into numbers in the four places, and adds games up', () => {
    const p = DreamPlayer.fromSeed({ seed: 4, rules: { difficulty: 'easy' } });
    for (let i = 0; i < 12; i += 1) {
      p.roll();
      p.endTurn();
    }
    const facts = factsOfLife(p.snapshot(), 6);
    expect(Object.keys(facts).sort()).toEqual([...FACT_KEYS].sort());
    expect(facts.turns).toBe(12);
    expect(facts.rounds).toBe(6);
    expect(facts.growHeld + facts.growSold).toBe(facts.growBought);
    expect(facts.fireDebtsRepaid).toBe(facts.fireDebtsLeftMinor === 0 ? 1 : 0);
    const twice = addFacts(addFacts({}, facts), facts);
    expect(twice.turns).toBe(24);
    expect(twice.netWorthMinor).toBe(facts.netWorthMinor * 2);
  });
});
