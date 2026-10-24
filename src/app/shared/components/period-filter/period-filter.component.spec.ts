import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { PeriodFilterComponent } from './period-filter.component';

function setup() {
  TestBed.configureTestingModule({ imports: [PeriodFilterComponent, TranslateModule.forRoot()] });
  const fixture = TestBed.createComponent(PeriodFilterComponent);
  const filter = { startDate: '', endDate: '2026-10-25', selectedAccounts: [], selectedTags: [] };
  fixture.componentRef.setInput('filter', filter);
  const apply = jest.fn();
  const clear = jest.fn();
  fixture.componentInstance.apply.subscribe(apply);
  fixture.componentInstance.clear.subscribe(clear);
  fixture.detectChanges();
  return { fixture, filter, apply, clear, el: fixture.nativeElement as HTMLElement };
}

const press = (el: HTMLElement, text: string) =>
  Array.from<HTMLButtonElement>(el.querySelectorAll('button'))
    .find((button) => button.textContent!.trim() === text)!
    .click();

describe('PeriodFilterComponent', () => {
  it('sets the filter to the month, the quarter or the year, and says which', () => {
    const { fixture, filter, apply, el } = setup();
    expect(el.querySelector('.pf-period--on')?.textContent).toContain('Period.all');
    press(el, 'Period.month');
    fixture.detectChanges();
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    expect(filter.startDate).toBe(`${now.getFullYear()}-${month}-01`);
    expect(filter.endDate >= filter.startDate).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.pf-label')?.textContent?.trim()).toMatch(/\d{4}$/);
    press(el, 'Period.quarter');
    expect(el.querySelector('.pf-label')?.textContent).toBeDefined();
    press(el, 'Period.year');
    fixture.detectChanges();
    expect(filter.startDate).toBe(`${now.getFullYear()}-01-01`);
    expect(filter.endDate).toBe(`${now.getFullYear()}-12-31`);
  });

  it('steps back through the time series, never into the future, and everything clears the filter', () => {
    const { fixture, filter, apply, clear, el } = setup();
    press(el, 'Period.month');
    const thisMonth = filter.startDate;
    const nav = () => Array.from<HTMLButtonElement>(el.querySelectorAll('.pf-step'));
    fixture.detectChanges();
    expect(nav()[1].disabled).toBe(true); // nothing after the current one
    nav()[0].click();
    fixture.detectChanges();
    expect(filter.startDate < thisMonth).toBe(true);
    // the last day of the month before is the day before this month's first
    const before = new Date(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 1, 0);
    expect(filter.endDate).toBe(
      `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, '0')}-${String(before.getDate()).padStart(2, '0')}`,
    );
    nav()[1].click(); // forward again
    fixture.detectChanges();
    expect(filter.startDate).toBe(thisMonth);
    expect(apply).toHaveBeenCalledTimes(3);
    press(el, 'Period.all');
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('shows no period as chosen once the dates were changed by hand', () => {
    const { fixture, filter, el } = setup();
    press(el, 'Period.month');
    filter.startDate = '2020-03-04'; // a range of the player's own, typed in the advanced filter
    fixture.componentInstance.type = 'month';
    fixture.detectChanges();
    expect(el.querySelector('.pf-period--on')).toBeNull();
    expect(el.querySelector('.pf-nav')).toBeNull();
  });
});
