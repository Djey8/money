import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { TranslateService } from '@ngx-translate/core';

/**
 * Base class for all info-* components.
 * Provides shared error state, form helpers, edit mode, and window management.
 * Each child must set `classReference` to its own static class and override `highlight()`.
 */
export abstract class BaseInfoComponent {

  errorTextLable = "";
  borderColor = "var(--color-border)";
  color = "black";
  currency = "€";
  isEdit = false;
  protected toastService = inject(ToastService);
  protected confirmService = inject(ConfirmService);
  protected translate = inject(TranslateService);

  /** Each child sets this to its own class so templates can access static props */
  abstract classReference: any;

  constructor(protected router: Router) {
  }

  /** Initializes the child's static flags. Call from child constructor. */
  protected initStatic(cls: any) {
    cls.isInfo = false;
    cls.isError = false;
    cls.zIndex = 0;
  }

  zeroPadded(val: number): string | number {
    return val >= 10 ? val : '0' + val;
  }

  /** Override in child to set/reset zIndex on relevant sibling components */
  abstract highlight(): void;

  /** Shared close logic. Override in child only if extra cleanup is needed. */
  closeWindow() {
    this.classReference.isInfo = false;
    this.isEdit = false;
  }

  /** Exit edit mode */
  cancel() {
    this.isEdit = false;
  }

  /** Show a validation error */
  protected showError(message: string) {
    this.errorTextLable = message;
    this.color = "red";
    this.borderColor = "red";
    this.classReference.isError = true;
  }

  /** Reset error state and form colors */
  protected clearError() {
    this.errorTextLable = "";
    this.color = "black";
    this.borderColor = "var(--color-border)";
    this.classReference.isError = false;
  }
}
