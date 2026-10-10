import { InfoSubscriptionComponent } from './info-subscription.component';
import { SubscriptionProcessingService } from '../../../shared/services/subscription-processing.service';
import { AppStateService } from '../../../shared/services/app-state.service';
import { subscriptionOccurrenceDates } from '@money/domain';

/** Local YYYY-MM-DD of a day `months` months before the first of this month, `day` of that month. */
function dayInMonth(monthsAgo: number, day: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

describe('InfoSubscriptionComponent: editing a subscription keeps its transactions in line', () => {
  const start = dayInMonth(3, 1);
  let component: any;
  let regenerate: jest.Mock;
  let storage: jest.Mock;
  let toast: { show: jest.Mock };
  let recalculate: jest.Mock;

  const gym = () => ({
    title: 'Gym',
    account: 'Daily',
    amount: -20,
    startDate: start,
    endDate: '',
    category: '@Fitness',
    comment: '',
    frequency: 'monthly' as const,
  });

  /** The transactions a monthly gym subscription has generated up to today. */
  const generated = () =>
    subscriptionOccurrenceDates(
      {
        title: 'Gym',
        account: 'Daily',
        amountMinor: -2000,
        startDate: start,
        endDate: null,
        category: '@Fitness',
        comment: '',
        frequency: 'monthly',
      },
      new Date(),
    ).map((date) => ({
      account: 'Daily',
      amount: -20,
      date,
      time: '',
      category: '@Fitness',
      comment: 'Gym',
    }));

  const dates = () => AppStateService.instance.allTransactions.map((t) => t.date);

  beforeEach(async () => {
    // AppComponent.gotoTop() scrolls the window, which jsdom does not implement
    jest.spyOn(window, 'scroll').mockImplementation(() => undefined);
    // the panel loads its neighbours after module init: give that a moment
    await new Promise((resolve) => setTimeout(resolve, 200));
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allSubscriptions = [gym()];
    AppStateService.instance.allTransactions = generated();

    const processing = new SubscriptionProcessingService(
      { checkAuthentication: jest.fn() } as any,
      { logActivity: jest.fn(), logError: jest.fn() } as any,
    );
    regenerate = jest.fn().mockResolvedValue({ transactionsCreated: 0, subscriptionsProcessed: 1 });
    processing.setTransactionsForSubscriptions = regenerate;

    storage = jest.fn().mockResolvedValue(true);
    toast = { show: jest.fn() };
    recalculate = jest.fn();

    component = Object.create(InfoSubscriptionComponent.prototype);
    component.subscriptionProcessing = processing;
    component.incomeStatement = { recalculate };
    component.frontendLogger = { logActivity: jest.fn() };
    component.toastService = toast;
    component.updateStorage = storage;
    component.showError = jest.fn();
    component.clearError = jest.fn();

    InfoSubscriptionComponent.index = 0;
    InfoSubscriptionComponent.isRefresh = false;
    component.selectedOption = 'Daily';
    component.titleTextField = 'Gym';
    component.amountTextField = -20;
    component.startDateTextField = start;
    component.endDateTextField = '';
    component.categoryTextField = '@Fitness';
    component.commentTextField = '';
    component.frequencyField = 'monthly';
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps every transaction when nothing that matters changed, and stores the change', async () => {
    const before = dates();
    await component.updateSubscription();
    expect(dates()).toEqual(before);
    expect(recalculate).not.toHaveBeenCalled();
    expect(storage).toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('Subscription updated', 'update');
  });

  it('removes the transactions after an end date moved into the past', async () => {
    const kept = generated().filter((t) => t.date <= dayInMonth(2, 15));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(generated().length);
    component.endDateTextField = dayInMonth(2, 15);
    await component.updateSubscription();
    expect(dates()).toEqual(kept.map((t) => t.date));
    expect(recalculate).toHaveBeenCalled();
    expect(AppStateService.instance.allSubscriptions[0].endDate).toBe(dayInMonth(2, 15));
  });

  it('removes all of them and generates the new ones when the amount changes', async () => {
    component.amountTextField = -25;
    await component.updateSubscription();
    expect(dates()).toEqual([]);
    expect(recalculate).toHaveBeenCalled();
    expect(regenerate).toHaveBeenCalled();
    expect(AppStateService.instance.allSubscriptions[0].amount).toBe(-25);
  });

  it('keeps a hand-made transaction that merely looks like a generated one', async () => {
    AppStateService.instance.allTransactions.push({
      account: 'Daily',
      amount: -20,
      date: dayInMonth(1, 3),
      time: '',
      category: '@Fitness',
      comment: 'Gym day pass',
    });
    component.amountTextField = -25;
    await component.updateSubscription();
    expect(AppStateService.instance.allTransactions.map((t) => t.comment)).toEqual([
      'Gym day pass',
    ]);
  });

  it('removes everything it generated first when the "delete transactions" box is ticked, then clears the box', async () => {
    InfoSubscriptionComponent.isRefresh = true;
    await component.updateSubscription();
    expect(dates()).toEqual([]);
    expect(regenerate).toHaveBeenCalled();
    expect(InfoSubscriptionComponent.isRefresh).toBe(false);
  });

  it('does not claim success when the data could not be stored', async () => {
    storage.mockResolvedValue(false);
    component.endDateTextField = dayInMonth(2, 15);
    await component.updateSubscription();
    expect(toast.show).not.toHaveBeenCalledWith('Subscription updated', 'update');
    expect(toast.show).toHaveBeenCalledWith(expect.stringContaining('could not be saved'), 'error');
  });

  it('refuses an incomplete form without touching anything', async () => {
    component.amountTextField = 0;
    await component.updateSubscription();
    expect(component.showError).toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(AppStateService.instance.allSubscriptions[0].amount).toBe(-20);
  });
});
