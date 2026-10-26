import { CASHFLOW_GAME_SETS } from '@money/domain/dist/cashflow-content';
import { dreamToSmile } from './dream-project';

describe('dreamToSmile', () => {
  const student = CASHFLOW_GAME_SETS.find((set) => set.id === 'jfk-stories')!.professions[0];

  it('turns the static dream into the Smile project of the app: buckets at 0, with their notes, links, tasks and notes', () => {
    const project = dreamToSmile(
      student.profile!.texts['en'].dream.project!,
      '2026-10-25T10:00:00.000Z',
    );
    expect(project.title).toBe('Mountain guide');
    expect(project.phase).toBe('planning');
    expect(project.buckets).toHaveLength(8);
    expect(project.buckets.every((bucket) => bucket.amount === 0)).toBe(true);
    expect(project.buckets.reduce((sum, bucket) => sum + bucket.target, 0)).toBe(24500);
    expect(project.buckets[0].notes).toContain('harness');
    expect(project.buckets[0].links?.[0].url).toContain('vdbs.de');
    expect(project.actionItems.every((item) => item.done === false)).toBe(true);
    expect(project.notes[0].createdAt).toBe('2026-10-25T10:00:00.000Z');
    // the buckets are told apart by id
    expect(new Set(project.buckets.map((bucket) => bucket.id)).size).toBe(8);
  });

  it('is the same project in German, with German names', () => {
    const project = dreamToSmile(
      student.profile!.texts['de'].dream.project!,
      '2026-10-25T10:00:00.000Z',
    );
    expect(project.title).toBe('Bergführer');
    expect(project.buckets[0].title).toBe('Ausrüstung');
  });
});
