import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Toast, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      <div *ngFor="let toast of toasts"
           class="toast toast--{{toast.type}}"
           role="status">
        <span class="toast__message">{{toast.message}}</span>
        <button class="toast__close" (click)="remove(toast.id)" aria-label="Dismiss">&times;</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15));
      color: white;
      font-size: var(--font-base, 14px);
      min-width: 250px;
      max-width: min(90vw, 400px);
      animation: toast-in 0.3s ease-out;
    }
    .toast--success { background-color: var(--color-success, #4CAF50); }
    .toast--error { background-color: var(--color-danger, #b51e1e); }
    .toast--info { background-color: var(--color-primary, #1976d2); }
    .toast--update { background-color: #FFA726; }
    .toast--delete { background-color: #EF5350; }
    .toast__message { flex: 1; }
    .toast__close {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      opacity: 0.8;
    }
    .toast__close:hover { opacity: 1; }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subs: Subscription[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.subs.push(
      this.toastService.toast$.subscribe(toast => {
        this.toasts.push(toast);
        setTimeout(() => this.remove(toast.id), 3500);
      }),
      this.toastService.dismiss$.subscribe(id => this.remove(id))
    );
  }

  remove(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }
}
