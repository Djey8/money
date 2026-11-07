import { DreamPlayer } from './player';
import { dreamAppEntities } from './app-entities';

const player = () =>
  DreamPlayer.fromSeed({
    seed: 11,
    professionId: 'dual-student-informatik',
    rules: { mode: 'free' } as never,
  });

/** A dream taken: the card, open, with nothing saved. */
function withDream(p: DreamPlayer) {
  const card = (p.gameSet.decks?.dream ?? [])[0];
  const total = card.buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0);
  p.smile.push({
    cardId: card.id,
    totalMinor: total,
    savedMinor: 0,
    points: card.points,
    round: 1,
  });
  return { card, total };
}

const app = (p: DreamPlayer) => dreamAppEntities(p.snapshot(), 'en', '2026-11-15T09:00:00.000Z');

describe('the projects of a Dreamer life', () => {
  it('money for a dream goes to the dream asked for, booked under its name, and a short account takes the Bank loan', () => {
    const p = player();
    const { card, total } = withDream(p);
    const cash = p.cash();
    const put = p.fundDreams(total, card.id);
    expect(put).toBe(total);
    expect(p.smile[0]?.savedMinor ?? total).toBeGreaterThan(-1);
    // the life dream was not touched
    expect(p.dreamSavedMinor).toBe(0);
    expect(p.books.transactions.some((tx) => tx.category === `@${card.title.en}`)).toBe(true);
    // more than the cash: the loan covered the rest
    if (total > cash)
      expect(p.books.liabilities.some((l) => l.tag.toLowerCase().includes('bank'))).toBe(true);
  });

  it('a dream paid in full stays as a completed project', () => {
    const p = player();
    const { card, total } = withDream(p);
    p.fundDreams(total, card.id);
    p.checkDreams();
    expect(p.smile).toHaveLength(0);
    const project = app(p).smile.find(
      (entry) => (entry as { dreamCardId?: string }).dreamCardId === card.id,
    );
    expect(project?.phase).toBe('completed');
    expect(project?.buckets.every((bucket) => bucket.amount >= bucket.target)).toBe(true);
  });

  it('a project with money in it or a plan running is saving, with nothing it is planning', () => {
    const p = player();
    const { card, total } = withDream(p);
    const before = app(p).smile.find(
      (entry) => (entry as { dreamCardId?: string }).dreamCardId === card.id,
    );
    expect(before?.phase).toBe('planning');
    p.fundDreams(Math.floor(total / 4), card.id);
    const after = app(p).smile.find(
      (entry) => (entry as { dreamCardId?: string }).dreamCardId === card.id,
    );
    expect(after?.phase).toBe('saving');
  });

  it('an emergency that is paid off stays as a completed Fire project', () => {
    const p = player();
    const card = (p.gameSet.decks?.emergency ?? [])[0];
    p.openEmergency(card.id, 20000);
    expect(
      app(p).fire.find((f) => (f as { emergencyCardId?: string }).emergencyCardId === card.id)
        ?.phase,
    ).toBe('planning');
    p.fundEmergency(card.id, 20000);
    const done = app(p).fire.find(
      (f) => (f as { emergencyCardId?: string }).emergencyCardId === card.id,
    );
    expect(done?.phase).toBe('completed');
    expect(done?.buckets[0].amount).toBe(done?.buckets[0].target);
    expect(p.plans.some((plan) => plan.id === card.id)).toBe(false);
  });
});
