import { MenuComponent } from './menu.component';

describe('MenuComponent', () => {

  beforeEach(() => {
    MenuComponent.isMenu = false;
    MenuComponent.openStats = false;
    MenuComponent.isStats = false;
    MenuComponent.zIndex = 0;
  });

  it('should have correct initial static state', () => {
    expect(MenuComponent.isMenu).toBe(false);
    expect(MenuComponent.openStats).toBe(false);
    expect(MenuComponent.isStats).toBe(false);
    expect(MenuComponent.zIndex).toBe(0);
  });

  it('closeWindow should reset isMenu, isStats, and zIndex', () => {
    MenuComponent.isMenu = true;
    MenuComponent.isStats = true;
    MenuComponent.zIndex = 5;

    const proto = Object.create(MenuComponent.prototype);
    proto.closeWindow();

    expect(MenuComponent.isMenu).toBe(false);
    expect(MenuComponent.isStats).toBe(false);
    expect(MenuComponent.zIndex).toBe(0);
  });

  it('clickedAccount should navigate and close menu', () => {
    MenuComponent.isMenu = true;
    const mockRouter = { navigate: jest.fn() };
    const proto = Object.create(MenuComponent.prototype);
    (proto as any).router = mockRouter;

    proto.clickedAccount('Daily');

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/daily']);
    expect(MenuComponent.isMenu).toBe(false);
  });
});
