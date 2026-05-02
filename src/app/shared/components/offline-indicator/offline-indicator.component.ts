import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConnectivityService } from '../../services/connectivity.service';

/**
 * Small fixed-position banner that surfaces offline status to the user.
 * Only renders while the app cannot reach the backend; stays out of the way otherwise.
 */
@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [NgIf],
  template: `
    <div
      class="offline-strip"
      *ngIf="!isOnline"
      role="status"
      aria-live="polite"
      aria-label="You are offline. Changes will sync when reconnected."
      title="You are offline. Changes will sync when reconnected."
    ></div>
  `,
  styles: [`
    .offline-strip {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 10000;
      pointer-events: none;
      background: linear-gradient(
        90deg,
        rgba(220, 60, 60, 0.0) 0%,
        rgba(220, 60, 60, 0.95) 20%,
        rgba(255, 90, 90, 1) 50%,
        rgba(220, 60, 60, 0.95) 80%,
        rgba(220, 60, 60, 0.0) 100%
      );
      background-size: 200% 100%;
      animation: offline-strip-shimmer 2.4s linear infinite,
                 offline-strip-fade-in 200ms ease-out;
      box-shadow: 0 0 6px rgba(220, 60, 60, 0.6);
    }
    @keyframes offline-strip-shimmer {
      0%   { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }
    @keyframes offline-strip-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `]
})
export class OfflineIndicatorComponent implements OnInit, OnDestroy {
  isOnline = true;
  private sub?: Subscription;

  constructor(private connectivity: ConnectivityService) {}

  ngOnInit(): void {
    this.isOnline = this.connectivity.isOnline;
    this.sub = this.connectivity.online$.subscribe(online => (this.isOnline = online));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
