import { TestBed } from '@angular/core/testing';
import { BaseInfoComponent } from './base-info.component';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

/** Concrete child for testing the abstract base class */
class TestInfoComponent extends BaseInfoComponent {
  static zIndex = 0;
  static isInfo = false;
  static isError = false;
  classReference = TestInfoComponent;

  constructor(router: Router) {
    super(router);
    this.initStatic(TestInfoComponent);
  }

  highlight(): void {
    TestInfoComponent.zIndex = 1;
  }
}

describe('BaseInfoComponent', () => {
  let component: TestInfoComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: { show: jest.fn() } },
        { provide: ConfirmService, useValue: { confirm: jest.fn() } },
        { provide: TranslateService, useValue: { instant: jest.fn((k: string) => k), get: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } }
      ]
    });

    TestInfoComponent.zIndex = 0;
    TestInfoComponent.isInfo = false;
    TestInfoComponent.isError = false;
    component = TestBed.runInInjectionContext(() => {
      return new TestInfoComponent(TestBed.inject(Router));
    });
  });

  describe('initStatic()', () => {
    it('should set isInfo, isError to false and zIndex to 0', () => {
      TestInfoComponent.isInfo = true;
      TestInfoComponent.isError = true;
      TestInfoComponent.zIndex = 5;
      (component as any).initStatic(TestInfoComponent);
      expect(TestInfoComponent.isInfo).toBe(false);
      expect(TestInfoComponent.isError).toBe(false);
      expect(TestInfoComponent.zIndex).toBe(0);
    });
  });

  describe('zeroPadded()', () => {
    it('should pad single-digit numbers', () => {
      expect(component.zeroPadded(3)).toBe('03');
    });

    it('should not pad >= 10', () => {
      expect(component.zeroPadded(12)).toBe(12);
    });
  });

  describe('showError()', () => {
    it('should set error message, colors, and isError', () => {
      (component as any).showError('Validation failed');
      expect(component.errorTextLable).toBe('Validation failed');
      expect(component.color).toBe('red');
      expect(component.borderColor).toBe('red');
      expect(TestInfoComponent.isError).toBe(true);
    });
  });

  describe('clearError()', () => {
    it('should reset error text, colors, and isError', () => {
      (component as any).showError('Error');
      (component as any).clearError();
      expect(component.errorTextLable).toBe('');
      expect(component.color).toBe('black');
      expect(component.borderColor).toBe('var(--color-border)');
      expect(TestInfoComponent.isError).toBe(false);
    });
  });

  describe('closeWindow()', () => {
    it('should set isInfo to false and isEdit to false', () => {
      TestInfoComponent.isInfo = true;
      component.isEdit = true;
      component.closeWindow();
      expect(TestInfoComponent.isInfo).toBe(false);
      expect(component.isEdit).toBe(false);
    });
  });

  describe('cancel()', () => {
    it('should set isEdit to false', () => {
      component.isEdit = true;
      component.cancel();
      expect(component.isEdit).toBe(false);
    });
  });

  describe('default properties', () => {
    it('should have currency defaulting to €', () => {
      expect(component.currency).toBe('€');
    });

    it('should have isEdit defaulting to false', () => {
      expect(component.isEdit).toBe(false);
    });
  });
});
