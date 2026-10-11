import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { CountUpDirective } from './count-up.directive';
import { AppStateService } from '../services/app-state.service';

registerLocaleData(localeDe);

describe('CountUpDirective', () => {
  const show = (value: number): string => {
    const element = { nativeElement: { textContent: '' } };
    const directive = new CountUpDirective(element as never);
    directive.ngOnChanges({
      targetValue: { previousValue: value, currentValue: value, firstChange: false } as never,
    });
    return element.nativeElement.textContent;
  };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  it('writes the number the way the app formats numbers: thousands separator, decimal comma', () => {
    AppStateService.instance.isEuropeanFormat = true;
    expect(show(4000)).toBe('+4.000,00');
    expect(show(-1234.5)).toBe('\u22121.234,50');
    expect(show(0)).toBe('0,00');
  });

  it('and with the US format', () => {
    AppStateService.instance.isEuropeanFormat = false;
    expect(show(4000)).toBe('+4,000.00');
  });
});
