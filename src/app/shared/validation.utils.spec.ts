import { isDuplicateTitle } from './validation.utils';

describe('isDuplicateTitle()', () => {
  it('returns false for empty arrays', () => {
    expect(isDuplicateTitle('Test', [])).toBe(false);
  });

  it('returns false when title is not found', () => {
    const arr = [{ title: 'Alpha' }, { title: 'Beta' }];
    expect(isDuplicateTitle('Gamma', [arr])).toBe(false);
  });

  it('returns true when title matches in first array', () => {
    const arr = [{ title: 'Alpha' }, { title: 'Beta' }];
    expect(isDuplicateTitle('Alpha', [arr])).toBe(true);
  });

  it('returns true when title matches in second array', () => {
    const a1 = [{ title: 'A' }];
    const a2 = [{ title: 'B' }];
    expect(isDuplicateTitle('B', [a1, a2])).toBe(true);
  });

  it('uses custom field name', () => {
    const arr = [{ name: 'Custom' }];
    expect(isDuplicateTitle('Custom', [arr], 'name')).toBe(true);
    expect(isDuplicateTitle('Custom', [arr], 'title')).toBe(false);
  });

  it('is case-sensitive', () => {
    const arr = [{ title: 'Alpha' }];
    expect(isDuplicateTitle('alpha', [arr])).toBe(false);
  });
});
