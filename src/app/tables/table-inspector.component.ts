import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { GameBooks, TableView } from '@money/domain';
import type { TableEventLine } from './table-session.service';
import {
  balanceSheet,
  incomeStatement,
  standings,
  type BalanceSheet,
  type IncomeStatement,
  type Standing,
} from './table-statements';
import { tableInspectorTexts, type TableInspectorTexts } from './table-inspector.texts';

const money = (minor: number): string =>
  (minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });

/**
 * Looking at the other players (todo/cashflow-multiplayer.md phase U4): everything at a table is open, so any player's
 * income statement and balance sheet can be read, next to the standings and a live feed of what happened. Presentational -
 * it reads the table the server sent and holds only which player is being looked at.
 */
@Component({
  selector: 'app-table-inspector',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tables.css',
  template: `
    <section class="ti-card" *ngIf="ranking.length">
      <h3>{{ t.leaderboard }}</h3>
      <ol class="ti-list">
        <li *ngFor="let row of ranking" class="ti-standing">
          <span class="ti-swatch" [style.background]="row.color"></span>
          <span class="ti-name">{{ row.name }}</span>
          <span class="ti-outcome">{{ outcomeText(row) }}</span>
          <span class="ti-num" [title]="t.coverage">{{ percent(row.coverage) }}</span>
        </li>
      </ol>
    </section>

    <section class="ti-card" *ngIf="looked as who">
      <h3>{{ t.inspect }}</h3>
      <div class="ti-tabs" role="tablist">
        <button
          *ngFor="let player of view.players"
          type="button"
          class="tx-btn"
          role="tab"
          [class.tx-btn--primary]="player.seat === who.seat"
          [attr.aria-selected]="player.seat === who.seat"
          (click)="look(player.seat)"
        >
          <span class="ti-swatch" [style.background]="player.color"></span>
          {{ player.name }}
        </button>
      </div>

      <ng-container *ngIf="books as b">
        <h4>{{ t.income }}</h4>
        <ng-container *ngIf="income as i">
          <ul class="ti-lines">
            <li *ngFor="let line of i.salary">
              <span>{{ t.salary }}</span
              ><span>{{ fmt(line.amountMinor) }}</span>
            </li>
            <li *ngFor="let line of i.passive">
              <span>{{ t.passive }}: {{ line.label }}</span
              ><span>{{ fmt(line.amountMinor) }}</span>
            </li>
            <li class="ti-total">
              <span>{{ t.totalIncome }}</span
              ><span>{{ fmt(i.totalIncomeMinor) }}</span>
            </li>
            <li *ngFor="let line of i.expenses">
              <span>{{ line.label }}</span
              ><span>−{{ fmt(line.amountMinor) }}</span>
            </li>
            <li class="ti-total">
              <span>{{ t.totalExpenses }}</span
              ><span>−{{ fmt(i.totalExpensesMinor) }}</span>
            </li>
            <li class="ti-total">
              <span>{{ t.cashflow }}</span
              ><span>{{ fmt(i.cashflowMinor) }}</span>
            </li>
            <li>
              <span>{{ t.children }}</span
              ><span>{{ b.state.children }}</span>
            </li>
          </ul>
        </ng-container>

        <h4>{{ t.balance }}</h4>
        <ng-container *ngIf="balance as s">
          <ul class="ti-lines">
            <li *ngFor="let line of s.assets">
              <span>{{ line.label }}</span
              ><span>{{ fmt(line.amountMinor) }}</span>
            </li>
            <li class="ti-total">
              <span>{{ t.totalAssets }}</span
              ><span>{{ fmt(s.totalAssetsMinor) }}</span>
            </li>
            <li *ngFor="let line of s.liabilities">
              <span>{{ line.label }}</span
              ><span>−{{ fmt(line.amountMinor) }}</span>
            </li>
            <li class="ti-total">
              <span>{{ t.totalLiabilities }}</span
              ><span>−{{ fmt(s.totalLiabilitiesMinor) }}</span>
            </li>
            <li class="ti-total">
              <span>{{ t.netWorth }}</span
              ><span>{{ fmt(s.netWorthMinor) }}</span>
            </li>
          </ul>
        </ng-container>
      </ng-container>
    </section>

    <section class="ti-card">
      <h3>{{ t.feed }}</h3>
      <p class="ti-empty" *ngIf="!feed.length">{{ t.noEvents }}</p>
      <ol class="ti-feed" *ngIf="feed.length">
        <li *ngFor="let line of feed">
          <strong>{{ line.who }}</strong> {{ line.text }}
        </li>
      </ol>
    </section>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .ti-card {
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #ddd);
        border-radius: 12px;
        padding: 16px;
      }
      .ti-card h3,
      .ti-card h4 {
        margin: 0 0 8px;
      }
      .ti-card h4 {
        margin-top: 16px;
      }
      .ti-list,
      .ti-lines,
      .ti-feed {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ti-feed {
        max-height: 260px;
        overflow-y: auto;
      }
      .ti-standing,
      .ti-lines li {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: space-between;
      }
      .ti-lines li span:first-child,
      .ti-name {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .ti-lines li span:last-child,
      .ti-num {
        font-variant-numeric: tabular-nums;
      }
      .ti-total {
        font-weight: 700;
        border-top: 1px solid var(--color-border, #ddd);
        padding-top: 4px;
      }
      .ti-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex: none;
      }
      .ti-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ti-empty,
      .ti-outcome {
        color: var(--color-text-secondary, #666);
        font-size: 0.9em;
      }
    `,
  ],
})
export class TableInspectorComponent {
  @Input({ required: true }) view!: TableView;
  @Input() events: TableEventLine[] = [];
  @Input() lang = 'en';

  fmt = money;
  private seat: number | null = null;

  get t(): TableInspectorTexts {
    return tableInspectorTexts(this.lang);
  }

  /** The player being looked at: the one picked, else the viewer's own seat, else the first. */
  get looked(): { seat: number } | null {
    const players = this.view.players;
    if (!players.length) return null;
    const seat = this.seat !== null && players[this.seat] ? this.seat : (this.view.youSeat ?? 0);
    return { seat: players[seat] ? seat : 0 };
  }

  get books(): GameBooks | null {
    const who = this.looked;
    const books = who ? (this.view.players[who.seat]?.books as unknown as GameBooks | null) : null;
    return books && books.state.professionId ? books : null;
  }

  get income(): IncomeStatement | null {
    return this.books ? incomeStatement(this.books) : null;
  }

  get balance(): BalanceSheet | null {
    return this.books ? balanceSheet(this.books, this.t.cash) : null;
  }

  get ranking(): Standing[] {
    return standings(this.view);
  }

  /** The newest first, worded in the viewer's language; an unlisted kind of event shows by its own name. */
  get feed(): { who: string; text: string }[] {
    const words = this.t.events;
    return [...this.events]
      .reverse()
      .slice(0, 60)
      .map((line) => ({
        who: line.seat === null ? '' : (this.view.players[line.seat]?.name ?? ''),
        text: words[line.type] ?? line.type.replace(/_/g, ' '),
      }));
  }

  look(seat: number): void {
    this.seat = seat;
  }

  outcomeText(row: Standing): string {
    return row.outcome === 'escaped'
      ? this.t.escaped
      : row.outcome === 'bankrupt'
        ? this.t.bankrupt
        : this.t.playing;
  }

  percent(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
  }
}
