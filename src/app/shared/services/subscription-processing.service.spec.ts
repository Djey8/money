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

  describe('removeStaleGeneratedTransactions', () => {
    const NOW = new Date('2026-04-15');
    const gym = {
      title: 'Gym',
      account: 'Daily',
      amount: -20,
      startDate: '2026-01-10',
      endDate: '',
      category: '@Fitness',
      comment: '',
      frequency: 'monthly' as const,
    };
    const generated = (date: string, comment = 'Gym') => ({
      account: 'Daily',
      amount: -20,
      date,
      time: '',
      category: '@Fitness',
      comment,
    });
    const dates = () => AppStateService.instance.allTransactions.map((t) => t.date);

    beforeEach(() => {
      AppStateService.instance.allTransactions = [
        generated('2026-01-10'),
        generated('2026-02-10'),
        generated('2026-03-10'),
        generated('2026-04-10'),
        // hand-made: same account, amount and category, another day and another comment
        { ...generated('2026-02-11'), comment: 'Gym day pass' },
      ];
    });

    it('removes what the old subscription generated and the changed one would not', () => {
      const removed = service.removeStaleGeneratedTransactions(
        gym,
        { ...gym, endDate: '2026-02-20' },
        NOW,
      );
      expect(removed).toBe(2);
      expect(dates()).toEqual(['2026-01-10', '2026-02-10', '2026-02-11']);
    });

    it('removes all of it when the details change, and none when only the end date moves later', () => {
      expect(service.removeStaleGeneratedTransactions(gym, { ...gym, amount: -25 }, NOW)).toBe(4);
      expect(dates()).toEqual(['2026-02-11']);
      AppStateService.instance.allTransactions = [generated('2026-01-10')];
      expect(
        service.removeStaleGeneratedTransactions(
          { ...gym, endDate: '2026-02-20' },
          { ...gym, endDate: '2026-12-31' },
          NOW,
        ),
      ).toBe(0);
    });

    it('removes everything it generated when the subscription goes', () => {
      expect(service.removeStaleGeneratedTransactions(gym, null, NOW)).toBe(4);
      expect(dates()).toEqual(['2026-02-11']);
    });

    it('recognises a Smile transaction that carries bucket tags after its comment', () => {
      AppStateService.instance.allTransactions = [
        generated('2026-01-10', 'Gym\n#bucket:Flight:20.00'),
      ];
      expect(service.removeStaleGeneratedTransactions(gym, null, NOW)).toBe(1);
    });
  });

  describe('setTransactionsForSubscriptions and tagged transactions', () => {
    afterEach(() => jest.useRealTimers());

    it('does not generate an occurrence again when its transaction carries bucket tags', async () => {
      jest.useFakeTimers({
        now: new Date('2026-02-15'),
        doNotFake: ['setTimeout', 'setImmediate'],
      });
      AppStateService.instance.allSubscriptions = [
        {
          title: 'Trip',
          account: 'Smile',
          amount: -50,
          startDate: '2026-01-10',
          endDate: '',
          category: '@Trip',
          comment: '',
          frequency: 'monthly',
        },
      ];
      AppStateService.instance.allTransactions = [
        {
          account: 'Smile',
          amount: -50,
          date: '2026-01-10',
          time: '',
          category: '@Trip',
          comment: 'Trip\n#bucket:Flight:50.00',
        },
        {
          account: 'Smile',
          amount: -50,
          date: '2026-02-10',
          time: '',
          category: '@Trip',
          comment: 'Trip\n#bucket:Flight:50.00',
        },
      ];
      const result = await service.setTransactionsForSubscriptions();
      expect(result.transactionsCreated).toBe(0);
    });
  });
});
