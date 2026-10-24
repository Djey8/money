import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RemoteGameHook } from '../shared/services/remote-game';
import { TableModeService } from './table-mode.service';

/**
 * What the other players do, told as it happens (the dice, the card they drew, what it did): one box that the game screen lays in the
 * middle of its wheel, so it covers nothing that matters - or, where the wheel is not on screen, the table layer floats it at the
 * top. It has its own close button and a click away is the end of the telling of that move (the presenter goes on to the next).
 */
@Component({
  selector: 'app-table-stage',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ts-stage"
      *ngIf="presenter.messages() && presenter.stage() as s"
      [attr.data-kind]="s.card?.tone ?? 'plain'"
      role="status"
    >
      <div class="ts-who">
        <span class="ts-swatch" [style.background]="s.color"></span>
        <span class="ts-name"
          ><strong>{{ s.who }}</strong> {{ s.headline }}</span
        >
        <button type="button" class="ts-x" aria-label="×" (click)="presenter.dismiss()">×</button>
      </div>
      <div class="ts-dice" *ngIf="s.dice?.length" aria-hidden="true">
        <span class="ts-die" *ngFor="let face of s.dice" [class.ts-die--tumble]="s.tumbling">{{
          faces[face - 1]
        }}</span>
      </div>
      <div
        class="ts-card"
        *ngIf="s.card as card"
        [attr.data-tone]="card.tone"
        [class.ts-card--link]="canOpen(card)"
        [attr.role]="canOpen(card) ? 'link' : null"
        [attr.tabindex]="canOpen(card) ? 0 : null"
        (click)="open(card)"
        (keydown.enter)="open(card)"
      >
        <strong>{{ card.title }}</strong>
        <small *ngIf="card.deck">{{ card.deck }}</small>
        <ul *ngIf="card.lines.length">
          <li *ngFor="let line of card.lines">{{ line }}</li>
        </ul>
        <p *ngIf="card.text">{{ card.text }}</p>
      </div>
      <div class="ts-patch" *ngIf="s.patch as patch" [attr.data-tone]="patch.tone">
        {{ patch.text }}
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 560px;
        max-height: min(45vh, 360px);
        pointer-events: auto;
      }
      .ts-stage {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        max-height: 100%;
        overflow-y: auto;
        border-radius: 10px;
        border: 2px solid var(--color-border, #ddd);
        background: var(--color-surface, #fff);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      }
      .ts-who {
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }
      .ts-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .ts-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        margin-top: 4px;
        border-radius: 50%;
        flex: none;
      }
      .ts-x {
        flex: none;
        border: 0;
        background: transparent;
        font-size: 1.4rem;
        line-height: 1;
        padding: 0 6px;
        cursor: pointer;
        color: inherit;
      }
      .ts-dice {
        display: flex;
        gap: 8px;
        font-size: 2.6rem;
        line-height: 1;
      }
      .ts-die--tumble {
        display: inline-block;
        animation: ts-tumble 0.18s linear infinite;
      }
      @keyframes ts-tumble {
        to {
          transform: rotate(90deg);
        }
      }
      .ts-card {
        /* the name, the pile, the numbers and the text each get their own line, with room between: never run into each other */
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        overflow-wrap: anywhere;
        line-height: 1.35;
        padding: 8px 10px;
        border-radius: 8px;
        border-inline-start: 6px solid var(--color-primary, #2a7de1);
        background: var(--color-surface-alt, #f4f6f8);
      }
      .ts-card--link {
        cursor: pointer;
      }
      .ts-card--link:hover,
      .ts-card--link:focus-visible {
        outline: 2px solid var(--color-primary, #2a7de1);
      }
      .ts-card[data-tone='market'] {
        border-color: #2a7de1;
      }
      .ts-card[data-tone='doodad'] {
        border-color: #c0392b;
      }
      .ts-card[data-tone='deal'] {
        border-color: #27ae60;
      }
      .ts-card strong {
        font-size: 1.02em;
      }
      .ts-card small {
        color: var(--color-text-secondary, #666);
      }
      .ts-card ul {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 2px 0 0;
        padding: 0;
        list-style: none;
      }
      .ts-card p {
        margin: 2px 0 0;
        font-size: 0.9em;
        color: var(--color-text-secondary, #666);
      }
      .ts-patch {
        align-self: flex-start;
        padding: 2px 10px;
        border-radius: 999px;
        font-weight: 700;
        background: var(--color-surface-alt, #f4f6f8);
      }
      .ts-patch[data-tone='plus'] {
        color: #1e8449;
      }
      .ts-patch[data-tone='minus'] {
        color: #c0392b;
      }
      @media (prefers-reduced-motion: reduce) {
        .ts-die--tumble {
          animation: none;
        }
      }
    `,
  ],
})
export class TableStageComponent {
  readonly presenter = inject(TableModeService).presenter;

  /** A card of the message opens, to be read, in the game screen's own card view. */
  canOpen(card: { id?: string }): boolean {
    return !!card.id && !!RemoteGameHook.openCard;
  }
  open(card: { id?: string }): void {
    if (!card.id || !RemoteGameHook.openCard) return;
    this.presenter.dismiss();
    RemoteGameHook.openCard(card.id);
  }
  readonly faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
}
