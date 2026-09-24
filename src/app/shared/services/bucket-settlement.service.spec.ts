import { AppStateService } from './app-state.service';
import { BucketSettlementService } from './bucket-settlement.service';
import { IncomeStatementService } from './income-statement.service';

describe('BucketSettlementService', () => {
  let service: BucketSettlementService;
  let persistence: { batchWriteAndSync: jest.Mock };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    const state = AppStateService.instance;
    state.allRevenues = [];
    state.allIntrests = [];
    state.allProperties = [];
    state.dailyExpenses = [];
    state.splurgeExpenses = [];
    state.smileExpenses = [];
    state.fireExpenses = [];
    state.mojoExpenses = [];
    state.allFireEmergencies = [];
    state.allShares = [];
    state.allInvestments = [];
    state.mojo = { amount: 0, target: 1000 };
    state.allSmileProjects = [
      {
        title: 'Alps',
        phase: 'saving',
        buckets: [{ id: 'b_guide', title: 'Guide', target: 500, amount: 500 }],
      } as any,
    ];
    state.allTransactions = [
      {
        account: 'Smile',
        amount: -500,
        date: '2026-09-01',
        time: '10:00',
        category: '@Alps',
        comment: '#bucket:Guide:500.00',
      },
    ];

    persistence = { batchWriteAndSync: jest.fn((config) => config.onSuccess()) };
    const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
    service = new BucketSettlementService(persistence as any, incomeStatement);
  });

  it('settles a bucket: rebuilt with the actual cost, then persisted in one batch', () => {
    const onSuccess = jest.fn();
    service.settle(
      'smile',
      'Alps',
      { bucket: { title: 'Guide', amount: 500 }, actual: 650, receipt: 'Invoice' },
      { onSuccess, onError: jest.fn() },
    );

    const bucket = AppStateService.instance.allSmileProjects[0].buckets[0];
    expect(bucket).toMatchObject({ amount: 650, settledAmount: 650 });
    expect(AppStateService.instance.allTransactions[1].amount).toBe(-150);
    const tags = persistence.batchWriteAndSync.mock.calls[0][0].writes.map((w: any) => w.tag);
    expect(tags).toEqual(expect.arrayContaining(['transactions']));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('unsettles a bucket back to its savings', () => {
    const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
    service.settle(
      'smile',
      'Alps',
      { bucket: { title: 'Guide', amount: 500 }, actual: 650 },
      callbacks,
    );
    service.unsettle('smile', 'Alps', 'Guide', callbacks);

    const bucket = AppStateService.instance.allSmileProjects[0].buckets[0];
    expect(bucket.amount).toBe(500);
    expect(bucket.settledAmount).toBeUndefined();
    expect(AppStateService.instance.allTransactions).toHaveLength(1);
  });

  it('reports an error when unsettling a bucket that is not settled', () => {
    const onError = jest.fn();
    service.unsettle('smile', 'Alps', 'Guide', { onSuccess: jest.fn(), onError });
    expect(onError).toHaveBeenCalled();
    expect(persistence.batchWriteAndSync).not.toHaveBeenCalled();
  });
});
