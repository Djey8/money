import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from '../services/app-state.service';
import { ToastService } from '../services/toast.service';

/**
 * Base class for all add-* components.
 * Provides shared error state, form helpers, and window management.
 * Each child must set `classReference` to its own static class and override `highlight()`.
 */
export abstract class BaseAddComponent {

  errorTextLable = "";
  borderColor = "var(--color-border)";
  color = "black";
  fieldErrors: Record<string, string> = {};
  protected toastService = inject(ToastService);

  /** Each child sets this to its own class so templates can access static props */
  abstract classReference: any;

  constructor(protected router: Router) {
  }

  /** Initializes the child's static flags. Call from child constructor. */
  protected initStatic(cls: any) {
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
    this.classReference.isError = false;
    this.classReference.zIndex = 0;
    this.color = "black";
    this.borderColor = "var(--color-border)";
    this.fieldErrors = {};
  }

  /** Show a validation error */
  protected showError(message: string) {
    this.errorTextLable = message;
    this.color = "red";
    this.borderColor = "red";
    this.classReference.isError = true;
  }

  /** Set a per-field error */
  protected setFieldError(field: string, message: string) {
    this.fieldErrors[field] = message;
  }

  /** Validate required fields; returns true if valid */
  protected validateRequired(fields: { name: string; value: any; label: string }[]): boolean {
    this.fieldErrors = {};
    let valid = true;
    for (const f of fields) {
      if (f.value === '' || f.value === null || f.value === undefined) {
        this.fieldErrors[f.name] = `${f.label} is required`;
        valid = false;
      }
    }
    if (!valid) {
      this.showError('Please fill out all required fields.');
    }
    return valid;
  }

  /** Reset error state and form colors */
  protected clearError() {
    this.color = "black";
    this.borderColor = "var(--color-border)";
    this.classReference.isError = false;
    this.fieldErrors = {};
  }
}
