import { FireComponent } from './fire.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('FireComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  it('should have allowedAccounts of Fire and Income', () => {
    expect(FireComponent.allowedAccounts).toEqual(['Fire', 'Income']);
  });

  it('should expose mojo from AppStateService', () => {
    AppStateService.instance.mojo = { amount: 500, target: 2000 };
    expect(FireComponent.mojo).toEqual({ amount: 500, target: 2000 });
  });

  it('should compute fire amount from AppStateService', () => {
    AppStateService.instance.fire = 20;
    AppStateService.instance.allTransactions = [
      { account: 'Income', amount: 1000, category: 'Salary', date: '2024-01-01', comment: '' },
      { account: 'Fire', amount: -100, category: '@Emergency', date: '2024-01-10', comment: '' },
    ] as any;

    const result = AppStateService.instance.getAmount('Fire', AppStateService.instance.fire / 100);
    // Income: round((1000 * 0.2 + eps) * 100) / 100 = 200, Fire: -100, total = 100
    expect(result).toBe(100);
  });
});
