import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BaseAddComponent } from './base-add.component';
import { ToastService } from '../services/toast.service';

/** Concrete child for testing the abstract base class */
class TestAddComponent extends BaseAddComponent {
  static zIndex = 0;
  static isError = false;
  classReference = TestAddComponent;

  constructor(router: Router) {
    super(router);
    this.initStatic(TestAddComponent);
  }

  highlight(): void {
    TestAddComponent.zIndex = 1;
  }
}

describe('BaseAddComponent', () => {
  let component: TestAddComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ToastService, useValue: { show: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
    TestAddComponent.zIndex = 0;
    TestAddComponent.isError = false;
    component = TestBed.runInInjectionContext(() => new TestAddComponent(TestBed.inject(Router)));
  });

  describe('initStatic()', () => {
    it('should set isError to false and zIndex to 0', () => {
      TestAddComponent.isError = true;
      TestAddComponent.zIndex = 5;
      (component as any).initStatic(TestAddComponent);
      expect(TestAddComponent.isError).toBe(false);
      expect(TestAddComponent.zIndex).toBe(0);
    });
  });

  describe('zeroPadded()', () => {
    it('should pad single-digit numbers with leading zero', () => {
      expect(component.zeroPadded(0)).toBe('00');
      expect(component.zeroPadded(5)).toBe('05');
      expect(component.zeroPadded(9)).toBe('09');
    });

    it('should not pad double-digit numbers', () => {
      expect(component.zeroPadded(10)).toBe(10);
      expect(component.zeroPadded(31)).toBe(31);
    });
  });

  describe('showError()', () => {
    it('should set error text, colors, and isError flag', () => {
      (component as any).showError('Something went wrong');
      expect(component.errorTextLable).toBe('Something went wrong');
      expect(component.color).toBe('red');
      expect(component.borderColor).toBe('red');
      expect(TestAddComponent.isError).toBe(true);
    });
  });

  describe('clearError()', () => {
    it('should reset error state and colors', () => {
      (component as any).showError('Error');
      (component as any).clearError();
      expect(component.color).toBe('black');
      expect(component.borderColor).toBe('var(--color-border)');
      expect(TestAddComponent.isError).toBe(false);
    });
  });

  describe('closeWindow()', () => {
    it('should reset isError, zIndex, and colors', () => {
      TestAddComponent.isError = true;
      TestAddComponent.zIndex = 5;
      component.color = 'red';
      component.borderColor = 'red';

      component.closeWindow();

      expect(TestAddComponent.isError).toBe(false);
      expect(TestAddComponent.zIndex).toBe(0);
      expect(component.color).toBe('black');
      expect(component.borderColor).toBe('var(--color-border)');
    });
  });

  describe('highlight()', () => {
    it('should set zIndex to 1', () => {
      component.highlight();
      expect(TestAddComponent.zIndex).toBe(1);
    });
  });
});
