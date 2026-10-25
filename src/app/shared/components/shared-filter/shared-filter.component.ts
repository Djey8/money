import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { AppStateService } from '../../services/app-state.service';
import { ChartFilterService } from '../../services/chart-filter.service';

type Period = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

/** Local date as YYYY-MM-DD (what the transactions and the filter use). */
function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-shared-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './shared-filter.component.html',
  styleUrls: ['../../styles/filter-styles.css'],
})
export class SharedFilterComponent {
  @Input() filter!: IncomeFilter;
  @Input() availableAccounts: string[] = [];
  @Input() availableTags: string[] = [];
  @Input() showSortOptions = false;

  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  readonly periods: Period[] = ['week', 'month', 'quarter', 'year', 'all', 'custom'];
  /** The period picked here (the dates of the filter are the truth: see `shown`). */
  periodType: Period = 'all';
  /** How many periods back from the current one (0: the current, -1: the one before ...). */
  periodIndex = 0;

  isAdvancedExpanded = false;
  isSearchHelpVisible = false;

  /**
   * The period the filter really is, as in the statistics: the one picked here while the dates are its dates, everything while
   * there is no date, and Custom for a range of the player's own (it may also have been set or cleared elsewhere).
   */
  get shown(): Period {
    if (this.periodType === 'custom') return 'custom';
    if (!this.filter?.startDate) return 'all';
    const range = ChartFilterService.getDateRange(this.periodType, this.periodIndex);
    return range &&
      this.filter.startDate === iso(range.startDate) &&
      this.filter.endDate === iso(range.endDate)
      ? this.periodType
      : 'custom';
  }

  get periodLabel(): string {
    const range = ChartFilterService.getDateRange(this.periodType, this.periodIndex);
    return range
      ? ChartFilterService.formatDateRange(this.periodType, range.startDate, range.endDate)
      : '';
  }

  choosePeriod(period: Period): void {
    this.periodType = period;
    this.periodIndex = 0;
    if (period === 'custom') return; // the dates appear: the player picks them and presses Filter
    this.applyPeriod();
  }

  stepPeriod(by: -1 | 1): void {
    if (this.periodIndex + by > 0) return;
    this.periodIndex += by;
    this.applyPeriod();
  }

  private applyPeriod(): void {
    if (this.periodType === 'all') {
      this.filter.startDate = '';
      this.filter.endDate = '';
      const other =
        this.filter.selectedAccounts.length > 0 ||
        this.filter.selectedTags.length > 0 ||
        !!this.filter.searchText?.trim();
      if (other) this.apply.emit();
      else this.clear.emit();
      return;
    }
    const range = ChartFilterService.getDateRange(this.periodType, this.periodIndex);
    if (!range) return;
    this.filter.startDate = iso(range.startDate);
    this.filter.endDate = iso(range.endDate);
    this.apply.emit();
  }

  toggleAdvancedFilter() {
    this.isAdvancedExpanded = !this.isAdvancedExpanded;
  }

  toggleSearchHelp() {
    this.isSearchHelpVisible = !this.isSearchHelpVisible;
  }

  appendToSearch(snippet: string) {
    if (this.filter.searchText && this.filter.searchText.trim()) {
      this.filter.searchText = this.filter.searchText.trim() + ' && ' + snippet;
    } else {
      this.filter.searchText = snippet;
    }
  }

  toggleAccount(account: string) {
    const idx = this.filter.selectedAccounts.indexOf(account);
    if (idx > -1) {
      this.filter.selectedAccounts.splice(idx, 1);
    } else {
      this.filter.selectedAccounts.push(account);
    }
  }

  isAccountSelected(account: string): boolean {
    return this.filter.selectedAccounts.includes(account);
  }

  toggleTag(tag: string) {
    const idx = this.filter.selectedTags.indexOf(tag);
    if (idx > -1) {
      this.filter.selectedTags.splice(idx, 1);
    } else {
      this.filter.selectedTags.push(tag);
    }
  }

  isTagSelected(tag: string): boolean {
    return this.filter.selectedTags.includes(tag);
  }

  isFixedCost(tag: string): boolean {
    return AppStateService.instance.allSubscriptions.some(
      (sub) => sub.category.replace('@', '') === tag,
    );
  }
}
