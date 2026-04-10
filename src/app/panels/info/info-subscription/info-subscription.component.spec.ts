import { InfoSubscriptionComponent } from './info-subscription.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoSubscriptionComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoSubscriptionComponent.index = 1;
    InfoSubscriptionComponent.title = 'Spotify';
    InfoSubscriptionComponent.img = 'daily';
    InfoSubscriptionComponent.account = 'Daily';
    InfoSubscriptionComponent.amount = -5.99;
    InfoSubscriptionComponent.startDate = '2024-09-01';
    InfoSubscriptionComponent.endDate = '';
    InfoSubscriptionComponent.category = 'entertainment';
    InfoSubscriptionComponent.comment = '';
    InfoSubscriptionComponent.isRefresh = false;
    InfoSubscriptionComponent.isInfo = false;
  });

  it('setInfoSubscriptionComponent should set all static fields', () => {
    InfoSubscriptionComponent.setInfoSubscriptionComponent(5, 'Netflix', 'Splurge', -12.99, '2024-01-01', '2025-01-01', 'media', 'streaming', 'monthly');

    expect(InfoSubscriptionComponent.index).toBe(5);
    expect(InfoSubscriptionComponent.title).toBe('Netflix');
    expect(InfoSubscriptionComponent.img).toBe('splurge');
    expect(InfoSubscriptionComponent.account).toBe('Splurge');
    expect(InfoSubscriptionComponent.amount).toBe(-12.99);
    expect(InfoSubscriptionComponent.startDate).toBe('2024-01-01');
    expect(InfoSubscriptionComponent.endDate).toBe('2025-01-01');
    expect(InfoSubscriptionComponent.category).toBe('media');
    expect(InfoSubscriptionComponent.comment).toBe('streaming');
    expect(InfoSubscriptionComponent.frequency).toBe('monthly');
    expect(InfoSubscriptionComponent.isInfo).toBe(true);
  });

  it('setInfoSubscriptionComponent should derive img from lowercase account', () => {
    InfoSubscriptionComponent.setInfoSubscriptionComponent(0, 'Test', 'Fire', -1, '2024-01-01', '', 'cat', '', 'weekly');
    expect(InfoSubscriptionComponent.img).toBe('fire');
  });
});
