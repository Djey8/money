import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

/** What one physical card prints besides its language-neutral numbers. */
export interface CashflowCardText {
  /** Dice cards: what a winning roll reads. */
  success?: string;
  /** Dice cards: what a missed roll reads ("ABSOLUTELY NOTHING in the cabinet", "an old cat"). */
  failure?: string;
  /** A special printed heading above the card's name, e.g. "You've found a Super Deal!". */
  heading?: string;
  /** The card's translated heading (investment cards: "Single-family home for sale"). */
  title?: string;
  /** The card's own flavor text (e.g. why a stock is cheap today). */
  description?: string;
  /** A special hint some cards carry ("super deal"), copied into the Grow project's notes. */
  note?: string;
  /** Doodad cards: the light-hearted line pre-filled into the payment's comment. */
  comment?: string;
}

interface CashflowCardTextFile {
  /** A type of card (EFH, MFH, GOLD...) -> its name in this language, shown on the lookup's type filter. */
  families?: Record<string, string>;
  /** The deck's language-neutral label -> the label this language uses ("EFH" -> "SFH"). */
  symbols?: Record<string, string>;
  /** Text printed on every card of one kind (e.g. "Only you may buy at this price…"), stored once per language. */
  shared?: Record<string, string>;
  /** Doodad spending group (leisure, events...) -> the category name in this language. */
  doodadGroups?: Record<string, string>;
  cards: Record<string, CashflowCardText>;
}

const FALLBACK_LANG = 'en';

/**
 * Card text lives apart from the app's main i18n files on purpose (JFK, 2026-09-30: the catalog will
 * grow to hundreds of cards in six languages): one file per language under
 * `assets/i18n/cashflow-cards/`, fetched only when a Cashflow-game account actually opens a card
 * pile, then cached. The app's normal translation load never pays for it.
 */
@Injectable({ providedIn: 'root' })
export class CashflowCardTextService {
  private files = new Map<string, CashflowCardTextFile>();
  private loadedFiles = 0;

  /** Changes whenever a language file finishes loading - lets a cache built from card text know it is stale. */
  get version(): number {
    return this.loadedFiles;
  }

  constructor(
    private http: HttpClient,
    private translate: TranslateService,
  ) {}

  /** Loads the current language's card text (and English as the fallback). Safe to call repeatedly. */
  async ensureLoaded(): Promise<void> {
    await Promise.all([this.load(this.currentLang()), this.load(FALLBACK_LANG)]);
  }

  /** The card's text in the current language, falling back to English, then to nothing. Synchronous — call `ensureLoaded()` first. */
  textFor(cardId: string): CashflowCardText {
    return (
      this.files.get(this.currentLang())?.cards[cardId] ??
      this.files.get(FALLBACK_LANG)?.cards[cardId] ??
      {}
    );
  }

  /**
   * The label a property type goes by in the current language - EFH is SFH in English, MAI in French
   * (JFK, 2026-10-03). It becomes the Grow project's title when a card is planned, so the language
   * picked at the start of a game sets the names for the whole game. Shares keep their made-up
   * tickers (OK4U...) in every language, so they simply have no entry. Falls back to English, then to
   * the deck's own label.
   */
  symbolFor(symbol: string | undefined): string | undefined {
    if (!symbol) return symbol;
    return (
      this.files.get(this.currentLang())?.symbols?.[symbol] ??
      this.files.get(FALLBACK_LANG)?.symbols?.[symbol] ??
      symbol
    );
  }

  /** The name of a card type in the current language ("Single-family homes"), falling back to English, then to the key. */
  familyName(family: string): string {
    return (
      this.files.get(this.currentLang())?.families?.[family] ??
      this.files.get(FALLBACK_LANG)?.families?.[family] ??
      family
    );
  }

  /** The category a Doodad's spending group goes by in the current language ("Freizeit und Hobby"), falling back to English, then to the key. */
  groupName(group: string): string {
    return (
      this.files.get(this.currentLang())?.doodadGroups?.[group] ??
      this.files.get(FALLBACK_LANG)?.doodadGroups?.[group] ??
      group
    );
  }

  /** A line printed on every card of one kind, same fallback chain as `textFor`. */
  sharedText(key: string): string {
    return (
      this.files.get(this.currentLang())?.shared?.[key] ??
      this.files.get(FALLBACK_LANG)?.shared?.[key] ??
      ''
    );
  }

  private currentLang(): string {
    return this.translate.currentLang || this.translate.defaultLang || FALLBACK_LANG;
  }

  private async load(lang: string): Promise<void> {
    if (this.files.has(lang)) return;
    try {
      const file = await firstValueFrom(
        this.http.get<CashflowCardTextFile>(`assets/i18n/cashflow-cards/${lang}.json`),
      );
      this.files.set(lang, file);
      this.loadedFiles++;
    } catch {
      // A language without a card file just falls back to English — never breaks the game.
    }
  }
}
