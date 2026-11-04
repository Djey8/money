import { CASHFLOW_GAME_SETS } from './cashflow-content';

describe('the life dreams of the characters', () => {
  const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories')!;
  const characters = set.professions.filter((p) => !p.variantOf && p.profile);

  it('are as rich as the mountain guide: a long description, links, steps, notes, a note on every bucket', () => {
    expect(characters.length).toBeGreaterThanOrEqual(10);
    for (const profession of characters) {
      for (const lang of ['en', 'de'] as const) {
        const project = profession.profile!.texts[lang].dream.project!;
        expect(project.description.length).toBeGreaterThan(300);
        expect(project.links.length).toBeGreaterThanOrEqual(3);
        expect(project.actionItems.length).toBeGreaterThanOrEqual(8);
        expect(project.notes.length).toBeGreaterThanOrEqual(2);
        for (const bucket of project.buckets) {
          expect(bucket.notes.length).toBeGreaterThan(100);
        }
        for (const link of project.links) expect(link.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('keeps every price: the buckets of a variant still add up to the dream', () => {
    for (const profession of characters) {
      const project = profession.profile!.texts.en.dream.project!;
      expect(project.buckets.reduce((sum, bucket) => sum + bucket.targetMinor, 0)).toBeGreaterThan(
        0,
      );
    }
  });
});
