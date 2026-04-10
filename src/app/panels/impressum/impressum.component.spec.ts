import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {

  beforeEach(() => {
    ImpressumComponent.isInfo = false;
    ImpressumComponent.zIndex = 0;
  });

  it('should have correct initial static state', () => {
    expect(ImpressumComponent.isInfo).toBe(false);
    expect(ImpressumComponent.zIndex).toBe(0);
  });

  it('closeWindow should set isInfo to false', () => {
    ImpressumComponent.isInfo = true;
    const proto = Object.create(ImpressumComponent.prototype);
    proto.closeWindow();
    expect(ImpressumComponent.isInfo).toBe(false);
  });
});
