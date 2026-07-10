import { Component, ViewEncapsulation, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { NgIf, NgClass, NgFor, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoService } from '../shared/services/demo.service';
import { AppStateService } from '../shared/services/app-state.service';

// Deferred imports to break circular chains
let AppComponent: any; setTimeout(() => import('src/app/app.component').then(m => AppComponent = m.AppComponent));
let SettingsComponent: any; setTimeout(() => import('src/app/panels/settings/settings.component').then(m => SettingsComponent = m.SettingsComponent));

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, NgIf, NgClass, NgFor, DecimalPipe, TranslateModule, FormsModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css', '../app.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('incomeFlowWrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  @ViewChild('incomePic') incomePicRef!: ElementRef<HTMLImageElement>;
  @ViewChild('incomeInput') incomeInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('gridContainer') gridContainerRef!: ElementRef<HTMLDivElement>;

  flowPaths: { d: string; color: string; delay: string }[] = [];
  flowDots: { x: number; y: number; color: string; delay: string }[] = [];
  svgWidth = 0;
  svgHeight = 0;
  private resizeListener = () => this.updateFlowLines();

  flippedBuckets = new Set<string>();
  selectedPromptType = 'smile-create';
  aiPreviewStep: 'options' | 'prompt' = 'options';

  // Smile info panel tab tracking
  smileTab: { [key: string]: string } = {
    'sp-japan': 'overview',
    'sp-office': 'overview'
  };

  // Login prompt
  showLoginPrompt = false;
  private loginPromptTimer: any;

  // Language & currency
  currentLang = 'en';
  get currencySymbol(): string { return AppStateService.instance.currency || '€'; }
  languages = [
    { code: 'en', label: 'EN', flag: 'assets/flags/eng.png' },
    { code: 'de', label: 'DE', flag: 'assets/flags/de.png' },
    { code: 'es', label: 'ES', flag: 'assets/flags/es.png' },
    { code: 'fr', label: 'FR', flag: 'assets/flags/fr.png' },
    { code: 'cn', label: 'ZH', flag: 'assets/flags/cn.png' },
    { code: 'ar', label: 'AR', flag: 'assets/flags/tu.png' }
  ];

  // Income → bucket animation
  totalIncome = 100;
  allocation = { daily: 60, splurge: 10, smile: 10, fire: 20 };
  bucketValues = { daily: 0, splurge: 0, smile: 0, fire: 0 };
  incomeDisplay = 100;
  animationStarted = false;
  animationRunning = false;
  showThoughtBubble = false;
  showResetButton = false;
  editingIncome = false;
  customIncomeInput = 100;
  private thoughtBubbleTimer: any;
  private lineHideTimer: any;

  constructor(private demoService: DemoService, private translate: TranslateService) {
    const saved = localStorage.getItem('landingLang');
    if (saved) {
      this.currentLang = saved;
      this.translate.use(saved);
    }
    this.loadAllocation();
    this.scheduleThoughtBubble();
  }

  get appReference() { return AppComponent; }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateFlowLines(), 200);
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
    clearTimeout(this.thoughtBubbleTimer);
    clearTimeout(this.lineHideTimer);
  }

  private updateFlowLines(): void {
    const wrapper = this.wrapperRef?.nativeElement;
    const img = this.incomePicRef?.nativeElement;
    const grid = this.gridContainerRef?.nativeElement;
    if (!wrapper || !img || !grid) return;

    const wr = wrapper.getBoundingClientRect();
    const ir = img.getBoundingClientRect();

    this.svgWidth = wr.width;
    this.svgHeight = wr.height;

    // Income circle geometry
    const cx = ir.left + ir.width / 2 - wr.left;   // center X
    const cy = ir.top + ir.height / 2 - wr.top;     // center Y
    const r = ir.width / 2;                          // radius

    // Start points per bucket depend on layout mode
    const cards = grid.querySelectorAll('.bucket-flip');
    const isNarrow = window.innerWidth < 600;

    const startPoints: Record<number, { x: number; y: number }> = isNarrow
      ? {
          // 2-row layout: top row (daily, splurge) from bottom; bottom row (smile, fire) from sides
          0: { x: cx, y: cy + r },     // daily: bottom center
          1: { x: cx, y: cy + r },     // splurge: bottom center
          2: { x: cx - r, y: cy },     // smile: left side of circle
          3: { x: cx + r, y: cy }      // fire: right side of circle
        }
      : {
          // Single-row layout: outer buckets from sides, inner from bottom
          0: { x: cx - r, y: cy },     // daily: left side
          1: { x: cx, y: cy + r },     // splurge: bottom center
          2: { x: cx, y: cy + r },     // smile: bottom center
          3: { x: cx + r, y: cy }      // fire: right side
        };

    const bucketColors: Record<string, string> = {
      0: 'var(--color-primary)',
      1: 'var(--color-warning)',
      2: 'var(--color-success)',
      3: 'var(--color-fire)'
    };
    const delays = ['0s', '0.1s', '0.2s', '0.3s'];

    const paths: typeof this.flowPaths = [];
    const dots: typeof this.flowDots = [];

    cards.forEach((card, i) => {
      const cr = (card as HTMLElement).getBoundingClientRect();
      const color = bucketColors[i];
      const delay = delays[i];
      const sp = startPoints[i];

      let endX: number, endY: number, d: string;

      if (isNarrow && i >= 2) {
        // Bottom row on mobile: income → near screen edge → down to dot height → into dot
        endY = cr.top + cr.height / 2 - wr.top;
        if (i === 2) {
          // smile: dot on card left edge
          endX = cr.left - wr.left;
          const nearEdge = -7; // near left screen edge
          d = `M ${sp.x} ${sp.y} L ${nearEdge} ${sp.y} L ${nearEdge} ${endY} L ${endX} ${endY}`;
        } else {
          // fire: dot on card right edge
          endX = cr.right - wr.left;
          const nearEdge = wr.width + 7; // near right screen edge
          d = `M ${sp.x} ${sp.y} L ${nearEdge} ${sp.y} L ${nearEdge} ${endY} L ${endX} ${endY}`;
        }
      } else if (isNarrow && i < 2) {
        // Top row on mobile: straight down from bottom of circle to card top-center
        endX = cr.left + cr.width / 2 - wr.left;
        endY = cr.top - wr.top;
        d = `M ${sp.x} ${sp.y} L ${endX} ${sp.y} L ${endX} ${endY}`;
      } else {
        // Desktop or top row on mobile: connect to top-center of card
        endX = cr.left + cr.width / 2 - wr.left;
        endY = cr.top - wr.top;
        // L-shape: go horizontal from start to above card, then straight down
        d = `M ${sp.x} ${sp.y} L ${endX} ${sp.y} L ${endX} ${endY}`;
      }

      paths.push({ d, color, delay });
      dots.push({ x: endX, y: endY, color, delay });
    });

    this.flowPaths = paths;
    this.flowDots = dots;
  }

  toggleBucket(bucket: string): void {
    if (this.flippedBuckets.has(bucket)) {
      this.flippedBuckets.delete(bucket);
      // Reset tab when closing
      if (this.smileTab[bucket]) {
        this.smileTab[bucket] = 'overview';
      }
    } else {
      // For smile project cards, only allow one open at a time
      if (bucket.startsWith('sp-')) {
        for (const key of Array.from(this.flippedBuckets)) {
          if (key.startsWith('sp-')) {
            this.flippedBuckets.delete(key);
            if (this.smileTab[key]) {
              this.smileTab[key] = 'overview';
            }
          }
        }
      }
      this.flippedBuckets.add(bucket);
      if (bucket.startsWith('sp-')) {
        setTimeout(() => {
          const el = document.getElementById('panel-' + bucket);
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }, 50);
      }
    }
  }

  setSmileTab(card: string, tab: string): void {
    this.smileTab[card] = tab;
  }

  requireLogin(): void {
    this.showLoginPrompt = true;
    clearTimeout(this.loginPromptTimer);
    this.loginPromptTimer = setTimeout(() => this.showLoginPrompt = false, 3000);
  }

  selectPromptType(type: string): void {
    this.selectedPromptType = type;
    this.aiPreviewStep = 'options';
  }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) { toggle.checked = false; }
  }

  switchLang(code: string): void {
    this.currentLang = code;
    this.translate.use(code);
    localStorage.setItem('landingLang', code);
    if (code === 'ar') {
      document.body.classList.add('rtl-text');
    } else {
      document.body.classList.remove('rtl-text');
    }
  }

  launchDemo(): void {
    this.demoService.startDemo();
  }

  openAllocation(): void {
    SettingsComponent?.openAllocationEditor();
  }

  private loadAllocation(): void {
    // Sync with AppStateService values (set by SettingsComponent from localStorage)
    const d = AppStateService.instance.daily;
    const sp = AppStateService.instance.splurge;
    const sm = AppStateService.instance.smile;
    const f = AppStateService.instance.fire;
    if (d + sp + sm + f === 100) {
      this.allocation = { daily: d, splurge: sp, smile: sm, fire: f };
    }
  }

  private scheduleThoughtBubble(): void {
    this.thoughtBubbleTimer = setTimeout(() => {
      const isEmpty = this.bucketValues.daily === 0 && this.bucketValues.splurge === 0
        && this.bucketValues.smile === 0 && this.bucketValues.fire === 0;
      if (isEmpty) {
        this.showThoughtBubble = true;
      }
    }, 3000);
  }

  onIncomeClick(): void {
    if (this.animationRunning) return;
    this.showThoughtBubble = false;
    clearTimeout(this.thoughtBubbleTimer);
    this.startCountUp();
  }

  startEditIncome(): void {
    if (this.animationRunning) return;
    this.customIncomeInput = this.totalIncome;
    this.editingIncome = true;
    setTimeout(() => this.incomeInputRef?.nativeElement?.focus(), 0);
  }

  confirmIncome(): void {
    const val = Math.max(0.01, +(this.customIncomeInput || 1).toFixed(2));
    this.totalIncome = val;
    this.customIncomeInput = val;
    this.incomeDisplay = val;
    this.editingIncome = false;
  }

  resetBuckets(): void {
    this.animationRunning = false;
    this.animationStarted = false;
    this.incomeDisplay = this.totalIncome;
    this.bucketValues = { daily: 0, splurge: 0, smile: 0, fire: 0 };
    this.showResetButton = false;
    clearTimeout(this.lineHideTimer);
    this.scheduleThoughtBubble();
  }

  private startCountUp(): void {
    this.animationRunning = true;
    this.animationStarted = true;
    clearTimeout(this.lineHideTimer);
    const duration = 1500;
    const steps = 30;
    const interval = duration / steps;
    let step = 0;

    const t = this.totalIncome;
    const addDaily = +(t * this.allocation.daily / 100).toFixed(2);
    const addSplurge = +(t * this.allocation.splurge / 100).toFixed(2);
    const addSmile = +(t * this.allocation.smile / 100).toFixed(2);
    const addFire = +(t * this.allocation.fire / 100).toFixed(2);
    const startBuckets = { ...this.bucketValues };

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - (1 - progress) * (1 - progress);

      this.incomeDisplay = this.totalIncome;
      this.bucketValues = {
        daily: +(startBuckets.daily + addDaily * eased).toFixed(2),
        splurge: +(startBuckets.splurge + addSplurge * eased).toFixed(2),
        smile: +(startBuckets.smile + addSmile * eased).toFixed(2),
        fire: +(startBuckets.fire + addFire * eased).toFixed(2)
      };

      if (step >= steps) {
        clearInterval(timer);
        this.incomeDisplay = this.totalIncome;
        this.bucketValues = {
          daily: +(startBuckets.daily + addDaily).toFixed(2),
          splurge: +(startBuckets.splurge + addSplurge).toFixed(2),
          smile: +(startBuckets.smile + addSmile).toFixed(2),
          fire: +(startBuckets.fire + addFire).toFixed(2)
        };
        this.animationRunning = false;
        this.showResetButton = true;

        // Hide flow lines after 2 seconds
        this.lineHideTimer = setTimeout(() => {
          this.animationStarted = false;
        }, 2000);
      }
    }, interval);
  }
}
