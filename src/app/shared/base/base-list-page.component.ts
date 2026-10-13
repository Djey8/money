import { AfterViewInit, Directive, OnDestroy, ViewChild, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { AppStateService } from '../services/app-state.service';

/**
 * Shared behaviour of a list page that looks and works like the Transactions page: a Material table with sortable
 * headers, a search box, and a paginator above and below the table (kept in step). A page supplies its rows, how a
 * search term matches a row, and how each column sorts; the rest is here.
 */
@Directive()
export abstract class BaseListPageComponent<Row> implements AfterViewInit, OnDestroy {
  protected readonly liveAnnouncer = inject(LiveAnnouncer);

  dataSource = new MatTableDataSource<Row>([]);
  searchTextField = '';
  isSearched = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('topPaginator') topPaginator!: MatPaginator;
  @ViewChild('bottomPaginator') bottomPaginator!: MatPaginator;

  private updatedSub?: Subscription;

  /** The rows to show, built from the app state (called again whenever the data changes). */
  protected abstract buildRows(): Row[];
  /** Whether one lower-cased, trimmed search term matches a row. */
  protected abstract matchesSearch(row: Row, term: string): boolean;
  /** The value a column sorts by. */
  protected abstract sortValue(row: Row, column: string): string | number;
  /** The column and direction the list opens sorted by. */
  protected abstract readonly defaultSort: { active: string; direction: 'asc' | 'desc' };

  /** Page sizes offered by the paginators, scaled to the amount of data. */
  get pageSizeOptions(): number[] {
    const n = this.dataSource.data.length;
    return n <= 25 ? [5, 10, 25] : n <= 200 ? [10, 25, 50, 100] : [25, 50, 100, 250];
  }

  protected initList(): void {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.refresh();
    this.updatedSub = AppStateService.instance.transfersUpdated$.subscribe(() => this.refresh());
  }

  refresh(): void {
    this.dataSource.data = this.buildRows();
  }

  ngAfterViewInit(): void {
    // The paginators and the sort header exist once the view is built; connect them to the data.
    this.dataSource.paginator = this.bottomPaginator;
    this.dataSource.sort = this.sort;
    setTimeout(() => {
      if (!this.sort) return;
      this.sort.active = this.defaultSort.active;
      this.sort.direction = this.defaultSort.direction;
      this.sort.sortChange.emit({
        active: this.defaultSort.active,
        direction: this.defaultSort.direction,
      });
    });
    if (this.topPaginator && this.bottomPaginator) {
      const mirror = (from: MatPaginator, to: MatPaginator) =>
        from.page.subscribe((event) => {
          if (to.pageIndex !== event.pageIndex || to.pageSize !== event.pageSize) {
            to.pageIndex = event.pageIndex;
            to.pageSize = event.pageSize;
            to.page.emit(event);
          }
        });
      mirror(this.topPaginator, this.bottomPaginator);
      mirror(this.bottomPaginator, this.topPaginator);
    }
  }

  ngOnDestroy(): void {
    this.updatedSub?.unsubscribe();
  }

  search(): void {
    const terms = this.searchTextField
      .toLowerCase()
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term !== '');
    this.isSearched = terms.length > 0;
    this.dataSource.filterPredicate = (row) => terms.some((term) => this.matchesSearch(row, term));
    // the predicate is only consulted when the filter string changes
    this.dataSource.filter = terms.length > 0 ? terms.join(',') : '';
    this.dataSource.paginator?.firstPage();
  }

  clearSearch(): void {
    this.searchTextField = '';
    this.search();
  }

  /** Announces the change in sort state for assistive technology. */
  announceSortChange(sortState: Sort | undefined): void {
    this.liveAnnouncer.announce(
      sortState?.direction ? `Sorted ${sortState.direction}ending` : 'Sorting cleared',
    );
  }
}

/** True when a date (ISO) matches a search term typed as 2026-10-05, 05.10.2026, 05.10.26 or 5/10/2026. */
export function dateMatchesTerm(isoDate: string, term: string): boolean {
  if (!isoDate) return false;
  if (isoDate.toLowerCase().includes(term)) return true;
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return false;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return [`${day}.${month}.${year}`, `${day}.${month}.${String(year).slice(-2)}`].some((s) =>
    s.includes(term),
  );
}
