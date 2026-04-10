import { InfoInterestsComponent } from './info-interests.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoInterestsComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoInterestsComponent.index = 1;
    InfoInterestsComponent.title = '';
    InfoInterestsComponent.amount = 0;
    InfoInterestsComponent.isInfo = false;
  });

  it('setInfoInterestsComponent should set all static fields', () => {
    InfoInterestsComponent.setInfoInterestsComponent(3, 'Savings Interest', 250);

    expect(InfoInterestsComponent.index).toBe(3);
    expect(InfoInterestsComponent.title).toBe('Savings Interest');
    expect(InfoInterestsComponent.amount).toBe(250);
    expect(InfoInterestsComponent.isInfo).toBe(true);
  });

  it('setInfoInterestsComponent should enable isInfo', () => {
    InfoInterestsComponent.isInfo = false;
    InfoInterestsComponent.setInfoInterestsComponent(0, 'Bond', 50);
    expect(InfoInterestsComponent.isInfo).toBe(true);
  });
});
