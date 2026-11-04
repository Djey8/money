import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/** The pips of a face on the 3 x 3 grid of a die: the cells that are dots. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * A die on one of its faces (JFK, 2026-11): the big one that is thrown, and the small one that stays on a card to show what it rolled.
 * The one look of every die of the game, whatever stack it belongs to.
 */
@Component({
  selector: 'app-die',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <span
      class="die"
      [class.die--sm]="size === 'sm'"
      [class.die--tumbling]="tumbling"
      role="img"
      [attr.aria-label]="'CashflowGame.diceRolled' | translate: { roll: face }"
    >
      <i class="die-pip" *ngFor="let on of cells; trackBy: trackIndex" [class.die-pip--on]="on"></i>
    </span>
  `,
  styles: [
    `
      app-die {
        display: inline-block;
        line-height: 0;
      }
      .die {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: repeat(3, 1fr);
        place-items: center;
        width: 68px;
        height: 68px;
        padding: 9px;
        border-radius: 14px;
        background: #fff;
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.25),
          inset 0 -3px 0 rgba(0, 0, 0, 0.08);
      }
      .die--sm {
        width: 30px;
        height: 30px;
        padding: 4px;
        border-radius: 7px;
        box-shadow:
          0 1px 4px rgba(0, 0, 0, 0.3),
          inset 0 -2px 0 rgba(0, 0, 0, 0.08);
      }
      .die-pip {
        width: 11px;
        height: 11px;
        border-radius: 50%;
      }
      .die--sm .die-pip {
        width: 5px;
        height: 5px;
      }
      .die-pip--on {
        background: #1b1b1f;
      }
      .die--tumbling {
        animation: die-tumble 0.5s linear infinite;
      }
      @keyframes die-tumble {
        from {
          transform: rotate(0deg) scale(0.92);
        }
        50% {
          transform: rotate(180deg) scale(1.06);
        }
        to {
          transform: rotate(360deg) scale(0.92);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .die--tumbling {
          animation: none;
        }
      }
    `,
  ],
})
export class DieComponent {
  @Input() face = 1;
  /** `md`: the die that is thrown; `sm`: the one that stays on a card. */
  @Input() size: 'md' | 'sm' = 'md';
  @Input() tumbling = false;

  get cells(): boolean[] {
    const on = new Set(PIPS[this.face] ?? []);
    return Array.from({ length: 9 }, (_, cell) => on.has(cell));
  }

  trackIndex = (index: number): number => index;
}
