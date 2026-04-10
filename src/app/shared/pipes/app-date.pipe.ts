import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { AppStateService } from '../services/app-state.service';

@Pipe({ name: 'appDate', pure: false, standalone: true })
export class AppDatePipe implements PipeTransform {
  transform(value: any, mode: 'short' | 'full' = 'full'): string {
    if (!value) return '';
    
    // Validate that value is a valid date string or Date object
    // If it's just a single character or obviously invalid, return empty
    if (typeof value === 'string' && value.length < 8) {
      console.warn('Invalid date value detected:', value);
      return ''; // Return empty instead of crashing
    }
    
    try {
      const format = AppStateService.instance.dateFormat || 'dd.MM.yyyy';
      const displayFormat = mode === 'short' ? format.replace('yyyy', 'yy') : format;
      return formatDate(value, displayFormat, 'en-US');
    } catch (error) {
      console.warn('Date formatting failed for value:', value, 'Error:', error);
      return ''; // Return empty instead of crashing
    }
  }
}
