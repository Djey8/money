import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private static STORAGE_KEY = 'onboarding_completed';

  private startSubject = new Subject<void>();
  start$ = this.startSubject.asObservable();

  /** Returns true if the user has already completed/skipped the tour */
  hasCompleted(): boolean {
    return localStorage.getItem(OnboardingService.STORAGE_KEY) === 'true';
  }

  /** Mark the tour as completed so it won't auto-show again */
  markCompleted(): void {
    localStorage.setItem(OnboardingService.STORAGE_KEY, 'true');
  }

  /** Trigger the tour (from registration redirect or help page) */
  startTour(): void {
    this.startSubject.next();
  }
}
