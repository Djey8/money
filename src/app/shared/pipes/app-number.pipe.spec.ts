import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { AppNumberPipe } from './app-number.pipe';
import { AppStateService } from '../services/app-state.service';

registerLocaleData(localeDe);

describe('AppNumberPipe', () => {
  let pipe: AppNumberPipe;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    pipe = new AppNumberPipe();
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('formats number with European locale (de-DE)', () => {
    AppStateService.instance.isEuropeanFormat = true;
    // de-DE: +1.234,56
    const result = pipe.transform(1234.56);
    expect(result).toMatch(/^\+/);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('56');
  });

  it('formats number with US locale (en-US)', () => {
    AppStateService.instance.isEuropeanFormat = false;
    const result = pipe.transform(1234.56);
    expect(result).toBe('+1,234.56');
  });

  it('uses custom digitsInfo', () => {
    AppStateService.instance.isEuropeanFormat = false;
    const result = pipe.transform(3.14159, '1.0-2');
    expect(result).toBe('+3.14');
  });

  it('formats zero without prefix', () => {
    AppStateService.instance.isEuropeanFormat = false;
    expect(pipe.transform(0)).toBe('0.00');
  });

  it('formats negative numbers with minus sign prefix', () => {
    AppStateService.instance.isEuropeanFormat = false;
    const result = pipe.transform(-42.5);
    expect(result).toBe('\u221242.50');
  });

  it('formats positive numbers with plus prefix', () => {
    AppStateService.instance.isEuropeanFormat = false;
    const result = pipe.transform(100);
    expect(result).toBe('+100.00');
  });
});
