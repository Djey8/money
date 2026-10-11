import { MatTableDataSource } from '@angular/material/table';
import { SubscriptionComponent } from './subscription.component';
import { AppStateService } from '../../shared/services/app-state.service';

const sub = (overrides: Record<string, unknown> = {}) => ({
  title: 'x',
  account: 'Daily',
  amount: -10,
  startDate: '2020-01-01',
  endDate: '',
  category: '@a',
  comment: '',
  frequency: 'monthly',
  ...overrides,
});

describe('SubscriptionComponent: sums count each subscription per month', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  it('turns a yearly, quarterly or weekly subscription into what it costs per month', () => {
    expect(SubscriptionComponent.monthlyAmount({ amount: -10 })).toBe(-10);
    expect(SubscriptionComponent.monthlyAmount({ amount: -1200, frequency: 'yearly' })).toBe(-100);
    expect(SubscriptionComponent.monthlyAmount({ amount: -30, frequency: 'quarterly' })).toBe(-10);
    expect(SubscriptionComponent.monthlyAmount({ amount: -12, frequency: 'weekly' })).toBe(-52);
    expect(SubscriptionComponent.monthlyAmount({ amount: -12, frequency: 'biweekly' })).toBe(-26);
  });

  it('sums income, expenses and the cashflow by those monthly amounts', () => {
    SubscriptionComponent.allSubscriptions = [
      sub({ amount: -1200, frequency: 'yearly' }),
      sub({ amount: -30, frequency: 'quarterly' }),
      sub({ amount: -10 }),
      sub({ account: 'Income', amount: 2400, frequency: 'yearly' }),
    ] as any;
    expect(SubscriptionComponent.getDebitAmount()).toBeCloseTo(-120, 2);
    expect(SubscriptionComponent.getCreditAmount()).toBeCloseTo(200, 2);
    expect(SubscriptionComponent.getTotalAmount()).toBeCloseTo(80, 2);
  });

  it('leaves out a subscription that has ended', () => {
    SubscriptionComponent.allSubscriptions = [
      sub({ amount: -10 }),
      sub({ amount: -1200, frequency: 'yearly', endDate: '2021-01-01' }),
    ] as any;
    expect(SubscriptionComponent.getTotalAmount()).toBeCloseTo(-10, 2);
  });
});

describe('SubscriptionComponent: the frequency filter', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  it('keeps every row’s place in the full list, so a click opens that subscription', () => {
    SubscriptionComponent.allSubscriptions = [
      sub({ title: 'Gym', frequency: 'monthly' }),
      sub({ title: 'Rent', frequency: 'monthly' }),
      sub({ title: 'Insurance', frequency: 'yearly' }),
      sub({ title: 'Paper', frequency: 'yearly' }),
    ] as any;
    SubscriptionComponent.activeDataSource = new MatTableDataSource<any>([]);
    SubscriptionComponent.inactiveDataSource = new MatTableDataSource<any>([]);
    const component: SubscriptionComponent = Object.create(SubscriptionComponent.prototype);

    component.frequencyFilter = 'yearly';
    component.applyFrequencyFilter();
    expect(SubscriptionComponent.activeDataSource.data.map((row) => [row.title, row.id])).toEqual([
      ['Insurance', 2],
      ['Paper', 3],
    ]);
    expect(SubscriptionComponent.inactiveDataSource.data.map((row) => row.id)).toEqual([2, 3]);

    component.frequencyFilter = 'all';
    component.applyFrequencyFilter();
    expect(SubscriptionComponent.activeDataSource.data.map((row) => row.id)).toEqual([0, 1, 2, 3]);
  });
});
