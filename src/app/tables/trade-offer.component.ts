import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnInit,
  Optional,
  Output,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  cashOnHandMinor,
  type CashflowDealCard,
  type GameBooks,
  type TableView,
} from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { CashflowCardTextService } from '../shared/services/cashflow-card-text.service';
import { AppStateService } from '../shared/services/app-state.service';
import { tradeOfferTexts, type TradeOfferTexts } from './trade-offer.texts';

/**
 * A card in hand put to the table (JFK, 2026-10-24). Every player who may answer sees the card as it really is - its price, down
 * payment, mortgage, cashflow, what it does - with what the seller asks below it, and what taking it would do to them (the Bank
 * loan, the monthly cashflow afterwards: the table never lets anybody take a deal that leaves them with less than 0). They take it
 * at the asking price, or make an offer of their own up to what they can afford; the seller gets the offers to accept. The first
 * one to take it gets it, and once it is gone it is gone: the panel closes for everybody.
 */
@Component({
  selector: 'app-trade-offer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="to-chip tx-btn tx-btn--primary"
      *ngIf="trade && hidden"
      (click)="hidden = false"
    >
      🃏 {{ t.reopen }}
    </button>

    <div
      class="to-backdrop"
      *ngIf="trade && !hidden"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="t.forSale"
      [attr.dir]="rtl ? 'rtl' : 'ltr'"
    >
      <div class="to-panel">
        <header class="to-head">
          <strong class="to-title">{{ headline }}</strong>
          <button
            type="button"
            class="to-close"
            [attr.aria-label]="t.later"
            (click)="hidden = true"
          >
            ✕
          </button>
        </header>

        <section class="to-card" *ngIf="card as c">
          <h3>{{ cardTitle }}</h3>
          <p class="to-desc" *ngIf="cardText">{{ cardText }}</p>
          <dl class="to-facts">
            <div *ngIf="c.costMinor !== undefined">
              <dt>{{ t.cost }}</dt>
              <dd>{{ fmt(c.costMinor) }}</dd>
            </div>
            <div *ngIf="c.priceMinor !== undefined">
              <dt>{{ t.price }}</dt>
              <dd>{{ fmt(c.priceMinor) }}</dd>
            </div>
            <div *ngIf="c.depositMinor !== undefined">
              <dt>{{ t.downPayment }}</dt>
              <dd>{{ fmt(c.depositMinor) }}</dd>
            </div>
            <div *ngIf="c.mortgageMinor !== undefined">
              <dt>{{ t.mortgage }}</dt>
              <dd>{{ fmt(c.mortgageMinor) }}</dd>
            </div>
            <div *ngIf="c.cashflowMinor !== undefined">
              <dt>{{ t.cashflow }}</dt>
              <dd>{{ fmt(c.cashflowMinor) }}</dd>
            </div>
            <div *ngIf="c.payoutMinor !== undefined">
              <dt>{{ t.payout }}</dt>
              <dd>{{ fmt(c.payoutMinor) }}</dd>
            </div>
            <div *ngIf="c.successOn">
              <dt>{{ t.winOn }}</dt>
              <dd>{{ c.successOn }}</dd>
            </div>
          </dl>
        </section>

        <section class="to-ask">
          <span class="to-ask-label">{{ t.asking }}</span>
          <strong class="to-ask-price">{{ fmt(trade!.priceMinor) }}</strong>
          <small class="to-ask-note" *ngIf="!isSeller">{{ t.onTop }}</small>
        </section>

        <!-- the seller: the offers that came in -->
        <section class="to-answer" *ngIf="isSeller">
          <h4>{{ t.counters }}</h4>
          <p class="to-hint" *ngIf="!trade!.counters.length">{{ t.noCounters }}</p>
          <ul class="to-list" *ngIf="trade!.counters.length">
            <li *ngFor="let counter of trade!.counters" class="to-row">
              <span
                ><strong>{{ nameOf(counter.seat) }}</strong> · {{ fmt(counter.priceMinor) }}</span
              >
              <button
                type="button"
                class="tx-btn tx-btn--primary tx-btn--small"
                [disabled]="busy"
                (click)="move.emit({ type: 'accept_trade', fromSeat: counter.seat })"
              >
                {{ t.accept }}
              </button>
            </li>
          </ul>
          <div class="to-actions">
            <button
              type="button"
              class="tx-btn"
              [disabled]="busy"
              (click)="move.emit({ type: 'withdraw_trade' })"
            >
              {{ t.withdraw }}
            </button>
          </div>
        </section>

        <!-- a player who may answer: what it costs them, take it, or an offer of their own -->
        <section class="to-answer" *ngIf="!isSeller && trade!.you as you">
          <h4>{{ t.youPayTitle }}</h4>
          <dl class="to-facts to-facts--you">
            <div>
              <dt>{{ t.yourCash }}</dt>
              <dd>{{ fmt(cashMinor) }}</dd>
            </div>
            <div *ngIf="you.quote.loanMinor > 0">
              <dt>{{ t.loanFirst }}</dt>
              <dd>{{ fmt(you.quote.loanMinor) }}</dd>
            </div>
            <div *ngIf="you.quote.cashflowAfterMinor !== null">
              <dt>{{ t.cashflowAfter }}</dt>
              <dd [class.to-bad]="(you.quote.cashflowAfterMinor ?? 0) < 0">
                {{ fmt(you.quote.cashflowAfterMinor ?? 0) }}
              </dd>
            </div>
          </dl>
          <p class="to-problem" *ngIf="!you.quote.ok" role="alert">
            {{ t.cannot.replace('{reason}', you.quote.reason ?? '') }}
          </p>
          <p class="to-hint" *ngIf="trade!.toSeat !== null">{{ t.only }}</p>
          <div class="to-actions">
            <button
              type="button"
              class="tx-btn tx-btn--primary to-buy"
              [disabled]="busy || !you.quote.ok"
              (click)="move.emit({ type: 'accept_trade' })"
            >
              {{ t.buyFor.replace('{price}', fmt(trade!.priceMinor)) }}
            </button>
          </div>
          <p class="to-race">{{ t.race }}</p>

          <div class="to-counter" *ngIf="!myCounter; else counterSent">
            <h4>{{ t.orOffer }}</h4>
            <div class="to-actions">
              <input
                class="to-input"
                type="number"
                min="1"
                inputmode="decimal"
                [attr.max]="you.maxPriceMinor / 100"
                [placeholder]="t.yourPrice"
                [attr.aria-label]="t.yourPrice"
                [(ngModel)]="counterPrice"
              />
              <button
                type="button"
                class="tx-btn"
                [disabled]="busy || !validCounter(you.maxPriceMinor)"
                (click)="sendCounter()"
              >
                {{ t.makeOffer }}
              </button>
            </div>
            <small class="to-hint">{{ t.atMost.replace('{max}', fmt(you.maxPriceMinor)) }}</small>
          </div>
          <ng-template #counterSent>
            <p class="to-hint">
              {{
                t.yourCounter
                  .replace('{price}', fmt(myCounter!.priceMinor))
                  .replace('{name}', nameOf(trade!.sellerSeat))
              }}
            </p>
          </ng-template>

          <div class="to-actions">
            <button
              type="button"
              class="tx-btn"
              [disabled]="busy"
              (click)="move.emit({ type: 'decline_trade' })"
            >
              {{ t.decline }}
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .to-chip {
        position: fixed;
        inset-inline-end: 12px;
        bottom: 12px;
        z-index: 1100;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      }
      .to-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.55);
      }
      .to-panel {
        width: min(520px, 100%);
        max-height: calc(100vh - 24px);
        overflow-y: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border-radius: 14px;
        background: var(--color-surface, #fff);
        color: var(--color-text, #222);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
        animation: to-in 0.18s ease-out;
      }
      @keyframes to-in {
        from {
          transform: translateY(14px) scale(0.98);
          opacity: 0;
        }
      }
      .to-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .to-title {
        font-size: 1.05em;
        overflow-wrap: anywhere;
      }
      .to-close {
        border: 0;
        background: transparent;
        color: inherit;
        font-size: 1.2em;
        cursor: pointer;
        padding: 4px 8px;
      }
      .to-card {
        border: 1px solid var(--color-border, #ccc);
        border-radius: 10px;
        padding: 10px 12px;
        background: var(--color-background, #f6f7f9);
      }
      .to-card h3 {
        margin: 0 0 4px;
        font-size: 1.1em;
      }
      .to-desc {
        margin: 0 0 8px;
        font-size: 0.9em;
        opacity: 0.85;
      }
      .to-facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9.5em, 1fr));
        gap: 6px 14px;
        margin: 0;
      }
      .to-facts div {
        display: flex;
        flex-direction: column;
      }
      .to-facts dt {
        font-size: 0.78em;
        opacity: 0.7;
      }
      .to-facts dd {
        margin: 0;
        font-weight: 700;
      }
      .to-bad {
        color: var(--color-danger, #c62828);
      }
      .to-ask {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 10px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--color-primary, #2a7de1) 14%, transparent);
      }
      .to-ask-label {
        font-size: 0.8em;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.8;
      }
      .to-ask-price {
        font-size: 1.7em;
      }
      .to-ask-note {
        text-align: center;
        opacity: 0.75;
      }
      .to-answer {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .to-answer h4 {
        margin: 0;
        font-size: 0.95em;
      }
      .to-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .to-buy {
        flex: 1 1 100%;
        padding-block: 12px;
        font-size: 1.05em;
      }
      .to-input {
        flex: 1 1 8em;
        min-width: 0;
      }
      .to-race {
        margin: 0;
        font-size: 0.85em;
        text-align: center;
        opacity: 0.8;
      }
      .to-hint {
        margin: 0;
        font-size: 0.85em;
        opacity: 0.8;
      }
      .to-problem {
        margin: 0;
        color: var(--color-danger, #c62828);
        font-size: 0.9em;
      }
      .to-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .to-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      @media (max-width: 480px) {
        .to-backdrop {
          align-items: flex-end;
          padding: 0;
        }
        .to-panel {
          width: 100%;
          border-radius: 14px 14px 0 0;
          max-height: 92vh;
        }
      }
    `,
  ],
})
export class TradeOfferComponent implements OnChanges, OnInit {
  @Input({ required: true }) view!: TableView;
  @Input() lang = 'en';
  @Input() busy = false;
  @Output() move = new EventEmitter<Record<string, unknown>>();

  hidden = false;
  counterPrice: number | null = null;
  private shownFor = '';

  constructor(
    private readonly changes: ChangeDetectorRef,
    @Optional()
    @Inject(CashflowCardTextService)
    private readonly texts: CashflowCardTextService | null,
  ) {}

  ngOnInit(): void {
    void this.texts?.ensureLoaded().then(() => this.changes.markForCheck());
  }

  ngOnChanges(changes: SimpleChanges): void {
    // a new offer opens the panel again, even if the last one was put aside
    const key = this.trade
      ? `${this.trade.sellerSeat}|${this.trade.cardId}|${this.trade.at ?? 0}`
      : '';
    if (key !== this.shownFor) {
      this.shownFor = key;
      this.hidden = false;
      this.counterPrice = null;
    }
    void changes;
  }

  get t(): TradeOfferTexts {
    return tradeOfferTexts(this.lang);
  }
  get rtl(): boolean {
    return this.lang.toLowerCase().startsWith('ar');
  }
  get trade() {
    return this.view?.trade ?? null;
  }
  get isSeller(): boolean {
    return !!this.trade && this.trade.sellerSeat === this.view.youSeat;
  }
  /** The viewer's own offer, once they made one. */
  get myCounter() {
    return this.trade?.counters.find((counter) => counter.seat === this.view.youSeat) ?? null;
  }

  get card(): Partial<CashflowDealCard> | null {
    const trade = this.trade;
    if (!trade) return null;
    const set = CASHFLOW_GAME_SETS.find(
      (candidate) => candidate.id === this.view.settings.gameSetId,
    );
    return (
      (set?.decks?.[trade.deck] as CashflowDealCard[] | undefined)?.find(
        (candidate) => candidate.id === trade.cardId,
      ) ?? null
    );
  }
  get cardTitle(): string {
    const trade = this.trade;
    if (!trade) return '';
    const printed = this.texts?.textFor(trade.cardId);
    return printed?.title || this.card?.title || trade.cardId;
  }
  get cardText(): string {
    const trade = this.trade;
    return (
      (trade && this.texts?.textFor(trade.cardId).description) ||
      (this.card as { description?: string } | null)?.description ||
      ''
    );
  }

  get headline(): string {
    const trade = this.trade;
    if (!trade) return '';
    if (this.isSeller) return this.t.yourOffer;
    const name = this.nameOf(trade.sellerSeat);
    return (trade.toSeat === null ? this.t.offersAll : this.t.offersYou).replace('{name}', name);
  }

  /** The viewer's cash, as the books show it. */
  get cashMinor(): number {
    const books = this.view.players[this.view.youSeat ?? -1]?.books as unknown as GameBooks | null;
    return books ? cashOnHandMinor(books.transactions ?? [], books.allocation) : 0;
  }

  nameOf(seat: number): string {
    return this.view.players[seat]?.name ?? '';
  }

  fmt(minor: number): string {
    const amount = (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
    return `${amount} ${AppStateService.instance.currency ?? ''}`.trim();
  }

  validCounter(maxMinor: number): boolean {
    const price = Math.round((this.counterPrice ?? 0) * 100);
    return price > 0 && price <= maxMinor;
  }

  sendCounter(): void {
    if (!this.counterPrice) return;
    this.move.emit({ type: 'counter_trade', priceMinor: Math.round(this.counterPrice * 100) });
    this.counterPrice = null;
  }
}
