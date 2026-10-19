import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetComponent } from './budget.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../shared/services/database.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../shared/services/app-state.service';

describe('BudgetComponent', () => {
  let component: BudgetComponent;
  let fixture: ComponentFixture<BudgetComponent>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allBudgets = [];

    await TestBed.configureTestingModule({
      imports: [
        BudgetComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        {
          provide: FIREBASE_OPTIONS,
          useValue: { projectId: 'test', appId: 'test', apiKey: 'test' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('draws the income as a green line with bullets, and a bar tells income and both cashflows', () => {
    const state = AppStateService.instance;
    const tx = (account: string, amount: number, date: string, extra: object = {}) =>
      ({ account, amount, date, time: '', category: '@x', comment: '', ...extra }) as any;
    state.allTransactions = [
      tx('Income', 3000, '2026-09-02', { category: '@Salary' }),
      tx('Daily', -1000, '2026-09-03'),
      tx('Income', 3000, '2026-10-02', { category: '@Salary' }),
      tx('Income', 40000, '2026-10-03', { comment: 'Sell Investment EFH 80000 60000;' }),
      tx('Daily', -2500, '2026-10-04'),
    ];
    state.isEuropeanFormat = false;
    state.allBudgets = [
      { date: '2026-09', tag: '@x', amount: 1200 },
      { date: '2026-10', tag: '@x', amount: 2000 },
    ];
    document.body.appendChild(fixture.nativeElement); // the chart is drawn into the page
    fixture.detectChanges();
    BudgetComponent.createBudgetVsActuals('all', 0);

    const points = document.querySelectorAll('#chart-container .income-point');
    expect(points).toHaveLength(2);
    expect(document.querySelectorAll('#chart-container .budget-point')).toHaveLength(2);
    (points[1] as SVGCircleElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const box = document.getElementById('kpi-info-box')!;
    const rows = Array.from(box.querySelectorAll('.kpi-row')).map((row) => row.textContent);
    // October: income 3.000 (the 40.000 sale does not count), planned 2.000, actual 2.500
    expect(rows.join('|')).toContain('3,000.00');
    expect(rows.join('|')).not.toContain('43,000');
    expect(rows.join('|')).toContain('1,000.00'); // planned cashflow 3000 - 2000
    expect(rows.join('|')).toContain('500.00'); // cashflow 3000 - 2500
  });
});
