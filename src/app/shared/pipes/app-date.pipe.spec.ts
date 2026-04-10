import { AppDatePipe } from './app-date.pipe';
import { AppStateService } from '../services/app-state.service';

describe('AppDatePipe', () => {
  let pipe: AppDatePipe;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.dateFormat = 'dd.MM.yyyy';
    pipe = new AppDatePipe();
  });

  it('returns empty string for falsy value', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('formats date with default dd.MM.yyyy format', () => {
    expect(pipe.transform('2026-01-15')).toBe('15.01.2026');
  });

  it('uses short mode (yy instead of yyyy)', () => {
    expect(pipe.transform('2026-01-15', 'short')).toBe('15.01.26');
  });

  it('respects MM/dd/yyyy format', () => {
    AppStateService.instance.dateFormat = 'MM/dd/yyyy';
    expect(pipe.transform('2026-01-15')).toBe('01/15/2026');
  });

  it('short mode with MM/dd/yyyy → MM/dd/yy', () => {
    AppStateService.instance.dateFormat = 'MM/dd/yyyy';
    expect(pipe.transform('2026-01-15', 'short')).toBe('01/15/26');
  });
});
