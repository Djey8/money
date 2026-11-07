import { cardFacts, effectLines, findDreamCard, pileOfEvent } from './dream-card-facts';

describe('the facts of a Dreamer card', () => {
  it('finds a card in its pile and names the pile of an event', () => {
    expect(findDreamCard('E01')?.pile).toBe('emergency');
    expect(findDreamCard('H01')?.pile).toBe('harvest');
    expect(findDreamCard('NOPE')).toBeNull();
    expect(pileOfEvent('opportunity_taken')).toBe('opportunity');
    expect(pileOfEvent('dream_declined')).toBe('dream');
    expect(pileOfEvent('rolled')).toBeUndefined();
  });

  it('tells in a few lines what a card is: the pile, the numbers that matter', () => {
    const dream = findDreamCard('D01')!;
    const facts = cardFacts(dream.pile, dream.card, 'en');
    expect(facts.deck).toBe('Dream');
    expect(facts.lines.join(' ')).toMatch(/Total/);
    expect(facts.lines.join(' ')).toMatch(/points/);
    const opportunity = findDreamCard('S01')!;
    expect(cardFacts(opportunity.pile, opportunity.card, 'de').deck).toBe('Chance');
  });

  it('prints an effect as money a month and once, a cost with its minus', () => {
    expect(effectLines({ monthlyMinor: 6000, oneTimeMinor: -50000 }, 'en')).toEqual([
      '−500 DT once',
      '−60 DT a month',
    ]);
  });
});
