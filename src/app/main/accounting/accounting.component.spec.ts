import { AccountingComponent } from './accounting.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('AccountingComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  it('should have expected available accounts', () => {
    expect(AccountingComponent.availableAccounts).toEqual([
      'Income',
      'Daily',
      'Splurge',
      'Smile',
      'Fire',
      'Mojo',
    ]);
  });
});
