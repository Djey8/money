import { cleanInitials } from './reducer';

describe('the letters on a token', () => {
  it('are up to two letters or digits, in capitals', () => {
    expect(cleanInitials('ab')).toBe('AB');
    expect(cleanInitials('a-b9')).toBe('AB');
    expect(cleanInitials('  x ')).toBe('X');
    expect(cleanInitials('张伟明')).toBe('张伟');
  });

  it('are the default (nothing) for anything else', () => {
    expect(cleanInitials('')).toBeUndefined();
    expect(cleanInitials('--')).toBeUndefined();
    expect(cleanInitials(7)).toBeUndefined();
    expect(cleanInitials(undefined)).toBeUndefined();
  });
});
