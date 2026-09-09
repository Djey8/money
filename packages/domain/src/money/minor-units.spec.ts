import { fromMinorUnits, isCleanlyRepresentable, toMinorUnits } from './minor-units';

describe('minor-units conversion', () => {
  describe('toMinorUnits / fromMinorUnits', () => {
    it('converts clean positive decimals', () => {
      expect(toMinorUnits(42.5)).toBe(4250);
      expect(toMinorUnits(0.01)).toBe(1);
      expect(toMinorUnits(1000)).toBe(100000);
      expect(toMinorUnits(0)).toBe(0);
    });

    it('converts clean negative decimals (expense transactions)', () => {
      expect(toMinorUnits(-12.5)).toBe(-1250);
      expect(toMinorUnits(-0.01)).toBe(-1);
    });

    it('round-trips clean values exactly', () => {
      for (const v of [0, 1, -1, 42.5, -12.34, 1000000.99, -0.01]) {
        expect(fromMinorUnits(toMinorUnits(v))).toBeCloseTo(v, 9);
      }
    });

    it('rounds half away from zero, symmetrically for positive and negative', () => {
      // 2.005 and -2.005 are themselves not exactly representable in binary
      // floating point, so this asserts the *symmetry* of the rounding rule
      // rather than a specific ambiguous edge value.
      expect(toMinorUnits(2.5, 0)).toBe(3);
      expect(toMinorUnits(-2.5, 0)).toBe(-3);
      expect(toMinorUnits(3.5, 0)).toBe(4);
      expect(toMinorUnits(-3.5, 0)).toBe(-4);
    });

    it('supports a non-default minor-unit digit count', () => {
      expect(toMinorUnits(1.234, 3)).toBe(1234);
      expect(fromMinorUnits(1234, 3)).toBeCloseTo(1.234, 9);
    });
  });

  describe('isCleanlyRepresentable', () => {
    it('is true for values that are already clean at 2 decimals', () => {
      expect(isCleanlyRepresentable(42.5)).toBe(true);
      expect(isCleanlyRepresentable(0.01)).toBe(true);
      expect(isCleanlyRepresentable(-12.34)).toBe(true);
      expect(isCleanlyRepresentable(0)).toBe(true);
    });

    it('is true for the classic 0.1 + 0.2 binary floating-point artifact (tolerated as noise, not real sub-cent precision)', () => {
      expect(isCleanlyRepresentable(0.1 + 0.2)).toBe(true);
    });

    it('is false for values with genuine sub-cent precision', () => {
      expect(isCleanlyRepresentable(10.333)).toBe(false);
      expect(isCleanlyRepresentable(1 / 3)).toBe(false);
    });
  });
});
