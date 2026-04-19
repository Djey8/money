import { InfoMojoComponent } from './info-mojo.component';
import { AppStateService } from '../../../shared/services/app-state.service';

describe('InfoMojoComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.mojo = { target: 2000, amount: 500 };
    InfoMojoComponent.isInfo = false;
    InfoMojoComponent.isError = false;
    InfoMojoComponent.zIndex = 0;
  });

  it('openMojo should set isInfo to true', () => {
    InfoMojoComponent.openMojo();
    expect(InfoMojoComponent.isInfo).toBe(true);
  });

  it('openMojo should keep existing mojo data unchanged', () => {
    AppStateService.instance.mojo = { target: 5000, amount: 1200 };
    InfoMojoComponent.openMojo();
    expect(AppStateService.instance.mojo.target).toBe(5000);
    expect(AppStateService.instance.mojo.amount).toBe(1200);
  });
});
