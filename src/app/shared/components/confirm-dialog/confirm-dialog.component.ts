import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmService, ConfirmRequest } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div *ngIf="pending" class="confirm-backdrop" (click)="cancel()">
      <div class="confirm-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <p class="confirm-message">{{ pending.message }}</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn--cancel" (click)="cancel()">{{'Confirm.cancel' | translate}}</button>
          <button 
            class="confirm-btn" 
            [ngClass]="pending.confirmButtonClass === 'primary' ? 'confirm-btn--primary' : 'confirm-btn--delete'"
            (click)="doConfirm()">
            {{ pending.confirmButtonText ? (pending.confirmButtonText | translate) : ('Info.delete' | translate) }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 11000;
    }
    .confirm-dialog {
      background: var(--color-surface);
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.2));
      padding: 24px;
      width: min(90vw, 360px);
      text-align: center;
    }
    .confirm-message {
      font-size: var(--font-md, 16px);
      color: var(--color-text, var(--color-text));
      margin: 0 0 20px;
      line-height: 1.5;
    }
    .confirm-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .confirm-btn {
      padding: 10px 24px;
      border: none;
      border-radius: var(--radius-md, 8px);
      font-size: var(--font-base, 14px);
      font-weight: 600;
      cursor: pointer;
      min-width: 100px;
    }
    .confirm-btn--cancel {
      background: var(--color-background);
      color: var(--color-text, var(--color-text));
    }
    .confirm-btn--cancel:hover {
      background: var(--color-muted);
    }
    .confirm-btn--delete {
      background: var(--color-danger, #b51e1e);
      color: white;
    }
    .confirm-btn--delete:hover {
      background: var(--color-danger-hover, #9a1919);
    }
    .confirm-btn--primary {
      background: var(--color-primary, #1e88e5);
      color: white;
    }
    .confirm-btn--primary:hover {
      background: var(--color-primary-hover, #1976d2);
    }
  `]
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  pending: ConfirmRequest | null = null;
  private sub!: Subscription;

  constructor(private confirmService: ConfirmService) {}

  ngOnInit() {
    this.sub = this.confirmService.confirm$.subscribe(req => {
      this.pending = req;
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  doConfirm() {
    if (this.pending) {
      this.pending.onConfirm();
      this.pending = null;
    }
  }

  cancel() {
    this.pending = null;
  }
}
