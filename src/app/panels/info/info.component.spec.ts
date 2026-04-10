import { InfoComponent } from './info.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('InfoComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoComponent.index = 1;
    InfoComponent.img = 'smile';
    InfoComponent.account = 'Smile';
    InfoComponent.amount = 145.3;
    InfoComponent.date = '2023-07-07';
    InfoComponent.time = '10:04';
    InfoComponent.category = 'car';
    InfoComponent.comment = 'petrol';
    InfoComponent.isInfo = false;
  });

  it('setInfoComponent should set all static fields', () => {
    InfoComponent.setInfoComponent(3, 'Daily', 50.5, '2024-01-15', '14:30', 'food', 'lunch');

    expect(InfoComponent.index).toBe(3);
    expect(InfoComponent.img).toBe('daily');
    expect(InfoComponent.account).toBe('Daily');
    expect(InfoComponent.amount).toBe(50.5);
    expect(InfoComponent.date).toBe('2024-01-15');
    expect(InfoComponent.time).toBe('14:30');
    expect(InfoComponent.category).toBe('food');
    expect(InfoComponent.comment).toBe('lunch');
    expect(InfoComponent.isInfo).toBe(true);
  });

  it('setInfoComponent should derive img from lowercase account', () => {
    InfoComponent.setInfoComponent(0, 'Fire', 100, '2024-01-01', '09:00', 'gas', '');
    expect(InfoComponent.img).toBe('fire');
  });
});
