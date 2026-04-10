import { InfoPropertiesComponent } from './info-properties.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoPropertiesComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoPropertiesComponent.index = 1;
    InfoPropertiesComponent.title = '';
    InfoPropertiesComponent.amount = 0;
    InfoPropertiesComponent.isInfo = false;
  });

  it('setInfoPropertiesComponent should set all static fields', () => {
    InfoPropertiesComponent.setInfoPropertiesComponent(5, 'Rental Income', 1800);

    expect(InfoPropertiesComponent.index).toBe(5);
    expect(InfoPropertiesComponent.title).toBe('Rental Income');
    expect(InfoPropertiesComponent.amount).toBe(1800);
    expect(InfoPropertiesComponent.isInfo).toBe(true);
  });

  it('setInfoPropertiesComponent should enable isInfo', () => {
    InfoPropertiesComponent.isInfo = false;
    InfoPropertiesComponent.setInfoPropertiesComponent(0, 'Dividend', 100);
    expect(InfoPropertiesComponent.isInfo).toBe(true);
  });
});
