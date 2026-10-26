import { HARVEST_CARDS } from '../cashflow-harvest-cards';
import { OPPORTUNITY_CARDS } from '../cashflow-opportunity-cards';
import { assetKindOf, harvestTopics, involvedHoldings, keywordsOfCard } from './keywords';
import { marketOfTag } from './harvest-deck';

const card = (id: string) => OPPORTUNITY_CARDS.find((candidate) => candidate.id === id)!;

describe('the words the cards share', () => {
  it('every card is a share, an investment, an asset or a saving', () => {
    expect(assetKindOf(card('S10'))).toBe('share');
    expect(OPPORTUNITY_CARDS.some((c) => assetKindOf(c) === 'asset')).toBe(true);
    expect(assetKindOf(card('S02'))).toBe('saving');
    expect(OPPORTUNITY_CARDS.some((c) => assetKindOf(c) === 'investment')).toBe(true);
  });

  it('a card has the word of its market and of its groups; a cloud stock is priced by the tech market', () => {
    expect(marketOfTag('CLOUD')).toBe('TECH');
    expect(keywordsOfCard(card('S16'))).toContain('TECH');
    expect(keywordsOfCard(card('P15'))).toContain('VENDING');
  });

  it('a Harvest card names the same words, and what is owned of them is found', () => {
    const rate = HARVEST_CARDS.find((c) => c.ops.some((op) => op.op === 'index'))!;
    const topics = harvestTopics(rate);
    expect(topics.targets.length).toBeGreaterThan(0);
    const owned = [
      { cardId: 'S10', title: 'WORLD', marketTag: 'WORLD' },
      { cardId: 'S02', title: 'x' },
    ] as never[];
    const found = involvedHoldings(
      { targets: ['WORLD'], allMarkets: false, general: [] },
      owned,
      OPPORTUNITY_CARDS,
    );
    expect(found.map((entry) => entry.holding.title)).toEqual(['WORLD']);
    expect(found[0].kind).toBe('share');
  });
});
