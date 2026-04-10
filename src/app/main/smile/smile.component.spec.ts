import { SmileComponent } from './smile.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('SmileComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  it('should have allowedAccounts of Smile and Income', () => {
    expect(SmileComponent.allowedAccounts).toEqual(['Smile', 'Income']);
  });

  it('should compute smile amount from AppStateService', () => {
    AppStateService.instance.smile = 10;
    AppStateService.instance.allTransactions = [
      { account: 'Income', amount: 2000, category: 'Salary', date: '2024-01-01', comment: '' },
      { account: 'Smile', amount: -75, category: '@Vacation', date: '2024-01-10', comment: '' },
    ] as any;

    const result = AppStateService.instance.getAmount('Smile', AppStateService.instance.smile / 100);
    // Income: round((2000 * 0.1 + eps) * 100) / 100 = 200, Smile: -75, total = 125
    expect(result).toBe(125);
  });
});
