import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistrationComponent } from './registration.component';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DatabaseService } from '../shared/services/database.service';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { LocalService } from '../shared/services/local.service';
import { CrypticService } from '../shared/services/cryptic.service';
import { AppStateService } from '../shared/services/app-state.service';

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
        RouterTestingModule
      ],
      providers: [
        { provide: DatabaseService, useValue: {} },
        { provide: LocalService, useValue: mockLocalService },
        { provide: CrypticService, useValue: mockCrypticService },
        { provide: FIREBASE_OPTIONS, useValue: { projectId: 'test', appId: 'test', apiKey: 'test' } }
      ]
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

  describe('default()', () => {
    it('should call cryptic.updateConfig with default values and reset isUploaded', () => {
      component.isUploaded = true;
      component.default();
      expect(mockCrypticService.updateConfig).toHaveBeenCalledWith('default', true, false);
      expect(component.isUploaded).toBe(false);
    });
  });
});
