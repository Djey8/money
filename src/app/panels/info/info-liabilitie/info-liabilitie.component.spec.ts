import { InfoLiabilitieComponent } from './info-liabilitie.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoLiabilitieComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoLiabilitieComponent.index = 1;
    InfoLiabilitieComponent.title = '';
    InfoLiabilitieComponent.amount = 0;
    InfoLiabilitieComponent.credit = 0;
    InfoLiabilitieComponent.isInvestment = false;
    InfoLiabilitieComponent.isInfo = false;
  });

  it('setInfoLiabilitieComponent should set all static fields', () => {
    InfoLiabilitieComponent.setInfoLiabilitieComponent(2, 'Mortgage', 200000, 1500, true);

    expect(InfoLiabilitieComponent.index).toBe(2);
    expect(InfoLiabilitieComponent.title).toBe('Mortgage');
    expect(InfoLiabilitieComponent.amount).toBe(200000);
    expect(InfoLiabilitieComponent.credit).toBe(1500);
    expect(InfoLiabilitieComponent.isInvestment).toBe(true);
    expect(InfoLiabilitieComponent.isInfo).toBe(true);
  });

  it('setInfoLiabilitieComponent with isInvestment false', () => {
    InfoLiabilitieComponent.setInfoLiabilitieComponent(0, 'Car Loan', 15000, 300, false);
    expect(InfoLiabilitieComponent.isInvestment).toBe(false);
    expect(InfoLiabilitieComponent.isInfo).toBe(true);
  });
});
