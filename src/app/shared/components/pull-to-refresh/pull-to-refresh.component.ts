import { Component, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-pull-to-refresh',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="pull-indicator" *ngIf="pulling" [style.opacity]="pullProgress">
      <div class="pull-spinner" [class.active]="pullProgress >= 1">↻</div>
      <span>{{ pullProgress >= 1 ? 'Release to refresh' : 'Pull to refresh' }}</span>
    </div>
  `,
  styles: [`
    .pull-indicator {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #333);
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: opacity 0.2s;
    }
    .pull-spinner {
      font-size: 20px;
      transition: transform 0.3s;
    }
    .pull-spinner.active {
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class PullToRefreshComponent implements OnInit, OnDestroy {
  pulling = false;
  pullProgress = 0;

  private startY = 0;
  private startX = 0;
  private threshold = 80;
  // Strict gesture: must travel this far vertically before we even show the indicator.
  // This prevents tiny scroll jitters and zoom-out gestures from being interpreted as a pull.
  private activationDistance = 24;
  // Once disqualified (multi-touch, horizontal drift, started inside input, etc.) the gesture
  // is dead until the next touchstart. Avoids "I started pinching to zoom out and the page reloaded".
  private disqualified = false;

  private onTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
  private onTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
  private onTouchEnd = () => this.handleTouchEnd();
  private onTouchCancel = () => this.reset();

  constructor(private zone: NgZone) {}

  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('touchstart', this.onTouchStart, { passive: true });
      document.addEventListener('touchmove', this.onTouchMove, { passive: true });
      document.addEventListener('touchend', this.onTouchEnd, { passive: true });
      document.addEventListener('touchcancel', this.onTouchCancel, { passive: true });
    });
  }

  ngOnDestroy() {
    document.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    document.removeEventListener('touchcancel', this.onTouchCancel);
  }

  /**
   * The user explicitly asked: pull-to-refresh must only fire on a deliberate
   * top-of-screen, single-finger, downward swipe. Multi-touch (pinch-zoom),
   * horizontal swipes, gestures that begin inside an input/scrollable area,
   * or pulls from a non-zero scroll position must NOT trigger a reload.
   */
  private handleTouchStart(e: TouchEvent) {
    this.disqualified = false;

    // Multi-touch (pinch zoom) — never a pull.
    if (e.touches.length > 1) {
      this.disqualified = true;
      return;
    }

    // Started while page is scrolled — never a pull.
    if (window.scrollY > 0) {
      this.disqualified = true;
      return;
    }

    // Started on an editable / interactive element — never a pull. Protects against
    // the user losing input mid-typing because the keyboard close gesture was misread.
    if (this.isInteractiveTarget(e.target)) {
      this.disqualified = true;
      return;
    }

    this.startY = e.touches[0].clientY;
    this.startX = e.touches[0].clientX;
  }

  private handleTouchMove(e: TouchEvent) {
    if (this.disqualified || this.startY === 0) return;

    // A second finger lands mid-gesture (pinch starts) → abort.
    if (e.touches.length > 1) {
      this.disqualify();
      return;
    }

    // Page got scrolled (e.g. by a parent scroller) → abort.
    if (window.scrollY > 0) {
      this.disqualify();
      return;
    }

    const dy = e.touches[0].clientY - this.startY;
    const dx = Math.abs(e.touches[0].clientX - this.startX);

    // Predominantly horizontal motion → user is swiping a carousel / nav, not pulling.
    if (dx > 20 && dx > Math.abs(dy)) {
      this.disqualify();
      return;
    }

    // Upward movement disqualifies; only downward counts.
    if (dy < 0) {
      this.disqualify();
      return;
    }

    if (dy < this.activationDistance) return;

    this.zone.run(() => {
      this.pulling = true;
      this.pullProgress = Math.min(dy / this.threshold, 1);
    });
  }

  private handleTouchEnd() {
    const shouldReload = !this.disqualified && this.pulling && this.pullProgress >= 1;
    if (shouldReload) {
      window.location.reload();
    }
    this.reset();
  }

  private disqualify() {
    this.disqualified = true;
    if (this.pulling) {
      this.zone.run(() => {
        this.pulling = false;
        this.pullProgress = 0;
      });
    }
  }

  private reset() {
    this.zone.run(() => {
      this.pulling = false;
      this.pullProgress = 0;
    });
    this.startY = 0;
    this.startX = 0;
    this.disqualified = false;
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'OPTION') {
      return true;
    }
    // contenteditable, dialogs, ng-select, datepickers, scrollable inner areas, etc.
    if (target.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"], .mat-mdc-dialog-container, mat-select, .ng-select-container')) {
      return true;
    }
    return false;
  }
}
