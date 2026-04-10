import { ChooseComponent } from './choose.component';

describe('ChooseComponent', () => {

  beforeEach(() => {
    ChooseComponent.isChoose = false;
    ChooseComponent.zIndex = 1;
  });

  it('should have correct initial static state', () => {
    expect(ChooseComponent.isChoose).toBe(false);
    expect(ChooseComponent.zIndex).toBe(1);
  });

  it('closeWindow should reset isChoose and zIndex', () => {
    ChooseComponent.isChoose = true;
    ChooseComponent.zIndex = 5;

    const proto = Object.create(ChooseComponent.prototype);
    proto.closeWindow();

    expect(ChooseComponent.isChoose).toBe(false);
    expect(ChooseComponent.zIndex).toBe(0);
  });
});
