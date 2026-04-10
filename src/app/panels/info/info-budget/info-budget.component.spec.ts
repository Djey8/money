import { InfoBudgetComponent } from './info-budget.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoBudgetComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoBudgetComponent.index = 1;
    InfoBudgetComponent.date = '2025-10';
    InfoBudgetComponent.tag = 'car';
    InfoBudgetComponent.amount = 145.3;
    InfoBudgetComponent.isInfo = false;
  });

  it('setInfoComponent should set all static fields', () => {
    InfoBudgetComponent.setInfoComponent(5, '2025-03', 'food', 200);

    expect(InfoBudgetComponent.index).toBe(5);
    expect(InfoBudgetComponent.date).toBe('2025-03');
    expect(InfoBudgetComponent.tag).toBe('food');
    expect(InfoBudgetComponent.amount).toBe(200);
    expect(InfoBudgetComponent.isInfo).toBe(true);
  });

  it('getDate should parse YYYY-MM into localized month/year', () => {
    const proto = Object.create(InfoBudgetComponent.prototype);
    proto.dateTextField = '2025-03';
    const result = proto.getDate();
    // Should contain "2025" and a month name
    expect(result).toContain('2025');
  });

  it('getDate should handle December correctly', () => {
    const proto = Object.create(InfoBudgetComponent.prototype);
    proto.dateTextField = '2024-12';
    const result = proto.getDate();
    expect(result).toContain('2024');
  });

  it('selectedCategory should sum previous month amounts for a category', () => {
    AppStateService.instance.allTransactions = [
      { account: 'Daily', amount: -50, category: 'food', date: '2025-02-10', time: '', comment: '' },
      { account: 'Daily', amount: -30, category: 'food', date: '2025-02-20', time: '', comment: '' },
      { account: 'Daily', amount: -20, category: 'transport', date: '2025-02-15', time: '', comment: '' },
      { account: 'Daily', amount: -10, category: 'food', date: '2025-03-01', time: '', comment: '' },
    ];

    const proto = Object.create(InfoBudgetComponent.prototype);
    proto.dateTextField = '2025-03';
    proto.categoryTextField = 'food';
    proto.amountTextField = 0;

    proto.selectedCategory();

    // Sum of food in Feb (previous month of March): abs(-50 + -30) = 80
    expect(proto.amountTextField).toBe(80);
  });

  it('selectedCategory should handle year wrap (January looks at December)', () => {
    AppStateService.instance.allTransactions = [
      { account: 'Daily', amount: -100, category: 'rent', date: '2024-12-01', time: '', comment: '' },
    ];

    const proto = Object.create(InfoBudgetComponent.prototype);
    proto.dateTextField = '2025-01';
    proto.categoryTextField = 'rent';
    proto.amountTextField = 0;

    proto.selectedCategory();

    expect(proto.amountTextField).toBe(100);
  });
});
