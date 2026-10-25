import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from '../../shared/pipes/app-number.pipe';

/** One row of a sheet. `index` lets the caller open the thing behind a row (a liability in the Info panel). */
export interface SheetLine {
  name: string;
  amount: number;
  /** A line under the one above it (which investment pays the passive income). */
  sub?: boolean;
  index?: number;
}

/**
 * The three sheets of a profession (JFK, 2026-10-25): CASHFLOW, Income Statement and Balance Sheet, each in a small version of the
 * boxes the app's own pages use - the blue box with its white title and the white card with the rows inside. The numbers are the
 * caller's (the printed card, or the running game); this only draws them, so the starting and the live scenario look the same.
 */
@Component({
  selector: 'app-profession-sheets',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- CASHFLOW -->
    <section class="ps-group">
      <h3 class="ps-heading">{{ 'Cashflow.title' | translate }}</h3>
      <div class="ps-cashflow">
        <h5 class="ps-label">{{ 'Cashflow.Income' | translate }}</h5>
        <div class="ps-amount">{{ cashIncome | appNumber }} {{ currency }}</div>
        <h5 class="ps-label">{{ 'CashflowGame.passiveIncome' | translate }}</h5>
        <div class="ps-amount">{{ cashPassive | appNumber }} {{ currency }}</div>
        <div class="ps-operation">−</div>
        <h5 class="ps-label">{{ 'Cashflow.Expenses' | translate }}</h5>
        <div class="ps-amount">{{ cashExpenses | appNumber }} {{ currency }}</div>
        <h5 class="ps-label">{{ 'Cashflow.title' | translate }}</h5>
        <div class="ps-amount ps-amount--total" [class.ps-negative]="cashTotal < 0">
          {{ cashTotal | appNumber }} {{ currency }}
        </div>
      </div>
    </section>

    <!-- Income Statement: the normal month -->
    <section class="ps-group">
      <h3 class="ps-heading">{{ 'Menu.statment' | translate }}</h3>
      <div class="ps-box">
        <h4 class="ps-box-title">{{ 'Income.Revenue' | translate }}</h4>
        <hr class="ps-rule" />
        <div class="ps-card">
          <table class="ps-table">
            <tbody>
              <tr *ngFor="let line of revenue" class="ps-row" [class.ps-row--sub]="line.sub">
                <td>{{ line.name }}</td>
                <td>{{ line.amount | appNumber }} {{ currency }}</td>
              </tr>
              <tr class="ps-row ps-row--total">
                <td>{{ 'CashflowGame.total' | translate }}</td>
                <td>{{ revenueTotal | appNumber }} {{ currency }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="ps-box">
        <h4 class="ps-box-title">{{ 'Cashflow.Expenses' | translate }}</h4>
        <hr class="ps-rule" />
        <div class="ps-card">
          <table class="ps-table">
            <tbody>
              <tr *ngFor="let line of expenses" class="ps-row">
                <td>{{ line.name }}</td>
                <td>{{ line.amount | appNumber }} {{ currency }}</td>
              </tr>
              <tr class="ps-row ps-row--total">
                <td>{{ 'CashflowGame.total' | translate }}</td>
                <td>{{ expensesTotal | appNumber }} {{ currency }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Balance Sheet: the state now -->
    <section class="ps-group">
      <h3 class="ps-heading">{{ 'Menu.sheet' | translate }}</h3>
      <div class="ps-box">
        <h4 class="ps-box-title">{{ 'Balance.Assets' | translate }}</h4>
        <hr class="ps-rule" />
        <div class="ps-card">
          <table class="ps-table">
            <tbody>
              <tr *ngFor="let line of assets" class="ps-row">
                <td>{{ line.name }}</td>
                <td>{{ line.amount | appNumber }} {{ currency }}</td>
              </tr>
              <tr class="ps-row ps-row--total">
                <td>{{ 'CashflowGame.total' | translate }}</td>
                <td>{{ assetsTotal | appNumber }} {{ currency }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="ps-box" *ngIf="liabilities.length">
        <h4 class="ps-box-title">{{ 'Balance.Liabilities' | translate }}</h4>
        <hr class="ps-rule" />
        <div class="ps-card">
          <table class="ps-table">
            <tbody>
              <!-- a row opens that balance item in the Info panel, where it can be paid back (live game only) -->
              <tr
                *ngFor="let line of liabilities"
                class="ps-row"
                [class.ps-row--link]="line.index !== undefined"
                [attr.tabindex]="line.index !== undefined ? 0 : null"
                [attr.role]="line.index !== undefined ? 'button' : null"
                (click)="open(line)"
                (keydown.enter)="open(line)"
              >
                <td>{{ line.name }}</td>
                <td>{{ line.amount | appNumber }} {{ currency }}</td>
              </tr>
              <tr class="ps-row ps-row--total">
                <td>{{ 'CashflowGame.total' | translate }}</td>
                <td>{{ liabilitiesTotal | appNumber }} {{ currency }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* a group, as in the lobby and the waiting room: a bordered card with a small caps heading */
      .ps-group {
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-lg, 12px);
        background: var(--color-background, #f6f7f9);
        padding: 10px 12px 12px;
      }
      .ps-heading {
        margin: 0 0 10px;
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.75;
      }
      /* the Cashflow calculation, the small version of the app's own */
      .ps-cashflow {
        margin: 0 auto;
        max-width: 252px;
        background-color: var(--color-primary);
        border: 2px solid white;
        border-radius: var(--radius-lg);
        padding: 14px 16px;
      }
      .ps-label {
        margin: 0;
        text-align: center;
        color: white;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .ps-operation {
        margin: 2px 0;
        text-align: center;
        color: white;
        font-size: 1rem;
      }
      .ps-amount {
        margin: 6px auto 12px;
        max-width: 220px;
        padding: 4px 8px;
        text-align: center;
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-text);
        font-size: 0.9rem;
        font-weight: 700;
      }
      .ps-amount--total {
        margin-bottom: 0;
      }
      .ps-negative {
        color: var(--color-danger);
      }
      /* the blue box of the Income Statement and the Balance Sheet, with the white card of rows inside */
      .ps-box {
        margin-bottom: 10px;
        padding: 12px;
        background-color: var(--color-primary);
        border: 2px solid white;
        border-radius: var(--radius-lg);
      }
      .ps-box:last-child {
        margin-bottom: 0;
      }
      .ps-box-title {
        margin: 0 0 4px;
        text-align: center;
        color: white;
        font-size: 1.15rem;
      }
      .ps-rule {
        margin: 0 5% 8px;
        height: 3px;
        border: 0;
        border-radius: 5px;
        background-color: white;
      }
      .ps-card {
        padding: 4px 6px;
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-text);
      }
      .ps-table {
        width: 100%;
        border-collapse: collapse;
      }
      .ps-row {
        border-bottom: 1px solid var(--color-border-light, #eee);
      }
      .ps-row td {
        padding: 6px 4px;
        font-size: 0.9rem;
        text-align: left;
        overflow-wrap: anywhere;
      }
      .ps-row td:last-child {
        text-align: right;
        font-weight: 700;
        white-space: nowrap;
      }
      .ps-row--sub td:first-child {
        padding-inline-start: 16px;
        opacity: 0.8;
      }
      .ps-row--sub td:last-child {
        font-weight: 400;
      }
      .ps-row--total {
        border-bottom: 0;
      }
      .ps-row--total td {
        padding-top: 8px;
        font-weight: 700;
        border-top: 2px solid var(--color-border-light, #eee);
      }
      .ps-row--link {
        cursor: pointer;
      }
      .ps-row--link:hover {
        background: var(--color-primary-light, #e3f0fd);
      }
    `,
  ],
})
export class ProfessionSheetsComponent {
  @Input() currency = '';
  /** The calculation: income, passive income, expenses and what is left of the month. */
  @Input() cashIncome = 0;
  @Input() cashPassive = 0;
  @Input() cashExpenses = 0;
  @Input() cashTotal = 0;
  @Input() revenue: SheetLine[] = [];
  @Input() revenueTotal = 0;
  @Input() expenses: SheetLine[] = [];
  @Input() expensesTotal = 0;
  @Input() assets: SheetLine[] = [];
  @Input() assetsTotal = 0;
  @Input() liabilities: SheetLine[] = [];
  @Input() liabilitiesTotal = 0;
  @Output() liabilityOpen = new EventEmitter<number>();

  open(line: SheetLine): void {
    if (line.index !== undefined) this.liabilityOpen.emit(line.index);
  }
}
