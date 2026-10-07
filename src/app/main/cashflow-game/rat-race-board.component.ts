import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  CLASSIC_RAT_RACE_BOARD,
  spaceAngle,
  type RatRaceBoard,
  type RatRaceSpaceKind,
} from '@money/domain';

/** One drawn cell of the ring. */
interface Cell {
  index: number;
  kind: RatRaceSpaceKind;
  x: number;
  y: number;
  glyph: string;
  labelKey: string;
}

const SIZE = 400;
const CENTER = SIZE / 2;
const RING = 150;
const TOKEN_RING = 112;
/** Room above the ring for the START label. */
const TOP_MARGIN = 48;
const CELL = 34;
/** The ring and its cells with a little air round them: from here to here, in the 400-unit drawing. */
const RING_VIEW = { x: 22, y: 22, size: 356 };

/** What each space is called, in the game's own translations - the same words the "landed on" buttons use. */
const LABEL_KEYS: Record<RatRaceSpaceKind, string> = {
  deal: 'CashflowGame.spaceDeals',
  doodad: 'CashflowGame.deckDoodad',
  market: 'CashflowGame.deckMarket',
  payday: 'CashflowGame.payday',
  charity: 'CashflowGame.charity',
  downsized: 'CashflowGame.downsized',
  baby: 'CashflowGame.baby',
};

/** The symbol each kind of space wears - on the ring, and on the card screens that go with it. */
export const SPACE_GLYPHS: Record<RatRaceSpaceKind, string> = {
  deal: '$',
  doodad: '🛍',
  market: '📈',
  payday: '💰',
  charity: '❤',
  downsized: '🔧',
  baby: '👶',
};

/** Where a point at `degrees` clockwise from the top lies on a circle of `radius` round the centre. */
function onCircle(degrees: number, radius: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) };
}

/**
 * The rat race as a ring of labelled cells with the token on it (todo/cashflow-game-pro.md slice C2). JFK, 2026-10-05:
 * "you don't have to visualize it nicely - just a circle with the different fields, and we simulate your token going
 * along it." Drawn from the board data; the token shows the position it is given (the parent walks it space by space).
 * Colours are the app's own tokens, the same as the "landed on" buttons.
 */
@Component({
  selector: 'app-rat-race-board',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="rr-board" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="ariaLabel">
      <circle class="rr-track" [attr.cx]="center" [attr.cy]="center" [attr.r]="ring" />
      <g *ngFor="let cell of cells" class="rr-cell" [ngClass]="'rr-cell--' + cell.kind">
        <title>{{ cell.labelKey | translate }}</title>
        <rect
          [attr.x]="cell.x - cellSize / 2"
          [attr.y]="cell.y - cellSize / 2"
          [attr.width]="cellSize"
          [attr.height]="cellSize"
          rx="8"
        />
        <text [attr.x]="cell.x" [attr.y]="cell.y" class="rr-glyph">{{ cell.glyph }}</text>
      </g>
      <!-- Before the first roll the totem waits outside the rat race, above the ring, with "START" below it. -->
      <g class="rr-start" *ngIf="position === null">
        <text [attr.x]="center" [attr.y]="startLabelY" class="rr-start-text">START</text>
      </g>
    </svg>
    <!--
      The walking part lives on a layer of its own over the ring: every step moves the token and the highlight, and on one
      shared drawing that repaints the whole ring - emoji text included - which flashed black on some of the spaces.
    -->
    <svg class="rr-walker" [attr.viewBox]="viewBox" aria-hidden="true">
      <rect
        *ngIf="here as cell"
        class="rr-cell--here"
        [ngClass]="'rr-here--' + cell.kind"
        [attr.x]="cell.x - cellSize / 2"
        [attr.y]="cell.y - cellSize / 2"
        [attr.width]="cellSize"
        [attr.height]="cellSize"
        rx="8"
      />
      <g
        class="rr-token"
        [attr.transform]="'translate(' + token.x + ' ' + token.y + ')'"
        [class.rr-token--at-start]="position === null"
      >
        <circle r="13" class="rr-token-body" />
        <circle r="5" class="rr-token-dot" />
      </g>
    </svg>
  `,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
      }
      .rr-board {
        width: 100%;
        height: auto;
        display: block;
        /* painted once, on its own layer: nothing on it changes while the token walks */
        transform: translateZ(0);
      }
      .rr-walker {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
        will-change: transform;
      }
      .rr-track {
        fill: none;
        stroke: var(--color-border, #ccc);
        stroke-width: 2;
        stroke-dasharray: 4 6;
      }
      .rr-cell rect {
        stroke-width: 2;
        fill: var(--color-surface, #fff);
      }
      .rr-glyph {
        font-size: 16px;
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
      }
      .rr-cell--deal rect {
        stroke: var(--color-success);
        fill: var(--color-success-bg, rgba(76, 175, 80, 0.15));
      }
      .rr-cell--deal .rr-glyph {
        fill: var(--color-success);
        font-weight: 700;
      }
      .rr-cell--doodad rect {
        stroke: var(--color-danger);
        fill: var(--color-danger-bg, rgba(211, 47, 47, 0.15));
      }
      .rr-cell--market rect {
        stroke: var(--color-info);
        fill: var(--color-info-surface, rgba(0, 123, 255, 0.15));
      }
      .rr-cell--charity rect,
      .rr-cell--downsized rect,
      .rr-cell--baby rect {
        stroke: var(--color-cf-purple, #8e44ad);
        fill: rgba(142, 68, 173, 0.15);
      }
      .rr-cell--payday rect {
        stroke: var(--color-warning, #f39c12);
        fill: rgba(243, 156, 18, 0.2);
      }
      .rr-cell--here {
        fill: none;
        stroke-width: 4;
      }
      .rr-here--deal {
        stroke: var(--color-success);
      }
      .rr-here--doodad {
        stroke: var(--color-danger);
      }
      .rr-here--market {
        stroke: var(--color-info);
      }
      .rr-here--charity,
      .rr-here--downsized,
      .rr-here--baby {
        stroke: var(--color-cf-purple, #8e44ad);
      }
      .rr-here--payday {
        stroke: var(--color-warning, #f39c12);
      }
      .rr-start-text {
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
        fill: var(--color-text-secondary, #666);
      }
      .rr-token {
        transition: transform 0.25s ease-in-out;
      }
      .rr-token-body {
        fill: var(--color-primary, #2c3e50);
        stroke: var(--color-surface, #fff);
        stroke-width: 3;
      }
      .rr-token-dot {
        fill: var(--color-surface, #fff);
      }
      @media (prefers-reduced-motion: reduce) {
        .rr-token {
          transition: none;
        }
      }
    `,
  ],
})
export class RatRaceBoardComponent {
  /** The ring to draw; the Classic board unless a game set ships its own. */
  @Input() board: RatRaceBoard = CLASSIC_RAT_RACE_BOARD;
  /** The ring index the token stands on; null at START. */
  @Input() position: number | null = null;

  readonly size = SIZE;
  readonly center = CENTER;
  readonly ring = RING;
  readonly cellSize = CELL;
  readonly topMargin = TOP_MARGIN;

  /**
   * Before the first roll the totem waits outside the ring, so the picture has room above it. Once it is inside the ring
   * that room is empty and the picture closes in on the ring - which then fills the width it has.
   */
  get viewBox(): string {
    return this.position === null
      ? `0 ${-TOP_MARGIN} ${SIZE} ${SIZE + TOP_MARGIN}`
      : `${RING_VIEW.x} ${RING_VIEW.y} ${RING_VIEW.size} ${RING_VIEW.size}`;
  }

  /** The space the token stands on, for the highlight that rides on the walker layer. */
  get here(): Cell | null {
    return this.cells.find((cell) => cell.index === this.position) ?? null;
  }

  get cells(): Cell[] {
    return this.board.map((space) => ({
      index: space.index,
      kind: space.kind,
      glyph: SPACE_GLYPHS[space.kind],
      labelKey: LABEL_KEYS[space.kind],
      ...onCircle(spaceAngle(this.board, space.index), RING),
    }));
  }

  /** Where "START" is written: between the waiting totem and the ring. */
  get startLabelY(): number {
    return -6;
  }

  /**
   * Before the first roll the totem stands outside the rat race, top middle; from the first roll it is inside, riding
   * the inner circle in line with the space it stands on.
   */
  get token(): { x: number; y: number } {
    if (this.position === null) return { x: CENTER, y: -30 };
    return onCircle(spaceAngle(this.board, this.position), TOKEN_RING);
  }

  get ariaLabel(): string {
    return this.position === null
      ? 'Cashflow rat race: token at start'
      : `Cashflow rat race: token on space ${this.position + 1} of ${this.board.length}`;
  }
}
