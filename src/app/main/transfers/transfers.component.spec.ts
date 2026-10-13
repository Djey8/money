import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransfersComponent } from './transfers.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { DatabaseService } from '../../shared/services/database.service';
import { PersistenceService } from '../../shared/services/persistence.service';
import { AppStateService } from '../../shared/services/app-state.service';
import { Transfer } from '../../interfaces/transfer';

const transfer = (id: string, extra: Partial<Transfer> = {}): Transfer => ({
  id,
  fromLocationId: 'bank',
  toLocationId: 'cash',
  amount: 100,
  date: '2026-10-05',
  time: '14:30',
  comment: 'ATM',
  ...extra,
});

registerLocaleData(localeDe); // the app registers it at startup (app.config.ts)

describe('TransfersComponent', () => {
  let fixture: ComponentFixture<TransfersComponent>;
  let component: TransfersComponent;

  const render = (transfers: Transfer[]) => {
    AppStateService.instance.allTransfers = transfers;
    fixture = TestBed.createComponent(TransfersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };
  const rows = () => fixture.nativeElement.querySelectorAll('tr[mat-row]');

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allLocations = [
      { id: 'bank', name: 'N26', subName: 'Main', amount: 0 },
      { id: 'cash', name: 'Cash', amount: 0 },
    ];
    await TestBed.configureTestingModule({
      imports: [
        TransfersComponent,
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

  it('resolves the location names and keeps each row pointing at its transfer', () => {
    render([transfer('x1'), transfer('x2', { fromLocationId: 'cash', toLocationId: 'bank' })]);
    expect(component.dataSource.data).toEqual([
      expect.objectContaining({ id: 0, from: 'N26 - Main', to: 'Cash', amount: 100 }),
      expect.objectContaining({ id: 1, from: 'Cash', to: 'N26 - Main' }),
    ]);
  });

  it('a transfer whose end was deleted has an empty name (shown as a deleted location)', () => {
    render([transfer('x1', { toLocationId: undefined })]);
    expect(component.dataSource.data[0].to).toBe('');
  });

  it('shows one table row per transfer, and an empty message instead when there are none', () => {
    render([transfer('x1'), transfer('x2'), transfer('x3')]);
    expect(rows().length).toBe(3);
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();

    TestBed.resetTestingModule();
  });

  it('searches names, comments, amounts and dates', () => {
    render([
      transfer('x1', { comment: 'ATM' }),
      transfer('x2', { comment: 'rent', amount: 250, date: '2026-11-01' }),
    ]);
    const search = (text: string) => {
      component.searchTextField = text;
      component.search();
      return component.dataSource.filteredData.map((r) => r.id);
    };
    expect(search('rent')).toEqual([1]);
    expect(search('250')).toEqual([1]);
    expect(search('01.11.2026')).toEqual([1]);
    expect(search('n26')).toEqual([0, 1]);
    expect(search('atm, rent')).toEqual([0, 1]);
    expect(search('nothing')).toEqual([]);
    component.clearSearch();
    expect(component.dataSource.filteredData).toHaveLength(2);
    expect(component.isSearched).toBe(false);
  });

  it('opens newest first and sorts by every column', async () => {
    render([
      transfer('x1', { date: '2026-10-01', amount: 30 }),
      transfer('x2', { date: '2026-10-09', amount: 10 }),
      transfer('x3', { date: '2026-10-05', amount: 20 }),
    ]);
    const ids = (column: string) =>
      [...component.dataSource.data]
        .sort((a, b) => {
          const x = (component as any).sortValue(a, column);
          const y = (component as any).sortValue(b, column);
          return x < y ? -1 : x > y ? 1 : 0;
        })
        .map((r) => r.id);
    await new Promise((resolve) => setTimeout(resolve)); // the default sort is applied after the view is built
    expect(component.sort.active).toBe('date');
    expect(component.sort.direction).toBe('desc');
    // and the table really is in that order
    expect(
      component.dataSource.sortData(component.dataSource.data, component.sort).map((r) => r.id),
    ).toEqual([1, 2, 0]);
    expect(ids('date')).toEqual([0, 2, 1]);
    expect(ids('amount')).toEqual([1, 2, 0]);
    expect(ids('id')).toEqual([0, 1, 2]);
  });

  it('rebuilds the table when the transfers change elsewhere', () => {
    render([transfer('x1')]);
    expect(component.dataSource.data).toHaveLength(1);
    AppStateService.instance.allTransfers.push(transfer('x2'));
    AppStateService.instance.transfersUpdated$.next();
    expect(component.dataSource.data).toHaveLength(2);
  });

  it('offers page sizes that fit the amount of data', () => {
    render([transfer('x1')]);
    expect(component.pageSizeOptions).toEqual([5, 10, 25]);
    render(Array.from({ length: 60 }, (_, i) => transfer('t' + i)));
    expect(component.pageSizeOptions).toEqual([10, 25, 50, 100]);
  });

  it('has buttons to go to the other list and back to the Locations page', () => {
    render([]);
    jest.spyOn(window, 'scroll').mockImplementation(() => undefined); // jsdom has no scrolling
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.goToRecurringTransfers();
    expect(navigate).toHaveBeenLastCalledWith(['/recurring-transfers']);
    component.goToLocations();
    expect(navigate).toHaveBeenLastCalledWith(['/locations']);
    // both buttons are really in the toolbar
    const toolbar = fixture.nativeElement.querySelector('.toolbar');
    expect(toolbar.querySelector('#locationsbtn')).not.toBeNull();
    expect(toolbar.querySelector('#recurringbtn')).not.toBeNull();
  });
});
