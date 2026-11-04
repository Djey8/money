import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  computeCashflowProfessionMonthlyCashflowMinor,
  fromMinorUnits,
  professionIdAtDifficulty,
  type CashflowProfession,
  type CashflowProfileTexts,
} from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { CashflowGameService } from '../shared/services/cashflow-game.service';
import { CharacterSheetComponent } from '../main/cashflow-game/character-sheet.component';
import type { ProfessionSheetNumbers } from '../main/cashflow-game/profession-sheets.component';

/**
 * A character to read before choosing it (JFK, 2026-11-02): who they are, what matters to them, the dream and the reserve, and the
 * three sheets with the income, the expenses, the debts and what is owned - the same view the solo game shows when a character is
 * looked at, at the difficulty of the table (Easy and Hard have their own numbers).
 */
@Component({
  selector: 'app-character-preview',
  standalone: true,
  imports: [CommonModule, TranslateModule, CharacterSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-character-sheet
      *ngIf="profession as p"
      [name]="story?.name ?? p.title"
      [tagline]="story?.tagline ?? p.title"
      [story]="story"
      [sheets]="sheets"
      [extraGoals]="extraGoals"
      [currency]="currency"
      (dreamOpen)="dreamOpen.emit()"
      (reserveOpen)="reserveOpen.emit()"
    ></app-character-sheet>
  `,
})
export class CharacterPreviewComponent {
  private readonly game = inject(CashflowGameService);

  @Input({ required: true }) professionId = '';
  /** The dream points the table asks for besides the life dream (0: none). */
  @Input() pointsGoal = 0;

  get extraGoals(): { id: string; text: string }[] {
    if (this.pointsGoal <= 0) return [];
    return [
      {
        id: 'dreamPoints',
        text:
          this.lang === 'de'
            ? `${this.pointsGoal} Traumpunkte mit weiteren Träumen sammeln`
            : `Collect ${this.pointsGoal} dream points with other dreams`,
      },
    ];
  }
  @Input() gameSetId = 'jfk-stories';
  /** The difficulty of the table (a Dreamfund character has its own numbers on Easy and Hard). */
  @Input() difficulty: 'easy' | 'medium' | 'hard' | undefined;
  @Input() lang = 'en';
  @Input() currency = 'DT';
  /** The dream and the reserve of the character open as the projects they are (in a game that has begun). */
  @Output() dreamOpen = new EventEmitter<void>();
  @Output() reserveOpen = new EventEmitter<void>();

  private get set() {
    return CASHFLOW_GAME_SETS.find((candidate) => candidate.id === this.gameSetId);
  }

  get profession(): CashflowProfession | undefined {
    const set = this.set;
    const id = professionIdAtDifficulty(set, this.professionId, this.difficulty);
    return set?.professions.find((candidate) => candidate.id === id);
  }

  get story(): CashflowProfileTexts | null {
    const texts = this.profession?.profile?.texts as
      Record<string, CashflowProfileTexts> | undefined;
    return texts ? (texts[this.lang] ?? texts['en'] ?? null) : null;
  }

  private cache: { key: string; value: ProfessionSheetNumbers } | null = null;

  /** The numbers of the printed start: the salary, the expense lines, the debts, the savings and what the character owns. */
  get sheets(): ProfessionSheetNumbers | null {
    const p = this.profession;
    if (!p) return null;
    const value = this.numbersOf(p);
    const key = JSON.stringify(value);
    if (this.cache?.key !== key) this.cache = { key, value };
    return this.cache.value;
  }

  private numbersOf(p: CashflowProfession): ProfessionSheetNumbers {
    const money = (minor: number) => fromMinorUnits(minor);
    const salary = money(p.salaryMinor);
    const expenses = money(p.expenses.reduce((sum, line) => sum + line.amountMinor, 0));
    const kit = p.starterKit;
    const owned = [
      ...(kit.shares ?? []).map((share) => ({
        name: `${share.tag} · ${share.quantity}`,
        amount: money(share.quantity * share.priceMinor),
      })),
      ...(kit.assets ?? []).map((asset) => ({ name: asset.tag, amount: money(asset.amountMinor) })),
    ];
    const savings = money(p.savingsMinor);
    const liabilities = (kit.liabilities ?? []).map((line) => ({
      name: this.game.translateLiabilityTag(p, line),
      amount: money(line.amountMinor),
    }));
    return {
      cashIncome: salary,
      cashPassive: 0,
      cashExpenses: expenses,
      cashTotal: money(computeCashflowProfessionMonthlyCashflowMinor(p)),
      revenue: [{ name: this.salaryWord, amount: salary }],
      revenueTotal: salary,
      expenses: p.expenses.map((line) => ({
        name: this.game.translateExpenseLineTitle(p, line),
        amount: money(line.amountMinor),
      })),
      expensesTotal: expenses,
      assets: [{ name: this.savingsWord, amount: savings }, ...owned],
      assetsTotal: savings + owned.reduce((sum, line) => sum + line.amount, 0),
      liabilities,
      liabilitiesTotal: liabilities.reduce((sum, line) => sum + line.amount, 0),
    };
  }

  private get salaryWord(): string {
    return this.lang === 'de' ? 'Gehalt' : 'Salary';
  }

  private get savingsWord(): string {
    return this.lang === 'de' ? 'Ersparnisse' : 'Savings';
  }
}
