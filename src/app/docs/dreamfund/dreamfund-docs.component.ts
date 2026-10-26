import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import { DemoService } from '../../shared/services/demo.service';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import {
  richSegments,
  type ManualContent,
  type ManualSection,
  type ManualSectionRef,
  type RichSegment,
} from '../cashflow/manual-content';

// Deferred import to break circular chain
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

/** The languages the Dreamfund manual is written in; the others read the English one. */
export const DREAMFUND_MANUAL_LANGUAGES = ['en', 'de'];
export const DREAMFUND_MANUAL_FALLBACK = 'en';

/** The manual file: the sections in the order of the page. */
interface DreamfundManual extends ManualContent {
  order: string[];
}

/**
 * The Dreamfund (Traumtopf) game manual (JFK, 2026-10-26): what the game is, the map, every card type, the goals, and the statistics of
 * the characters. Made from docs/DREAMFUND_GAME.md and docs/DREAMFUND_GAME.de.md by `scripts/dreamfund-manual.js`, so the page and the
 * manual never differ; the statistics in it are written by the simulation. Only for game accounts, like the Cashflow manual.
 */
@Component({
  selector: 'app-dreamfund-docs',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, NgSwitch, NgSwitchCase, RouterLink, TranslateModule],
  templateUrl: './dreamfund-docs.component.html',
  styleUrls: [
    '../selfhosted/selfhosted-docs.component.css',
    '../cashflow/cashflow-docs.component.css',
    '../../landing/landing-page.component.css',
    '../../app.component.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class DreamfundDocsComponent implements OnInit, OnDestroy {
  sections: ManualSectionRef[] = [];
  selectedIndex = 0;
  content: DreamfundManual | null = null;
  loadFailed = false;
  /** The manual is not written in the app's language yet - the English text is shown. */
  usingFallback = false;

  private langSubscription?: Subscription;
  private segmentCache = new Map<string, RichSegment[]>();

  constructor(
    private http: HttpClient,
    private demoService: DemoService,
    private translate: TranslateService,
    private router: Router,
  ) {
    const saved = localStorage.getItem('landingLang');
    if (saved) {
      this.translate.use(saved);
    }
  }

  get appReference() {
    return AppComponent;
  }

  /** Only a game account sees the manual; checked live because the account loads after the page. */
  get isGameAccount(): boolean {
    return CashflowGameService.isCashflowGame();
  }

  get selected(): ManualSectionRef {
    return this.sections[this.selectedIndex] ?? { id: '', number: '', level: 0 };
  }

  get section(): ManualSection | undefined {
    return this.content?.sections[this.selected.id];
  }

  get previous(): ManualSectionRef | undefined {
    return this.sections[this.selectedIndex - 1];
  }

  get next(): ManualSectionRef | undefined {
    return this.sections[this.selectedIndex + 1];
  }

  navOf(ref: ManualSectionRef): string {
    return this.content?.sections[ref.id]?.nav ?? ref.id;
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0 });
    void this.load();
    // Switching the language reloads the manual in it.
    this.langSubscription = this.translate.onLangChange?.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.langSubscription?.unsubscribe();
  }

  private async load(): Promise<void> {
    const language = this.translate.currentLang || this.translate.defaultLang || 'en';
    const wanted = DREAMFUND_MANUAL_LANGUAGES.includes(language)
      ? language
      : DREAMFUND_MANUAL_FALLBACK;
    this.usingFallback = wanted !== language;
    this.loadFailed = false;
    try {
      this.content = await firstValueFrom(
        this.http.get<DreamfundManual>(`assets/i18n/dreamfund-manual/${wanted}.json`),
      );
      this.sections = this.content.order.map((id, index) => ({
        id,
        number: `${index + 1}`,
        level: 0,
      }));
      if (this.selectedIndex >= this.sections.length) this.selectedIndex = 0;
    } catch {
      this.loadFailed = true;
    }
  }

  selectSection(index: number): void {
    this.selectedIndex = index;
    document.querySelector('.selfhosted-detail')?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeNav(): void {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement;
    if (toggle) {
      toggle.checked = false;
    }
  }

  launchDemo(): void {
    this.demoService.startDemo();
  }

  navigateToSection(sectionId: string): void {
    this.router.navigateByUrl('/').then(() => {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  }

  /** A line of text split into plain, bold and code parts (memoised: the template asks on every pass). */
  segments(text: string): RichSegment[] {
    let parts = this.segmentCache.get(text);
    if (!parts) {
      parts = richSegments(text);
      this.segmentCache.set(text, parts);
    }
    return parts;
  }
}
