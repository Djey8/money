import { DREAM_CARDS } from './cashflow-dream-cards';
import { DREAM_DETAILS } from './cashflow-dream-details';
import { dreamProjectParts } from './cashflow-game/dream-project';

describe('the detail of the dreams', () => {
  const ids = Object.keys(DREAM_DETAILS);

  it('belongs to dreams and to buckets that exist', () => {
    for (const id of ids) {
      const card = DREAM_CARDS.find((candidate) => candidate.id === id);
      expect(card).toBeDefined();
      for (const bucket of Object.keys(DREAM_DETAILS[id].buckets ?? {})) {
        expect(card!.buckets.some((own) => own.id === bucket)).toBe(true);
      }
    }
  });

  it('is told in both languages, with links that are pages, and at most three notes', () => {
    for (const id of ids) {
      const card = DREAM_CARDS.find((candidate) => candidate.id === id)!;
      for (const lang of ['en', 'de'] as const) {
        const parts = dreamProjectParts(card, lang);
        expect(parts.description.length).toBeGreaterThan(120);
        expect(parts.notes.length).toBeLessThanOrEqual(3);
        expect(parts.notes.length).toBeGreaterThan(0);
        expect(parts.actionItems.length).toBeGreaterThanOrEqual(3);
        for (const bucket of parts.buckets) {
          expect(bucket.notes.length).toBeGreaterThan(40);
        }
        for (const link of [...parts.links, ...parts.buckets.flatMap((bucket) => bucket.links)]) {
          expect(link.label.length).toBeGreaterThan(3);
          expect(link.url).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/);
        }
      }
    }
  });

  it('keeps the price of the card: the buckets still add up to the total', () => {
    for (const card of DREAM_CARDS) {
      expect(card.buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0)).toBe(
        card.totalMinor,
      );
    }
  });
});
