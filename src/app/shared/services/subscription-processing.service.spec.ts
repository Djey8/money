import { SubscriptionProcessingService } from './subscription-processing.service';
import { AppStateService } from './app-state.service';
import { ProfileComponent } from '../../panels/profile/profile.component';
import { AppDataService } from './app-data.service';

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

  describe('generating a subscription with a location', () => {
    it('books every generated transaction at the location and moves its balance', async () => {
      ProfileComponent.mail = 'jfk@example.com';
      (AppDataService as any).instance = { updateDatabase: jest.fn() };
      AppStateService.instance.allLocations = [{ id: 'loc_bank', name: 'Bank', amount: 1000 }];
      AppStateService.instance.allSubscriptions = [
        {
          title: 'Rent',
          account: 'Daily',
          amount: -100,
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          category: '@Rent',
          comment: '',
          frequency: 'monthly',
          locationId: 'loc_bank',
        },
      ];

      const result = await service.setTransactionsForSubscriptions();

      expect(result.transactionsCreated).toBe(3);
      const transactions = AppStateService.instance.allTransactions;
      expect(transactions.every((t) => t.locationId === 'loc_bank')).toBe(true);
      expect(AppStateService.instance.allLocations[0].amount).toBe(700);
      // running it again generates nothing and moves nothing
      expect((await service.setTransactionsForSubscriptions()).transactionsCreated).toBe(0);
      expect(AppStateService.instance.allLocations[0].amount).toBe(700);
    });
  });

  describe('generating a subscription with a split rule', () => {
    it('books 80 / 20 on every generated transaction and moves both balances', async () => {
      ProfileComponent.mail = 'jfk@example.com';
      (AppDataService as any).instance = { updateDatabase: jest.fn() };
      AppStateService.instance.allLocations = [
        { id: 'loc_main', name: 'N26', subName: 'Main', amount: 0 },
        { id: 'loc_sav', name: 'N26', subName: 'Instant Savings', amount: 0 },
      ];
      AppStateService.instance.allSubscriptions = [
        {
          title: 'Salary',
          account: 'Income',
          amount: 3000,
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          category: '@Salary',
          comment: '',
          frequency: 'monthly',
          locationId: 'loc_main',
          locationSplit: [{ locationId: 'loc_sav', percent: 20 }],
        },
      ];

      const result = await service.setTransactionsForSubscriptions();

      expect(result.transactionsCreated).toBe(3);
      for (const t of AppStateService.instance.allTransactions) {
        expect(t.locationId).toBe('loc_main');
        expect(t.locationSplits).toEqual([{ locationId: 'loc_sav', amount: 600 }]);
      }
      expect(AppStateService.instance.allLocations.map((l) => l.amount)).toEqual([7200, 1800]);
    });
  });

  describe('reconcileGeneratedTransactions', () => {
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

    it('removes only the transactions after an end date moved into the past', () => {
      const result = service.reconcileGeneratedTransactions(
        gym,
        { ...gym, endDate: '2026-02-20' },
        NOW,
      );
      expect(result).toEqual({ updated: 0, removed: 2 });
      expect(dates()).toEqual(['2026-01-10', '2026-02-10', '2026-02-11']);
    });

    it('changes the transactions in place when the details change, keeping their objects and order', () => {
      const first = AppStateService.instance.allTransactions[0];
      const result = service.reconcileGeneratedTransactions(
        gym,
        { ...gym, amount: -25, category: '@Sport', comment: 'sauna' },
        NOW,
      );
      expect(result).toEqual({ updated: 4, removed: 0 });
      expect(AppStateService.instance.allTransactions[0]).toBe(first);
      expect(first).toMatchObject({ amount: -25, category: '@Sport', comment: 'Gym + sauna' });
      expect(dates()).toEqual([
        '2026-01-10',
        '2026-02-10',
        '2026-03-10',
        '2026-04-10',
        '2026-02-11',
      ]);
    });

    it('moves the date of the same month when the day changes and drops the one that no longer counts', () => {
      const result = service.reconcileGeneratedTransactions(
        gym,
        { ...gym, startDate: '2026-01-20' },
        NOW,
      );
      expect(result).toEqual({ updated: 3, removed: 1 });
      expect(dates()).toEqual(['2026-01-20', '2026-02-20', '2026-03-20', '2026-02-11']);
    });

    describe('locations', () => {
      const bank = () => ({ id: 'loc_bank', name: 'Bank', amount: 100 });
      const cash = () => ({ id: 'loc_cash', name: 'Cash', amount: 50 });
      const at = (date: string, locationId?: string) => ({
        ...generated(date),
        ...(locationId ? { locationId } : {}),
      });
      const balances = () => AppStateService.instance.allLocations.map((l) => l.amount);

      beforeEach(() => {
        AppStateService.instance.allLocations = [bank(), cash()];
        AppStateService.instance.allTransactions = [
          at('2026-01-10', 'loc_bank'),
          at('2026-02-10', 'loc_bank'),
          at('2026-03-10', 'loc_bank'),
          at('2026-04-10', 'loc_bank'),
        ];
      });

      it('changing the subscription location does not touch the transactions already booked', () => {
        const result = service.reconcileGeneratedTransactions(
          { ...gym, locationId: 'loc_bank' },
          { ...gym, locationId: 'loc_cash' },
          NOW,
        );
        expect(result).toEqual({ updated: 0, removed: 0 });
        expect(
          AppStateService.instance.allTransactions.every((t) => t.locationId === 'loc_bank'),
        ).toBe(true);
        expect(balances()).toEqual([100, 50]);
      });

      it('changing the amount keeps each transaction at its location and adjusts that balance', () => {
        AppStateService.instance.allTransactions[1] = at('2026-02-10', 'loc_cash');
        service.reconcileGeneratedTransactions(
          { ...gym, locationId: 'loc_bank' },
          { ...gym, amount: -25, locationId: 'loc_cash' },
          NOW,
        );
        expect(AppStateService.instance.allTransactions.map((t) => t.locationId)).toEqual([
          'loc_bank',
          'loc_cash',
          'loc_bank',
          'loc_bank',
        ]);
        // bank: 3 bookings now 5 more each, cash: 1 booking 5 more
        expect(balances()).toEqual([85, 45]);
      });

      it('removing the generated transactions gives their amounts back to where they were booked', () => {
        AppStateService.instance.allTransactions[0] = at('2026-01-10', 'loc_cash');
        const result = service.reconcileGeneratedTransactions(
          { ...gym, locationId: 'loc_bank' },
          null,
          NOW,
        );
        expect(result.removed).toBe(4);
        expect(balances()).toEqual([160, 70]);
      });

      it('removing only the part after a new end date gives back just that part', () => {
        service.reconcileGeneratedTransactions(
          { ...gym, locationId: 'loc_bank' },
          { ...gym, endDate: '2026-02-20', locationId: 'loc_bank' },
          NOW,
        );
        expect(balances()).toEqual([140, 50]);
      });
    });

    it('does nothing when only the end date moves later', () => {
      AppStateService.instance.allTransactions = [generated('2026-01-10')];
      expect(
        service.reconcileGeneratedTransactions(
          { ...gym, endDate: '2026-02-20' },
          { ...gym, endDate: '2026-12-31' },
          NOW,
        ),
      ).toEqual({ updated: 0, removed: 0 });
    });

    it('removes everything it generated when the subscription goes', () => {
      expect(service.reconcileGeneratedTransactions(gym, null, NOW)).toEqual({
        updated: 0,
        removed: 4,
      });
      expect(dates()).toEqual(['2026-02-11']);
    });

    it('recognises a Smile transaction that carries bucket tags after its comment', () => {
      AppStateService.instance.allTransactions = [
        generated('2026-01-10', 'Gym\n#bucket:Flight:20.00'),
      ];
      expect(service.reconcileGeneratedTransactions(gym, null, NOW).removed).toBe(1);
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
