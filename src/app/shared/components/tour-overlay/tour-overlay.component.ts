import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TourService, TourStep, TourSection } from '../../services/tour.service';
import { LocalService } from '../../services/local.service';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './tour-overlay.component.html',
  styleUrls: ['./tour-overlay.component.css']
})
export class TourOverlayComponent implements OnInit, OnDestroy {
  private sub!: Subscription;
  visible = false;
  leaving = false;
  animatingStep = false;
  stepFading = false;
  sectionMenuOpen = false;
  menuNavigating = false;
  bodyCollapsed = false;
  private scrollRAF = 0;

  /** Spotlight geometry (viewport coords) */
  spotlightRect: DOMRect | null = null;

  /** Tooltip position */
  tooltipStyle: Record<string, string> = {};

  languagesRow1 = [
    { code: 'en', flag: 'assets/flags/eng.png', label: 'EN' },
    { code: 'de', flag: 'assets/flags/de.png', label: 'DE' },
    { code: 'es', flag: 'assets/flags/es.png', label: 'ES' },
  ];
  languagesRow2 = [
    { code: 'fr', flag: 'assets/flags/fr.png', label: 'FR' },
    { code: 'cn', flag: 'assets/flags/cn.png', label: 'CN' },
    { code: 'ar', flag: 'assets/flags/tu.png', label: 'AR' },
  ];

  constructor(
    public tour: TourService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
    private localStorage: LocalService
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'en';
  }

  switchLanguage(lang: string) {
    this.translate.use(lang);
    // Persist — mirror the SettingsComponent storage format
    const keys = ['isEng', 'isDe', 'isEs', 'isFr', 'isCn', 'isAr'];
    const map: Record<string, string> = { en: 'isEng', de: 'isDe', es: 'isEs', fr: 'isFr', cn: 'isCn', ar: 'isAr' };
    for (const k of keys) {
      this.localStorage.saveData(k, k === map[lang] ? 'true' : 'false');
    }
    // RTL handling
    if (lang === 'ar') {
      document.body.classList.add('rtl-text');
    } else {
      document.body.classList.remove('rtl-text');
    }
  }

  ngOnInit() {
    this.sub = this.tour.start$.subscribe(async () => {
      this.leaving = false;
      this.sectionMenuOpen = false;
      this.menuNavigating = false;
      this.visible = true;
      document.body.style.paddingBottom = '80vh';
      document.body.classList.add('tour-active');
      this.cdr.detectChanges();
      await this.tour.navigateIfNeeded();
      this.positionSpotlight();
    });
    this.tour.action$.subscribe(action => {
      if (action === 'tourMenuOpen') {
        this.menuNavigating = true;
        this.cdr.detectChanges();
      } else if (action === 'tourMenuClose') {
        this.menuNavigating = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    cancelAnimationFrame(this.scrollRAF);
    document.body.style.paddingBottom = '';
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(e: KeyboardEvent) {
    if (!this.visible) return;
    if (e.key === 'Escape') this.skip();
    if (e.key === 'ArrowRight' || e.key === 'Enter') this.next();
    if (e.key === 'ArrowLeft') this.prev();
  }

  @HostListener('window:resize')
  onResize() {
    if (this.visible) this.positionSpotlight();
  }

  @HostListener('window:scroll')
  onScroll() {
    if (this.visible && this.tour.currentStep?.target && !this.animatingStep) {
      cancelAnimationFrame(this.scrollRAF);
      this.scrollRAF = requestAnimationFrame(() => this.updateSpotlightLive());
    }
  }

  get step(): TourStep {
    return this.tour.currentStep;
  }

  get section(): TourSection {
    return this.tour.currentSection;
  }

  get sections(): TourSection[] {
    return this.tour.sections;
  }

  get isFirst(): boolean {
    return this.tour.isFirstStep;
  }

  get isLast(): boolean {
    return this.tour.isLastStep;
  }

  get progress(): number {
    return this.tour.progress;
  }

  get stepCountInSection(): number {
    return this.tour.currentSection.steps.length;
  }

  get stepIndexInSection(): number {
    return this.tour.currentStepIndex;
  }

  async next() {
    if (this.animatingStep) {
      this.tour.skipMenuAnimation();
      return;
    }
    this.animatingStep = true;
    this.stepFading = true;
    this.cdr.detectChanges();
    await this.delay(220);

    await this.tour.next();
    if (!this.tour.isActive) { this.close(); return; }
    await this.tour.navigateRoute();
    await this.tour.executeAction();

    await this.positionSpotlight();
    this.stepFading = false;
    this.bodyCollapsed = false;
    this.animatingStep = false;
    this.cdr.detectChanges();
  }

  async prev() {
    if (this.animatingStep) return;
    this.animatingStep = true;
    this.stepFading = true;
    this.cdr.detectChanges();
    await this.delay(220);

    await this.tour.prev();
    await this.tour.navigateRoute();
    this.tour.emitAction('closeAllPanels');
    await this.delay(200);
    await this.tour.executeAction();

    await this.positionSpotlight();
    this.stepFading = false;
    this.bodyCollapsed = false;
    this.animatingStep = false;
    this.cdr.detectChanges();
  }

  async goToSection(index: number) {
    this.sectionMenuOpen = false;
    this.animatingStep = true;
    this.stepFading = true;
    this.cdr.detectChanges();
    await this.delay(220);

    await this.tour.goToSection(index);
    await this.tour.navigateRoute();
    await this.tour.executeAction();

    await this.positionSpotlight();
    this.stepFading = false;
    this.bodyCollapsed = false;
    this.animatingStep = false;
    this.cdr.detectChanges();
  }

  toggleSectionMenu() {
    this.sectionMenuOpen = !this.sectionMenuOpen;
  }

  skip() {
    this.close();
  }

  private close() {
    this.leaving = true;
    this.tour.skip();
    document.body.style.paddingBottom = '';
    document.body.classList.remove('tour-active');
    setTimeout(() => {
      this.visible = false;
      this.leaving = false;
      this.animatingStep = false;
      this.stepFading = false;
      this.sectionMenuOpen = false;
    }, 300);
  }

  private delay(ms: number): Promise<void> {
    return this.tour.cancellableDelay(ms);
  }

  /** Find and spotlight the target element, position tooltip */
  positionSpotlight(): Promise<void> {
    return new Promise(resolve => {
      const step = this.tour.currentStep;
      if (!step.target) {
        this.spotlightRect = null;
        this.tooltipStyle = {};
        this.cdr.detectChanges();
        resolve();
        return;
      }

      // Small delay for DOM to settle after route/action changes
      setTimeout(() => {
        const el = document.querySelector(step.target!) as HTMLElement;
        if (!el) {
          this.spotlightRect = null;
          this.tooltipStyle = {};
          this.cdr.detectChanges();
          resolve();
          return;
        }

        const rect = el.getBoundingClientRect();
        const bottomBar = 72;
        const isVisible = rect.top >= 0 && rect.bottom <= (window.innerHeight - bottomBar);

        // For bottom tooltips, ensure there's room below the target for the info box
        const needsTooltipRoom = step.position === 'bottom';
        const hasTooltipRoom = !needsTooltipRoom || rect.bottom < (window.innerHeight - bottomBar) / 2;

        // Fast path: target already visible and enough room for tooltip
        if (isVisible && hasTooltipRoom) {
          this.updateSpotlightLive();
          resolve();
          return;
        }

        // Phase 1: scroll target into view near top
        if (step.position === 'bottom' || step.position === 'left' || step.position === 'right') {
          const targetTop = 80;
          const scrollY = window.scrollY + rect.top - targetTop;
          window.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Phase 2: wait for scroll to settle, then show spotlight + scroll tooltip into view
        setTimeout(() => {
          this.updateSpotlightLive();

          // If tooltip overflows below viewport, scroll down to reveal it
          if (step.position === 'bottom') {
            const tooltip = document.querySelector('.tour-tooltip') as HTMLElement;
            if (tooltip) {
              const tooltipRect = tooltip.getBoundingClientRect();
              const overflow = tooltipRect.bottom - (window.innerHeight - bottomBar);
              if (overflow > 0) {
                window.scrollBy({ top: overflow + 24, behavior: 'smooth' });
                setTimeout(() => this.updateSpotlightLive(), 500);
              }
            }
          }
          resolve();
        }, 400);
      }, 100);
    });
  }

  /** Live-update spotlight position (called on scroll/resize) */
  private updateSpotlightLive() {
    const step = this.tour.currentStep;
    if (!step.target) return;
    const el = document.querySelector(step.target) as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.spotlightRect = rect;
    this.tooltipStyle = this.calculateTooltipPosition(rect, step.position);
    this.cdr.detectChanges();
  }

  private calculateTooltipPosition(rect: DOMRect, position: string): Record<string, string> {
    const pad = 16;
    const tooltipWidth = 360;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Auto-switch to bottom-fixed when target is taller than the viewport
    if (position === 'bottom' && rect.height > vh * 0.7) {
      position = 'bottom-fixed';
    }

    let style: Record<string, string> = { 'max-width': tooltipWidth + 'px' };

    switch (position) {
      case 'bottom':
        style['top'] = (rect.bottom + pad) + 'px';
        style['left'] = Math.max(pad, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - pad)) + 'px';
        break;
      case 'top':
        style['bottom'] = (vh - rect.top + pad) + 'px';
        style['left'] = Math.max(pad, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - pad)) + 'px';
        break;
      case 'left':
        style['top'] = Math.max(pad, rect.top + rect.height / 2 - 60) + 'px';
        style['right'] = (vw - rect.left + pad) + 'px';
        break;
      case 'right':
        style['top'] = Math.max(pad, rect.top + rect.height / 2 - 60) + 'px';
        style['left'] = (rect.right + pad) + 'px';
        break;
      case 'bottom-fixed':
        style['bottom'] = '88px';
        style['left'] = Math.max(pad, (vw - tooltipWidth) / 2) + 'px';
        break;
      default:
        break;
    }
    return style;
  }

  get spotlightClipPath(): string {
    if (!this.spotlightRect) return '';
    const r = this.spotlightRect;
    const pad = 8;
    const x = r.x - pad;
    const y = r.y - pad;
    const w = r.width + pad * 2;
    const h = r.height + pad * 2;
    const radius = 12;
    return `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z ` +
      `M${x + radius},${y} ` +
      `H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} ` +
      `V${y + h - radius} Q${x + w},${y + h} ${x + w - radius},${y + h} ` +
      `H${x + radius} Q${x},${y + h} ${x},${y + h - radius} ` +
      `V${y + radius} Q${x},${y} ${x + radius},${y} Z`;
  }

  isSectionCompleted(index: number): boolean {
    return index < this.tour.currentSectionIndex;
  }

  isSectionActive(index: number): boolean {
    return index === this.tour.currentSectionIndex;
  }
}
