import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RemoteGameHook } from '../shared/services/remote-game';
import { tableLayerTexts } from './table-layer.texts';
import { TableModeService } from './table-mode.service';

/**
 * Shown at the top of every page of the app while another player's books are on screen (todo/cashflow-multiplayer-solo-ui.md):
 * whatever page it is - Home, Grow, Subscriptions, the Balance - it must be plain that these are not the player's own and that
 * nothing can be changed. Coloured with the colour of the player being looked at; one press goes back to the player's own books.
 */
@Component({
  selector: 'app-table-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb" *ngIf="shown() as who" role="status" [style.border-color]="who.color">
      <span class="tb-swatch" [style.background]="who.color"></span>
      <span class="tb-text">{{ text(who.name) }}</span>
      <button type="button" class="tb-back" (click)="back()">{{ t.backToMe }}</button>
    </div>
    <div class="tb tb--sell" *ngIf="offers().length && !shown()" role="status">
      <span class="tb-text"
        >💰 {{ t.offersTitle }}:
        <ng-container *ngFor="let offer of offers(); let last = last"
          >{{ offer.title }} ({{ leftText(offer.left) }}){{ last ? '' : ', ' }}</ng-container
        ></span
      >
      <button type="button" class="tb-back" (click)="toGame()">{{ t.backToGame }}</button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tb {
        /* in the page's flow above the toolbar: it scrolls away, so the toolbar (profile, stats ...) stays reachable */
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: #fff7d6;
        color: #3b3000;
        border-bottom: 4px solid;
        font-weight: 600;
      }
      .tb--sell {
        background: #e3f6e8;
        color: #0f3d1d;
        border-bottom-color: #27ae60;
      }
      .tb-swatch {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        flex: none;
      }
      .tb-text {
        flex: 1 1 auto;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .tb-back {
        flex: none;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid #3b3000;
        background: #fff;
        color: #3b3000;
        cursor: pointer;
      }
    `,
  ],
})
export class TableBannerComponent implements OnDestroy {
  private readonly mode = inject(TableModeService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private observer: ResizeObserver | null = null;

  constructor() {
    // The bar sits above every page: what it takes is published (--table-banner-height) so the pages that size themselves to the
    // window - the home page on its side - take it off, and nothing slips under the bottom menu.
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      this.observer = new ResizeObserver(() => this.publish());
      this.observer.observe(this.host.nativeElement);
      this.publish();
    });
  }

  private publish(): void {
    const bar = (this.host.nativeElement as HTMLElement).querySelector('.tb') as HTMLElement | null;
    document.documentElement.style.setProperty(
      '--table-banner-height',
      `${bar ? bar.offsetHeight : 0}px`,
    );
    // the Stats charts measure the window: they draw again to the room that is left (see stats/viewport.ts)
    window.dispatchEvent(new Event('mm-banner-height'));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    document.documentElement.style.removeProperty('--table-banner-height');
    window.dispatchEvent(new Event('mm-banner-height'));
  }

  get t() {
    return tableLayerTexts(this.mode.lang);
  }

  /** Whose books these are, while they are somebody else's. */
  readonly shown = computed(() => {
    const seat = this.mode.looking();
    const view = this.mode.view();
    const player = seat !== null && view ? view.players[seat] : undefined;
    return player ? { name: player.name, color: player.color } : null;
  });

  /** The buyers' offers waiting for the player, with how long each stays open. */
  readonly offers = this.mode.myOffers;

  leftText(left: number | null): string {
    if (left === null) return this.t.offerUntilPayday;
    return left <= 1 ? this.t.offerLeftOne : this.t.offerLeft.replace('{n}', String(left));
  }

  /** Back to the game screen, where the End turn / Continue button is. */
  toGame(): void {
    RemoteGameHook.reopen?.();
  }

  text(name: string): string {
    return this.t.lookingAt.replace('{name}', name);
  }

  back(): void {
    this.mode.look(null);
  }
}
