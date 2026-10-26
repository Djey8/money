import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { fromMinorUnits, type ActiveEffect } from '@money/domain';

/**
 * What is working on the account (JFK, 2026-10-26): every cost and gain that runs for some more Paydays, what a market card did to a
 * holding, what is on its way, and what has changed for good. `compact` is the dense strip on the game, `detail` the list in the
 * character's info.
 */
@Component({
  selector: 'app-active-effects',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="effects.length > 0">
      <!-- the dense strip: one chip each, the ones that end soonest first -->
      <div class="ae-strip" *ngIf="mode === 'compact'">
        <button
          type="button"
          class="ae-head"
          [attr.aria-expanded]="open"
          (click)="open = !open"
          [title]="'CashflowGame.effects.title' | translate"
        >
          ⏳ {{ effects.length }}
          <span class="ae-sum ae-sum--bad" *ngIf="sums.costMinor < 0">{{
            signed(sums.costMinor)
          }}</span>
          <span class="ae-sum ae-sum--good" *ngIf="sums.gainMinor > 0">{{
            signed(sums.gainMinor)
          }}</span>
        </button>
        <button
          type="button"
          class="ae-chip"
          *ngFor="let effect of shown; trackBy: trackEffect"
          [attr.data-tone]="effect.tone"
          [title]="effect.title + (effect.detail ? ' - ' + effect.detail : '')"
          (click)="pick(effect)"
        >
          <span class="ae-name">{{ effect.title }}</span>
          <strong *ngIf="effect.amountMinor !== undefined">{{ signed(effect.amountMinor) }}</strong>
          <span class="ae-left">{{ left(effect) }}</span>
        </button>
        <button
          type="button"
          class="ae-more"
          *ngIf="effects.length > shown.length"
          (click)="open = true"
        >
          +{{ effects.length - shown.length }}
        </button>
      </div>

      <!-- the list: what, how much a month, how long -->
      <ul class="ae-list" *ngIf="mode === 'detail' || open">
        <li
          class="ae-row"
          *ngFor="let effect of effects; trackBy: trackEffect"
          [attr.data-tone]="effect.tone"
        >
          <span class="ae-row-main">
            <strong>{{ effect.title }}</strong>
            <small *ngIf="effect.detail">{{ effect.detail }}</small>
          </span>
          <span class="ae-row-amount" *ngIf="effect.amountMinor !== undefined">{{
            signed(effect.amountMinor)
          }}</span>
          <span class="ae-row-left">{{ left(effect, true) }}</span>
        </li>
      </ul>
    </ng-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ae-strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin: 4px 0;
        font-size: 0.74rem;
        line-height: 1.2;
      }
      .ae-head,
      .ae-chip,
      .ae-more {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        max-width: 100%;
        padding: 2px 7px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 999px;
        background: var(--color-surface, #fff);
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .ae-head {
        font-weight: 700;
      }
      .ae-name {
        overflow: hidden;
        max-width: 11em;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ae-left {
        opacity: 0.75;
        font-variant-numeric: tabular-nums;
      }
      .ae-chip[data-tone='bad'],
      .ae-row[data-tone='bad'] {
        border-color: #d9362b;
        background: #fdeceb;
        color: #8c1d14;
      }
      .ae-chip[data-tone='good'],
      .ae-row[data-tone='good'] {
        border-color: #2e9e5b;
        background: #e7f6ea;
        color: #1b5e20;
      }
      .ae-sum--bad {
        color: #c0392b;
      }
      .ae-sum--good {
        color: #2e7d32;
      }
      .ae-list {
        display: grid;
        gap: 4px;
        margin: 6px 0;
        padding: 0;
        list-style: none;
      }
      .ae-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: 1px solid var(--color-border, #ddd);
        border-inline-start-width: 5px;
        border-radius: 8px;
        font-size: 0.86rem;
      }
      .ae-row-main {
        display: grid;
        min-width: 0;
      }
      .ae-row-main small {
        opacity: 0.8;
      }
      .ae-row-amount {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .ae-row-left {
        min-width: 4.5em;
        text-align: right;
        font-weight: 600;
      }
    `,
  ],
})
export class ActiveEffectsComponent {
  private readonly translate = inject(TranslateService);
  @Input() effects: ActiveEffect[] = [];
  @Input() mode: 'compact' | 'detail' = 'detail';
  @Input() currency = '';
  /** How many chips the strip shows before "+n". */
  @Input() limit = 5;
  /** A chip about a Grow project was picked. */
  @Output() project = new EventEmitter<string>();
  open = false;

  get shown(): ActiveEffect[] {
    return this.effects.slice(0, this.limit);
  }

  get sums(): { gainMinor: number; costMinor: number } {
    let gainMinor = 0;
    let costMinor = 0;
    for (const effect of this.effects) {
      if (['incoming', 'ramp', 'locked'].includes(effect.kind) || effect.amountMinor === undefined)
        continue;
      if (effect.amountMinor >= 0) gainMinor += effect.amountMinor;
      else costMinor += effect.amountMinor;
    }
    return { gainMinor, costMinor };
  }

  trackEffect = (_i: number, effect: ActiveEffect): string => effect.id;

  signed(minor: number): string {
    const value = Math.abs(fromMinorUnits(minor)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return `${minor < 0 ? '−' : '+'}${value}`;
  }

  /** How long it lasts: `3 P` in the strip, `3 Paydays` in the list; nothing for what is for good. */
  left(effect: ActiveEffect, long = false): string {
    if (effect.paydaysLeft === undefined) return '∞';
    if (!long) return `${effect.paydaysLeft}P`;
    return `${effect.paydaysLeft} ${this.translate.instant(effect.paydaysLeft === 1 ? 'CashflowGame.effects.payday' : 'CashflowGame.effects.paydays')}`;
  }

  pick(effect: ActiveEffect): void {
    if (effect.project) this.project.emit(effect.project);
    else this.open = !this.open;
  }
}
