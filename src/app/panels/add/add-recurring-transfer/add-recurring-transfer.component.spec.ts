import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddRecurringTransferComponent } from './add-recurring-transfer.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';
import { recurringProblem } from '../../../shared/transfer.utils';

describe('AddRecurringTransferComponent', () => {
  let component: AddRecurringTransferComponent;
  let fixture: ComponentFixture<AddRecurringTransferComponent>;
  let mockPersistence: { batchWriteAndSync: jest.Mock };
  const balances = () => AppStateService.instance.allLocations.map((l) => l.amount);
  const today = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allTransfers = [];
    AppStateService.instance.allRecurringTransfers = [];
    AppStateService.instance.allLocations = [
      { id: 'main', name: 'Main', amount: 1000 },
      { id: 'shared', name: 'Shared', amount: 0 },
    ];
    mockPersistence = { batchWriteAndSync: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AddRecurringTransferComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        { provide: PersistenceService, useValue: mockPersistence },
        {
          provide: FIREBASE_OPTIONS,
          useValue: { projectId: 'test', appId: 'test', apiKey: 'test' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddRecurringTransferComponent);
    component = fixture.componentInstance;
  });

  it('with a start date in the past it creates the rule and every transfer already due', () => {
    component.titleTextField = 'Shared account';
    component.fromLocationId = 'main';
    component.toLocationId = 'shared';
    component.amountTextField = '50';
    component.frequencyField = 'weekly';
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    component.startDateTextField = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

    component.addRecurringTransfer();

    expect(AppStateService.instance.allRecurringTransfers).toHaveLength(1);
    expect(AppStateService.instance.allRecurringTransfers[0]).toMatchObject({
      title: 'Shared account',
      fromLocationId: 'main',
      toLocationId: 'shared',
      amount: 50,
      frequency: 'weekly',
    });
    expect(AppStateService.instance.allRecurringTransfers[0].id).toMatch(/^rtransfer_/);
    const created = AppStateService.instance.allTransfers.length;
    expect(created).toBeGreaterThanOrEqual(2);
    expect(balances()).toEqual([1000 - 50 * created, 50 * created]);
    const config = mockPersistence.batchWriteAndSync.mock.calls[0][0];
    expect(config.writes.map((w: { tag: string }) => w.tag)).toEqual([
      'recurringTransfers',
      'transfers',
      'locations',
    ]);
  });

  it('with a start date in the future it only stores the rule', () => {
    component.fromLocationId = 'main';
    component.toLocationId = 'shared';
    component.amountTextField = '50';
    component.startDateTextField = '2999-01-01';

    component.addRecurringTransfer();

    expect(AppStateService.instance.allRecurringTransfers).toHaveLength(1);
    expect(AppStateService.instance.allTransfers).toEqual([]);
    expect(balances()).toEqual([1000, 0]);
    expect(AppStateService.instance.allRecurringTransfers[0].title).toBe('Recurring transfer');
  });

  it.each([
    ['no source', { from: null, to: 'shared', amount: '10' }],
    ['no destination', { from: 'main', to: null, amount: '10' }],
    ['the same location twice', { from: 'main', to: 'main', amount: '10' }],
    ['a zero amount', { from: 'main', to: 'shared', amount: '0' }],
    ['a negative amount', { from: 'main', to: 'shared', amount: '-5' }],
  ])('refuses %s and changes nothing', (_label, input) => {
    component.fromLocationId = input.from;
    component.toLocationId = input.to;
    component.amountTextField = input.amount;
    component.startDateTextField = today();

    component.addRecurringTransfer();

    expect(component.color).toBe('red');
    expect(AppStateService.instance.allRecurringTransfers).toEqual([]);
    expect(AppStateService.instance.allTransfers).toEqual([]);
    expect(mockPersistence.batchWriteAndSync).not.toHaveBeenCalled();
  });

  it('recurringProblem also needs a start date and a sane end date', () => {
    const ok = {
      fromLocationId: 'a',
      toLocationId: 'b',
      amount: 5,
      date: '2026-01-01',
      startDate: '2026-01-01',
      endDate: '',
    };
    expect(recurringProblem(ok)).toBeNull();
    expect(recurringProblem({ ...ok, startDate: '' })).toMatch(/start date/i);
    expect(recurringProblem({ ...ok, endDate: '2025-12-31' })).toMatch(/end date/i);
    expect(recurringProblem({ ...ok, endDate: '2026-12-31' })).toBeNull();
  });
});
