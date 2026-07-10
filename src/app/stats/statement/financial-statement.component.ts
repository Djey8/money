import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { AppStateService } from '../../shared/services/app-state.service';
import { AppNumberPipe } from '../../shared/pipes/app-number.pipe';
import {
  StatementPeriodType, FinancialStatement, computeStatement, CategoryAgg, KeyRatios,
} from './statement-calculations';

interface PeriodOption {
  type: StatementPeriodType;
  labelKey: string;
}

interface RatioMeta {
  key: keyof KeyRatios;
  labelKey: string;
  unit: '%' | '';
  /** Threshold above which the ratio is considered "good". If `lowerIsBetter`, the opposite. */
  goodThreshold: number;
  lowerIsBetter?: boolean;
  /** i18n key explaining the formula. */
  formulaKey: string;
  /** i18n key describing when the ratio is healthy. */
  healthyKey: string;
}

@Component({
  selector: 'app-financial-statement',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AppNumberPipe],
  templateUrl: './financial-statement.component.html',
  styleUrls: ['./financial-statement.component.css'],
})
export class FinancialStatementComponent implements OnInit, OnDestroy {
  periodTypes: PeriodOption[] = [
    { type: 'year',     labelKey: 'Statement.periodYear' },
    { type: 'halfyear', labelKey: 'Statement.periodHalfYear' },
    { type: 'quarter',  labelKey: 'Statement.periodQuarter' },
    { type: 'month',    labelKey: 'Statement.periodMonth' },
    { type: 'week',     labelKey: 'Statement.periodWeek' },
  ];

  selectedType: StatementPeriodType = 'year';
  selectedIndex = 0; // 0 = current period, -1 = previous
  statement!: FinancialStatement;

  ratioMeta: RatioMeta[] = [
    { key: 'savingsRate',      labelKey: 'Statement.savingsRate',      unit: '%', goodThreshold: 10,  formulaKey: 'Statement.savingsRateFormula',      healthyKey: 'Statement.savingsRateHealthy' },
    { key: 'fixedCostRatio',   labelKey: 'Statement.fixedCostRatio',   unit: '%', goodThreshold: 60,  lowerIsBetter: true, formulaKey: 'Statement.fixedCostRatioFormula', healthyKey: 'Statement.fixedCostRatioHealthy' },
    { key: 'netMargin',        labelKey: 'Statement.netMargin',        unit: '%', goodThreshold: 0,   formulaKey: 'Statement.netMarginFormula',        healthyKey: 'Statement.netMarginHealthy' },
    { key: 'debtRatio',        labelKey: 'Statement.debtRatio',        unit: '',  goodThreshold: 1,   lowerIsBetter: true, formulaKey: 'Statement.debtRatioFormula',      healthyKey: 'Statement.debtRatioHealthy' },
    { key: 'equityRatio',      labelKey: 'Statement.equityRatio',      unit: '%', goodThreshold: 30,  formulaKey: 'Statement.equityRatioFormula',      healthyKey: 'Statement.equityRatioHealthy' },
    { key: 'interestCoverage', labelKey: 'Statement.interestCoverage', unit: '',  goodThreshold: 1,   formulaKey: 'Statement.interestCoverageFormula', healthyKey: 'Statement.interestCoverageHealthy' },
  ];

  private langSub?: Subscription;

  constructor(private translate: TranslateService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.recompute();
    this.langSub = this.translate.onLangChange.subscribe((_: LangChangeEvent) => this.recompute());
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  get currency(): string {
    return AppStateService.instance.currency;
  }

  get periodLabel(): string {
    return this.statement?.period.label ?? '';
  }

  get dateRangeLabel(): string {
    if (!this.statement) return '';
    const fmt = this.translate.currentLang || 'en';
    const s = this.statement.period.startDate.toLocaleDateString(fmt, { day: '2-digit', month: 'short', year: 'numeric' });
    const e = this.statement.period.endDate.toLocaleDateString(fmt, { day: '2-digit', month: 'short', year: 'numeric' });
    return `${s} — ${e}`;
  }

  selectType(type: StatementPeriodType): void {
    this.selectedType = type;
    this.selectedIndex = 0;
    this.recompute();
  }

  prev(): void {
    this.selectedIndex--;
    this.recompute();
  }

  next(): void {
    if (this.selectedIndex < 0) {
      this.selectedIndex++;
      this.recompute();
    }
  }

  private recompute(): void {
    this.statement = computeStatement(this.selectedType, this.selectedIndex);
    this.cdr.markForCheck();
  }

  /** Trend class for change indicators (positive = up, negative = down). */
  trendClass(change: number, lowerIsBetter = false): string {
    if (change === 0) return 'trend-flat';
    const positive = change > 0;
    const good = lowerIsBetter ? !positive : positive;
    return good ? 'trend-up' : 'trend-down';
  }

  trendArrow(change: number): string {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '—';
  }

  /** Ratio value class — green when healthy, red when not. */
  ratioHealthClass(meta: RatioMeta): string {
    const value = this.statement.ratios[meta.key];
    const healthy = meta.lowerIsBetter ? value < meta.goodThreshold : value >= meta.goodThreshold;
    return healthy ? 'ratio-healthy' : 'ratio-warning';
  }

  ratioChange(meta: RatioMeta): number {
    const cur = this.statement.ratios[meta.key];
    const prev = this.statement.previousRatios[meta.key];
    if (prev === 0) return 0;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  /** Safely format a number for display using the app's existing number pipe. */
  print(): void {
    window.print();
  }

  /** Accessor helpers used by template to keep it concise. */
  trackByLabel = (_: number, row: { label: string }) => row.label;
  trackByCategory = (_: number, row: CategoryAgg) => row.category;
}
