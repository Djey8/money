import { SubscriptionProcessingService } from './subscription-processing.service';
import { AppStateService } from './app-state.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

describe('SubscriptionProcessingService', () => {
  let service: SubscriptionProcessingService;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    ProfileComponent.mail = '';
    const authService = {
      checkAuthentication: jest.fn().mockResolvedValue({ authenticated: true }),
    } as any;
    const frontendLogger = { logActivity: jest.fn(), logError: jest.fn() } as any;
    service = new SubscriptionProcessingService(authService, frontendLogger);
  });

  describe('setTransactionsForSubscriptions', () => {
    it('is a no-op for a cashflow-game account — Payday is the only thing that posts its Subscriptions (todo/cashflow-game.md decision 31)', async () => {
      ProfileComponent.mail = 'player@cashflow.example';
      AppStateService.instance.allSubscriptions = [
        {
          title: 'Salary',
          account: 'Income',
          amount: 1000,
          startDate: '2020-01-01',
          endDate: '',
          category: '',
          comment: '',
          frequency: 'monthly',
        },
      ];

      const result = await service.setTransactionsForSubscriptions();

      expect(result).toEqual({ transactionsCreated: 0, subscriptionsProcessed: 0 });
      expect(AppStateService.instance.allTransactions).toEqual([]);
    });

    it('is not blocked by the cashflow guard for a normal account — the subscription still gets processed', async () => {
      ProfileComponent.mail = 'jfk@example.com';
      AppStateService.instance.allSubscriptions = [
        {
          title: 'Salary',
          account: 'Income',
          amount: 1000,
          startDate: '2020-01-01',
          endDate: '',
          category: '',
          comment: '',
          frequency: 'monthly',
        },
      ];

      const result = await service.setTransactionsForSubscriptions();

      expect(result.subscriptionsProcessed).toBe(1);
    });
  });
});
