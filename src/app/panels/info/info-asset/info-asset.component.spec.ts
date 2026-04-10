import { InfoAssetComponent } from './info-asset.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoAssetComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoAssetComponent.index = 1;
    InfoAssetComponent.title = '';
    InfoAssetComponent.amount = 0;
    InfoAssetComponent.isInfo = false;
  });

  it('setInfoAssetComponent should set all static fields', () => {
    InfoAssetComponent.setInfoAssetComponent(3, 'House', 250000);

    expect(InfoAssetComponent.index).toBe(3);
    expect(InfoAssetComponent.title).toBe('House');
    expect(InfoAssetComponent.amount).toBe(250000);
    expect(InfoAssetComponent.isInfo).toBe(true);
  });

  it('setInfoAssetComponent should enable isInfo', () => {
    InfoAssetComponent.isInfo = false;
    InfoAssetComponent.setInfoAssetComponent(0, 'Car', 15000);
    expect(InfoAssetComponent.isInfo).toBe(true);
  });
});
