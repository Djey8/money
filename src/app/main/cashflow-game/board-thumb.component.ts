import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildDreamfundBoard,
  type BoardShape,
  type BoardSize,
  type DreamfundTile,
} from '@money/domain';
import { TILE_COLORS } from './dream-board.component';

/**
 * A map in small (JFK, 2026-10-25): its shape drawn with its tiles as dots in their colours, so what is chosen can be seen at a
 * glance - in the list of maps and as the choice that stays visible after.
 */
@Component({
  selector: 'app-board-thumb',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="viewBox" class="bt" aria-hidden="true">
      <circle
        *ngFor="let dot of dots"
        [attr.cx]="dot.x"
        [attr.cy]="dot.y"
        [attr.r]="radius"
        [attr.fill]="dot.color"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .bt {
        display: block;
        width: 100%;
        height: auto;
      }
    `,
  ],
})
export class BoardThumbComponent {
  @Input({ required: true }) shape!: BoardShape;
  @Input() size: BoardSize = 'medium';
  @Input() seed = 1;

  private get map() {
    return buildDreamfundBoard({ shape: this.shape, size: this.size, seed: this.seed });
  }

  /** In the box of the map's own proportions: wide maps wide, so a thumbnail is as large as it can be. */
  get viewBox(): string {
    const pad = this.map.spacing * 0.7;
    return `${-pad} ${-pad} ${this.map.aspect + 2 * pad} ${1 + 2 * pad}`;
  }

  get radius(): number {
    return this.map.spacing * 0.34;
  }

  get dots(): { x: number; y: number; color: string }[] {
    return this.map.points.map((point, index) => ({
      x: point.x,
      y: point.y,
      color: TILE_COLORS[this.map.board[index].kind as DreamfundTile],
    }));
  }
}
