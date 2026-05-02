import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnChanges {
  @Input('appCountUp') targetValue: number = 0;
  @Input() countDuration: number = 600; // ms

  private animationFrame: number | null = null;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetValue']) {
      const change = changes['targetValue'];
      const to = Number(change.currentValue ?? 0);
      // First render: paint the target value directly. Animating from 0 produces a
      // visible "0" flash on cached refresh — the user already had this number on disk,
      // so there is nothing to count up to.
      if (change.firstChange) {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.el.nativeElement.textContent = this.format(to);
        return;
      }
      const from = Number(change.previousValue ?? 0);
      this.animateCount(from, to);
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
    // Match AppNumberPipe: +/− prefix, 2 decimal places
    const abs = Math.abs(value).toFixed(2);
    if (value > 0.005) return '+' + abs;
    if (value < -0.005) return '\u2212' + abs;
    return abs;
  }
}
