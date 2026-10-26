import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { TranslateModule } from '@ngx-translate/core';
import { ProfessionSheetsComponent } from './profession-sheets.component';

registerLocaleData(localeDe); // the app registers it at startup (app.config.ts)

describe('ProfessionSheetsComponent', () => {
  let fixture: ComponentFixture<ProfessionSheetsComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfessionSheetsComponent, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfessionSheetsComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('currency', '€');
    fixture.componentRef.setInput('revenue', [{ name: 'Salary', amount: 3000 }]);
    fixture.componentRef.setInput('revenueTotal', 3000);
    fixture.componentRef.setInput('expenses', [
      { name: 'Taxes', amount: 800 },
      { name: 'Student loan', amount: 150 },
    ]);
    fixture.componentRef.setInput('expensesTotal', 950);
    fixture.componentRef.setInput('assets', [{ name: 'Savings', amount: 2000 }]);
    fixture.componentRef.setInput('assetsTotal', 2000);
    fixture.componentRef.setInput('liabilities', [
      { name: 'Mortgage', amount: 90000, index: 0 },
      { name: 'Car loan', amount: 5000 },
    ]);
    fixture.componentRef.setInput('liabilitiesTotal', 95000);
    fixture.componentRef.setInput('cashTotal', 2050);
    fixture.detectChanges();
  });

  it('draws the three sheets, each in the blue box with the white card of rows', () => {
    expect(element.querySelectorAll('.ps-group')).toHaveLength(3);
    // income statement: revenue and expenses, balance sheet: assets and liabilities
    expect(element.querySelectorAll('.ps-box')).toHaveLength(4);
    const text = element.textContent!;
    expect(text).toContain('Taxes');
    expect(text).toContain('Student loan');
    expect(text).toContain('Mortgage');
  });

  it('lists the biggest amount first in the income statement, a line under its parent staying there', () => {
    fixture.componentRef.setInput('expenses', [
      { name: 'Small', amount: 24 },
      { name: 'Rent', amount: 800 },
      { name: 'Food', amount: 300 },
    ]);
    fixture.componentRef.setInput('revenue', [
      { name: 'Passive', amount: 100 },
      { name: 'Rental', amount: 100, sub: true },
      { name: 'Salary', amount: 3000 },
    ]);
    fixture.detectChanges();
    const names = (box: number) =>
      Array.from(
        element
          .querySelectorAll('.ps-box')
          [box].querySelectorAll('.ps-row:not(.ps-row--total) td:first-child'),
      ).map((cell) => cell.textContent!.trim());
    expect(names(0)).toEqual(['Salary', 'Passive', 'Rental']);
    expect(names(1)).toEqual(['Rent', 'Food', 'Small']);
  });

  it('opens only the liabilities that have something behind them', () => {
    const opened: number[] = [];
    fixture.componentInstance.liabilityOpen.subscribe((index) => opened.push(index));
    const rows = Array.from(element.querySelectorAll<HTMLElement>('.ps-row')).filter((row) =>
      /Mortgage|Car loan/.test(row.textContent!),
    );
    rows.forEach((row) => row.click());
    expect(opened).toEqual([0]);
  });

  it('leaves the liabilities box out when there are none', () => {
    fixture.componentRef.setInput('liabilities', []);
    fixture.detectChanges();
    expect(element.querySelectorAll('.ps-box')).toHaveLength(3);
  });
});
