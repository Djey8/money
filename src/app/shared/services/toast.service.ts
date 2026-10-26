import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info' | 'update' | 'delete';
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private toastSubject = new Subject<Toast>();
  private dismissSubject = new Subject<number>();

  toast$ = this.toastSubject.asObservable();
  dismiss$ = this.dismissSubject.asObservable();

  /**
   * Set by a screen that wants the small confirmations quiet while it is open (the game with others: a button below a toast is hard
   * to press on a phone). Errors always show - a failed save must never be silent.
   */
  static quiet: (() => boolean) | null = null;
  /** The player's own setting (the game's Settings): the small confirmations are off; errors still show. */
  static muted: (() => boolean) | null = null;

  show(message: string, type: 'success' | 'error' | 'info' | 'update' | 'delete' = 'success') {
    const id = ++this.counter;
    if (type !== 'error' && (ToastService.quiet?.() || ToastService.muted?.())) return id;
    this.toastSubject.next({ message, type, id });
    return id;
  }

  dismiss(id: number) {
    this.dismissSubject.next(id);
  }
}
