import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddTransferComponent } from './add-transfer.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../../../shared/services/database.service';
import { PersistenceService } from '../../../shared/services/persistence.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AppStateService } from '../../../shared/services/app-state.service';
import { IncomeComponent } from '../../../main/cashflow/income/income.component';

describe('AddTransferComponent', () => {
  let component: AddTransferComponent;
  let fixture: ComponentFixture<AddTransferComponent>;
  let mockPersistence: { batchWriteAndSync: jest.Mock };
  const balances = () => AppStateService.instance.allLocations.map((l) => l.amount);

  beforeEach(async () => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allTransfers = [];
    AppStateService.instance.allLocations = [
      { id: 'bank', name: 'Bank', amount: 1000 },
      { id: 'cash', name: 'Cash', amount: 50 },
    ];
    mockPersistence = { batchWriteAndSync: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        AddTransferComponent,
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

    fixture = TestBed.createComponent(AddTransferComponent);
    component = fixture.componentInstance;
  });

  it('moves the amount from the source to the destination and stores both lists', () => {
    component.fromLocationId = 'bank';
    component.toLocationId = 'cash';
    component.amountTextField = '100';
    component.dateTextField = '2026-10-05';
    component.commentTextField = ' ATM ';

    component.addTransfer();

    expect(balances()).toEqual([900, 150]);
    expect(AppStateService.instance.allTransfers).toHaveLength(1);
    expect(AppStateService.instance.allTransfers[0]).toMatchObject({
      fromLocationId: 'bank',
      toLocationId: 'cash',
      amount: 100,
      date: '2026-10-05',
      comment: 'ATM',
    });
    expect(AppStateService.instance.allTransfers[0].id).toMatch(/^xfer_/);
    const config = mockPersistence.batchWriteAndSync.mock.calls[0][0];
    expect(config.writes.map((w: { tag: string }) => w.tag)).toEqual(['transfers', 'locations']);
  });

  it('a transfer never touches the transactions', () => {
    AppStateService.instance.allTransactions = [
      { account: 'Daily', amount: -5, date: '2026-10-01', time: '', category: '@x', comment: '' },
    ];
    component.fromLocationId = 'bank';
    component.toLocationId = 'cash';
    component.amountTextField = '25';
    component.dateTextField = '2026-10-05';
    component.addTransfer();
    expect(AppStateService.instance.allTransactions).toHaveLength(1);
    expect(balances().reduce((a, b) => a + b, 0)).toBe(1050);
  });

  it('does not change the Cashflow figure the app shows (income statement untouched)', () => {
    AppStateService.instance.allRevenues = [{ tag: 'Salary', amount: 3000 }] as any;
    AppStateService.instance.dailyExpenses = [{ tag: 'Food', amount: -400 }] as any;
    const before = IncomeComponent.getTotalAmount();
    expect(before).not.toBe(0);

    component.fromLocationId = 'bank';
    component.toLocationId = 'cash';
    component.amountTextField = '300';
    component.dateTextField = '2026-10-05';
    component.addTransfer();

    expect(AppStateService.instance.allTransfers).toHaveLength(1);
    expect(IncomeComponent.getTotalAmount()).toBe(before);
    expect(AppStateService.instance.allRevenues).toEqual([{ tag: 'Salary', amount: 3000 }]);
  });

  it.each([
    ['no source', { from: null, to: 'cash', amount: '10' }],
    ['no destination', { from: 'bank', to: null, amount: '10' }],
    ['the same location twice', { from: 'bank', to: 'bank', amount: '10' }],
    ['a zero amount', { from: 'bank', to: 'cash', amount: '0' }],
    ['a negative amount', { from: 'bank', to: 'cash', amount: '-10' }],
    ['no amount', { from: 'bank', to: 'cash', amount: '' }],
  ])('refuses %s and changes nothing', (_label, input) => {
    component.fromLocationId = input.from;
    component.toLocationId = input.to;
    component.amountTextField = input.amount;
    component.dateTextField = '2026-10-05';

    component.addTransfer();

    expect(component.color).toBe('red');
    expect(AppStateService.instance.allTransfers).toEqual([]);
    expect(balances()).toEqual([1000, 50]);
    expect(mockPersistence.batchWriteAndSync).not.toHaveBeenCalled();
  });
});
