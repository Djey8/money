import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type {
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowGameSet,
  CashflowMarketCard,
  CashflowMarketOffer,
  CashflowPendingDecision,
  GameBooks,
  TableView,
} from '@money/domain';
import { tableCardsTexts, type TableCardsTexts } from './table-cards.texts';

type AnyCard = Partial<CashflowDealCard & CashflowDoodadCard & CashflowMarketCard> & {
  id: string;
  title: string;
};

/** The card that is on the table: the one the player on the move was offered for the space they stand on. */
export interface CardOnTable {
  ownerSeat: number;
  deck: CashflowDeckKind;
  kind: CashflowPendingDecision['kind'];
  card: AnyCard;
  /** Played or settled: it can be looked at, no longer acted on. */
  played: boolean;
}

/** Looks the offered card up in the game set; null while no card is offered. Pure, so it is easy to test. */
export function cardOnTable(
  view: TableView,
  gameSet: CashflowGameSet | undefined,
): CardOnTable | null {
  if (view.activeSeat === null || !gameSet) return null;
  const books = view.players[view.activeSeat]?.books as unknown as GameBooks | null | undefined;
  const pending = books?.state.turn?.pending;
  const offered = pending?.offered;
  if (!pending || !offered) return null;
  const deck = (gameSet.decks?.[offered.deck] ?? []) as AnyCard[];
  const card = deck.find((candidate) => candidate.id === offered.cardId);
  if (!card) return null;
  return {
    ownerSeat: view.activeSeat,
    deck: offered.deck,
    kind: pending.kind,
    card,
    played: Boolean(pending.played || pending.closed || pending.purchased),
  };
}

/** The buyer offers a drawn card has opened for one player (properties, gold, a share's new price). */
export function offersOf(view: TableView, seat: number | null): CashflowMarketOffer[] {
  if (seat === null) return [];
  const books = view.players[seat]?.books as unknown as GameBooks | null | undefined;
  return books?.state.marketOffers ?? [];
}

const money = (minor: number | undefined): string =>
  minor === undefined ? '–' : (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });

/**
 * The card flows of a table (todo/cashflow-multiplayer.md phase U3): the card on the table for everyone to read, the moves
 * of the player it is offered to, the offers that sell into a drawn Market card, and a card in hand offered to the others.
 * Presentational: it shows what the table state holds and emits the command the player picked; whether a button is there at
 * all is the server's `legalActions` (`allowed`). The server checks everything again.
 */
@Component({
  selector: 'app-table-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tables.css',
  template: `
    <section class="tc-card" *ngIf="onTable as shown">
      <h3>{{ t.onTable }} · {{ deckName(shown.deck) }}</h3>
      <p class="tc-hint" *ngIf="shown.deck === 'market'">{{ t.forEveryone }}</p>
      <strong class="tc-title">{{ shown.card.title }}</strong>
      <p *ngIf="shown.card.description" class="tc-desc">{{ shown.card.description }}</p>
      <dl class="tc-facts">
        <div *ngIf="shown.card.costMinor !== undefined">
          <dt>{{ t.cost }}</dt>
          <dd>{{ fmt(shown.card.costMinor) }}</dd>
        </div>
        <div *ngIf="shown.card.priceMinor !== undefined">
          <dt>{{ t.price }}</dt>
          <dd>{{ fmt(shown.card.priceMinor) }}</dd>
        </div>
        <div *ngIf="shown.card.depositMinor !== undefined">
          <dt>{{ t.downPayment }}</dt>
          <dd>{{ fmt(shown.card.depositMinor) }}</dd>
        </div>
        <div *ngIf="shown.card.mortgageMinor !== undefined">
          <dt>{{ t.mortgage }}</dt>
          <dd>{{ fmt(shown.card.mortgageMinor) }}</dd>
        </div>
        <div *ngIf="shown.card.cashflowMinor !== undefined">
          <dt>{{ t.cashflow }}</dt>
          <dd>{{ fmt(shown.card.cashflowMinor) }}</dd>
        </div>
        <div *ngIf="shown.card.payoutMinor !== undefined">
          <dt>{{ t.payout }}</dt>
          <dd>{{ fmt(shown.card.payoutMinor) }}</dd>
        </div>
        <div *ngIf="shown.card.successOn">
          <dt>{{ t.winOn }}</dt>
          <dd>{{ shown.card.successOn }}</dd>
        </div>
      </dl>
      <p class="tc-hint" *ngIf="shown.played">{{ t.played }}</p>

      <div class="tc-actions" *ngIf="!shown.played">
        <label *ngIf="allow('buy_deal') && shown.card.assetKind === 'share'" class="tc-field">
          <span>{{ t.shares }}</span>
          <input type="number" min="1" [(ngModel)]="quantity" />
        </label>
        <button
          *ngIf="allow('buy_deal')"
          class="tx-btn tx-btn--primary"
          type="button"
          [disabled]="busy"
          (click)="buy(shown)"
        >
          {{ t.buy }}
        </button>
        <button
          *ngIf="allow('pay_doodad')"
          class="tx-btn tx-btn--primary"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'pay_doodad', cardId: shown.card.id })"
        >
          {{ t.pay }}
        </button>
        <button
          *ngIf="allow('roll_decision')"
          class="tx-btn tx-btn--primary"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'roll_decision' })"
        >
          {{ t.rollDecision }}
        </button>
        <button
          *ngIf="allow('pass_card')"
          class="tx-btn"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'pass_card' })"
        >
          {{ t.pass }}
        </button>
      </div>
    </section>

    <!-- Landed on a card space and nothing drawn yet: the player on the move draws. -->
    <section class="tc-card" *ngIf="!onTable && allow('draw_card')">
      <h3>{{ t.drawFrom }}</h3>
      <div class="tc-actions">
        <button
          *ngFor="let deck of drawable()"
          class="tx-btn tx-btn--primary"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'draw_card', deck: deck })"
        >
          {{ deckName(deck) }}
        </button>
      </div>
    </section>

    <!-- A bank loan, when the rules let this player take one. -->
    <section class="tc-card" *ngIf="allow('bank_loan')">
      <h3>{{ t.loan }}</h3>
      <div class="tc-actions">
        <label class="tc-field">
          <span>{{ t.loanAmount }}</span>
          <input type="number" min="1" [(ngModel)]="loanAmount" />
        </label>
        <button
          class="tx-btn"
          type="button"
          [disabled]="busy || !(loanAmount > 0)"
          (click)="move.emit({ type: 'bank_loan', amountMinor: minor(loanAmount) })"
        >
          {{ t.takeLoan }}
        </button>
      </div>
    </section>

    <!-- Buyers a drawn card brought to this player: sell into them, on or off your turn. -->
    <section class="tc-card" *ngIf="offers.length && allow('sell_position')">
      <h3>{{ t.offersForYou }}</h3>
      <ul class="tc-list">
        <li *ngFor="let offer of offers" class="tc-row">
          <span
            >{{ offer.title }} {{ t.sellFor }}
            {{ fmt(offer.pricePerShareMinor ?? offer.pricePerCoinMinor ?? offer.salePriceMinor) }}
            <small>({{ offer.label }})</small></span
          >
          <button
            class="tx-btn tx-btn--primary"
            type="button"
            [disabled]="busy"
            (click)="move.emit({ type: 'sell_position', input: { title: offer.title } })"
          >
            {{ t.sell }}
          </button>
        </li>
      </ul>
    </section>

    <!-- A card in hand offered to the others, and the answers. -->
    <section class="tc-card" *ngIf="view.trade as trade; else offering">
      <h3>{{ t.tradeOffer }}</h3>
      <p>
        <strong>{{ nameOf(trade.sellerSeat) }}</strong> {{ t.asks }} {{ fmt(trade.priceMinor) }} ·
        {{ trade.toSeat === null ? t.toTable : t.to + ' ' + nameOf(trade.toSeat) }}
      </p>
      <ul class="tc-list" *ngIf="trade.counters.length">
        <li class="tc-hint">{{ t.counters }}</li>
        <li *ngFor="let counter of trade.counters" class="tc-row">
          <span>{{ nameOf(counter.seat) }}: {{ fmt(counter.priceMinor) }}</span>
          <button
            *ngIf="allow('accept_trade') && view.youSeat === trade.sellerSeat"
            class="tx-btn"
            type="button"
            [disabled]="busy"
            (click)="move.emit({ type: 'accept_trade', fromSeat: counter.seat })"
          >
            {{ t.acceptFrom }}
          </button>
        </li>
      </ul>
      <div class="tc-actions">
        <button
          *ngIf="allow('accept_trade') && view.youSeat !== trade.sellerSeat"
          class="tx-btn tx-btn--primary"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'accept_trade' })"
        >
          {{ t.acceptAsked }}
        </button>
        <ng-container *ngIf="allow('counter_trade')">
          <label class="tc-field">
            <span>{{ t.yourPrice }}</span>
            <input type="number" min="1" [(ngModel)]="counterPrice" />
          </label>
          <button
            class="tx-btn"
            type="button"
            [disabled]="busy || !(counterPrice > 0)"
            (click)="move.emit({ type: 'counter_trade', priceMinor: minor(counterPrice) })"
          >
            {{ t.counter }}
          </button>
        </ng-container>
        <button
          *ngIf="allow('decline_trade')"
          class="tx-btn"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'decline_trade' })"
        >
          {{ t.decline }}
        </button>
        <button
          *ngIf="allow('withdraw_trade')"
          class="tx-btn"
          type="button"
          [disabled]="busy"
          (click)="move.emit({ type: 'withdraw_trade' })"
        >
          {{ t.withdraw }}
        </button>
      </div>
    </section>
    <ng-template #offering>
      <section class="tc-card" *ngIf="allow('offer_trade')">
        <h3>{{ t.offerCard }}</h3>
        <div class="tc-actions">
          <label class="tc-field">
            <span>{{ t.yourPrice }}</span>
            <input type="number" min="1" [(ngModel)]="tradePrice" />
          </label>
          <button
            class="tx-btn"
            type="button"
            [disabled]="busy || !(tradePrice > 0)"
            (click)="move.emit({ type: 'offer_trade', priceMinor: minor(tradePrice) })"
          >
            {{ t.offerCard }}
          </button>
        </div>
      </section>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .tc-card {
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #ddd);
        border-radius: 12px;
        padding: 16px;
      }
      .tc-card h3 {
        margin-top: 0;
      }
      .tc-title {
        overflow-wrap: anywhere;
      }
      .tc-desc,
      .tc-hint {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
        overflow-wrap: anywhere;
      }
      .tc-facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 4px 12px;
        margin: 8px 0;
      }
      .tc-facts div,
      .tc-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .tc-facts dt {
        color: var(--color-text-secondary, #666);
      }
      .tc-facts dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .tc-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
      .tc-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tc-field input {
        width: 120px;
      }
      .tc-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `,
  ],
})
export class TableCardsComponent {
  @Input({ required: true }) view!: TableView;
  /** The command types the server lists as legal for the viewer right now. */
  @Input() allowed: string[] = [];
  @Input() lang = 'en';
  @Input() busy = false;
  @Output() move = new EventEmitter<Record<string, unknown>>();

  quantity = 1;
  loanAmount = 0;
  tradePrice = 0;
  counterPrice = 0;
  fmt = money;

  /** An amount typed in whole currency units, as the whole minor units the server takes. */
  minor(amount: number): number {
    return Math.round(amount * 100);
  }

  get t(): TableCardsTexts {
    return tableCardsTexts(this.lang);
  }

  get gameSet(): CashflowGameSet | undefined {
    return this.gameSets.find((set) => set.id === this.view.settings.gameSetId);
  }

  /** The game sets, injected by the room screen so this component stays free of the content import. */
  @Input() gameSets: CashflowGameSet[] = [];

  get onTable(): CardOnTable | null {
    return cardOnTable(this.view, this.gameSet);
  }

  get offers(): CashflowMarketOffer[] {
    return offersOf(this.view, this.view.youSeat);
  }

  allow(action: string): boolean {
    return this.allowed.includes(action);
  }

  deckName(deck: CashflowDeckKind): string {
    return this.t[`deck${deck}` as keyof TableCardsTexts] as string;
  }

  /** Which piles the space the token stands on lets the player draw from. */
  drawable(): CashflowDeckKind[] {
    const active = this.view.activeSeat;
    const books =
      active === null ? null : (this.view.players[active]?.books as unknown as GameBooks | null);
    switch (books?.state.turn?.pending?.kind) {
      case 'deal':
        return ['dealSmall', 'dealBig'];
      case 'doodad':
        return ['doodad'];
      case 'market':
        return ['market'];
      default:
        return [];
    }
  }

  nameOf(seat: number): string {
    return this.view.players[seat]?.name ?? '';
  }

  buy(shown: CardOnTable): void {
    const share = shown.card.assetKind === 'share';
    this.move.emit({
      type: 'buy_deal',
      cardId: shown.card.id,
      ...(share ? { quantity: Math.max(1, Math.floor(this.quantity)) } : {}),
    });
  }
}
