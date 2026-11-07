import { CARD_TEXT_DE } from './cashflow-card-text-de-data';
import { OPPORTUNITY_ENRICH, enrichOpportunityCards } from './cashflow-opportunity-enrich';
import { OPPORTUNITY_CARDS } from './cashflow-opportunity-cards';
import { tuneOpportunityCards } from './cashflow-opportunity-tuning';

const SKETCH = tuneOpportunityCards(OPPORTUNITY_CARDS);
const CARDS = enrichOpportunityCards(SKETCH);

describe('the Opportunity cards, second pass (JFK, 2026-11-05)', () => {
  it('gives every card a place to read and things to do', () => {
    expect(CARDS).toHaveLength(98);
    for (const card of CARDS) {
      expect(card.links.length).toBeGreaterThanOrEqual(2);
      expect(card.links.length).toBeLessThanOrEqual(4);
      expect(card.actions.length).toBeGreaterThanOrEqual(3);
      expect(card.actions.length).toBeLessThanOrEqual(5);
      for (const entry of card.links) {
        expect(entry.url).toMatch(/^https:\/\//);
        expect(entry.label.length).toBeGreaterThan(3);
      }
      expect(new Set(card.links.map((entry) => entry.url)).size).toBe(card.links.length);
    }
  });

  it('every card that can be bought has a strategy, a risk with its reason, and a tip with a do and a don’t', () => {
    for (const card of CARDS.filter((entry) => entry.growType === 'income-growth')) {
      expect(card.strategy.length).toBeGreaterThan(40);
      expect(card.risks.length).toBeGreaterThan(20);
      expect(card.riskScore).toBeGreaterThanOrEqual(0);
      expect(card.riskScore).toBeLessThanOrEqual(5);
      expect(card.tip).toMatch(/Do:.*Don’t:/);
    }
  });

  it('knows no card that does not exist, and changes nothing about the money of a card', () => {
    const ids = new Set(SKETCH.map((card) => card.id));
    for (const id of Object.keys(OPPORTUNITY_ENRICH)) expect(ids.has(id)).toBe(true);
    for (const card of CARDS) {
      const before = SKETCH.find((entry) => entry.id === card.id)!;
      expect(card.costMinor).toBe(before.costMinor);
      expect(card.share).toEqual(before.share);
      expect(card.property).toEqual(before.property);
      if (!before.trap) expect(card.cashflowMinor).toBe(before.cashflowMinor);
    }
  });

  it('a scam shows the monthly cash flow it advertises like any other offer, so the card does not give it away', () => {
    for (const id of ['S21', 'P09', 'T28']) {
      const card = CARDS.find((entry) => entry.id === id)!;
      expect(card.trap?.ponzi).toBeDefined();
      expect(card.cashflowMinor).toBe(card.trap!.ponzi!.paysMonthMinor);
      // and says nothing of the trap
      expect(JSON.stringify([card.strategy, card.risks, card.tip, card.insights])).not.toMatch(
        /scam|ponzi|fraud/i,
      );
    }
  });

  it('is in German as well: every text it adds has its translation', () => {
    for (const card of CARDS) {
      const before = SKETCH.find((entry) => entry.id === card.id)!;
      const added = [
        card.tip,
        card.strategy !== before.strategy ? card.strategy : undefined,
        card.risks !== before.risks ? card.risks : undefined,
        ...card.actions
          .filter((entry) => !before.actions.some((old) => old.text === entry.text))
          .map((entry) => entry.text),
      ].filter((text): text is string => !!text);
      for (const text of added) {
        expect(CARD_TEXT_DE[text]).toBeTruthy();
        expect(CARD_TEXT_DE[text]).not.toBe(text);
      }
    }
  });
});
