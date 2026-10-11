import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { formatNumber } from '@angular/common';
import { AppStateService } from '../services/app-state.service';

@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnChanges {
  @Input('appCountUp') targetValue = 0;
  @Input() countDuration = 600; // ms

  private animationFrame: number | null = null;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetValue']) {
      const from = changes['targetValue'].previousValue ?? 0;
      const to = changes['targetValue'].currentValue ?? 0;
      this.animateCount(Number(from), Number(to));
    }
  }

  private animateCount(from: number, to: number): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (from === to) {
      this.el.nativeElement.textContent = this.format(to);
      return;
    }

    const start = performance.now();
    const duration = this.countDuration;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * ease;
      this.el.nativeElement.textContent = this.format(current);
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.animationFrame = null;
      }
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private format(value: number): string {
    // Match AppNumberPipe: +/− prefix, 2 decimal places, the thousands and decimal separators of the chosen number format
    const locale = AppStateService.instance.isEuropeanFormat ? 'de-DE' : 'en-US';
    const abs = formatNumber(Math.abs(value), locale, '1.2-2');
    if (value > 0.005) return '+' + abs;
    if (value < -0.005) return '\u2212' + abs;
    return abs;
  }
}
