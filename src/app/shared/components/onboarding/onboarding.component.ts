import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OnboardingService } from '../../services/onboarding.service';

interface OnboardingStep {
  icon: string;
  titleKey: string;
  bodyKey: string;
  accent: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit, OnDestroy {
  visible = false;
  currentStep = 0;
  leaving = false;
  private sub!: Subscription;

  steps: OnboardingStep[] = [
    { icon: '👋', titleKey: 'Onboarding.step1.title', bodyKey: 'Onboarding.step1.body', accent: 'var(--color-primary)' },
    { icon: '💰', titleKey: 'Onboarding.step2.title', bodyKey: 'Onboarding.step2.body', accent: 'var(--color-cat-daily)' },
    { icon: '🛍️', titleKey: 'Onboarding.step3.title', bodyKey: 'Onboarding.step3.body', accent: 'var(--color-cat-splurge)' },
    { icon: '😊', titleKey: 'Onboarding.step4.title', bodyKey: 'Onboarding.step4.body', accent: 'var(--color-cat-smile)' },
    { icon: '🔥', titleKey: 'Onboarding.step5.title', bodyKey: 'Onboarding.step5.body', accent: 'var(--color-cat-fire)' },
    { icon: '📊', titleKey: 'Onboarding.step6.title', bodyKey: 'Onboarding.step6.body', accent: 'var(--color-primary)' },
    { icon: '🚀', titleKey: 'Onboarding.step7.title', bodyKey: 'Onboarding.step7.body', accent: 'var(--color-success)' },
  ];

  constructor(
    private onboardingService: OnboardingService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.sub = this.onboardingService.start$.subscribe(() => {
      this.currentStep = 0;
      this.leaving = false;
      this.visible = true;
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(e: KeyboardEvent) {
    if (!this.visible) return;
    if (e.key === 'Escape') this.skip();
    if (e.key === 'ArrowRight' || e.key === 'Enter') this.next();
    if (e.key === 'ArrowLeft') this.prev();
  }

  get step(): OnboardingStep {
    return this.steps[this.currentStep];
  }

  get isFirst(): boolean {
    return this.currentStep === 0;
  }

  get isLast(): boolean {
    return this.currentStep === this.steps.length - 1;
  }

  get progress(): number {
    return ((this.currentStep + 1) / this.steps.length) * 100;
  }

  next() {
    if (this.isLast) {
      this.finish();
    } else {
      this.currentStep++;
    }
  }

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  goToStep(index: number) {
    this.currentStep = index;
  }

  skip() {
    this.close();
  }

  finish() {
    this.close();
  }

  private close() {
    this.leaving = true;
    this.onboardingService.markCompleted();
    setTimeout(() => {
      this.visible = false;
      this.leaving = false;
    }, 300);
  }
}
