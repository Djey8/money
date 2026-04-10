import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IncomeFilter } from 'src/app/interfaces/income-filter';
import { AppStateService } from '../../../services/app-state.service';

@Component({
  selector: 'app-shared-filter',
  templateUrl: './shared-filter.component.html',
  styleUrls: ['../../styles/filter-styles.css']
})
export class SharedFilterComponent {

  @Input() filter!: IncomeFilter;
  @Input() availableAccounts: string[] = [];
  @Input() availableTags: string[] = [];
  @Input() showSortOptions = false;

  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  isAdvancedExpanded = false;
  isSearchHelpVisible = false;

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
    return AppStateService.instance.allSubscriptions.some(sub =>
      sub.category.replace('@', '') === tag
    );
  }
}
