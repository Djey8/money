import { Directive, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

const FOCUSABLE = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden])';

@Directive({
  selector: '[appTrapFocus]',
  standalone: true
})
export class TrapFocusDirective implements AfterViewInit, OnDestroy {
  private listener: ((e: KeyboardEvent) => void) | null = null;
  private observer: MutationObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  private focusFirstElement(): void {
    const host = this.el.nativeElement;
    if (host.hidden) return;
    setTimeout(() => {
      const first = host.querySelector<HTMLElement>(FOCUSABLE);
      if (first) first.focus();
    });
  }

  ngAfterViewInit(): void {
    this.listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const closeBtn = this.el.nativeElement.querySelector<HTMLElement>('#closebtn, [aria-label="Close"]');
        if (closeBtn) { closeBtn.click(); }
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = this.el.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    this.el.nativeElement.addEventListener('keydown', this.listener);

    // Auto-focus on init (handles *ngIf panels)
    this.focusFirstElement();

    // Watch for [hidden] attribute removal (handles [hidden] panels)
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'hidden') {
          if (!this.el.nativeElement.hidden) {
            this.focusFirstElement();
          }
        }
      }
    });
    this.observer.observe(this.el.nativeElement, { attributes: true, attributeFilter: ['hidden'] });
  }

  ngOnDestroy(): void {
    if (this.listener) {
      this.el.nativeElement.removeEventListener('keydown', this.listener);
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
