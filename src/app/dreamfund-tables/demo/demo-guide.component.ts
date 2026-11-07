import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TablesApiService } from '../../tables/tables-api.service';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { richSegments, type RichSegment } from '../../docs/cashflow/manual-content';
import { TableModeService } from '../../tables/table-mode.service';
import { DreamDemoService } from './demo-guide.service';
import {
  DEMO_STEPS,
  demoLabels,
  demoText,
  demoContext,
  demoScreen,
  stepIsFor,
  type DemoContext,
  type DemoScreen,
  type DemoStep,
} from './demo-steps';

/** The table's own screens come in this order; every other page (Grow, Fire ...) is the game's level: the story never skips over it. */
const RANK: Partial<Record<DemoScreen, number>> = { lobby: 0, room: 1 };
const rankOf = (screen: DemoScreen): number => RANK[screen] ?? 2;

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The coach of the guided demo game: a dimmed page with the place it is talking about lit up, and a card with a few words. The lit place
 * stays clickable when the step asks the person to press it - so they use the real app, only guided. Mounted by the lobby, the table
 * page and the game screen, each with what it knows (`context`); the service keeps the place in the story across all three.
 */
@Component({
  selector: 'app-dream-demo-guide',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dg" *ngIf="shown" [class.dg--wait]="step!.next === 'event'">
      <!-- the page around the lit place cannot be pressed; the lit place can, when the step asks for it -->
      <ng-container *ngIf="hole as h; else everything">
        <div
          class="dg-shade"
          [style.top.px]="0"
          [style.left.px]="0"
          [style.right.px]="0"
          [style.height.px]="h.top"
        ></div>
        <div
          class="dg-shade"
          [style.top.px]="h.top + h.height"
          [style.left.px]="0"
          [style.right.px]="0"
          [style.bottom.px]="0"
        ></div>
        <div
          class="dg-shade"
          [style.top.px]="h.top"
          [style.left.px]="0"
          [style.width.px]="h.left"
          [style.height.px]="h.height"
        ></div>
        <div
          class="dg-shade"
          [style.top.px]="h.top"
          [style.left.px]="h.left + h.width"
          [style.right.px]="0"
          [style.height.px]="h.height"
        ></div>
        <div
          class="dg-ring"
          [style.top.px]="h.top"
          [style.left.px]="h.left"
          [style.width.px]="h.width"
          [style.height.px]="h.height"
        ></div>
      </ng-container>
      <ng-template #everything>
        <div class="dg-shade dg-shade--all" *ngIf="!cornerOnly"></div>
      </ng-template>

      <section
        class="dg-card"
        [class.dg-card--center]="!hole && !cornerOnly"
        [class.dg-card--corner]="cornerOnly"
        [ngStyle]="cardStyle"
        role="dialog"
        aria-live="polite"
      >
        <div class="dg-meta">
          <span class="dg-chapter">{{ chapterName }}</span>
          <span class="dg-count"
            >{{ labels.step }} {{ index + 1 }} {{ labels.of }} {{ total }}</span
          >
        </div>
        <div class="dg-bar"><div class="dg-bar-fill" [style.width.%]="progress"></div></div>
        <h3 class="dg-title">{{ words.title }}</h3>
        <p class="dg-text">
          <ng-container *ngFor="let part of parts">
            <strong *ngIf="part.bold">{{ part.text }}</strong>
            <code *ngIf="part.code">{{ part.text }}</code>
            <ng-container *ngIf="!part.bold && !part.code">{{ part.text }}</ng-container>
          </ng-container>
        </p>
        <div class="dg-actions">
          <button
            type="button"
            class="dg-btn dg-btn--ghost"
            *ngIf="index > 0 && step!.next === 'button'"
            (click)="back()"
          >
            ‹ {{ labels.back }}
          </button>
          <span class="dg-spacer"></span>
          <button
            type="button"
            class="dg-btn dg-btn--ghost"
            *ngIf="step!.assist"
            (click)="assist()"
          >
            {{ labels.assist }}
          </button>
          <button
            type="button"
            class="dg-btn dg-btn--ghost"
            *ngIf="step!.next === 'event'"
            (click)="next()"
          >
            {{ labels.skip }} ›
          </button>
          <button
            type="button"
            class="dg-btn dg-btn--primary"
            *ngIf="step!.next === 'button'"
            (click)="next()"
          >
            {{ isLast ? labels.finish : labels.next }} ›
          </button>
        </div>
        <button type="button" class="dg-stop" (click)="stop()">
          {{ labels.stop }}
        </button>
      </section>
    </div>
  `,
  styles: [
    `
      .dg {
        position: fixed;
        inset: 0;
        z-index: 100000;
        pointer-events: none;
      }
      .dg-shade {
        position: fixed;
        background: rgba(8, 16, 32, 0.34);
        /* only a dimming: the page under it can be scrolled and pressed (on a phone a layer that took the touches stopped the scrolling) */
        pointer-events: none;
      }
      .dg-shade--all {
        inset: 0;
      }
      .dg-ring {
        position: fixed;
        border: 3px solid #ffb300;
        border-radius: 10px;
        box-shadow:
          0 0 0 4px rgba(255, 179, 0, 0.35),
          0 0 24px rgba(255, 179, 0, 0.6);
        pointer-events: none;
        animation: dg-pulse 1.6s ease-in-out infinite;
      }
      @keyframes dg-pulse {
        50% {
          box-shadow:
            0 0 0 7px rgba(255, 179, 0, 0.2),
            0 0 30px rgba(255, 179, 0, 0.8);
        }
      }
      .dg-card {
        position: fixed;
        width: min(380px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        overflow-y: auto;
        box-sizing: border-box;
        padding: 14px 16px 12px;
        background: var(--color-surface, #fff);
        color: var(--color-text, #1d2733);
        border-radius: 14px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
        pointer-events: auto;
        font-size: 14px;
        line-height: 1.45;
      }
      .dg-card--corner {
        right: 12px;
        bottom: 12px;
        width: min(340px, calc(100vw - 24px));
      }
      .dg-card--center {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(460px, calc(100vw - 24px));
      }
      .dg-meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b7785;
      }
      .dg-bar {
        height: 3px;
        margin: 6px 0 10px;
        background: #e3e8ee;
        border-radius: 2px;
      }
      .dg-bar-fill {
        height: 100%;
        background: #ffb300;
        border-radius: 2px;
      }
      .dg-title {
        margin: 0 0 6px;
        font-size: 17px;
      }
      .dg-text {
        margin: 0 0 12px;
      }
      .dg-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .dg-spacer {
        flex: 1;
      }
      .dg-btn {
        border: 1px solid #c8d0da;
        background: #fff;
        color: inherit;
        border-radius: 8px;
        padding: 7px 14px;
        font-size: 13px;
        cursor: pointer;
      }
      .dg-btn--primary {
        background: #1976d2;
        border-color: #1976d2;
        color: #fff;
        font-weight: 600;
      }
      .dg-btn--ghost {
        background: transparent;
      }
      .dg-stop {
        display: block;
        margin: 10px auto 0;
        background: none;
        border: 0;
        color: #6b7785;
        font-size: 12px;
        text-decoration: underline;
        cursor: pointer;
      }
      @media (max-width: 600px) {
        .dg-card:not(.dg-card--center) {
          left: 12px !important;
          right: 12px;
          top: auto !important;
          bottom: 12px;
          width: auto;
        }
      }
    `,
  ],
})
export class DreamDemoGuideComponent implements OnInit, OnDestroy {
  /** The step may be shown: its place is on the page (and has settled). */
  private ready = false;
  private foundSince = 0;
  private missingSince = 0;
  private lastIndex = -1;

  hole: Hole | null = null;
  cardStyle: Record<string, string> = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastLook = '';
  private lastScrollAt = 0;
  /** The place is too tall to light up: only the card shows, in the corner. */
  private tall = false;

  constructor(
    private readonly demo: DreamDemoService,
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly host: ElementRef<HTMLElement>,
    private readonly router: Router,
    private readonly mode: TableModeService,
    private readonly api: TablesApiService,
  ) {}

  /** What the coach knows right now: the table (wherever the person is in the app) and the page. */
  private context(): DemoContext {
    return demoContext(
      demoScreen(),
      this.table(),
      (this.mode.session() ?? this.demo.roomSession())?.legalActions() ?? [],
      (selector) => !!document.querySelector(selector),
    );
  }

  ngOnInit(): void {
    // the coach lives on the body: inside the game panel (which is moved and scaled) a fixed overlay would be placed against the panel,
    // not the screen, and every lit place would be off
    document.body.appendChild(this.host.nativeElement);
    // outside Angular's zone: the tick checks the page by itself and only draws when something changed
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        this.tick();
      }, 150);
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.host.nativeElement.remove();
  }

  get language(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'en';
  }

  get labels() {
    return demoLabels(this.language);
  }

  get index(): number {
    return this.demo.index();
  }

  get total(): number {
    return DEMO_STEPS.length;
  }

  get isLast(): boolean {
    return this.index >= DEMO_STEPS.length - 1;
  }

  get step(): DemoStep | null {
    return this.demo.active() ? (DEMO_STEPS[this.index] ?? null) : null;
  }

  get words() {
    return demoText(this.step?.id ?? '', this.language);
  }

  get parts(): RichSegment[] {
    return richSegments(this.words.text);
  }

  get chapterName(): string {
    return this.labels.chapters[this.step?.chapter ?? ''] ?? '';
  }

  get progress(): number {
    return ((this.index + 1) / DEMO_STEPS.length) * 100;
  }

  /** The step is for this screen and there is a coach at all. */
  get shown(): boolean {
    return this.ready && !!this.step;
  }

  /** "Stop tutorial": over at once. A demo table is taken away and the person is back in the lobby, free to play for real. */
  /** The table the person is at: the game screen's, or the table page's while it is only a lobby. */
  private table() {
    return (this.mode.session() ?? this.demo.roomSession())?.view() ?? null;
  }

  /** "Stop tutorial": over at once. A demo table is taken away and the person is back in the lobby, free to play for real. */
  async stop(): Promise<void> {
    const view = this.table();
    const id = view?.id ?? null;
    const demoTable = (view?.settings as unknown as { demo?: string } | undefined)?.demo;
    this.demo.stop(id);
    this.ready = false;
    this.draw();
    if (id && demoTable === 'basics') {
      try {
        await firstValueFrom(this.api.remove(id));
      } catch {
        // the table may be gone already
      }
      // the app is reloaded on the lobby: nothing of the table is left on the screen
      window.location.hash = '#/tables?lobby=1';
      window.location.reload();
    } else {
      void this.router.navigate(['/tables']);
    }
  }

  next(): void {
    if (this.isLast) {
      // the story is told: the demo table stays, and the game goes on to its end
      this.demo.stop(this.table()?.id ?? null);
      this.ready = false;
      this.draw();
      return;
    }
    this.demo.goTo(this.index + 1);
    this.draw();
  }

  back(): void {
    this.demo.goTo(this.index - 1);
    this.draw();
  }

  /** "Do it for me": a press on the real button. */
  assist(): void {
    const how = this.step?.assist ?? '';
    if (how.startsWith('click:')) {
      this.find(how.slice('click:'.length))?.click();
    } else if (how.startsWith('go:')) {
      void this.router.navigateByUrl(how.slice('go:'.length));
    }
  }

  private draw(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }

  /** Every quarter second: move on when the step is done, find the lit place, and draw only when something changed. */
  private tick(): void {
    const context = this.context();
    if (!this.demo.active()) {
      if (this.lastLook !== '') {
        this.lastLook = '';
        this.draw();
      }
      return;
    }
    // the person is further than the step (they pressed what it pointed at, or went their own way): the story catches up
    let moved = false;
    if (this.lastIndex !== this.demo.index()) {
      this.lastIndex = this.demo.index();
      this.foundSince = 0;
      this.missingSince = 0;
    }
    for (let guard = 0; guard < DEMO_STEPS.length; guard += 1) {
      const step = DEMO_STEPS[this.demo.index()];
      if (!step) break;
      const stepRank = Math.min(...[step.screen].flat().map(rankOf));
      const behind = stepRank < rankOf(context.screen);
      // a step is done by what has happened, wherever the person is (the page of the step may be left behind: Fire, Grow ...)
      const finished = step.next === 'event' && !!step.done?.(context);
      if (!behind && !finished) break;
      if (this.demo.index() >= DEMO_STEPS.length - 1) {
        this.demo.stop();
        moved = true;
        break;
      }
      this.demo.goTo(this.demo.index() + 1);
      moved = true;
    }
    const step = this.step;
    let hole: Hole | null = null;
    this.tall = false;
    let ready = !!step && stepIsFor(step, context.screen);
    if (step && ready && step.target && step.place !== 'center') {
      const element = this.find(step.target);
      // a place that is not on the page yet (a card still being drawn, dice still rolling): the coach waits for it - and for a moment
      // after it has appeared - instead of talking about something the person cannot see
      if (!element) {
        // still not there after a long while (the person went another way): the card shows in the corner, so they can read it or skip
        if (this.missingSince === 0) this.missingSince = Date.now();
        ready = Date.now() - this.missingSince > 12000;
        this.foundSince = 0;
      } else {
        this.missingSince = 0;
        if (this.foundSince === 0) this.foundSince = Date.now();
        if (Date.now() - this.foundSince < 450) ready = false;
      }
      if (element) {
        const rect = element.getBoundingClientRect();
        // a place that is taller than most of the screen (a sheet to scroll) is not lit: its card says what to look at
        this.tall = rect.height > window.innerHeight * 0.62;
        const inView = rect.top >= 0 && rect.bottom <= window.innerHeight - 8;
        if (!this.tall && !inView && Date.now() - this.lastScrollAt > 1200) {
          this.lastScrollAt = Date.now();
          element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        if (!this.tall) {
          const pad = 6;
          const top = Math.max(0, rect.top - pad);
          const left = Math.max(0, rect.left - pad);
          const bottom = Math.min(window.innerHeight, rect.bottom + pad);
          const right = Math.min(window.innerWidth, rect.right + pad);
          if (bottom > top && right > left) {
            hole = { top, left, width: right - left, height: bottom - top };
          }
        }
      }
    }
    if (!(step && step.target)) this.foundSince = 0;
    if (ready !== this.ready) moved = true;
    this.ready = ready;
    const look = JSON.stringify([
      this.demo.index(),
      ready,
      this.demo.active(),
      hole,
      window.innerWidth,
      window.innerHeight,
      this.tall,
    ]);
    if (look === this.lastLook && !moved) return;
    this.lastLook = look;
    this.hole = hole;
    this.cardStyle = hole ? this.placeCard(hole) : {};
    this.draw();
  }

  /** A step that waits for the person without lighting a place: only its card shows, in the corner, and the page stays usable. */
  get cornerOnly(): boolean {
    return (
      !this.hole && (this.step?.next === 'event' || this.step?.place === 'corner' || this.tall)
    );
  }

  /** A place of the page: a CSS selector, or `selector@@text` for the one whose text is that. */
  private find(target: string): HTMLElement | null {
    const [selector, text] = target.split('@@');
    if (!text) return document.querySelector(selector) as HTMLElement | null;
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
      (e) => e.offsetParent !== null,
    );
    // `@@~text`: the one whose text contains it; `@@text`: whose text is exactly it
    if (text.startsWith('~'))
      return all.find((element) => (element.textContent ?? '').includes(text.slice(1))) ?? null;
    return all.find((element) => (element.textContent ?? '').trim() === text) ?? null;
  }

  /** The card beside the lit place: below it, above it, or to a side - wherever it fits whole - else in a corner that is free. */
  private placeCard(hole: Hole): Record<string, string> {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = document.querySelector('.dg-card') as HTMLElement | null;
    const width = Math.min(380, vw - 24);
    const height = (card?.offsetHeight ?? 260) + 8;
    const gap = 14;
    const clampX = (x: number) => Math.min(Math.max(12, x), vw - width - 12);
    const clampY = (y: number) => Math.min(Math.max(12, y), vh - height - 12);
    const centerX = clampX(hole.left + hole.width / 2 - width / 2);
    const centerY = clampY(hole.top + hole.height / 2 - height / 2);
    const below = hole.top + hole.height + gap;
    if (vh - below >= height + 12) return { top: `${below}px`, left: `${centerX}px` };
    const above = hole.top - gap - height;
    if (above >= 12) return { top: `${above}px`, left: `${centerX}px` };
    const right = hole.left + hole.width + gap;
    if (vw - right >= width + 12) return { top: `${centerY}px`, left: `${right}px` };
    const left = hole.left - gap - width;
    if (left >= 12) return { top: `${centerY}px`, left: `${left}px` };
    // nowhere beside it: the corner of the screen the lit place does not cover
    const corners = [
      { top: vh - height - 12, left: vw - width - 12 },
      { top: vh - height - 12, left: 12 },
      { top: 12, left: vw - width - 12 },
      { top: 12, left: 12 },
    ];
    const free = corners.find(
      (c) =>
        c.left + width < hole.left ||
        c.left > hole.left + hole.width ||
        c.top + height < hole.top ||
        c.top > hole.top + hole.height,
    );
    const at = free ?? corners[0];
    return { top: `${at.top}px`, left: `${at.left}px` };
  }
}
