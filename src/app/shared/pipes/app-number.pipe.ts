import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AppStateService } from '../services/app-state.service';

@Pipe({ name: 'appNumber', pure: false, standalone: true })
export class AppNumberPipe implements PipeTransform {
  /** `showSign` false leaves a positive amount without its plus (a price, not a change). */
  transform(value: any, digitsInfo = '1.2-2', showSign = true): string {
    if (value == null || value === '') return '';
    const num = Number(value);
    const locale = AppStateService.instance.isEuropeanFormat ? 'de-DE' : 'en-US';
    const formatted = formatNumber(Math.abs(num), locale, digitsInfo);
    if (num > 0) return (showSign ? '+' : '') + formatted;
    if (num < 0) return '\u2212' + formatted;
    return formatted;
  }
}
