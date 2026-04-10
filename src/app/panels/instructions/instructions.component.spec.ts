import { InstructionsComponent } from './instructions.component';

describe('InstructionsComponent', () => {

  beforeEach(() => {
    InstructionsComponent.isInfo = false;
    InstructionsComponent.zIndex = 0;
    InstructionsComponent.activeCategory = null;
  });

  it('should have correct initial static state', () => {
    expect(InstructionsComponent.isInfo).toBe(false);
    expect(InstructionsComponent.zIndex).toBe(0);
    expect(InstructionsComponent.activeCategory).toBeNull();
  });

  it('closeWindow should set isInfo to false and activeCategory to null', () => {
    InstructionsComponent.isInfo = true;
    InstructionsComponent.activeCategory = 'budgeting';
    const proto = Object.create(InstructionsComponent.prototype);
    proto.closeWindow();
    expect(InstructionsComponent.isInfo).toBe(false);
    expect(InstructionsComponent.activeCategory).toBeNull();
  });
});
