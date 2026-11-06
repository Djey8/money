import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { richSegments, type RichSegment } from '../../docs/cashflow/manual-content';
import { DreamDemoService } from './demo-guide.service';
import {
  DEMO_STEPS,
  demoLabels,
  demoText,
  type DemoContext,
  type DemoScreen,
  type DemoStep,
} from './demo-steps';

const RANK: Record<DemoScreen, number> = { lobby: 0, room: 1, game: 2 };

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
        <div
          class="dg-hole-block"
          *ngIf="step!.next === 'button'"
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
        <button type="button" class="dg-stop" (click)="stopRequested.emit()">
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
        background: rgba(8, 16, 32, 0.62);
        pointer-events: auto;
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
      .dg-hole-block {
        position: fixed;
        pointer-events: auto;
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
        right: 16px;
        bottom: 16px;
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
  /** What the host knows right now (re-read on every tick, so the host may pass a fresh object). */
  @Input() context: (() => DemoContext) | null = null;
  /** The person pressed "Stop tutorial": the host removes the demo table and leaves. */
  @Output() stopRequested = new EventEmitter<void>();

  hole: Hole | null = null;
  cardStyle: Record<string, string> = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastLook = '';

  constructor(
    private readonly demo: DreamDemoService,
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    // outside Angular's zone: the tick checks the page by itself and only draws when something changed
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => this.tick(), 250);
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
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
    const step = this.step;
    const context = this.context?.();
    return !!step && !!context && step.screen === context.screen;
  }

  next(): void {
    if (this.isLast) {
      this.demo.stop();
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
      (document.querySelector(how.slice('click:'.length)) as HTMLElement | null)?.click();
    }
  }

  private draw(): void {
    this.zone.run(() => this.cdr.detectChanges());
  }

  /** Every quarter second: move on when the step is done, find the lit place, and draw only when something changed. */
  private tick(): void {
    const context = this.context?.();
    if (!context || !this.demo.active()) {
      if (this.lastLook !== '') {
        this.lastLook = '';
        this.draw();
      }
      return;
    }
    // the person is further than the step (they pressed what it pointed at, or went their own way): the story catches up
    let moved = false;
    for (let guard = 0; guard < DEMO_STEPS.length; guard += 1) {
      const step = DEMO_STEPS[this.demo.index()];
      if (!step) break;
      const behind = RANK[step.screen] < RANK[context.screen];
      const finished =
        step.next === 'event' && step.screen === context.screen && !!step.done?.(context);
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
    if (step && step.screen === context.screen && step.target && step.place !== 'center') {
      const element = this.find(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        const inView = rect.bottom > 0 && rect.top < window.innerHeight;
        if (!inView) element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const pad = 6;
        hole = {
          top: Math.max(0, rect.top - pad),
          left: Math.max(0, rect.left - pad),
          width: rect.width + 2 * pad,
          height: rect.height + 2 * pad,
        };
      }
    }
    const look = JSON.stringify([
      this.demo.index(),
      this.demo.active(),
      hole,
      window.innerWidth,
      window.innerHeight,
    ]);
    if (look === this.lastLook && !moved) return;
    this.lastLook = look;
    this.hole = hole;
    this.cardStyle = hole ? this.placeCard(hole) : {};
    this.draw();
  }

  /** A step that waits for the person without lighting a place: only its card shows, in the corner, and the page stays usable. */
  get cornerOnly(): boolean {
    return this.step?.next === 'event' && !this.hole;
  }

  /** A place of the page: a CSS selector, or `selector@@text` for the one whose text is that. */
  private find(target: string): HTMLElement | null {
    const [selector, text] = target.split('@@');
    if (!text) return document.querySelector(selector) as HTMLElement | null;
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
    return all.find((element) => (element.textContent ?? '').trim() === text) ?? null;
  }

  /** The card beside the lit place: below it when there is room, else above it, kept inside the screen. */
  private placeCard(hole: Hole): Record<string, string> {
    const width = Math.min(380, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, hole.left + hole.width / 2 - width / 2),
      window.innerWidth - width - 12,
    );
    const below = hole.top + hole.height + 12;
    const room = window.innerHeight - below;
    if (room >= 230) return { top: `${below}px`, left: `${left}px` };
    const aboveBottom = window.innerHeight - hole.top + 12;
    if (hole.top >= 230) return { bottom: `${aboveBottom}px`, left: `${left}px` };
    return { bottom: '12px', left: `${left}px` };
  }
}
