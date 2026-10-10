import { PlanComponent } from './plan.component';
import { AppStateService } from '../../../shared/services/app-state.service';

/** Local YYYY-MM-DD of the first day of the month `monthsAgo` months back. */
function firstOfMonth(monthsAgo: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

const sub = (overrides: Record<string, unknown> = {}) => ({
  title: 'x',
  account: 'Daily',
  amount: -10,
  startDate: firstOfMonth(2),
  endDate: '',
  category: '@Food',
  comment: '',
  frequency: 'monthly',
  ...overrides,
});

describe('PlanComponent: fill the budget from subscriptions', () => {
  let component: any;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allBudgets = [];
    AppStateService.instance.allTransactions = [];
    component = Object.create(PlanComponent.prototype);
    component.updateStorage = jest.fn();
    component.toastService = { show: jest.fn() };
  });

  it('puts each subscription in as what it costs per month, whatever its frequency', () => {
    AppStateService.instance.allSubscriptions = [
      sub({ category: '@Insurance', amount: -1200, frequency: 'yearly' }),
      sub({ category: '@Paper', amount: -30, frequency: 'quarterly' }),
      sub({ category: '@Food', amount: -10 }),
      sub({ category: '@Salary', account: 'Income', amount: 3000 }),
    ] as any;
    component.subscriptions();

    const budgets = AppStateService.instance.allBudgets;
    const months = [firstOfMonth(2), firstOfMonth(1), firstOfMonth(0)].map((d) => d.slice(0, 7));
    for (const month of months) {
      const of = (tag: string) => budgets.find((b) => b.date === month && b.tag === tag)?.amount;
      expect(of('@Insurance')).toBeCloseTo(100, 2);
      expect(of('@Paper')).toBeCloseTo(10, 2);
      expect(of('@Food')).toBeCloseTo(10, 2);
      expect(of('@Salary')).toBeUndefined(); // income is not a budget
    }
    expect(budgets).toHaveLength(3 * 3);
    expect(component.updateStorage).toHaveBeenCalled();
  });

  it('adds subscriptions of the same category together and overwrites an existing row', () => {
    const month = firstOfMonth(0).slice(0, 7);
    AppStateService.instance.allBudgets = [{ date: month, tag: '@Food', amount: 999 }] as any;
    AppStateService.instance.allSubscriptions = [
      sub({ amount: -10, startDate: firstOfMonth(0) }),
      sub({ amount: -120, frequency: 'yearly', startDate: firstOfMonth(0) }),
    ] as any;
    component.subscriptions();
    const rows = AppStateService.instance.allBudgets.filter((b) => b.tag === '@Food');
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBeCloseTo(20, 2);
  });
});
