import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { ChartFilterService } from '../../services/chart-filter.service';

type Period = 'week' | 'month' | 'quarter' | 'year' | 'all';

const PERIODS: Period[] = ['week', 'month', 'quarter', 'year', 'all'];

/** Local date as YYYY-MM-DD (what the transactions and the filter use). */
function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The quick period filter of the statistics, for a page with a filter of its own (JFK, 2026-10-25): pick week, month, quarter, year or
 * everything, and step back and forward through the time series with the arrows - "last month", "the quarter before" - without
 * typing dates. It sets the start and end of the page's filter and tells the page to apply it; the advanced filter below stays for
 * everything else (accounts, categories, text, a range of your own).
 */
@Component({
  selector: 'app-period-filter',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pf" role="group" [attr.aria-label]="'ChartFilter.title' | translate">
      <div class="pf-periods" role="radiogroup">
        <button
          *ngFor="let period of periods"
          type="button"
          role="radio"
          class="pf-period"
          [class.pf-period--on]="shown === period"
          [attr.aria-checked]="shown === period"
          (click)="choose(period)"
        >
          {{ 'Period.' + period | translate }}
        </button>
      </div>
      <div class="pf-nav" *ngIf="shown && shown !== 'all'">
        <button type="button" class="pf-step" aria-label="‹" (click)="step(-1)">‹</button>
        <span class="pf-label">{{ label }}</span>
        <button
          type="button"
          class="pf-step"
          aria-label="›"
          [disabled]="index >= 0"
          (click)="step(1)"
        >
          ›
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .pf {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin: 10px 12px 10px;
      }
      .pf-periods {
        display: flex;
        width: 100%;
        max-width: 460px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 10px;
        overflow: hidden;
        background: var(--color-surface, #fff);
      }
      .pf-period {
        flex: 1 1 0;
        min-width: 0;
        padding: 9px 4px;
        border: 0;
        border-inline-start: 1px solid var(--color-border, #ddd);
        background: transparent;
        color: var(--color-text, #222);
        font: inherit;
        cursor: pointer;
      }
      .pf-period:first-child {
        border-inline-start: 0;
      }
      .pf-period--on {
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-weight: 600;
      }
      .pf-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .pf-label {
        min-width: 9rem;
        text-align: center;
        font-weight: 600;
        color: var(--color-text, #222);
      }
      .pf-step {
        width: 40px;
        height: 40px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 50%;
        background: var(--color-surface, #fff);
        color: var(--color-text, #222);
        font-size: 1.3rem;
        line-height: 1;
        cursor: pointer;
      }
      .pf-step:disabled {
        opacity: 0.35;
        cursor: default;
      }
    `,
  ],
})
export class PeriodFilterComponent {
  /** The page's filter: its start and end are set from the period. */
  @Input({ required: true }) filter!: IncomeFilter;
  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  readonly periods = PERIODS;
  type: Period = 'all';
  /** How many periods back from the current one (0: the current, -1: the one before ...). */
  index = 0;

  /**
   * The period the page's filter really is (it may have been changed or cleared elsewhere, in the advanced filter): the one chosen
   * here while the dates are its dates, everything while no start is set, and none while it is a range of somebody's own.
   */
  get shown(): Period | null {
    if (!this.filter.startDate) return 'all';
    if (this.type === 'all') return null;
    const range = ChartFilterService.getDateRange(this.type, this.index);
    return range &&
      this.filter.startDate === iso(range.startDate) &&
      this.filter.endDate === iso(range.endDate)
      ? this.type
      : null;
  }

  get label(): string {
    const range = ChartFilterService.getDateRange(this.type, this.index);
    return range
      ? ChartFilterService.formatDateRange(this.type, range.startDate, range.endDate)
      : '';
  }

  choose(period: Period): void {
    this.type = period;
    this.index = 0;
    this.update();
  }

  step(by: -1 | 1): void {
    if (this.index + by > 0) return;
    this.index += by;
    this.update();
  }

  private update(): void {
    if (this.type === 'all') {
      this.clear.emit();
      return;
    }
    const range = ChartFilterService.getDateRange(this.type, this.index);
    if (!range) return;
    this.filter.startDate = iso(range.startDate);
    this.filter.endDate = iso(range.endDate);
    this.apply.emit();
  }
}
