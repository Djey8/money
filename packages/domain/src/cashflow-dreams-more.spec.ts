import { DREAM_CARDS } from './cashflow-dream-cards';

describe('the dreams D49-D96', () => {
  const more = DREAM_CARDS.slice(48);

  it('are 48 more, with unique ids, in all nine categories', () => {
    expect(more).toHaveLength(48);
    expect(new Set(DREAM_CARDS.map((card) => card.id)).size).toBe(96);
    expect(new Set(more.map((card) => card.category)).size).toBe(9);
  });

  it('carry a description, a note and links per bucket, actions, links and notes in both languages', () => {
    for (const card of more) {
      expect(card.description?.en && card.description?.de).toBeTruthy();
      expect(card.actions.length).toBeGreaterThanOrEqual(2);
      expect(card.links.length).toBeGreaterThanOrEqual(1);
      expect(card.notes?.length).toBeGreaterThanOrEqual(1);
      for (const action of card.actions) expect(action.text.en && action.text.de).toBeTruthy();
      for (const bucket of card.buckets) expect(bucket.notes?.en && bucket.notes?.de).toBeTruthy();
    }
  });

  it('reach from small dreams up to the huge ones of about 500,000', () => {
    const prices = more.map((card) => card.totalMinor / 100);
    expect(Math.min(...prices)).toBeLessThan(2000);
    expect(Math.max(...prices)).toBeLessThanOrEqual(500000);
    expect(Math.max(...prices)).toBeGreaterThanOrEqual(400000);
  });
});
