import { DEMO_STEPS, demoContext, demoLabels, demoText } from './demo-steps';

describe('the steps of the guided demo game', () => {
  it('have an id each, and words in English and German', () => {
    const ids = DEMO_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      for (const language of ['en', 'de']) {
        const words = demoText(id, language);
        expect(words.title).not.toBe(id);
        expect(words.text.length).toBeGreaterThan(20);
      }
    }
  });

  it('keep the story in the order of the screens: the lobby, the table, the game', () => {
    const rank = { lobby: 0, room: 1, game: 2 } as const;
    const ranks = DEMO_STEPS.map((step) => rank[step.screen]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('give every step that waits for the person a way to do it for them or a way to see it done', () => {
    for (const step of DEMO_STEPS.filter((s) => s.next === 'event')) {
      expect(typeof step.done).toBe('function');
    }
    for (const step of DEMO_STEPS.filter((s) => s.assist)) {
      expect(step.assist).toMatch(/^click:/);
    }
  });

  it('read the table: not a demo, no seat, nothing happened yet', () => {
    const context = demoContext('lobby', null, [], () => false);
    expect(context).toMatchObject({
      phase: 'none',
      isDemo: false,
      coachSeated: false,
      turns: 0,
      myTurn: false,
    });
    expect(context.dom('x')).toBe(false);
  });

  it('say the coach buttons in the language', () => {
    expect(demoLabels('en').stop).toBe('Stop tutorial');
    expect(demoLabels('de').stop).toBe('Tutorial beenden');
    expect(demoLabels('fr').stop).toBe('Stop tutorial');
  });
});
