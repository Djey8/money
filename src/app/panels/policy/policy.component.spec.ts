import { PolicyComponent } from './policy.component';

describe('PolicyComponent', () => {

  beforeEach(() => {
    PolicyComponent.isInfo = false;
    PolicyComponent.zIndex = 0;
  });

  it('should have correct initial static state', () => {
    expect(PolicyComponent.isInfo).toBe(false);
    expect(PolicyComponent.zIndex).toBe(0);
  });

  it('closeWindow should set isInfo to false', () => {
    PolicyComponent.isInfo = true;
    const proto = Object.create(PolicyComponent.prototype);
    proto.closeWindow();
    expect(PolicyComponent.isInfo).toBe(false);
  });
});
