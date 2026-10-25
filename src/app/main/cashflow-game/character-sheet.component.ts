import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { CashflowProfileTexts } from '@money/domain';
import { AppNumberPipe } from '../../shared/pipes/app-number.pipe';
import {
  ProfessionSheetsComponent,
  type ProfessionSheetNumbers,
} from './profession-sheets.component';

type SheetId = 'cashflow' | 'income' | 'balance';

/**
 * Who a character is (JFK, 2026-10-25): the same view when a character is chosen and later in the game - who they are, what matters
 * to them, the dream, the list of what it takes to win (ticked off once it is met) and the financial sheets behind three panels,
 * as when a company is looked at before investing. Only the Cashflow panel is open at first, so the page stays short.
 */
@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppNumberPipe, ProfessionSheetsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cs-head">
      <span class="cs-avatar" aria-hidden="true">{{ name.charAt(0) }}</span>
      <span class="cs-head-text">
        <strong>{{ name }}</strong>
        <small>{{ tagline }}</small>
      </span>
    </div>

    <ng-container *ngIf="story">
      <section class="cs-group">
        <h4>{{ 'CashflowGame.setup.background' | translate }}</h4>
        <p class="cs-story">{{ story.background }}</p>
      </section>
      <section class="cs-group">
        <h4>{{ 'CashflowGame.setup.values' | translate }}</h4>
        <ul class="cs-values">
          <li *ngFor="let value of story.values">{{ value }}</li>
        </ul>
      </section>
      <section class="cs-group cs-group--dream">
        <h4>{{ 'CashflowGame.setup.dream' | translate }}</h4>
        <p class="cs-story">
          <strong>{{ story.dream.title }}</strong
          ><br />{{ story.dream.summary }}
        </p>
      </section>
      <!-- what it takes to win: a checklist, ticked in the running game as each one is met -->
      <section class="cs-group">
        <h4>{{ 'CashflowGame.setup.goal' | translate }}</h4>
        <p class="cs-story">{{ story.goal }}</p>
        <ul class="cs-check">
          <li *ngFor="let item of story.goalItems" [class.cs-check--done]="done(item.id)">
            <span class="cs-box" aria-hidden="true">{{ done(item.id) ? '☑' : '☐' }}</span>
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </section>
    </ng-container>

    <!-- the numbers: three panels, only the Cashflow is open at first -->
    <h4 class="cs-numbers" *ngIf="sheets">{{ 'CashflowGame.setup.numbers' | translate }}</h4>
    <ng-container *ngIf="sheets as numbers">
      <section class="cs-detail" *ngFor="let panel of panels(numbers); trackBy: trackPanel">
        <button
          type="button"
          class="cs-detail-head"
          [attr.aria-expanded]="open === panel.id"
          (click)="toggle(panel.id)"
        >
          <span class="cs-detail-title">{{ panel.title | translate }}</span>
          <span class="cs-detail-figure" [class.cs-negative]="panel.value < 0"
            >{{ panel.value | appNumber: '1.0-0' : false }} {{ currency }}</span
          >
          <span class="cs-detail-chevron" aria-hidden="true">{{
            open === panel.id ? '▾' : '▸'
          }}</span>
        </button>
        <app-profession-sheets
          *ngIf="open === panel.id"
          [only]="panel.id"
          [currency]="currency"
          [cashIncome]="numbers.cashIncome"
          [cashPassive]="numbers.cashPassive"
          [cashExpenses]="numbers.cashExpenses"
          [cashTotal]="numbers.cashTotal"
          [revenue]="numbers.revenue"
          [revenueTotal]="numbers.revenueTotal"
          [expenses]="numbers.expenses"
          [expensesTotal]="numbers.expensesTotal"
          [assets]="numbers.assets"
          [assetsTotal]="numbers.assetsTotal"
          [liabilities]="numbers.liabilities"
          [liabilitiesTotal]="numbers.liabilitiesTotal"
          (liabilityOpen)="liabilityOpen.emit($event)"
        ></app-profession-sheets>
      </section>
    </ng-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .cs-head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        margin-bottom: 12px;
        border: 2px solid var(--color-primary, #2a7de1);
        border-radius: var(--radius-lg, 12px);
        background: var(--color-surface, #fff);
      }
      .cs-avatar {
        display: grid;
        place-items: center;
        flex: none;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--color-primary, #2a7de1);
        color: #fff;
        font-size: 1.2rem;
        font-weight: 700;
      }
      .cs-head-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .cs-head-text small {
        opacity: 0.75;
      }
      .cs-group {
        margin: 0 0 12px;
        padding: 10px 12px 12px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-lg, 12px);
        background: var(--color-background, #f6f7f9);
      }
      .cs-group h4,
      .cs-numbers {
        margin: 0 0 8px;
        font-size: 0.8rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.75;
      }
      .cs-numbers {
        margin-top: 14px;
      }
      .cs-group--dream {
        border-color: var(--color-primary, #2a7de1);
      }
      .cs-story {
        margin: 0;
        line-height: 1.4;
      }
      .cs-values {
        margin: 0;
        padding-inline-start: 1.2em;
        line-height: 1.4;
      }
      .cs-check {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cs-check li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        line-height: 1.35;
      }
      .cs-box {
        flex: none;
        font-size: 1.15rem;
        line-height: 1.2;
      }
      .cs-check--done {
        opacity: 0.6;
      }
      .cs-check--done span:last-child {
        text-decoration: line-through;
      }
      .cs-detail {
        margin-bottom: 8px;
        border: 1px solid var(--color-border, #d9dde3);
        border-radius: var(--radius-lg, 12px);
        background: var(--color-background, #f6f7f9);
        overflow: hidden;
      }
      .cs-detail > app-profession-sheets {
        padding: 0 8px 8px;
      }
      .cs-detail-head {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .cs-detail-title {
        flex: 1;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .cs-detail-figure {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .cs-negative {
        color: var(--color-danger, #c0392b);
      }
      .cs-detail-chevron {
        opacity: 0.6;
      }
    `,
  ],
})
export class CharacterSheetComponent {
  @Input({ required: true }) name = '';
  @Input() tagline = '';
  /** The story of a character of the custom edition; the classic professions have none. */
  @Input() story: CashflowProfileTexts | null = null;
  /** What of the winning list is met, by id; null: nothing yet (a character looked at before the game). */
  @Input() checks: Record<string, boolean> | null = null;
  @Input() sheets: ProfessionSheetNumbers | null = null;
  @Input() currency = '';
  @Output() liabilityOpen = new EventEmitter<number>();

  /** The panel that is open: the Cashflow, at first. */
  open: SheetId | null = 'cashflow';

  done(id: string): boolean {
    return !!this.checks?.[id];
  }

  toggle(panel: SheetId): void {
    this.open = this.open === panel ? null : panel;
  }

  panels(sheets: ProfessionSheetNumbers): { id: SheetId; title: string; value: number }[] {
    return [
      { id: 'cashflow', title: 'Cashflow.title', value: sheets.cashTotal },
      { id: 'income', title: 'Menu.statment', value: sheets.revenueTotal },
      { id: 'balance', title: 'Menu.sheet', value: sheets.assetsTotal - sheets.liabilitiesTotal },
    ];
  }

  trackPanel = (_index: number, panel: { id: string }): string => panel.id;
}
