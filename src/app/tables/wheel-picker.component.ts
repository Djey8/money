import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const ITEM_PX = 40;

/**
 * A number to pick on a wheel (JFK, 2026-10-25): the usual choices turn under a marker, a tap or a flick picks one, and only when none
 * of them fits there is a way to type a number of your own. Used by the "new table" panel for the players, the seconds and the rounds.
 */
@Component({
  selector: 'app-wheel-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wp" [attr.dir]="'ltr'">
      <div
        class="wp-wheel"
        *ngIf="!custom"
        role="listbox"
        tabindex="0"
        [attr.aria-label]="label"
        [attr.aria-activedescendant]="'wp-' + value"
        (scroll)="onScroll()"
        (keydown)="onKey($event)"
        #wheel
      >
        <span class="wp-marker" aria-hidden="true"></span>
        <button
          *ngFor="let option of options"
          type="button"
          role="option"
          class="wp-item"
          [id]="'wp-' + option"
          [class.wp-item--on]="option === value"
          [attr.aria-selected]="option === value"
          (click)="pick(option)"
        >
          {{ option }}{{ unit }}
        </button>
      </div>
      <input
        *ngIf="custom"
        class="wp-input"
        type="number"
        inputmode="numeric"
        [attr.min]="min"
        [attr.max]="max"
        [attr.aria-label]="ownLabel"
        [ngModel]="value"
        (ngModelChange)="typed($event)"
      />
      <button type="button" class="wp-other" (click)="toggleCustom()">
        {{ custom ? backLabel : otherLabel }}
      </button>
    </div>
  `,
  styles: [
    `
      .wp {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
        width: 100%;
        max-width: 11rem;
      }
      .wp-wheel {
        position: relative;
        height: 120px; /* three items: the one in the middle is the choice */
        overflow-y: auto;
        scroll-snap-type: y mandatory;
        padding: 40px 0;
        box-sizing: border-box;
        border-radius: 10px;
        border: 1px solid var(--color-border, #ccc);
        background: var(--color-background, #f6f7f9);
        scrollbar-width: none;
        -webkit-mask-image: linear-gradient(transparent, #000 32%, #000 68%, transparent);
        mask-image: linear-gradient(transparent, #000 32%, #000 68%, transparent);
      }
      .wp-wheel::-webkit-scrollbar {
        display: none;
      }
      .wp-marker {
        position: sticky;
        top: 0; /* the sticky edge already sits inside the wheel's padding */
        display: block;
        height: 0;
        pointer-events: none;
      }
      .wp-marker::after {
        content: '';
        position: absolute;
        inset-inline: 6px;
        top: 0;
        height: 40px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--color-primary, #2a7de1) 16%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-primary, #2a7de1) 45%, transparent);
      }
      .wp-item {
        display: block;
        width: 100%;
        height: 40px;
        border: 0;
        background: transparent;
        color: inherit;
        font-size: 1.05rem;
        scroll-snap-align: center;
        cursor: pointer;
        opacity: 0.55;
      }
      .wp-item--on {
        opacity: 1;
        font-weight: 700;
      }
      .wp-input {
        height: 40px;
        box-sizing: border-box;
        text-align: center;
        font-size: 1.05rem;
      }
      .wp-other {
        border: 0;
        background: transparent;
        color: var(--color-primary, #2a7de1);
        font-size: 0.85rem;
        cursor: pointer;
        padding: 2px;
      }
    `,
  ],
})
export class WheelPickerComponent implements AfterViewInit, OnChanges {
  /** The usual choices, in order. */
  @Input() options: number[] = [];
  @Input() value = 0;
  /** A little text after each number ("s"). */
  @Input() unit = '';
  /** The limits of a number of your own. */
  @Input() min = 1;
  @Input() max = 999;
  @Input() label = '';
  @Input() otherLabel = 'Other';
  @Input() ownLabel = 'Your own number';
  @Input() backLabel = '↺';
  @Output() valueChange = new EventEmitter<number>();

  @ViewChild('wheel') wheel?: ElementRef<HTMLElement>;
  /** Typing a number of your own, because none of the choices fits. */
  custom = false;
  private settle: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.custom = this.value > 0 && !this.options.includes(this.value);
    this.cdr.markForCheck();
    this.scrollToValue(false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      if (!this.options.includes(this.value)) this.custom = true;
      this.scrollToValue(true);
    }
  }

  /** The wheel stands on the chosen number (once the view is there). */
  private scrollToValue(smooth: boolean): void {
    queueMicrotask(() => {
      const el = this.wheel?.nativeElement;
      const index = this.options.indexOf(this.value);
      if (!el || index < 0 || typeof el.scrollTo !== 'function') return;
      el.scrollTo({ top: index * ITEM_PX, behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  pick(option: number): void {
    if (option !== this.value) {
      this.value = option;
      this.valueChange.emit(option);
    }
    this.scrollToValue(true);
  }

  /** The flick has come to rest: the number under the marker is the choice. */
  onScroll(): void {
    clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      const el = this.wheel?.nativeElement;
      if (!el) return;
      const index = Math.max(
        0,
        Math.min(this.options.length - 1, Math.round(el.scrollTop / ITEM_PX)),
      );
      const option = this.options[index];
      if (option !== undefined && option !== this.value) {
        this.value = option;
        this.valueChange.emit(option);
        this.cdr.markForCheck();
      }
    }, 90);
  }

  onKey(event: KeyboardEvent): void {
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const index = this.options.indexOf(this.value);
    const next = this.options[Math.max(0, Math.min(this.options.length - 1, index + step))];
    if (next !== undefined) this.pick(next);
  }

  toggleCustom(): void {
    this.custom = !this.custom;
    if (!this.custom && !this.options.includes(this.value)) {
      // back to the wheel: the nearest usual choice
      const nearest = this.options.reduce((a, b) =>
        Math.abs(b - this.value) < Math.abs(a - this.value) ? b : a,
      );
      this.pick(nearest);
    }
    this.cdr.markForCheck();
    if (!this.custom) this.scrollToValue(false);
  }

  typed(raw: number | string): void {
    const number = Math.round(Number(raw));
    if (!Number.isFinite(number)) return;
    const clamped = Math.max(this.min, Math.min(this.max, number));
    this.value = clamped;
    this.valueChange.emit(clamped);
  }
}
