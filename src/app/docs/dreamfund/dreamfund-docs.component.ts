import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { DecimalPipe, NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import { InfoFireComponent } from '../../panels/info/info-fire/info-fire.component';
import { InfoSmileComponent } from '../../panels/info/info-smile/info-smile.component';
import { InfoGrowComponent } from '../../panels/info/info-grow/info-grow.component';
import {
  EXAMPLE_FIRE,
  EXAMPLE_GROW,
  EXAMPLE_SMILE,
  exampleCards,
  type ExampleCard,
} from './dreamfund-examples';
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

/** The languages the Dreamer manual is written in; the others read the English one. */
export const DREAMFUND_MANUAL_LANGUAGES = ['en'];
export const DREAMFUND_MANUAL_FALLBACK = 'en';

/** The manual file: the sections in the order of the page. */
interface DreamfundManual extends ManualContent {
  order: string[];
}

/**
 * The Dreamer (Träumer) game manual (JFK, 2026-10-26): what the game is, the map, every card type, the goals, and the statistics of
 * the characters. Made from docs/DREAMFUND_GAME.md and docs/DREAMFUND_GAME.de.md by `scripts/dreamfund-manual.js`, so the page and the
 * manual never differ; the statistics in it are written by the simulation. Only for game accounts, like the Cashflow manual.
 */
@Component({
  selector: 'app-dreamfund-docs',
  standalone: true,
  imports: [
    DecimalPipe,
    NgIf,
    NgFor,
    NgClass,
    NgSwitch,
    NgSwitchCase,
    RouterLink,
    TranslateModule,
    InfoFireComponent,
    InfoSmileComponent,
    InfoGrowComponent,
  ],
  templateUrl: './dreamfund-docs.component.html',
  styleUrls: [
    '../selfhosted/selfhosted-docs.component.css',
    '../cashflow/cashflow-docs.component.css',
    '../../main/fire/fire-emergencies/fire-emergencies.component.css',
    '../../main/smile/smile-projects/smile-projects.component.css',
    '../../main/grow/grow.component.css',
    './dreamfund-docs.component.css',
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
  /** The cards of an example grid (real projects, in a planned phase). */
  examples(kind: 'fire' | 'smile' | 'grow'): ExampleCard[] {
    // made once: a new list on every check would draw the cards again under the press
    return (this.exampleCache[kind] ??= exampleCards(kind));
  }

  private readonly exampleCache: Partial<Record<'fire' | 'smile' | 'grow', ExampleCard[]>> = {};

  /** Opens the app's own info panel on an example project: read only, not in the account. */
  openExample(kind: 'fire' | 'smile' | 'grow', index: number): void {
    const z = 3000;
    if (kind === 'fire') InfoFireComponent.openPreview(EXAMPLE_FIRE[index], z);
    else if (kind === 'smile') InfoSmileComponent.openPreview(EXAMPLE_SMILE[index], z);
    else InfoGrowComponent.openPreview(EXAMPLE_GROW[index], z);
  }

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

  /** The tone of an example card: the colour of its pile. */
  pileTone(pile: string): string {
    return pile === 'tree' ? '#2e7d32' : pile === 'sapling' ? '#558b2f' : '#7b1fa2';
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
