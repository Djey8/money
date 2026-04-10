import { InfoInvestmentComponent } from './info-investment.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoInvestmentComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoInvestmentComponent.index = 1;
    InfoInvestmentComponent.title = '';
    InfoInvestmentComponent.deposit = 0;
    InfoInvestmentComponent.amount = 0;
    InfoInvestmentComponent.isInfo = false;
  });

  it('setInfoInvestmentComponent should set all static fields', () => {
    InfoInvestmentComponent.setInfoInvestmentComponent(4, 'Vanguard Fund', 5000, 6200);

    expect(InfoInvestmentComponent.index).toBe(4);
    expect(InfoInvestmentComponent.title).toBe('Vanguard Fund');
    expect(InfoInvestmentComponent.deposit).toBe(5000);
    expect(InfoInvestmentComponent.amount).toBe(6200);
    expect(InfoInvestmentComponent.isInfo).toBe(true);
  });

  it('setInfoInvestmentComponent should enable isInfo', () => {
    InfoInvestmentComponent.isInfo = false;
    InfoInvestmentComponent.setInfoInvestmentComponent(0, 'ETF', 100, 120);
    expect(InfoInvestmentComponent.isInfo).toBe(true);
  });
});
