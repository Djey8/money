import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import {
  type CashflowDealCard,
  type CashflowDoodadCard,
  type CashflowMarketCard,
  type CashflowProfession,
} from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../../shared/cashflow-content';
import { DemoService } from '../../shared/services/demo.service';
import { AppStateService } from '../../shared/services/app-state.service';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import { CashflowCardTextService } from '../../shared/services/cashflow-card-text.service';
import {
  MANUAL_FALLBACK_LANGUAGE,
  MANUAL_LANGUAGES,
  MANUAL_SECTIONS,
  richSegments,
  type ManualBlock,
  type ManualContent,
  type ManualSection,
  type ManualSectionRef,
  type RichSegment,
} from './manual-content';
import {
  buildManualTable,
  type LabResults,
  type ManualContext,
  type ManualTable,
} from './manual-data';

// Deferred import to break circular chain
let AppComponent: any;
setTimeout(() => import('src/app/app.component').then((m) => (AppComponent = m.AppComponent)));

/** A real card of the catalog as the manual draws it: which pile it comes from, its text and its numbers. */
export interface ManualFace {
  tone: 'small' | 'big' | 'doodad' | 'market';
  title: string;
  text: string;
  facts: { label: string; value: string }[];
}

/**
 * The Cashflow game manual (JFK, 2026-10-04): a second documentation topic, only for Cashflow game
 * accounts. Written as data per language and rendered section by section like the self-hosting guide;
 * its tables and card examples come straight from the card catalog.
 */
@Component({
  selector: 'app-cashflow-docs',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, NgSwitch, NgSwitchCase, RouterLink, TranslateModule],
  templateUrl: './cashflow-docs.component.html',
  styleUrls: [
    '../selfhosted/selfhosted-docs.component.css',
    './cashflow-docs.component.css',
    '../../landing/landing-page.component.css',
    '../../app.component.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class CashflowDocsComponent implements OnInit, OnDestroy {
  sections: ManualSectionRef[] = MANUAL_SECTIONS;
  selectedIndex = 0;
  content: ManualContent | null = null;
  /** What the strategy lab measured (scripts/strategy-lab.js); null when the file is not there. */
  lab: LabResults | null = null;
  loadFailed = false;
  /** The manual is not written in the app's language yet - the English text is shown. */
  usingFallback = false;

  private langSubscription?: Subscription;
  private tableCache = new Map<string, ManualTable>();
  private segmentCache = new Map<string, RichSegment[]>();

  constructor(
    private http: HttpClient,
    private demoService: DemoService,
    private translate: TranslateService,
    private router: Router,
    private cardText: CashflowCardTextService,
  ) {
    const saved = localStorage.getItem('landingLang');
    if (saved) {
      this.translate.use(saved);
    }
  }

  get appReference() {
    return AppComponent;
  }

  /** Only a Cashflow game account sees the manual; checked live because the account loads after the page. */
  get isGameAccount(): boolean {
    return CashflowGameService.isCashflowGame();
  }

  get selected(): ManualSectionRef {
    return this.sections[this.selectedIndex];
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
    const match = window.location.hash.match(/section=(\w+)/);
    if (match) {
      const index = this.sections.findIndex((section) => section.id === match[1]);
      if (index >= 0) this.selectedIndex = index;
    }
    void this.load();
    // Switching the language reloads the manual in it.
    this.langSubscription = this.translate.onLangChange?.subscribe(() => void this.load());
  }

  ngOnDestroy(): void {
    this.langSubscription?.unsubscribe();
  }

  private async load(): Promise<void> {
    const language = this.translate.currentLang || this.translate.defaultLang || 'en';
    const wanted = MANUAL_LANGUAGES.includes(language) ? language : MANUAL_FALLBACK_LANGUAGE;
    this.usingFallback = wanted !== language;
    this.loadFailed = false;
    try {
      this.tableCache.clear();
      this.faceCache.clear();
      this.content = await firstValueFrom(
        this.http.get<ManualContent>(`assets/i18n/cashflow-manual/${wanted}.json`),
      );
      // The cards drawn in the manual use the same texts as the game.
      await this.cardText.ensureLoaded();
      // The strategy tables read the lab's results; the manual still works without them.
      this.lab = await firstValueFrom(
        this.http.get<LabResults>('assets/i18n/cashflow-manual/strategy-lab.json'),
      ).catch(() => null);
      this.tableCache.clear();
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

  // ---------------------------------------------------------------- text

  /** A line of text split into plain, bold and code parts (memoised: the template asks on every pass). */
  segments(text: string): RichSegment[] {
    let parts = this.segmentCache.get(text);
    if (!parts) {
      parts = richSegments(text);
      this.segmentCache.set(text, parts);
    }
    return parts;
  }

  // ---------------------------------------------------------------- tables from the card catalog

  private get formatContext(): ManualContext {
    const locale = (this.translate.currentLang || 'en') === 'de' ? 'de-DE' : 'en-US';
    const currency = AppStateService.instance.currency || '€';
    const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    return {
      labels: this.content?.labels ?? {},
      money: (minor) => `${whole.format(minor / 100)} ${currency}`,
      percent: (ratio) => `${whole.format(ratio * 100)} %`,
      number: (value) => whole.format(value),
      professionTitle: (profession: CashflowProfession) => {
        const key = `CashflowGame.profession.${profession.id}.title`;
        const translated = this.translate.instant(key);
        return translated === key ? profession.title : translated;
      },
      groupName: (group) => this.cardText.groupName(group),
      familyName: (family) => this.cardText.familyName(family),
      lab: this.lab,
    };
  }

  table(block: Extract<ManualBlock, { type: 'data' }>): ManualTable {
    const key = `${this.translate.currentLang}|${block.id}`;
    let table = this.tableCache.get(key);
    if (!table) {
      table = buildManualTable(block.id, this.formatContext);
      this.tableCache.set(key, table);
    }
    return table;
  }

  // ---------------------------------------------------------------- real cards

  private cardById(cardId: string): { tone: ManualFace['tone']; card: any } | null {
    const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'cashflow');
    const piles: [ManualFace['tone'], any[] | undefined][] = [
      ['small', set?.decks?.dealSmall],
      ['big', set?.decks?.dealBig],
      ['doodad', set?.decks?.doodad],
      ['market', set?.decks?.market],
    ];
    for (const [tone, deck] of piles) {
      const card = deck?.find((candidate) => candidate.id === cardId);
      if (card) return { tone, card };
    }
    return null;
  }

  private faceCache = new Map<string, ManualFace | null>();

  /** The card as it is drawn on the table - null when the id is unknown (the page then skips it). */
  faceOf(cardId: string): ManualFace | null {
    const key = `${this.translate.currentLang}|${this.cardText.version}|${cardId}`;
    if (!this.faceCache.has(key)) this.faceCache.set(key, this.buildFace(cardId));
    return this.faceCache.get(key) ?? null;
  }

  private buildFace(cardId: string): ManualFace | null {
    const found = this.cardById(cardId);
    if (!found) return null;
    const { tone, card } = found;
    const labels = this.content?.labels ?? {};
    const ctx = this.formatContext;
    const text = this.cardText.textFor(card.id);
    const facts: { label: string; value: string }[] = [];
    const add = (label: string, value: string) =>
      facts.push({ label: labels[label] ?? label, value });

    if (tone === 'small' || tone === 'big') {
      const deal = card as CashflowDealCard;
      if (deal.assetKind === 'share') {
        add('factPrice', ctx.money(deal.priceMinor ?? 0));
        add(
          'factRange',
          `${ctx.money(deal.rangeMinMinor ?? 0)} – ${ctx.money(deal.rangeMaxMinor ?? 0)}`,
        );
      } else if (deal.assetKind === 'investment') {
        add('factPrice', ctx.money((deal.depositMinor ?? 0) + (deal.mortgageMinor ?? 0)));
        add('factDeposit', ctx.money(deal.depositMinor ?? 0));
        add('factMortgage', ctx.money(deal.mortgageMinor ?? 0));
        add('factCashflow', `+${ctx.money(deal.cashflowMinor ?? 0)}`);
      } else {
        add('factCost', ctx.money(deal.costMinor ?? 0));
        if (deal.quantity) add('factCoins', String(deal.quantity));
        if (deal.successOn) add('factDice', `${deal.successOn}–6`);
        if (deal.payoutMinor) add('factPayout', ctx.money(deal.payoutMinor));
      }
    } else if (tone === 'doodad') {
      const doodad = card as CashflowDoodadCard;
      add('factCost', ctx.money(doodad.costMinor));
      add('factAccount', doodad.account ?? 'Splurge');
    } else {
      const market = card as CashflowMarketCard;
      if (market.sells?.plusPercent !== undefined)
        add('factOffer', `+${market.sells.plusPercent} %`);
      if (market.sells?.plusMinor !== undefined)
        add('factOffer', `+${ctx.money(market.sells.plusMinor)}`);
      if (market.sells?.priceMinor !== undefined)
        add('factOffer', ctx.money(market.sells.priceMinor));
      if (market.sells?.pricePerUnitMinor !== undefined) {
        add(
          'factOffer',
          `${ctx.money(market.sells.pricePerUnitMinor)} / ${labels['unit'] ?? 'unit'}`,
        );
      }
      if (market.sells?.pricePerCoinMinor !== undefined) {
        add(
          'factOffer',
          `${ctx.money(market.sells.pricePerCoinMinor)} / ${labels['coin'] ?? 'coin'}`,
        );
      }
      if (market.pays) add('factCost', ctx.money(market.pays.costMinor));
      if (market.splits) add('factSymbol', market.splits.symbol);
      if (market.boost) {
        add('factBoost', `+${ctx.money(market.boost.addMinor)}`);
        add('factUpTo', ctx.money(market.boost.maxCashflowMinor));
      }
    }
    return {
      tone,
      title: (text.title ?? card.title) + (card.star ? ' ★' : ''),
      text: text.description ?? card.description ?? '',
      facts,
    };
  }
}
