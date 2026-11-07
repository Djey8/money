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
      <!-- the Yin Yang: the circle and the S, so the symbol is seen -->
      <ng-container *ngIf="lines as shape">
        <polygon [attr.points]="shape.rim" class="bt-line" />
        <polyline [attr.points]="shape.seam" class="bt-line" />
      </ng-container>
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
      .bt-line {
        fill: none;
        stroke: var(--color-border, #c8ccd2);
        stroke-width: 0.012;
      }
    `,
  ],
})
export class BoardThumbComponent {
  @Input({ required: true }) shape!: BoardShape;
  @Input() size: BoardSize = 'medium';
  @Input() seed = 1;
  /** False: the map of a game for the life dream alone, without Smile tiles. */
  @Input() dreams = true;

  private get map() {
    return buildDreamfundBoard({
      shape: this.shape,
      size: this.size,
      seed: this.seed,
      ...(this.dreams ? {} : { dreams: false }),
    });
  }

  /** In the box of the map's own proportions: wide maps wide, so a thumbnail is as large as it can be. */
  get viewBox(): string {
    const pad = this.map.spacing * 0.7;
    return `${-pad} ${-pad} ${this.map.aspect + 2 * pad} ${1 + 2 * pad}`;
  }

  get radius(): number {
    return this.map.spacing * 0.34;
  }

  /** The circle and the S of a Yin Yang map, as polylines in the box of the map. */
  get lines(): { rim: string; seam: string } | null {
    const picture = this.map.picture;
    if (!picture) return null;
    const text = (line: { x: number; y: number }[]) => line.map((p) => `${p.x},${p.y}`).join(' ');
    return { rim: text(picture.rim), seam: text(picture.seam) };
  }

  get dots(): { x: number; y: number; color: string }[] {
    const picture = this.map.picture;
    if (picture) {
      return picture.tiles.map((tile) => ({
        x: tile.x,
        y: tile.y,
        color: TILE_COLORS[tile.kind],
      }));
    }
    return this.map.points.map((point, index) => ({
      x: point.x,
      y: point.y,
      color: TILE_COLORS[this.map.board[index].kind as DreamfundTile],
    }));
  }
}
