import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  HostListener,
  Input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { DreamfundBoard, DreamfundTile } from '@money/domain';

/** The colour of each kind of tile - the colours of the accounts where there is one (Smile green, Fire red), the same everywhere. */
export const TILE_COLORS: Record<DreamfundTile, string> = {
  payday: '#f0b323',
  dream: '#2e9e5b',
  emergency: '#d9362b',
  opportunity: '#8e44ad',
  harvest: '#c9871c',
  life: '#e0568f',
  career: '#3f51b5',
};

/** What each tile wears: the app's own icons for the Smile and Fire accounts, a sprout for Opportunity (Grow), a symbol for the rest. */
export const TILE_ICONS: Record<DreamfundTile, { image?: string; glyph?: string }> = {
  payday: { glyph: '💰' },
  dream: { image: 'assets/icons/smile.jpg' },
  emergency: { image: 'assets/icons/fire.jpg' },
  opportunity: {},
  harvest: { glyph: '🌾' },
  life: { glyph: '❤' },
  career: { glyph: '🎓' },
};

/** The names of the tiles, as the translation keys of the game. */
export const TILE_LABEL_KEYS: Record<DreamfundTile, string> = {
  payday: 'CashflowGame.payday',
  dream: 'CashflowGame.tile.dream',
  emergency: 'CashflowGame.tile.emergency',
  opportunity: 'CashflowGame.tile.opportunity',
  harvest: 'CashflowGame.tile.harvest',
  life: 'CashflowGame.tile.life',
  career: 'CashflowGame.tile.career',
};

/** The sprout of the Opportunity tile (a seed, a sapling, a tree grow from it): two leaves on a stem, in a 24 x 24 box. */
export const SPROUT_PATH =
  'M12 21V11 M12 14C12 9 7 7 3.5 8 3.5 12.5 8 14.5 12 14Z M12 11.5C12 6.5 16.5 4 20.5 5 20.5 10 16 12.5 12 11.5Z';

/** One tile of the picture. */
interface DrawnTile {
  index: number;
  kind: DreamfundTile;
  x: number;
  y: number;
}

/** The unit of the drawing: neighbouring tiles are this far apart. */
const SPACING = 100;
const TILE = 76;
/** Room round the track for half a tile and the START marker. */
const MARGIN = 70;
const START_REACH = 150;
/** What the header, the start of the page and the roll bar take of the height of the screen. */
const HEIGHT_TAKEN = 400;

/**
 * The map of a Dreamfund game (JFK, 2026-10-25): the tiles on their track, in the shape of the map, with the token on it. A map
 * that is wider than high stands up on a portrait screen, so the tiles come out as big as the screen allows; the whole picture
 * scales down on a small phone and never needs to scroll. The engine knows the tiles by their order only - this is the picture.
 */
@Component({
  selector: 'app-dream-board',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="db-board"
      [attr.viewBox]="layout.viewBox"
      role="img"
      [attr.aria-label]="ariaLabel"
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon class="db-track" [attr.points]="layout.trackPoints" />
      <g
        *ngFor="let tile of layout.tiles; trackBy: trackTile"
        class="db-tile"
        [attr.data-kind]="tile.kind"
      >
        <title>{{ labelKey(tile.kind) | translate }}</title>
        <rect
          [attr.x]="tile.x - tileSize / 2"
          [attr.y]="tile.y - tileSize / 2"
          [attr.width]="tileSize"
          [attr.height]="tileSize"
          rx="16"
          [style.--tc]="color(tile.kind)"
        />
        <ng-container [ngSwitch]="iconOf(tile.kind)">
          <ng-container *ngSwitchCase="'image'">
            <circle
              [attr.cx]="tile.x"
              [attr.cy]="tile.y"
              [attr.r]="tileSize * 0.34"
              class="db-disc"
            />
            <image
              [attr.href]="icons[tile.kind].image"
              [attr.x]="tile.x - tileSize * 0.3"
              [attr.y]="tile.y - tileSize * 0.3"
              [attr.width]="tileSize * 0.6"
              [attr.height]="tileSize * 0.6"
            />
          </ng-container>
          <ng-container *ngSwitchCase="'sprout'">
            <circle
              [attr.cx]="tile.x"
              [attr.cy]="tile.y"
              [attr.r]="tileSize * 0.34"
              class="db-disc"
            />
            <path
              class="db-sprout"
              [attr.d]="sprout"
              [attr.transform]="
                'translate(' +
                (tile.x - tileSize * 0.3) +
                ' ' +
                (tile.y - tileSize * 0.3) +
                ') scale(' +
                (tileSize * 0.6) / 24 +
                ')'
              "
              [style.stroke]="color(tile.kind)"
            />
          </ng-container>
          <text
            *ngSwitchDefault
            [attr.x]="tile.x"
            [attr.y]="tile.y"
            class="db-glyph"
            [style.font-size.px]="tileSize * 0.5"
          >
            {{ icons[tile.kind].glyph }}
          </text>
        </ng-container>
      </g>
      <g class="db-start" *ngIf="atStart">
        <text [attr.x]="layout.start.x" [attr.y]="layout.start.y + 54" class="db-start-text">
          START
        </text>
      </g>
    </svg>
    <!-- the walking part on a layer of its own: every step repaints only this -->
    <svg class="db-walker" [attr.viewBox]="layout.viewBox" aria-hidden="true">
      <rect
        *ngIf="hereTile as here"
        class="db-here"
        [attr.x]="here.x - tileSize / 2"
        [attr.y]="here.y - tileSize / 2"
        [attr.width]="tileSize"
        [attr.height]="tileSize"
        rx="16"
        [style.stroke]="color(here.kind)"
      />
      <g class="db-token" [style.transform]="tokenTransform">
        <circle r="26" class="db-token-body" />
        <circle r="10" class="db-token-dot" />
      </g>
    </svg>
  `,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        width: 100%;
        margin: 0 auto;
      }
      .db-board,
      .db-walker {
        width: 100%;
        height: auto;
        display: block;
      }
      .db-board {
        transform: translateZ(0);
      }
      .db-walker {
        position: absolute;
        inset: 0;
        height: 100%;
        pointer-events: none;
        overflow: visible;
      }
      .db-track {
        fill: none;
        stroke: var(--color-border, #ccc);
        stroke-width: 5;
        stroke-dasharray: 8 12;
        stroke-linejoin: round;
      }
      .db-tile rect {
        stroke-width: 6;
        stroke: var(--tc);
        fill: color-mix(in srgb, var(--tc) 16%, var(--color-surface, #fff));
      }
      .db-disc {
        fill: #fff;
      }
      .db-sprout {
        fill: none;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .db-glyph {
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
      }
      .db-start-text {
        font-size: 30px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
        fill: var(--color-text-secondary, #666);
      }
      .db-here {
        fill: none;
        stroke-width: 11;
      }
      .db-token {
        transition: transform 0.25s ease-in-out;
      }
      .db-token-body {
        fill: var(--color-primary, #2c3e50);
        stroke: var(--color-surface, #fff);
        stroke-width: 8;
      }
      .db-token-dot {
        fill: var(--color-surface, #fff);
      }
      @media (prefers-reduced-motion: reduce) {
        .db-token {
          transition: none;
        }
      }
    `,
  ],
})
export class DreamBoardComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  /** The map to draw. */
  @Input({ required: true }) map!: DreamfundBoard;
  /** The tile the token stands on; null at START. */
  @Input() position: number | null = null;
  /** `auto`: a wide map stands up on a portrait screen. */
  @Input() orientation: 'auto' | 'landscape' | 'portrait' = 'auto';

  readonly tileSize = TILE;
  readonly icons = TILE_ICONS;
  readonly sprout = SPROUT_PATH;

  private cache: { key: string; value: Layout } | null = null;

  /** The picture is as wide as the screen leaves room for its height (the controls stay in view), never wider than its box. */
  @HostBinding('style.max-width') get maxWidth(): string {
    return `min(100%, max(150px, calc((100vh - ${HEIGHT_TAKEN}px) * ${this.layout.ratio.toFixed(3)})))`;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.cdr.markForCheck();
  }

  /**
   * Whether the map stands up. A wide map (the rectangle, the infinity) lies down or stands up, whichever gives the bigger tiles in
   * the room the screen leaves: its width, and its height under the header and above the roll bar.
   */
  private get standing(): boolean {
    if (!this.map.standsUp) return false;
    if (this.orientation !== 'auto') return this.orientation === 'portrait';
    if (typeof window === 'undefined') return false;
    const width = Math.min(window.innerWidth - 40, 600);
    const height = Math.max(150, window.innerHeight - HEIGHT_TAKEN);
    const lying = Math.min(width / this.map.aspect, height);
    const upright = Math.min(width, height / this.map.aspect);
    return upright > lying;
  }

  get atStart(): boolean {
    return this.position === null;
  }

  /** Everything the picture needs, made again only when the map, the orientation or the START marker changes. */
  get layout(): Layout {
    const standing = this.standing;
    const key = `${this.map.setup.shape}/${this.map.setup.size}/${this.map.setup.seed}/${standing}/${this.atStart}`;
    if (this.cache?.key === key) return this.cache.value;
    const scale = SPACING / this.map.spacing;
    const raw = this.map.points.map((p) => (standing ? { x: p.y, y: p.x } : { x: p.x, y: p.y }));
    const width = (standing ? 1 : this.map.aspect) * scale;
    const height = (standing ? this.map.aspect : 1) * scale;
    const tiles: DrawnTile[] = this.map.board.map((space, index) => ({
      index,
      kind: space.kind as DreamfundTile,
      x: raw[index].x * scale + MARGIN,
      y: raw[index].y * scale + MARGIN,
    }));
    // START waits outside the track, on the side of the first tile that faces away from the middle of the map
    const first = tiles[0];
    const centre = { x: MARGIN + width / 2, y: MARGIN + height / 2 };
    const away = Math.hypot(first.x - centre.x, first.y - centre.y) || 1;
    const start = {
      x: first.x + ((first.x - centre.x) / away) * START_REACH * 0.7,
      y: first.y + ((first.y - centre.y) / away) * START_REACH * 0.7,
    };
    let minX = 0;
    let minY = 0;
    let maxX = width + 2 * MARGIN;
    let maxY = height + 2 * MARGIN;
    if (this.atStart) {
      minX = Math.min(minX, start.x - MARGIN);
      minY = Math.min(minY, start.y - MARGIN);
      maxX = Math.max(maxX, start.x + MARGIN);
      maxY = Math.max(maxY, start.y + MARGIN);
    }
    const value: Layout = {
      tiles,
      start,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
      trackPoints: tiles.map((t) => `${t.x},${t.y}`).join(' '),
      ratio: (maxX - minX) / (maxY - minY),
    };
    this.cache = { key, value };
    return value;
  }

  get hereTile(): DrawnTile | null {
    return this.position === null ? null : (this.layout.tiles[this.position] ?? null);
  }

  /** Where the token stands: on its tile, or at START outside the track. */
  get tokenTransform(): string {
    const at = this.position === null ? this.layout.start : this.layout.tiles[this.position];
    return `translate(${at.x}px, ${at.y}px)`;
  }

  get ariaLabel(): string {
    return this.position === null
      ? `Dreamfund map: token at start`
      : `Dreamfund map: token on tile ${this.position + 1} of ${this.map.board.length}`;
  }

  trackTile(_: number, tile: DrawnTile): number {
    return tile.index;
  }

  color(kind: DreamfundTile): string {
    return TILE_COLORS[kind];
  }

  labelKey(kind: DreamfundTile): string {
    return TILE_LABEL_KEYS[kind];
  }

  iconOf(kind: DreamfundTile): 'image' | 'sprout' | 'glyph' {
    if (kind === 'opportunity') return 'sprout';
    return TILE_ICONS[kind].image ? 'image' : 'glyph';
  }
}

interface Layout {
  tiles: DrawnTile[];
  start: { x: number; y: number };
  viewBox: string;
  trackPoints: string;
  /** Width over height of the picture. */
  ratio: number;
}
