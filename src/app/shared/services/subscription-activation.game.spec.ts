import { AppStateService } from './app-state.service';
import { SubscriptionActivationService } from './subscription-activation.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

describe('payment plans in a game', () => {
  let service: SubscriptionActivationService;
  const state = () => AppStateService.instance;
  const plan = () =>
    ({
      id: 'p1',
      title: 'Plan',
      status: 'active',
      projectType: 'smile',
      projectTitle: 'Mountain',
      account: 'Daily',
      amount: 100,
      startDate: '2026-11-15',
      endDate: '2027-03-15',
      category: '@Mountain',
      comment: '',
      frequency: 'monthly',
      targetDate: '2027-03-15',
      targetBucketIds: [],
      originalCalculatedAmount: 100,
      manuallyAdjusted: false,
      createdAt: '',
      updatedAt: '',
    }) as any;
  const project = (plans: any[]) =>
    ({
      title: 'Mountain',
      buckets: [{ id: 'b', title: 'B', target: 1000, amount: 400 }],
      plannedSubscriptions: plans,
    }) as any;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    localStorage.clear();
    ProfileComponent.mail = 'player@cashflow.example';
    state().cashflowGame = {
      ...state().cashflowGame,
      professionId: 'x',
      virtualDate: '2026-12-15',
      gameSubscriptionTitles: ['Salary'],
    } as any;
    state().allSubscriptions = [
      {
        title: 'Salary',
        account: 'Income',
        amount: 2000,
        startDate: '2026-01-01',
        endDate: '',
        category: '@Salary',
        comment: '',
        frequency: 'monthly',
      } as any,
      {
        title: 'Plan',
        account: 'Daily',
        amount: -100,
        startDate: '2026-11-15',
        endDate: '2027-03-15',
        category: '@Mountain',
        comment: '',
        frequency: 'monthly',
      } as any,
    ];
    service = new SubscriptionActivationService({ writeAndSync: jest.fn() } as any);
  });

  it('a paused plan ends before the next Payday of the game; started again, it runs for the Paydays it still has', () => {
    const p = plan();
    const proj = project([p]);
    expect(service.deactivatePlannedSubscription(p, proj)).toBe(true);
    expect(state().allSubscriptions[1].endDate).toBe('2026-12-14');
    // 600 are missing at 100 a Payday: six Paydays, from the next one on
    expect(service.reactivatePlannedSubscription(p, proj)).toBe(true);
    expect(state().allSubscriptions[1].startDate).toBe('2026-12-15');
    expect(state().allSubscriptions[1].endDate).toBe('2027-05-15');
    expect(p.startDate).toBe('2026-12-15');
    expect(state().cashflowGame.fundingSubscriptionTitles).toContain('Plan');
  });

  it('a deleted plan takes its subscription with it', () => {
    const p = plan();
    const proj = project([p]);
    expect(service.deletePlannedSubscription('p1', proj)).toBe(true);
    expect(proj.plannedSubscriptions).toHaveLength(0);
    expect(state().allSubscriptions).toHaveLength(1);
  });
});
