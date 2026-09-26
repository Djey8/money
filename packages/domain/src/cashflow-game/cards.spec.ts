import { drawRandomCard, findCards } from './cards';

interface TestCard {
  id: string;
  title: string;
}

const deck: TestCard[] = [
  { id: '1', title: 'Duplex' },
  { id: '2', title: 'Small Office Building' },
  { id: '3', title: 'Storage Units' },
];

describe('drawRandomCard', () => {
  it('never returns a card already in drawnIds while others remain', () => {
    for (let i = 0; i < 30; i++) {
      const result = drawRandomCard(deck, ['1', '2']);
      expect(result.card.id).toBe('3');
      expect(result.reshuffled).toBe(false);
      expect(result.drawnIds).toEqual(['1', '2', '3']);
    }
  });

  it('reshuffles once every card has been drawn, and returns just the new draw', () => {
    const result = drawRandomCard(deck, ['1', '2', '3']);
    expect(result.reshuffled).toBe(true);
    expect(result.drawnIds).toEqual([result.card.id]);
    expect(deck.map((c) => c.id)).toContain(result.card.id);
  });

  it('refuses an empty deck rather than throwing something confusing', () => {
    expect(() => drawRandomCard([], [])).toThrow('no cards yet');
  });
});

describe('findCards', () => {
  it('matches by title, case-insensitively, substring', () => {
    expect(findCards(deck, 'duplex')).toEqual([deck[0]]);
    expect(findCards(deck, 'STORAGE')).toEqual([deck[2]]);
  });

  it('can match more than one card', () => {
    const results = findCards(deck, 'o');
    expect(results.map((c) => c.title)).toEqual(
      expect.arrayContaining(['Small Office Building', 'Storage Units']),
    );
  });

  it('returns nothing for an empty query rather than the whole deck', () => {
    expect(findCards(deck, '')).toEqual([]);
    expect(findCards(deck, '   ')).toEqual([]);
  });

  it('returns nothing when there is no match', () => {
    expect(findCards(deck, 'zzz')).toEqual([]);
  });
});
