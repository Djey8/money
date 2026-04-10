import { InfoShareComponent } from './info-share.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoShareComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoShareComponent.index = 1;
    InfoShareComponent.title = '';
    InfoShareComponent.quantity = 0;
    InfoShareComponent.price = 0;
    InfoShareComponent.isInfo = false;
  });

  it('setInfoShareComponent should set all static fields', () => {
    InfoShareComponent.setInfoShareComponent(2, 'AAPL', 50, 175.5);

    expect(InfoShareComponent.index).toBe(2);
    expect(InfoShareComponent.title).toBe('AAPL');
    expect(InfoShareComponent.quantity).toBe(50);
    expect(InfoShareComponent.price).toBe(175.5);
    expect(InfoShareComponent.isInfo).toBe(true);
  });

  it('setInfoShareComponent should enable isInfo', () => {
    InfoShareComponent.isInfo = false;
    InfoShareComponent.setInfoShareComponent(0, 'TSLA', 10, 200);
    expect(InfoShareComponent.isInfo).toBe(true);
  });
});
