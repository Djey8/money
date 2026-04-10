import { ProfileComponent } from './profile.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('ProfileComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    ProfileComponent.zIndex = 0;
    ProfileComponent.isProfile = false;
    ProfileComponent.isUser = false;
    ProfileComponent.isImport = false;
    ProfileComponent.username = '';
    ProfileComponent.mail = '';
  });

  it('should have static defaults after reset', () => {
    expect(ProfileComponent.isProfile).toBe(false);
    expect(ProfileComponent.isImport).toBe(false);
    expect(ProfileComponent.zIndex).toBe(0);
  });

  it('should store and retrieve static username', () => {
    ProfileComponent.username = 'TestUser';
    expect(ProfileComponent.username).toBe('TestUser');
  });

  it('should store and retrieve static mail', () => {
    ProfileComponent.mail = 'test@example.com';
    expect(ProfileComponent.mail).toBe('test@example.com');
  });

  it('should track isUser flag for login state', () => {
    ProfileComponent.isUser = true;
    expect(ProfileComponent.isUser).toBe(true);
    ProfileComponent.isUser = false;
    expect(ProfileComponent.isUser).toBe(false);
  });
});
