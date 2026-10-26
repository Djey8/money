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
/** The pad the tokens wait on before the first roll: above the map, in the middle. */
const START_HEIGHT = 84;
const START_GAP = 24;
/** The token's size and the space kept between it and its tile. */
const TOKEN_DISTANCE = Math.round(TILE * 1.12);
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
        <rect
          class="db-start-pad"
          [attr.x]="layout.start.x - layout.startWidth / 2"
          [attr.y]="layout.start.y - START_HEIGHT / 2"
          [attr.width]="layout.startWidth"
          [attr.height]="START_HEIGHT"
          rx="22"
        />
        <text
          [attr.x]="layout.start.x"
          [attr.y]="layout.start.y - START_HEIGHT / 2 + 18"
          class="db-start-text"
        >
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
        <polygon
          *ngIf="tokenAngle !== null"
          class="db-token-pointer"
          points="19,-9 33,0 19,9"
          [attr.transform]="'rotate(' + tokenAngle + ')'"
        />
        <circle r="21" class="db-token-body" />
        <circle r="8" class="db-token-dot" />
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
      .db-start-pad {
        fill: color-mix(in srgb, var(--color-primary, #2c3e50) 8%, var(--color-surface, #fff));
        stroke: var(--color-border, #ccc);
        stroke-width: 4;
        stroke-dasharray: 8 8;
      }
      .db-start-text {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.12em;
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
        stroke-width: 5;
      }
      .db-token-pointer {
        fill: var(--color-primary, #2c3e50);
        stroke: var(--color-surface, #fff);
        stroke-width: 4;
        stroke-linejoin: round;
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
  readonly tileSize = TILE;
  readonly START_HEIGHT = START_HEIGHT;
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

  get atStart(): boolean {
    return this.position === null;
  }

  /** Everything the picture needs, made again only when the map, the orientation or the START marker changes. */
  get layout(): Layout {
    const key = `${this.map.setup.shape}/${this.map.setup.size}/${this.map.setup.seed}/${this.atStart}`;
    if (this.cache?.key === key) return this.cache.value;
    const scale = SPACING / this.map.spacing;
    // the map is always drawn as it is shown in the choice of the maps: an infinity lies down, whatever the screen
    const width = this.map.aspect * scale;
    const height = scale;
    const tiles: DrawnTile[] = this.map.board.map((space, index) => ({
      index,
      kind: space.kind as DreamfundTile,
      x: this.map.points[index].x * scale + MARGIN,
      y: this.map.points[index].y * scale + MARGIN,
    }));
    // START is a pad above the map, in the middle: the tokens wait there side by side until the first roll
    const startWidth = Math.min(width + 2 * MARGIN - 20, 300);
    const start = { x: MARGIN + width / 2, y: -START_GAP - START_HEIGHT / 2 };
    const minX = 0;
    const minY = this.atStart ? -START_GAP - START_HEIGHT - 8 : 0;
    const maxX = width + 2 * MARGIN;
    const maxY = height + 2 * MARGIN;
    // a token stands inside the map, next to its tile, the way tokens do at a table
    const spots = tokenSpots(tiles);
    const value: Layout = {
      tiles,
      spots,
      start,
      startWidth,
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
    if (this.position === null) {
      const at = this.layout.start;
      return `translate(${at.x}px, ${at.y + 8}px)`;
    }
    const at = this.layout.spots[this.position] ?? this.layout.tiles[this.position];
    return `translate(${at.x}px, ${at.y}px)`;
  }

  /** The way the token points: at its tile (none while it waits at START). */
  get tokenAngle(): number | null {
    if (this.position === null) return null;
    return this.layout.spots[this.position]?.angle ?? null;
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
  /** Where the token stands when it is on a tile: inside the map, beside it. */
  spots: { x: number; y: number; angle: number }[];
  start: { x: number; y: number };
  startWidth: number;
  viewBox: string;
  trackPoints: string;
  /** Width over height of the picture. */
  ratio: number;
}

/**
 * Where a token stands next to each tile: on the inner side of the track, so it lies inside the map and covers no tile. Inner is the
 * side of the middle of the whole map - or, for a tile close to that middle (the crossing of an infinity), the middle of the loop
 * the tile is on, found from the tiles around it on the track.
 */
export function tokenSpots(
  tiles: { x: number; y: number }[],
): { x: number; y: number; angle: number }[] {
  const n = tiles.length;
  const centre = {
    x: tiles.reduce((sum, t) => sum + t.x, 0) / n,
    y: tiles.reduce((sum, t) => sum + t.y, 0) / n,
  };
  const around = Math.max(3, Math.round(n / 5));
  // an infinity has two loops: the middle of each is found from the tiles that are clearly in it, and every tile near the crossing
  // belongs to the loop its neighbours on the track are in - so the token stands inside that loop, beside the tile, whichever way the
  // tile itself lies at the crossing (JFK, 2026-10-26)
  const clear = SPACING * 1.6;
  const left = tiles.filter((t) => t.x < centre.x - clear);
  const right = tiles.filter((t) => t.x > centre.x + clear);
  const middleOf = (group: { x: number; y: number }[]) => ({
    x: group.reduce((sum, t) => sum + t.x, 0) / group.length,
    y: group.reduce((sum, t) => sum + t.y, 0) / group.length,
  });
  const loops = left.length >= 3 && right.length >= 3 ? [middleOf(left), middleOf(right)] : null;
  return tiles.map((tile, i) => {
    let target = centre;
    if (Math.hypot(centre.x - tile.x, centre.y - tile.y) < SPACING * 1.6) {
      if (loops) {
        // the side the tiles around this one are on
        let side = 0;
        for (let k = -around; k <= around; k += 1) side += tiles[(i + k + n) % n].x - centre.x;
        target = side < 0 ? loops[0] : loops[1];
      } else {
        // near the middle: the loop this tile belongs to
        let sx = 0;
        let sy = 0;
        for (let k = -around; k <= around; k += 1) {
          const t = tiles[(i + k + n) % n];
          sx += t.x;
          sy += t.y;
        }
        target = { x: sx / (2 * around + 1), y: sy / (2 * around + 1) };
      }
    } else if (loops) {
      target = tile.x < centre.x ? loops[0] : loops[1];
    }
    const dx = target.x - tile.x;
    const dy = target.y - tile.y;
    const length = Math.hypot(dx, dy) || 1;
    // like the token of the rat race at a table: on the line from the middle through the middle of the tile, always the same
    // distance inside it (the classic board keeps 1.1 cells), so the tokens of a map stand on one circle-like track and each is
    // clearly beside its own tile; where the map is narrow the distance shrinks, at the last the token stands outside (JFK, 2026-10-26)
    const along = (sign: number, distance: number) => ({
      x: tile.x + sign * (dx / length) * distance,
      y: tile.y + sign * (dy / length) * distance,
    });
    const room = (at: { x: number; y: number }) =>
      Math.min(
        ...tiles.filter((_, other) => other !== i).map((t) => Math.hypot(at.x - t.x, at.y - t.y)),
      );
    const facing = (at: { x: number; y: number }) => ({
      ...at,
      // the token points at its tile
      angle: (Math.atan2(tile.y - at.y, tile.x - at.x) * 180) / Math.PI,
    });
    for (const distance of [TOKEN_DISTANCE, 78, 70, 64]) {
      const inner = along(1, distance);
      if (room(inner) >= TILE / 2 + 4) return facing(inner);
    }
    const rest = [along(1, 58), along(-1, TOKEN_DISTANCE), along(-1, 70), along(-1, 58)];
    return facing(rest.reduce((best, at) => (room(at) > room(best) ? at : best), along(1, 54)));
  });
}
