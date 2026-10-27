import { DreamPlayer } from '@money/domain/dist/cashflow-game/dreamfund/player';
import { applyDreamExtrasToApp, dreamLifeToApp } from './dream-books-bridge';

const NOW = '2026-11-15T09:00:00.000Z';

describe('dreamLifeToApp', () => {
  const life = (change: (p: DreamPlayer) => void = () => undefined) => {
    const p = DreamPlayer.fromSeed({ seed: 7, professionId: 'dual-student-informatik' });
    change(p);
    return p.snapshot();
  };

  it('gives a new life its dream as a Smile project and its reserve as a Fire project, both empty', () => {
    const app = dreamLifeToApp(life(), 'en', NOW);
    expect(app.smile).toHaveLength(1);
    expect(app.smile[0].title).toBe('Mountain guide');
    expect(app.smile[0].buckets.every((bucket) => bucket.amount === 0)).toBe(true);
    expect(app.fire).toHaveLength(1);
    expect(app.fire[0].reserve).toBe(true);
    expect(app.mojo.amount).toBe(0);
    // the reserve is three months of the expenses the character has now
    expect(app.mojo.target).toBeGreaterThan(0);
    expect(app.fire[0].buckets.every((bucket) => bucket.target === app.mojo.target / 3)).toBe(true);
    expect(app.books.gameSet).toBeDefined();
  });

  it('puts what is saved into the buckets, first bucket first, and the reserve into the Mojo', () => {
    const app = dreamLifeToApp(
      life((p) => {
        p.reserveMinor = 100000;
        p.dreamSavedMinor = 300000;
      }),
      'en',
      NOW,
    );
    expect(app.mojo.amount).toBe(1000);
    expect(app.fire[0].buckets.reduce((sum, bucket) => sum + bucket.amount, 0)).toBe(1000);
    const dream = app.smile[0];
    expect(dream.buckets.reduce((sum, bucket) => sum + bucket.amount, 0)).toBe(3000);
    // the buckets add up to what the dream costs this character
    const player = DreamPlayer.fromSeed({ seed: 7, professionId: 'dual-student-informatik' });
    expect(dream.buckets.reduce((sum, bucket) => sum + Math.round(bucket.target * 100), 0)).toBe(
      player.dreamTargetMinor,
    );
  });

  it('shows the dreams taken, in the language of the viewer, with the money saved for them', () => {
    const app = dreamLifeToApp(
      life((p) => {
        const card = p.gameSet.decks!.dream![0];
        p.takeDream(card);
        p.smile[0].savedMinor = Math.round(card.totalMinor / 2);
      }),
      'de',
      NOW,
    );
    expect(app.smile).toHaveLength(2);
    const taken = app.smile[1];
    expect(taken.dreamCardId).toBeTruthy();
    const total = taken.buckets.reduce((sum, bucket) => sum + Math.round(bucket.target * 100), 0);
    const saved = taken.buckets.reduce((sum, bucket) => sum + Math.round(bucket.amount * 100), 0);
    expect(saved).toBe(Math.round(total / 2));
    // the open dream names the project the viewer sees
    expect(app.openDreams[0].projectTitle).toBe(taken.title);
  });

  it('shows an emergency on a plan as a Fire project with what is left', () => {
    const app = dreamLifeToApp(
      life((p) => {
        const card = p.gameSet.decks!.emergency![0];
        p.plans.push({ kind: 'emergency', id: card.id, perMinor: 5000, leftMinor: 20000 });
      }),
      'en',
      NOW,
    );
    const emergency = app.fire.find((project) => project.emergencyCardId);
    expect(emergency?.buckets[0].target).toBe(200);
  });

  it('puts the extras on the app state: Mojo, projects, and the open dreams', () => {
    const app = dreamLifeToApp(life(), 'en', NOW);
    const state = { cashflowGame: { dreams: { open: [], lived: [] } } } as never;
    applyDreamExtrasToApp(state, app);
    const shown = state as unknown as {
      mojo: unknown;
      allSmileProjects: unknown[];
      allFireEmergencies: unknown[];
    };
    expect(shown.mojo).toBe(app.mojo);
    expect(shown.allSmileProjects).toHaveLength(1);
    expect(shown.allFireEmergencies).toHaveLength(1);
  });
});
