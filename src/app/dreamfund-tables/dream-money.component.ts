import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { DreamHarvestOpen, DreamLifeSummary, DreamTableView } from './dream-session.service';
import { dreamMoney, dreamTexts, type DreamTexts } from './dream-texts';

interface Goal {
  key: string;
  kind: 'mojo' | 'life' | 'smile';
  id: string;
  label: string;
  perMinor: number;
}

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
    <details class="dm" [open]="paydayDue && canAct">
      <summary class="dm-head">
        <strong>💰 {{ t.money }}</strong>
        <span class="dm-nums">{{ t.cash }} {{ m(summary.cashMinor) }}</span>
      </summary>
      <div class="dm-body">
        <p class="dm-line">
          {{ t.reserve }} {{ m(summary.reserveMinor) }} / {{ m(summary.reserveTargetMinor) }} ·
          {{ t.dream }} {{ m(summary.dreamSavedMinor) }} / {{ m(summary.dreamTargetMinor) }} ·
          {{ t.cashflow }} {{ m(summary.cashflowMinor) }}
        </p>

        <div class="dm-settle" *ngIf="paydayDue && canAct">
          <span>{{ t.payDay }}</span>
          <button
            type="button"
            class="tx-btn tx-btn--primary tx-btn--small"
            [disabled]="busy"
            (click)="move.emit({ type: 'settle_payday' })"
          >
            {{ t.settleMonth }}
          </button>
        </div>

        <ng-container *ngIf="canAct">
          <div class="dm-row">
            <input
              type="number"
              min="0"
              class="dm-amount"
              [(ngModel)]="amount"
              [placeholder]="t.amount"
              [attr.aria-label]="t.amount"
            />
            <button
              type="button"
              class="tx-btn tx-btn--small"
              [disabled]="busy || !minor(amount)"
              (click)="move.emit({ type: 'fund_reserve', amountMinor: minor(amount) })"
            >
              {{ t.putInReserve }}
            </button>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              [disabled]="busy || !minor(amount)"
              (click)="move.emit({ type: 'fund_dream', amountMinor: minor(amount) })"
            >
              {{ t.putInDream }}
            </button>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              *ngIf="summary.bankLoanMinor"
              [disabled]="busy || !minor(amount)"
              (click)="move.emit({ type: 'repay_bank_loan', amountMinor: minor(amount) })"
            >
              {{ t.repayBank }} ({{ m(summary.bankLoanMinor) }})
            </button>
          </div>

          <div class="dm-row" *ngIf="summary.debts.length">
            <small>{{ t.debts }}:</small>
            <button
              type="button"
              class="tx-btn tx-btn--small"
              *ngFor="let debt of summary.debts"
              [disabled]="busy"
              (click)="move.emit({ type: 'repay_debt', tag: debt.tag })"
            >
              {{ t.repay }} {{ debt.tag }} ({{ m(debt.amountMinor) }})
            </button>
          </div>

          <!-- what the player owns: sold at the market, or offered to the others -->
          <div class="dm-plans" *ngIf="summary.holdings.length">
            <small>{{ t.holdings }}:</small>
            <div class="dm-row" *ngFor="let holding of summary.holdings; trackBy: trackHolding">
              <span class="dm-goal"
                >{{ holding.title }} · {{ m(holding.monthlyMinor) }} {{ t.perMonth }}</span
              >
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [disabled]="busy"
                (click)="move.emit({ type: 'sell_holding', holding: holding.title })"
              >
                {{ t.sell }}
              </button>
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

          <!-- how much goes to a goal at every Payday -->
          <div class="dm-plans">
            <small>{{ t.plans }}:</small>
            <div class="dm-row" *ngFor="let goal of goals(); trackBy: trackGoal">
              <span class="dm-goal">{{ goal.label }}</span>
              <input
                type="number"
                min="0"
                class="dm-amount"
                [ngModel]="goal.perMinor / 100"
                (ngModelChange)="plans[goal.key] = $event"
                [attr.aria-label]="goal.label"
              />
              <button
                type="button"
                class="tx-btn tx-btn--small"
                [disabled]="busy"
                (click)="setPlan(goal)"
              >
                {{ t.payPlan }}
              </button>
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
  /** A Payday was passed in this turn: the month's money is still to be dealt with. */
  @Input() paydayDue = false;
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

  amount: number | null = null;
  tradePrice: number | null = null;
  counterPrice: number | null = null;

  can(action: string): boolean {
    return this.allowed.includes(action);
  }

  trackHolding = (_: number, holding: { title: string }): string => holding.title;
  /** What the player typed for each plan (by key), until it is set. */
  plans: Record<string, number> = {};

  get t(): DreamTexts {
    return dreamTexts(this.lang);
  }

  m(minor: number): string {
    return dreamMoney(minor, this.lang);
  }

  minor(units: number | null): number {
    return Math.round((Number(units) || 0) * 100);
  }

  trackGoal = (_: number, goal: { key: string }): string => goal.key;

  /** The goals money can be planned for: the reserve, the dream of the character, and every dream taken. */
  goals(): Goal[] {
    const planned = (kind: string, id: string) =>
      this.summary.plans.find((plan) => plan.kind === kind && plan.id === id)?.perMinor ?? 0;
    return [
      {
        key: 'mojo',
        kind: 'mojo',
        id: 'mojo',
        label: this.t.reserve,
        perMinor: planned('mojo', 'mojo'),
      },
      {
        key: 'life',
        kind: 'life',
        id: 'life',
        label: this.t.dream,
        perMinor: planned('life', 'life'),
      },
      ...this.summary.smile.map((dream) => ({
        key: `smile:${dream.cardId}`,
        kind: 'smile' as const,
        id: dream.cardId,
        label: dream.cardId,
        perMinor: planned('smile', dream.cardId),
      })),
    ];
  }

  setPlan(goal: Goal): void {
    const typed = this.plans[goal.key];
    const perMinor = typed === undefined ? goal.perMinor : this.minor(typed);
    this.move.emit({ type: 'set_plan', kind: goal.kind, id: goal.id, perMinor });
  }
}
