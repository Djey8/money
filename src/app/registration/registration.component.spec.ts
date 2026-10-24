import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationComponent } from './registration.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../shared/services/database.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { LocalService } from '../shared/services/local.service';
import { CrypticService } from '../shared/services/cryptic.service';
import { AppStateService } from '../shared/services/app-state.service';
import { defer, of, throwError } from 'rxjs';

describe('RegistrationComponent', () => {
  let component: RegistrationComponent;
  let fixture: ComponentFixture<RegistrationComponent>;
  let mockLocalService: jest.Mocked<Partial<LocalService>>;
  let mockCrypticService: jest.Mocked<Partial<CrypticService>>;

  beforeEach(async () => {
    // Reset AppStateService singleton
    (AppStateService as any)._instance = undefined;

    mockLocalService = {
      removeData: jest.fn(),
      saveData: jest.fn(),
      getData: jest.fn().mockReturnValue(''),
    };
    mockCrypticService = {
      updateConfig: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        RegistrationComponent,
        TranslateModule.forRoot(),
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        // the sign-in service of Firebase is not needed here (and would load its modules in the background)
        { provide: AngularFireAuth, useValue: { authState: of(null) } },
        { provide: LocalService, useValue: mockLocalService },
        { provide: CrypticService, useValue: mockCrypticService },
        {
          provide: FIREBASE_OPTIONS,
          useValue: { projectId: 'test', appId: 'test', apiKey: 'test' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('constructor — clears local storage', () => {
    it('should remove transactions, smile, fire, mojo, username, uid, email from storage', () => {
      expect(mockLocalService.removeData).toHaveBeenCalledWith('transactions');
      expect(mockLocalService.removeData).toHaveBeenCalledWith('smile');
      expect(mockLocalService.removeData).toHaveBeenCalledWith('fire');
      expect(mockLocalService.removeData).toHaveBeenCalledWith('mojo');
      expect(mockLocalService.removeData).toHaveBeenCalledWith('username');
      expect(mockLocalService.removeData).toHaveBeenCalledWith('uid');
      expect(mockLocalService.removeData).toHaveBeenCalledWith('email');
    });

    it('should reset AppStateService arrays', () => {
      expect(AppStateService.instance.allTransactions).toEqual([]);
      expect(AppStateService.instance.allSmileProjects).toEqual([]);
    });
  });

  describe('initial state', () => {
    it('should default isRegister to false', () => {
      expect(component.isRegister).toBe(false);
    });

    it('should default isError to false', () => {
      expect(component.isError).toBe(false);
    });

    it('should have empty text fields', () => {
      expect(component.usernameTextField).toBe('');
      expect(component.emailTextField).toBe('');
      expect(component.passwordTextField).toBe('');
    });

    it('should default isUploaded to false', () => {
      expect(component.isUploaded).toBe(false);
    });
  });

  describe('game password for a Cashflow game account (self-hosted only)', () => {
    const fill = (email: string) => {
      component.usernameTextField = 'Anna';
      component.emailTextField = email;
      component.passwordTextField = 'StrongPass1';
    };

    it('is asked for only on the self-hosted server and only for a "cashflow" email', () => {
      fill('anna.cashflow@example.com');
      (component as any).mode = 'firebase';
      expect(component.needsGamePassword).toBe(false);

      (component as any).mode = 'selfhosted';
      expect(component.needsGamePassword).toBe(true);

      fill('anna@example.com');
      expect(component.needsGamePassword).toBe(false);
    });

    it('does not register a game account without it', () => {
      (component as any).mode = 'selfhosted';
      fill('Anna.CashFlow@example.com');
      const signUp = jest.spyOn(component, 'SignUp').mockImplementation();

      component.register();

      expect(component.isError).toBe(true);
      expect(component.errorMessageLable).toBe('A game account needs the game password');
      expect(signUp).not.toHaveBeenCalled();
    });

    it('registers once it is filled in', () => {
      (component as any).mode = 'selfhosted';
      fill('anna.cashflow@example.com');
      component.gamePasswordTextField = 'this too shall pass';
      const signUp = jest.spyOn(component, 'SignUp').mockImplementation();

      component.register();

      expect(component.isError).toBe(false);
      expect(signUp).toHaveBeenCalled();
    });

    it('the first data of a new account never fails the registration: a failing write is tried again, then skipped, and the account is signed in', () => {
      AppStateService.instance.lastUpdatedAt = '2020-01-01T00:00:00.000Z'; // the version of another account
      component.retryDelayMs = 0;
      jest.spyOn(console, 'warn').mockImplementation(); // each skipped write is told in the console
      let tries = 0;
      const writes = [
        { tag: 'info/username', data: 'Anna' },
        { tag: 'transactions', data: [] },
        { tag: 'mojo', data: {} },
      ];
      const done = jest.fn();
      component.layDownFirstData(writes, done, (tag) =>
        defer(() => {
          tries += 1;
          // the second write works on its third try, the others never do
          return tag === 'transactions' && tries >= 5
            ? of({ success: true })
            : throwError(() => new Error('stale'));
        }),
      );
      expect(done).toHaveBeenCalledTimes(1);
      expect(AppStateService.instance.lastUpdatedAt).toBeNull();
      expect(tries).toBeGreaterThanOrEqual(7);
      expect(component.isError).toBe(false);
    });

    it('sends it to the server with the registration', () => {
      (component as any).mode = 'selfhosted';
      fill('anna.cashflow@example.com');
      component.gamePasswordTextField = 'this too shall pass';
      const register = jest
        .spyOn((component as any).selfhosted, 'register')
        .mockReturnValue({ toPromise: () => new Promise(() => undefined) });

      component.SignUp('', '');

      expect(register).toHaveBeenCalledWith(
        'anna.cashflow@example.com',
        'StrongPass1',
        'Anna',
        'this too shall pass',
      );
    });
  });

  describe('default()', () => {
    it('should call cryptic.updateConfig with default values and reset isUploaded', () => {
      component.isUploaded = true;
      component.default();
      expect(mockCrypticService.updateConfig).toHaveBeenCalledWith('default', true, false);
      expect(component.isUploaded).toBe(false);
    });
  });
});
