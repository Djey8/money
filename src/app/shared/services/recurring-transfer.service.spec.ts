import { RecurringTransferService } from './recurring-transfer.service';
import { AppStateService } from './app-state.service';
import { RecurringTransfer } from '../../interfaces/recurring-transfer';
import { IncomeComponent } from '../../main/cashflow/income/income.component';

describe('RecurringTransferService', () => {
  const NOW = new Date('2026-04-15');
  let service: RecurringTransferService;
  let persistence: { batchWriteAndSync: jest.Mock };

  const shared: RecurringTransfer = {
    id: 'rtransfer_1',
    title: 'Shared account',
    fromLocationId: 'main',
    toLocationId: 'shared',
    amount: 50,
    startDate: '2026-03-23',
    endDate: '',
    frequency: 'weekly',
    comment: '',
  };
  const balances = () => AppStateService.instance.allLocations.map((l) => l.amount);

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    persistence = { batchWriteAndSync: jest.fn() };
    service = new RecurringTransferService(persistence as any);
    AppStateService.instance.allLocations = [
      { id: 'main', name: 'Main', amount: 1000 },
      { id: 'shared', name: 'Shared', amount: 0 },
      { id: 'other', name: 'Other', amount: 0 },
    ];
    AppStateService.instance.allTransfers = [];
    AppStateService.instance.allRecurringTransfers = [{ ...shared }];
  });

  it('creates every due transfer, in the right direction, and moves both balances', () => {
    expect(service.generateDue(NOW)).toBe(4);
    const transfers = AppStateService.instance.allTransfers;
    expect(transfers.map((t) => t.date)).toEqual([
      '2026-03-23',
      '2026-03-30',
      '2026-04-06',
      '2026-04-13',
    ]);
    expect(transfers.every((t) => t.fromLocationId === 'main' && t.toLocationId === 'shared')).toBe(
      true,
    );
    expect(transfers.every((t) => t.id.startsWith('xfer_') && t.comment === 'Shared account')).toBe(
      true,
    );
    expect(balances()).toEqual([800, 200, 0]);
  });

  it('is repeatable: running it again creates nothing and moves nothing', () => {
    service.generateDue(NOW);
    expect(service.generateDue(NOW)).toBe(0);
    expect(balances()).toEqual([800, 200, 0]);
    expect(service.generateDue(new Date('2026-04-28'))).toBe(2);
    expect(balances()).toEqual([700, 300, 0]);
  });

  it('never touches a transaction or the Cashflow figure', () => {
    AppStateService.instance.allRevenues = [{ tag: 'Salary', amount: 3000 }] as any;
    const before = IncomeComponent.getTotalAmount();
    AppStateService.instance.allTransactions = [];
    service.generateDue(NOW);
    expect(AppStateService.instance.allTransactions).toEqual([]);
    expect(IncomeComponent.getTotalAmount()).toBe(before);
  });

  it('a start date of today starts with today and then only affects the future', () => {
    AppStateService.instance.allRecurringTransfers = [{ ...shared, startDate: '2026-04-15' }];
    // during the day of the start date: today's transfer is created, nothing earlier
    expect(service.generateDue(new Date('2026-04-15T10:00:00'))).toBe(1);
    expect(service.generateDue(new Date('2026-04-21T10:00:00'))).toBe(0);
    expect(service.generateDue(new Date('2026-04-22T10:00:00'))).toBe(1);
    expect(AppStateService.instance.allTransfers.map((t) => t.date)).toEqual([
      '2026-04-15',
      '2026-04-22',
    ]);
  });

  it('editing the amount changes the generated transfers in place and the balances follow', () => {
    service.generateDue(NOW);
    const ids = AppStateService.instance.allTransfers.map((t) => t.id);
    const before = { ...AppStateService.instance.allRecurringTransfers[0] };
    const after = { ...before, amount: 75 };
    AppStateService.instance.allRecurringTransfers[0] = after;

    expect(service.reconcile(before, after, NOW)).toEqual({ updated: 4, removed: 0 });
    expect(AppStateService.instance.allTransfers.map((t) => t.id)).toEqual(ids);
    expect(AppStateService.instance.allTransfers.every((t) => t.amount === 75)).toBe(true);
    expect(balances()).toEqual([700, 300, 0]);
  });

  it('moving the destination moves the generated transfers and both balances', () => {
    service.generateDue(NOW);
    const before = { ...AppStateService.instance.allRecurringTransfers[0] };
    const after = { ...before, toLocationId: 'other' };
    service.reconcile(before, after, NOW);
    expect(balances()).toEqual([800, 0, 200]);
  });

  it('an end date moved into the past removes the later transfers and gives that money back', () => {
    service.generateDue(NOW);
    const before = { ...AppStateService.instance.allRecurringTransfers[0] };
    const after = { ...before, endDate: '2026-03-31' };
    expect(service.reconcile(before, after, NOW)).toEqual({ updated: 0, removed: 2 });
    expect(AppStateService.instance.allTransfers.map((t) => t.date)).toEqual([
      '2026-03-23',
      '2026-03-30',
    ]);
    expect(balances()).toEqual([900, 100, 0]);
  });

  it('deleting the rule with its transfers gives everything back; transfers made by hand stay', () => {
    AppStateService.instance.allTransfers = [
      {
        id: 'xfer_hand',
        fromLocationId: 'main',
        toLocationId: 'shared',
        amount: 20,
        date: '2026-03-23',
        time: '',
        comment: 'birthday gift',
      },
    ];
    service.generateDue(NOW);
    expect(AppStateService.instance.allTransfers).toHaveLength(5);
    const rule = AppStateService.instance.allRecurringTransfers[0];
    expect(service.reconcile(rule, null, NOW)).toEqual({ updated: 0, removed: 4 });
    expect(AppStateService.instance.allTransfers.map((t) => t.id)).toEqual(['xfer_hand']);
    // only the hand-made 20 is still moved
    expect(balances()).toEqual([1000, 0, 0]);
  });

  it('save stores the rules, the transfers and the location balances in one batch', () => {
    service.generateDue(NOW);
    const done = jest.fn();
    service.save('test_event', done);
    const config = persistence.batchWriteAndSync.mock.calls[0][0];
    expect(config.writes.map((w: { tag: string }) => w.tag)).toEqual([
      'recurringTransfers',
      'transfers',
      'locations',
    ]);
    config.onSuccess();
    expect(done).toHaveBeenCalledWith(true);
    expect(AppStateService.instance.isSaving).toBe(false);
  });
});
