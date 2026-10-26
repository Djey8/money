import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { SharedFilterComponent } from './shared-filter.component';

function setup() {
  TestBed.configureTestingModule({ imports: [SharedFilterComponent, TranslateModule.forRoot()] });
  const fixture = TestBed.createComponent(SharedFilterComponent);
  const filter = {
    startDate: '',
    endDate: '2026-10-25',
    selectedAccounts: [] as string[],
    selectedTags: [] as string[],
    sortBy: 'none',
    sortOrder: 'desc',
    searchText: '',
    searchFields: {},
  };
  fixture.componentRef.setInput('filter', filter);
  const apply = jest.fn();
  const clear = jest.fn();
  fixture.componentInstance.apply.subscribe(apply);
  fixture.componentInstance.clear.subscribe(clear);
  fixture.detectChanges();
  return { fixture, filter, apply, clear, el: fixture.nativeElement as HTMLElement };
}

const press = (el: HTMLElement, selector: string, text?: string) =>
  Array.from<HTMLButtonElement>(el.querySelectorAll(selector))
    .find((button) => (text === undefined ? true : button.textContent!.trim() === text))!
    .click();

describe('the period of the shared filter (as in the statistics)', () => {
  it('offers week, month, quarter, year, all and custom; the dates are only there for custom', () => {
    const { fixture, el } = setup();
    const labels = Array.from(el.querySelectorAll('.chart-filter-period-btn')).map((b) =>
      b.textContent!.trim(),
    );
    expect(labels).toEqual([
      'Period.week',
      'Period.month',
      'Period.quarter',
      'Period.year',
      'Period.all',
      'BI.custom',
    ]);
    expect(el.querySelector('#quickStartDate')).toBeNull();
    press(el, '.chart-filter-period-btn', 'BI.custom');
    fixture.detectChanges();
    expect(el.querySelector('#quickStartDate')).not.toBeNull();
    expect(el.querySelector('.chart-filter-nav')).toBeNull();
  });

  it('sets the dates to the month, the quarter or the year and applies at once', () => {
    const { fixture, filter, apply, el } = setup();
    const now = new Date();
    press(el, '.chart-filter-period-btn', 'Period.month');
    fixture.detectChanges();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    expect(filter.startDate).toBe(`${now.getFullYear()}-${month}-01`);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.chart-filter-date-label')?.textContent?.trim()).toMatch(/\d{4}$/);
    press(el, '.chart-filter-period-btn', 'Period.year');
    expect(filter.startDate).toBe(`${now.getFullYear()}-01-01`);
    expect(filter.endDate).toBe(`${now.getFullYear()}-12-31`);
  });

  it('steps back and forward through the time series, never past the current one', () => {
    const { fixture, filter, apply, el } = setup();
    press(el, '.chart-filter-period-btn', 'Period.month');
    const thisMonth = filter.startDate;
    fixture.detectChanges();
    const steps = () => Array.from<HTMLButtonElement>(el.querySelectorAll('.chart-filter-nav-btn'));
    expect(steps()[1].disabled).toBe(true);
    steps()[0].click();
    fixture.detectChanges();
    expect(filter.startDate < thisMonth).toBe(true);
    steps()[1].click();
    fixture.detectChanges();
    expect(filter.startDate).toBe(thisMonth);
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it('All takes the dates off: it clears when nothing else is filtered, and applies when something is', () => {
    const { fixture, filter, apply, clear, el } = setup();
    press(el, '.chart-filter-period-btn', 'Period.month');
    press(el, '.chart-filter-period-btn', 'Period.all');
    expect(filter.startDate).toBe('');
    expect(filter.endDate).toBe('');
    expect(clear).toHaveBeenCalledTimes(1);
    filter.selectedTags.push('food');
    press(el, '.chart-filter-period-btn', 'Period.month');
    press(el, '.chart-filter-period-btn', 'Period.all');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(3);
    fixture.detectChanges();
    expect(el.querySelector('.chart-filter-period-btn.active')?.textContent).toContain(
      'Period.all',
    );
  });

  it('shows Custom once the dates are a range of its own, however they got there', () => {
    const { fixture, filter, el } = setup();
    press(el, '.chart-filter-period-btn', 'Period.month');
    filter.startDate = '2020-03-04';
    fixture.detectChanges();
    expect(el.querySelector('.chart-filter-period-btn.active')?.textContent).toContain('BI.custom');
  });
});
