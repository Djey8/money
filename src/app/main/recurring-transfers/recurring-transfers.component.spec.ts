import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecurringTransfersComponent } from './recurring-transfers.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { DatabaseService } from '../../shared/services/database.service';
import { PersistenceService } from '../../shared/services/persistence.service';
import { AppStateService } from '../../shared/services/app-state.service';
import { RecurringTransfer } from '../../interfaces/recurring-transfer';

const rule = (id: string, extra: Partial<RecurringTransfer> = {}): RecurringTransfer => ({
  id,
  title: 'Shared account',
  fromLocationId: 'bank',
  toLocationId: 'shared',
  amount: 50,
  startDate: '2026-03-23',
  endDate: '',
  frequency: 'weekly',
  comment: '',
  ...extra,
});

registerLocaleData(localeDe); // the app registers it at startup (app.config.ts)

describe('RecurringTransfersComponent', () => {
  let fixture: ComponentFixture<RecurringTransfersComponent>;
  let component: RecurringTransfersComponent;

  const render = (rules: RecurringTransfer[]) => {
    AppStateService.instance.allRecurringTransfers = rules;
    fixture = TestBed.createComponent(RecurringTransfersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allLocations = [
      { id: 'bank', name: 'N26', subName: 'Main', amount: 0 },
      { id: 'shared', name: 'Shared', amount: 0 },
    ];
    await TestBed.configureTestingModule({
      imports: [
        RecurringTransfersComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        provideNoopAnimations(),
        { provide: DatabaseService, useValue: {} },
        { provide: PersistenceService, useValue: {} },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 't', appId: 't', apiKey: 't' } },
      ],
    }).compileComponents();
  });

  it('lists every rule with the names resolved and its position in the full list', () => {
    render([rule('r1'), rule('r2', { title: 'Savings', toLocationId: 'gone' })]);
    expect(component.dataSource.data).toEqual([
      expect.objectContaining({ id: 0, title: 'Shared account', from: 'N26 - Main', to: 'Shared' }),
      expect.objectContaining({ id: 1, title: 'Savings', to: '' }),
    ]);
    expect(fixture.nativeElement.querySelectorAll('tr[mat-row]').length).toBe(2);
  });

  it('shows the empty message when there are no rules', () => {
    render([]);
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
  });

  it('searches name, locations, frequency, amount and dates', () => {
    render([
      rule('r1'),
      rule('r2', {
        title: 'Rent share',
        frequency: 'monthly',
        amount: 400,
        startDate: '2026-06-01',
      }),
    ]);
    const search = (text: string) => {
      component.searchTextField = text;
      component.search();
      return component.dataSource.filteredData.map((r) => r.id);
    };
    expect(search('rent')).toEqual([1]);
    expect(search('monthly')).toEqual([1]);
    expect(search('400')).toEqual([1]);
    expect(search('01.06.2026')).toEqual([1]);
    expect(search('shared')).toEqual([0, 1]);
    expect(search('zzz')).toEqual([]);
  });

  it('rebuilds the table when the rules change elsewhere', () => {
    render([rule('r1')]);
    AppStateService.instance.allRecurringTransfers.push(rule('r2'));
    AppStateService.instance.transfersUpdated$.next();
    expect(component.dataSource.data).toHaveLength(2);
  });

  it('has buttons to go to the other list and back to the Locations page', () => {
    render([]);
    jest.spyOn(window, 'scroll').mockImplementation(() => undefined); // jsdom has no scrolling
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.goToTransfers();
    expect(navigate).toHaveBeenLastCalledWith(['/transfers']);
    component.goToLocations();
    expect(navigate).toHaveBeenLastCalledWith(['/locations']);
    // both buttons are really in the toolbar
    const toolbar = fixture.nativeElement.querySelector('.toolbar');
    expect(toolbar.querySelector('#locationsbtn')).not.toBeNull();
    expect(toolbar.querySelector('#transferbtn')).not.toBeNull();
  });
});
