import { DemoService } from './demo.service';
import { environment } from '../../../environments/environment';
import { ProfileComponent } from '../../panels/profile/profile.component';

describe('DemoService - the Demo button of a game account', () => {
  const original = ProfileComponent.mail;
  beforeEach(() => jest.replaceProperty(environment, 'mode', 'selfhosted'));
  afterEach(() => {
    jest.restoreAllMocks();
    ProfileComponent.mail = original;
    sessionStorage.clear();
  });

  it('starts the guided Dreamer demo for a signed-in game account', () => {
    ProfileComponent.mail = 'anna.cashflow@example.com';
    const router = { navigate: jest.fn().mockResolvedValue(true) };
    new DemoService(router as never, {} as never).startDemo();
    expect(router.navigate).toHaveBeenCalledWith(['/tables'], {
      queryParams: { game: 'dreamfund', demo: 'start' },
    });
    expect(sessionStorage.getItem('demo_mode')).toBeNull();
  });

  it('starts the normal demo for a normal account or nobody', () => {
    ProfileComponent.mail = 'anna@example.com';
    const router = { navigate: jest.fn().mockResolvedValue(true) };
    new DemoService(
      router as never,
      { saveData: jest.fn(), getData: jest.fn() } as never,
    ).startDemo();
    expect(sessionStorage.getItem('demo_mode')).toBe('true');
    expect(router.navigate).not.toHaveBeenCalledWith(['/tables'], expect.anything());
  });
});
