import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * A round picture of whoever sits at a table (JFK, 2026-10-25): the profile picture when there is one, else the first letter on the
 * player's colour, a robot for a bot. Used by the table lobby and the waiting room, small in a row of seats, large on a seat card.
 */
@Component({
  selector: 'app-seat-avatar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="sa"
      [class.sa--bot]="bot"
      [class.sa--empty]="empty"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.font-size.px]="size * 0.42"
      [style.background]="bot || empty ? null : color"
      aria-hidden="true"
      >{{ empty ? '+' : bot ? '🤖' : initial
      }}<img
        *ngIf="src"
        class="sa-photo"
        [src]="src"
        alt=""
        (error)="$any($event.target).style.display = 'none'"
    /></span>
  `,
  styles: [
    `
      .sa {
        position: relative;
        overflow: hidden;
        flex: none;
        display: inline-grid;
        place-items: center;
        border-radius: 50%;
        font-weight: 700;
        color: #fff;
        background: var(--color-primary, #1976d2);
        box-sizing: border-box;
      }
      .sa--bot {
        background: var(--color-surface-alt, #eef1f4);
      }
      .sa--empty {
        background: transparent;
        color: var(--color-text-secondary, #888);
        border: 2px dashed var(--color-border, #bbb);
        font-weight: 400;
      }
      .sa-photo {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `,
  ],
})
export class SeatAvatarComponent {
  @Input() name = '';
  @Input() src: string | null = null;
  @Input() bot = false;
  /** A free seat: a dashed circle. */
  @Input() empty = false;
  @Input() color = '#1976d2';
  @Input() size = 36;

  get initial(): string {
    return (this.name || '?').trim().charAt(0).toUpperCase();
  }
}
