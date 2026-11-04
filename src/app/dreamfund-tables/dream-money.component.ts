import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { DreamHarvestOpen, DreamLifeSummary, DreamTableView } from './dream-session.service';
import { dreamMoney, dreamTexts, type DreamTexts } from './dream-texts';

/**
 * The player's own money at a Dreamfund table (todo/dreamfund-tables-solo-ui.md, R4f): what the month leaves is put into the reserve
 * and the dream, debts are repaid, a plan says how much goes to a goal at every Payday, and the month is settled. These are the table's
 * moves (the table's server books them), made from a small panel over the solo screen: the app's own pages show the books and are
 * read only while a table is played. Only on the player's own turn, as the table asks.
 */
@Component({
  selector: 'app-dream-money',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../tables/tables.css',
  template: `
    <details class="dm" *ngIf="anything" [open]="true">
      <summary class="dm-head">
        <strong>🎲 {{ t.money }}</strong>
      </summary>
      <div class="dm-body">
        <ng-container *ngIf="canAct">
          <!-- what the player owns: sold at the market, or offered to the others -->
          <div class="dm-plans" *ngIf="summary.holdings.length">
            <small>{{ t.holdings }}:</small>
            <div class="dm-row" *ngFor="let holding of summary.holdings; trackBy: trackHolding">
              <span class="dm-goal"
                >{{ holding.title }} · {{ m(holding.monthlyMinor) }} {{ t.perMonth }}</span
              >
              <ng-container *ngIf="!trade && can('offer_trade')">
                <input
                  type="number"
                  min="0"
                  class="dm-amount"
                  [(ngModel)]="tradePrice"
                  [placeholder]="t.price"
                  [attr.aria-label]="t.price"
                />
                <button
                  type="button"
                  class="tx-btn tx-btn--small"
                  [disabled]="busy || !minor(tradePrice)"
                  (click)="
                    move.emit({
                      type: 'offer_trade',
                      holding: holding.title,
                      priceMinor: minor(tradePrice),
                    })
                  "
                >
                  {{ t.offerTrade }}
                </button>
              </ng-container>
            </div>
          </div>
        </ng-container>

        <!-- a Harvest card drawn at the table: anybody may sell into it until the turn of its drawer is over -->
        <div
          class="dm-plans"
          *ngIf="
            harvest && (harvest.sellable.length || harvest.sales.length || harvest.ladders.length)
          "
        >
          <small>{{ t.harvest }}:</small>
          <div class="dm-row">
            <button
              type="button"
              class="tx-btn tx-btn--small"
              *ngFor="let title of harvest.sellable"
              [disabled]="busy"
              (click)="move.emit({ type: 'harvest_sell', holding: title })"
            >
              {{ t.sellIntoMarket }}: {{ title }}
            </button>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              *ngFor="let sale of harvest.sales"
              [disabled]="busy"
              (click)="move.emit({ type: 'harvest_accept', holding: sale.holding })"
            >
              {{ t.buyerOffers }}: {{ sale.holding }} {{ m(sale.grossMinor) }}
            </button>
            <ng-container *ngFor="let ladder of harvest.ladders">
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [disabled]="busy"
                (click)="
                  move.emit({ type: 'harvest_ladder', holding: ladder.holding, action: 'ride' })
                "
              >
                {{ t.ride }}: {{ ladder.holding }}
              </button>
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [disabled]="busy"
                (click)="
                  move.emit({ type: 'harvest_ladder', holding: ladder.holding, action: 'cash' })
                "
              >
                {{ t.cashOut }}
              </button>
            </ng-container>
          </div>
        </div>

        <!-- a holding offered to the others: answered by anybody, off turn too -->
        <div class="dm-trade" *ngIf="trade as tr">
          <strong>{{ tr.holding }} · {{ m(tr.priceMinor) }}</strong>
          <div class="dm-row" *ngIf="tr.sellerSeat !== youSeat">
            <button
              type="button"
              class="tx-btn tx-btn--primary tx-btn--small"
              *ngIf="can('accept_trade')"
              [disabled]="busy"
              (click)="move.emit({ type: 'accept_trade' })"
            >
              {{ t.accept }}
            </button>
            <ng-container *ngIf="can('counter_trade')">
              <input
                type="number"
                min="0"
                class="dm-amount"
                [(ngModel)]="counterPrice"
                [placeholder]="t.price"
                [attr.aria-label]="t.price"
              />
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [disabled]="busy || !minor(counterPrice)"
                (click)="move.emit({ type: 'counter_trade', priceMinor: minor(counterPrice) })"
              >
                {{ t.counter }}
              </button>
            </ng-container>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              *ngIf="can('decline_trade')"
              [disabled]="busy"
              (click)="move.emit({ type: 'decline_trade' })"
            >
              {{ t.decline }}
            </button>
          </div>
          <div class="dm-row" *ngIf="tr.sellerSeat === youSeat">
            <button
              type="button"
              class="tx-btn tx-btn--small"
              [disabled]="busy"
              (click)="move.emit({ type: 'withdraw_trade' })"
            >
              {{ t.withdraw }}
            </button>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              *ngFor="let counter of tr.counters"
              [disabled]="busy"
              (click)="move.emit({ type: 'accept_trade', fromSeat: counter.seat })"
            >
              {{ names[counter.seat] }}: {{ m(counter.priceMinor) }}
            </button>
          </div>
        </div>
      </div>
    </details>
  `,
  styles: [
    `
      .dm {
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: 10px;
        background: var(--color-surface, #fff);
        padding: 6px 10px;
      }
      .dm-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
      }
      .dm-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 8px;
      }
      .dm-line {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.8;
      }
      .dm-row,
      .dm-settle {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .dm-amount {
        width: 6rem;
      }
      .dm-goal {
        min-width: 6rem;
      }
    `,
  ],
})
export class DreamMoneyComponent {
  @Input({ required: true }) summary!: DreamLifeSummary;
  @Input() lang = 'en';
  /** The money moves are the player's own, in their own turn. */
  @Input() canAct = false;
  @Input() busy = false;
  @Output() move = new EventEmitter<Record<string, unknown>>();

  /** A holding offered to the table, if one is (the table holds one offer at a time). */
  @Input() trade: DreamTableView['trade'] = null;
  @Input() youSeat: number | null = null;
  /** The names of the seats, to say who made a counter offer. */
  @Input() names: string[] = [];
  /** What the table lists as possible for the player now (the server decides, the panel only shows). */
  @Input() allowed: string[] = [];
  /** The Harvest card's open options for the player. */
  @Input() harvest: DreamHarvestOpen | null = null;

  tradePrice: number | null = null;
  counterPrice: number | null = null;

  can(action: string): boolean {
    return this.allowed.includes(action);
  }

  trackHolding = (_: number, holding: { title: string }): string => holding.title;
  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }

  m(minor: number): string {
    return dreamMoney(minor, this.lang);
  }

  minor(units: number | null): number {
    return Math.round((Number(units) || 0) * 100);
  }

  /** The strip is there only while the table has something for the player that the app's own pages cannot do. */
  get anything(): boolean {
    const harvest = this.harvest;
    return !!(
      this.trade ||
      (this.canAct && this.summary.holdings.length && this.can('offer_trade')) ||
      (harvest && (harvest.sellable.length || harvest.sales.length || harvest.ladders.length))
    );
  }
}
