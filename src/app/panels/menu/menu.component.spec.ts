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

  describe('gameMenuEntries', () => {
    const menu = (isGame: boolean, config: unknown[], lang = 'en') => {
      const proto = Object.create(MenuComponent.prototype);
      proto.isCashflowGame = () => isGame;
      proto.router = { config, navigate: jest.fn() };
      proto.translate = { currentLang: lang };
      return proto;
    };
    const route = {
      path: 'tables',
      data: { gameMenu: { icon: '👥', label: (lang: string) => `label-${lang}` } },
    };

    it('lists what the route table brings, in the app language, for a game account', () => {
      expect(menu(true, [{ path: 'daily' }, route], 'de').gameMenuEntries()).toEqual([
        { path: '/tables', icon: '👥', label: 'label-de' },
      ]);
    });

    it('is empty for a normal account, and where the route table brings nothing (Firebase)', () => {
      expect(menu(false, [route]).gameMenuEntries()).toEqual([]);
      expect(menu(true, [{ path: 'daily' }]).gameMenuEntries()).toEqual([]);
    });

    it('clicking an entry goes there and closes the menu', () => {
      const m = menu(true, [route]);
      MenuComponent.isMenu = true;
      m.clickedGameMenuEntry('/tables');
      expect(m.router.navigate).toHaveBeenCalledWith(['/tables']);
      expect(MenuComponent.isMenu).toBe(false);
    });
  });
});
