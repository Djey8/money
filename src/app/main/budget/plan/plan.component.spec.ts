import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanComponent } from './plan.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('PlanComponent', () => {
  let component: PlanComponent;
  let fixture: ComponentFixture<PlanComponent>;

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allBudgets = [];

    await TestBed.configureTestingModule({
      imports: [
        PlanComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 'test', appId: 'test', apiKey: 'test' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlanComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getActualsCached()', () => {
    it('should return 0 for unknown tag', () => {
      expect(component.getActualsCached('nonexistent')).toBe(0);
    });
  });

  describe('rebuildDataSources with budget data', () => {
    it('should populate dataSource for selected month', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const dateStr = `${year}-${month}`;

      AppStateService.instance.allBudgets = [
        { date: dateStr, tag: '@Food', amount: 200 },
        { date: dateStr, tag: '@Transport', amount: 100 },
      ] as any;
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -80, category: '@Food', date: `${dateStr}-15`, comment: '' },
        { account: 'Daily', amount: -30, category: '@Transport', date: `${dateStr}-10`, comment: '' },
      ] as any;

      PlanComponent.selectedMonthYear = dateStr;

      // Recreate component to trigger constructor
      fixture = TestBed.createComponent(PlanComponent);
      component = fixture.componentInstance;

      expect(PlanComponent.dataSource.data.length).toBe(2);

      const foodRow = PlanComponent.dataSource.data.find(r => r.tag === '@Food');
      expect(foodRow).toBeDefined();
      expect(foodRow!.amount).toBe(200);
      expect(foodRow!.actual).toBe(-80);
      expect(foodRow!.diff).toBe(120);
    });

    it('should have empty dataSource when no budgets match', () => {
      AppStateService.instance.allBudgets = [
        { date: '1999-01', tag: '@Food', amount: 200 },
      ] as any;

      PlanComponent.selectedMonthYear = '2024-06';
      fixture = TestBed.createComponent(PlanComponent);
      component = fixture.componentInstance;

      expect(PlanComponent.dataSource.data.length).toBe(0);
    });
  });

  describe('initial selected month', () => {
    it('should default to current year-month', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(PlanComponent.selectedMonthYear).toBe(expected);
    });
  });
});
