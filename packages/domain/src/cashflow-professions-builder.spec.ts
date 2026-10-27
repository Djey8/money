import { CASHFLOW_GAME_SETS } from './cashflow-content';
import { DREAMFUND_SPECS } from './cashflow-professions-dreamfund';
import { computeCashflowProfessionMonthlyCashflowMinor } from './cashflow-game/engine';
import { professionIdAtDifficulty } from './cashflow-game/game-sets';

const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories')!;
const professions = set.professions;
const byId = (id: string) => professions.find((profession) => profession.id === id)!;
const cashflow = (id: string) => computeCashflowProfessionMonthlyCashflowMinor(byId(id)) / 100;

describe('the Dreamfund characters', () => {
  it('are ten, each in three difficulties that share the story', () => {
    const base = professions.filter((profession) => !profession.variantOf);
    expect(base).toHaveLength(10);
    for (const profession of base) {
      for (const level of ['easy', 'hard'] as const) {
        const variant = byId(`${profession.id}~${level}`);
        expect(variant.variantOf).toBe(profession.id);
        expect(variant.profile?.texts['en'].name).toBe(profession.profile?.texts['en'].name);
        expect(professionIdAtDifficulty(set, profession.id, level)).toBe(variant.id);
      }
      expect(professionIdAtDifficulty(set, profession.id, 'medium')).toBe(profession.id);
      expect(professionIdAtDifficulty(set, `${profession.id}~hard`, 'medium')).toBe(profession.id);
    }
  });

  it('leave what the specs say of a month: the surplus follows the ease and the difficulty', () => {
    for (const spec of DREAMFUND_SPECS) {
      const medium = cashflow(spec.id);
      expect(medium).toBeCloseTo(500 * spec.scale * spec.ease, -1);
      expect(cashflow(`${spec.id}~easy`)).toBeGreaterThan(medium);
      expect(cashflow(`${spec.id}~hard`)).toBeLessThan(medium);
      expect(cashflow(`${spec.id}~hard`)).toBeGreaterThan(0);
    }
  });

  it('have no negative lines, a story in English and German, a dream that adds up and a reserve of three months', () => {
    for (const profession of professions) {
      expect(profession.expenses.every((line) => line.amountMinor > 0)).toBe(true);
      const texts = profession.profile!.texts;
      expect(Object.keys(texts)).toEqual(expect.arrayContaining(['en', 'de']));
      const project = texts['en'].dream.project!;
      expect(project.buckets.length).toBeGreaterThan(3);
      const expenses = profession.expenses.reduce((sum, line) => sum + line.amountMinor, 0);
      expect(texts['en'].reserve!.project.buckets.reduce((sum, b) => sum + b.targetMinor, 0)).toBe(
        3 * expenses,
      );
      expect(texts['en'].goalItems.at(-1)?.id).toBe('independence');
      // (the Dual Student's own list has the two goals of his story; the variants built from him list every debt)
      if (profession.id !== 'dual-student-informatik') {
        for (const debt of profession.starterKit.liabilities ?? []) {
          expect(texts['en'].goalItems.some((item) => item.id === `debt:${debt.key}`)).toBe(true);
        }
      }
    }
  });

  it('are harder the more they earn, in proportion to the cards: the price level grows with the pay', () => {
    const levels = DREAMFUND_SPECS.map((spec) => [spec.gross, spec.scale]).sort(
      (a, b) => a[0] - b[0],
    );
    for (let i = 1; i < levels.length; i += 1)
      expect(levels[i][1]).toBeGreaterThanOrEqual(levels[i - 1][1]);
    expect(byId('jan-oberarzt').priceFactor).toBeGreaterThan(3);
  });

  it('round the amounts of Easy', () => {
    for (const spec of DREAMFUND_SPECS) {
      const easy = byId(`${spec.id}~easy`);
      expect(easy.roundNumbers).toBe(true);
      expect(easy.salaryMinor % 10000).toBe(0);
      for (const line of easy.expenses) expect(line.amountMinor % 1000).toBe(0);
      expect(easy.expenses.length).toBeLessThan(byId(spec.id).expenses.length);
    }
  });
});
