import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AppStateService } from '../services/app-state.service';

@Pipe({ name: 'appNumber', pure: false, standalone: true })
export class AppNumberPipe implements PipeTransform {
  transform(value: any, digitsInfo: string = '1.2-2'): string {
    if (value == null || value === '') return '';
    const num = Number(value);
    const locale = AppStateService.instance.isEuropeanFormat ? 'de-DE' : 'en-US';
    const formatted = formatNumber(Math.abs(num), locale, digitsInfo);
    if (num > 0) return '+' + formatted;
    if (num < 0) return '\u2212' + formatted;
    return formatted;
  }
}
