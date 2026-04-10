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
  private threshold = 80;

  private onTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
  private onTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
  private onTouchEnd = () => this.handleTouchEnd();

  constructor(private zone: NgZone) {}

  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('touchstart', this.onTouchStart, { passive: true });
      document.addEventListener('touchmove', this.onTouchMove, { passive: true });
      document.addEventListener('touchend', this.onTouchEnd, { passive: true });
    });
  }

  ngOnDestroy() {
    document.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
  }

  private handleTouchStart(e: TouchEvent) {
    if (window.scrollY === 0) {
      this.startY = e.touches[0].clientY;
    }
  }

  private handleTouchMove(e: TouchEvent) {
    if (this.startY === 0 || window.scrollY > 0) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - this.startY;

    if (diff > 10) {
      this.zone.run(() => {
        this.pulling = true;
        this.pullProgress = Math.min(diff / this.threshold, 1);
      });
    }
  }

  private handleTouchEnd() {
    if (this.pulling && this.pullProgress >= 1) {
      window.location.reload();
    }
    this.zone.run(() => {
      this.pulling = false;
      this.pullProgress = 0;
      this.startY = 0;
    });
  }
}
