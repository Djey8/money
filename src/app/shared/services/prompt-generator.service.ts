import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService } from './app-state.service';
import { SettingsComponent } from 'src/app/panels/settings/settings.component';
import { Transaction } from 'src/app/interfaces/transaction';
import { Subscription } from 'src/app/interfaces/subscription';

export type PromptType = 'grow-strategy' | 'budget-optimizer' | 'subscription-audit' | 'expense-pattern' | 'smile-create' | 'smile-improve' | 'fire-create' | 'fire-improve';

export interface PromptOptions {
  includeAssets: boolean;
  includeShares: boolean;
  includeInvestments: boolean;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  investmentHorizon: '0-1' | '1-3' | '3-5' | '5+';
  considerLoans: boolean;
  anonymized: boolean;
  broker: string;
  country: string;
  // Goals
  primaryGoal: '' | 'build-capital' | 'monthly-income' | 'financial-independence' | 'large-purchase';
  targetAmount: number;
  // Risk quantification
  maxDrawdown: '' | '10' | '20' | '30' | '50';
  riskPreference: '' | 'growth' | 'cashflow' | 'balanced';
  // Situation
  taxSituation: '' | 'employed' | 'freelance' | 'self-employed' | 'retired';
  churchTax: boolean;
  monthlyBudget: number;
  willingToCutExpenses: boolean;
  weeklyHours: number;
  skills: string;
  // Credit
  creditScore: '' | 'good' | 'average' | 'unknown';
  maxLoanPayment: number;
  // Capital
  availableCapital: number;
  cashBuffer: number;
  // Constraints
  leveragePreference: '' | 'avoid' | 'small' | 'active';
  geoFocus: '' | 'local' | 'eu' | 'global';
  complexityTolerance: '' | 'low' | 'medium' | 'high';
  exitStrategy: '' | 'sell' | 'hold';
  numberOfSuggestions: number | undefined;
  // Phase 2 Settings
  analysisPeriod: '3' | '6' | '12' | 'all';
  detailLevel: 'quick' | 'detailed';
  minSubscriptionAmount: number;
  subscriptionFocusArea: 'all' | 'high-cost' | 'unused';
  includeSeasonalAnalysis: boolean;
  selectedBudgetCategories: string[]; // Budget Optimizer: which categories to analyze
  selectedSubscriptions: string[]; // Subscription Audit: which subscriptions to analyze (by title)
  // Phase 3 - Smile Settings
  smileGoal: string;
  smileUrgency: 'flexible' | '6-months' | '1-year' | '2-years';
  smileResearchDepth: 'quick' | 'moderate' | 'deep';
  smileBudgetFlexibility: 'strict' | 'some' | 'open';
  smileInformationFocus: string[]; // Checkboxes: shopping, reviews, comparisons, tips, forums, guides, custom
  smileCustomInformationFocus?: string; // Custom value if user selects "other"
  smileComplexity: '' | 'simple' | 'moderate' | 'complex'; // '' = not specified
  smileNumberOfSuggestions: number | undefined;
  // Phase 3 - Fire Settings
  fireEmergencyType: 'appliance' | 'medical' | 'car' | 'debt' | 'job-loss' | 'family-loan' | 'other';
  fireTotalAmount: number;
  fireAlreadyBorrowed: boolean;
  fireLenderDetails: string;
  fireUrgency: 'immediate' | '1-month' | '3-months' | '6-months' | 'flexible';
  firePaybackStrategy: 'snowball' | 'avalanche' | 'realistic' | 'ai-decide';
  fireResearchNeeds: string[]; // Checkboxes: comparisons, diy, financing, insurance, prevention, custom
  fireCustomResearchNeeds?: string; // Custom value if user selects "other"
  fireNumberOfSuggestions: number | undefined;
  // Phase 4 - Improve Settings (shared for Smile & Fire)
  selectedSmileProjects: string[]; // Titles of projects to improve
  selectedFireEmergencies: string[]; // Titles of emergencies to improve
  improveUserPlan: string; // What the user wants to achieve
  improveDetailLevel: 'quick' | 'moderate' | 'deep';
  improveAreas: string[]; // Checkboxes: description, buckets, links, action-items, payment-plan, timeline, notes, budget-realism
  improveInformationFocus: string[]; // Reused: shopping, reviews, comparisons, tips, forums, guides, custom
  improveCustomInformationFocus?: string;
  improveCustomInstructions: string; // Free-text additional instructions
}

export const BROKER_OPTIONS = [
  'Trade Republic',
  'Scalable Capital',
  'ING',
  'DKB',
  'Comdirect',
  'Consorsbank',
  'Flatex / Degiro',
  'Interactive Brokers',
  'Smartbroker+',
  'Other'
];

export const COUNTRY_OPTIONS = [
  'Germany',
  'Austria',
  'Switzerland',
  'Netherlands',
  'France',
  'Spain',
  'Italy',
  'Belgium',
  'Ireland',
  'Other EU',
  'Other'
];

interface MonthlyBucket {
  income: number;
  expenses: number;
  byAccount: Record<string, number>;
  byCategory: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class PromptGeneratorService {

  private static readonly LANG_MAP: Record<string, string> = {
    en: 'English',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    cn: 'Chinese',
    ar: 'Arabic'
  };

  private get state(): AppStateService { return AppStateService.instance; }
  private get currency(): string { return SettingsComponent.currency || '€'; }

  constructor(private translate: TranslateService) {}

  getDefaultOptions(): PromptOptions {
    return {
      includeAssets: true,
      includeShares: true,
      includeInvestments: true,
      riskTolerance: 'moderate',
      investmentHorizon: '1-3',
      considerLoans: true,
      anonymized: true,
      broker: '',
      country: '',
      primaryGoal: '',
      targetAmount: 0,
      maxDrawdown: '',
      riskPreference: '',
      taxSituation: '',
      churchTax: false,
      monthlyBudget: 0,
      willingToCutExpenses: false,
      weeklyHours: 0,
      skills: '',
      creditScore: '',
      maxLoanPayment: 0,
      availableCapital: 0,
      cashBuffer: 0,
      leveragePreference: '',
      geoFocus: '',
      complexityTolerance: '',
      exitStrategy: '',
      numberOfSuggestions: undefined,
      analysisPeriod: '6',
      detailLevel: 'detailed',
      minSubscriptionAmount: 0,
      subscriptionFocusArea: 'all',
      includeSeasonalAnalysis: true,
      selectedBudgetCategories: [],
      selectedSubscriptions: [],
      // Smile defaults
      smileGoal: '',
      smileUrgency: 'flexible',
      smileResearchDepth: 'moderate',
      smileBudgetFlexibility: 'some',
      smileInformationFocus: ['shopping', 'reviews', 'tips'],
      smileCustomInformationFocus: undefined,
      smileComplexity: '',
      smileNumberOfSuggestions: undefined,
      // Fire defaults
      fireEmergencyType: 'other',
      fireTotalAmount: 0,
      fireAlreadyBorrowed: false,
      fireLenderDetails: '',
      fireUrgency: 'flexible',
      firePaybackStrategy: 'realistic',
      fireResearchNeeds: ['comparisons', 'diy', 'financing'],
      fireCustomResearchNeeds: undefined,
      fireNumberOfSuggestions: undefined,
      // Improve defaults
      selectedSmileProjects: [],
      selectedFireEmergencies: [],
      improveUserPlan: '',
      improveDetailLevel: 'moderate',
      improveAreas: ['budget-realism', 'add-links', 'action-items', 'notes'],
      improveInformationFocus: ['shopping', 'reviews', 'tips'],
      improveCustomInformationFocus: undefined,
      improveCustomInstructions: ''
    };
  }

  generateGrowPrompt(options: PromptOptions): string {
    const sections: string[] = [];

    sections.push(this.buildContextBlock(options));
    sections.push(this.buildInstructionBlock(options));
    sections.push(this.buildOutputFormatBlock());

    return sections.join('\n\n');
  }

  private buildContextBlock(options: PromptOptions): string {
    const lines: string[] = ['=== MY FINANCIAL CONTEXT ==='];
    const anon = options.anonymized;
    const monthly = this.getMonthlyBreakdown();
    const months = Object.keys(monthly).sort();

    // --- Income & Expense Averages (from real transactions) ---
    if (months.length > 0) {
      lines.push(`Data history: ${months.length} months (${months[0]} to ${months[months.length - 1]})`);

      const incomes = months.map(m => monthly[m].income);
      const expenses = months.map(m => monthly[m].expenses);
      const avgIncome = incomes.reduce((a, b) => a + b, 0) / months.length;
      const avgExpense = expenses.reduce((a, b) => a + b, 0) / months.length;
      const avgSavings = avgIncome - avgExpense;
      const savingsRate = avgIncome > 0 ? Math.round((avgSavings / avgIncome) * 100) : 0;

      lines.push('');
      lines.push('--- Monthly Averages ---');
      lines.push(`Avg monthly income: ${anon ? this.toRange(avgIncome) : this.currency + avgIncome.toFixed(0)}`);
      lines.push(`Avg monthly expenses: ${anon ? this.toRange(avgExpense) : this.currency + avgExpense.toFixed(0)}`);
      lines.push(`Avg monthly surplus: ${anon ? this.toRange(Math.abs(avgSavings)) + (avgSavings < 0 ? ' (deficit)' : '') : this.currency + avgSavings.toFixed(0)}`);
      lines.push(`Savings rate: ~${savingsRate}%`);

      // --- Available Capital ---
      if (options.monthlyBudget > 0) {
        lines.push(`Monthly investment budget (user-specified): ${anon ? this.toRange(options.monthlyBudget) : this.currency + options.monthlyBudget}`);
      } else if (avgSavings > 0) {
        lines.push(`Estimated investable surplus: ${anon ? this.toRange(avgSavings) : this.currency + avgSavings.toFixed(0)}/mo`);
      }
      if (options.willingToCutExpenses) {
        lines.push('Willing to reduce expenses to increase investment capacity: yes');
      }

      // --- Spending by account (actual distribution) ---
      const accountTotals: Record<string, number> = {};
      months.forEach(m => {
        Object.entries(monthly[m].byAccount).forEach(([acct, amt]) => {
          accountTotals[acct] = (accountTotals[acct] || 0) + amt;
        });
      });
      const totalExpenseAll = Object.values(accountTotals).reduce((a, b) => a + b, 0);
      if (totalExpenseAll > 0) {
        lines.push('');
        lines.push('--- Spending Distribution (actual) ---');
        const accountNames = ['Daily', 'Splurge', 'Smile', 'Fire'];
        accountNames.forEach(acct => {
          const total = accountTotals[acct] || 0;
          const pct = Math.round((total / totalExpenseAll) * 100);
          const avg = total / months.length;
          if (pct > 0) {
            lines.push(`${acct}: ${pct}% of spending (avg ${anon ? this.toRange(avg) : this.currency + avg.toFixed(0)}/mo)`);
          }
        });
        lines.push(`Target allocation: Daily ${this.state.daily}% | Splurge ${this.state.splurge}% | Smile ${this.state.smile}% | Fire ${this.state.fire}%`);
      }

      // --- Top 5 expense categories ---
      const categoryTotals: Record<string, number> = {};
      months.forEach(m => {
        Object.entries(monthly[m].byCategory).forEach(([cat, amt]) => {
          categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
        });
      });
      const sortedCats = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      if (sortedCats.length > 0) {
        lines.push('');
        lines.push('--- Top Expense Categories (monthly avg) ---');
        sortedCats.forEach(([cat, total]) => {
          const avg = total / months.length;
          lines.push(`${cat}: ${anon ? this.toRange(avg) : this.currency + avg.toFixed(0)}/mo`);
        });
      }

      // --- Trend & Outliers ---
      if (months.length >= 3) {
        lines.push('');
        lines.push('--- Trends & Notable Months ---');

        // Trend: compare last 3 months to overall average
        const last3 = months.slice(-3);
        const recentAvgExp = last3.map(m => monthly[m].expenses).reduce((a, b) => a + b, 0) / 3;
        const recentAvgInc = last3.map(m => monthly[m].income).reduce((a, b) => a + b, 0) / 3;
        const expTrend = avgExpense > 0 ? Math.round(((recentAvgExp - avgExpense) / avgExpense) * 100) : 0;
        const incTrend = avgIncome > 0 ? Math.round(((recentAvgInc - avgIncome) / avgIncome) * 100) : 0;

        if (Math.abs(incTrend) > 5) {
          lines.push(`Income trend (last 3 mo): ${incTrend > 0 ? '+' : ''}${incTrend}% vs average`);
        } else {
          lines.push('Income trend: stable');
        }
        if (Math.abs(expTrend) > 5) {
          lines.push(`Spending trend (last 3 mo): ${expTrend > 0 ? '+' : ''}${expTrend}% vs average`);
        } else {
          lines.push('Spending trend: stable');
        }

        // Outlier months (expense >50% above average)
        const outliers = months.filter(m => monthly[m].expenses > avgExpense * 1.5);
        if (outliers.length > 0 && outliers.length <= 4) {
          lines.push(`High-spending months: ${outliers.join(', ')} (>${anon ? '50% above avg' : this.currency + (avgExpense * 1.5).toFixed(0)})`);
        }

        // Income consistency
        const incomeStdDev = Math.sqrt(incomes.reduce((s, v) => s + Math.pow(v - avgIncome, 2), 0) / months.length);
        const incomeCV = avgIncome > 0 ? incomeStdDev / avgIncome : 0;
        if (incomeCV > 0.3) {
          lines.push('Income stability: variable (>30% coefficient of variation) — may indicate freelance/irregular income');
        } else if (incomeCV > 0.15) {
          lines.push('Income stability: somewhat variable — likely has bonuses or side income');
        } else {
          lines.push('Income stability: steady — consistent salary/wage income');
        }
      }

      // --- Subscriptions ---
      if (this.state.allSubscriptions.length > 0) {
        const subTotal = this.state.allSubscriptions.reduce((s, sub) => s + (sub.amount || 0), 0);
        lines.push('');
        lines.push(`Recurring subscriptions: ${this.state.allSubscriptions.length} active, total ${anon ? this.toRange(subTotal) : this.currency + subTotal.toFixed(0)}/mo`);
        if (!anon && this.state.allSubscriptions.length <= 10) {
          this.state.allSubscriptions.forEach(sub => {
            lines.push(`  - ${sub.title || sub.category}: ${this.currency}${(sub.amount || 0).toFixed(0)}/mo`);
          });
        }
      }
    } else {
      // Fallback: no transactions, use static balance-sheet data
      const totalIncome = this.sumRevenues();
      if (totalIncome > 0) {
        lines.push(`Monthly income (static): ${anon ? this.toRange(totalIncome) : this.currency + totalIncome.toFixed(2)}`);
      }
      const totalExpenses = this.sumExpenses();
      if (totalExpenses > 0) {
        lines.push(`Monthly expenses (static): ${anon ? this.toRange(totalExpenses) : this.currency + totalExpenses.toFixed(2)}`);
      }
      lines.push(`Budget allocation: Daily ${this.state.daily}% | Splurge ${this.state.splurge}% | Smile ${this.state.smile}% | Fire ${this.state.fire}%`);
    }

    // --- Emergency Fund (Mojo) ---
    const mojo = this.state.mojo;
    if (mojo && (mojo.target > 0 || mojo.amount > 0)) {
      lines.push('');
      lines.push('--- Emergency Fund ---');
      const current = mojo.amount || 0;
      const target = mojo.target || 0;
      if (anon) {
        lines.push(`Current: ${this.toRange(current)}`);
        if (target > 0) {
          lines.push(`Target: ${this.toRange(target)}`);
          const pct = Math.round((current / target) * 100);
          lines.push(`Progress: ${pct}%`);
        }
      } else {
        lines.push(`Current: ${this.currency}${current.toFixed(0)}`);
        if (target > 0) {
          lines.push(`Target: ${this.currency}${target.toFixed(0)}`);
          const pct = Math.round((current / target) * 100);
          lines.push(`Progress: ${pct}%`);
        }
      }
      // Estimate months of coverage
      const monthly = this.getMonthlyBreakdown();
      const mKeys = Object.keys(monthly).sort();
      if (mKeys.length > 0) {
        const avgExp = mKeys.map(m => monthly[m].expenses).reduce((a, b) => a + b, 0) / mKeys.length;
        if (avgExp > 0) {
          const coverageMonths = Math.round((current / avgExp) * 10) / 10;
          lines.push(`Coverage: ~${coverageMonths} months of expenses`);
        }
      }
    } else {
      lines.push('');
      lines.push('--- Emergency Fund ---');
      lines.push('No emergency fund configured yet.');
    }

    // --- Investor Profile ---
    const hasProfile = options.primaryGoal || options.taxSituation || options.weeklyHours > 0 || options.skills || options.creditScore || options.maxDrawdown || options.riskPreference || options.availableCapital > 0 || options.cashBuffer > 0 || options.leveragePreference || options.geoFocus || options.complexityTolerance || options.exitStrategy;
    if (hasProfile) {
      lines.push('');
      lines.push('--- Investor Profile ---');
      if (options.primaryGoal) {
        const goalLabels: Record<string, string> = {
          'build-capital': 'Build capital / grow net worth',
          'monthly-income': 'Generate monthly passive income',
          'financial-independence': 'Achieve financial independence',
          'large-purchase': 'Save for a large purchase'
        };
        lines.push(`Primary goal: ${goalLabels[options.primaryGoal] || options.primaryGoal}`);
      }
      if (options.targetAmount > 0) {
        lines.push(`Target in ${options.investmentHorizon} years: ${anon ? this.toRange(options.targetAmount) : this.currency + options.targetAmount}`);
      }
      if (options.maxDrawdown) {
        lines.push(`Max acceptable portfolio drawdown: ${options.maxDrawdown}%`);
      }
      if (options.riskPreference) {
        const weights: Record<string, string> = {
          growth: 'Growth 80% / Cashflow 20%',
          cashflow: 'Growth 20% / Cashflow 80%',
          balanced: 'Growth 50% / Cashflow 50%'
        };
        lines.push(`Priority weighting: ${weights[options.riskPreference] || options.riskPreference}`);
      }
      if (options.availableCapital > 0) {
        lines.push(`Available capital to invest immediately: ${anon ? this.toRange(options.availableCapital) : this.currency + options.availableCapital}`);
      }
      if (options.cashBuffer > 0) {
        lines.push(`Minimum cash buffer to keep: ${anon ? this.toRange(options.cashBuffer) : this.currency + options.cashBuffer}`);
      }
      if (options.taxSituation) {
        lines.push(`Employment / tax type: ${options.taxSituation}`);
      }
      if (options.churchTax) {
        lines.push('Church tax: yes (affects capital gains tax rate)');
      }
      if (options.weeklyHours > 0) {
        lines.push(`Time available per week for investing activities: ${options.weeklyHours} hours`);
      }
      if (options.skills) {
        lines.push(`Skills / interests: ${options.skills}`);
      }
      if (options.complexityTolerance) {
        const complexLabels: Record<string, string> = {
          low: 'Low (simple, passive strategies only)',
          medium: 'Medium (some active management acceptable)',
          high: 'High (complex systems, multiple steps OK)'
        };
        lines.push(`Complexity tolerance: ${complexLabels[options.complexityTolerance] || options.complexityTolerance}`);
      }
      if (options.geoFocus) {
        const geoLabels: Record<string, string> = {
          local: 'Local / domestic market only',
          eu: 'EU / European markets',
          global: 'Global (all markets)'
        };
        lines.push(`Geographic focus: ${geoLabels[options.geoFocus] || options.geoFocus}`);
      }
      if (options.exitStrategy) {
        const exitLabels: Record<string, string> = {
          sell: `Sell / exit after ${options.investmentHorizon} years`,
          hold: 'Hold long-term if performing well'
        };
        lines.push(`Exit strategy: ${exitLabels[options.exitStrategy] || options.exitStrategy}`);
      }
      if (options.leveragePreference) {
        const levLabels: Record<string, string> = {
          avoid: 'Avoid debt / no leverage',
          small: 'Open to small, manageable leverage',
          active: 'Actively seeking leverage opportunities'
        };
        lines.push(`Leverage preference: ${levLabels[options.leveragePreference] || options.leveragePreference}`);
      }
      if (options.creditScore) {
        lines.push(`Credit score (Schufa): ${options.creditScore}`);
      }
      if (options.maxLoanPayment > 0) {
        lines.push(`Max acceptable monthly loan payment: ${anon ? this.toRange(options.maxLoanPayment) : this.currency + options.maxLoanPayment}`);
      }
    }

    // --- Balance Sheet ---
    lines.push('');
    lines.push('--- Balance Sheet ---');

    if (this.state.allAssets.length > 0) {
      const totalAssets = this.state.allAssets.reduce((s, a) => s + (a.amount || 0), 0);
      lines.push(`Assets: ${anon ? `${this.state.allAssets.length} positions, total ${this.toRange(totalAssets)}` : `${this.state.allAssets.length} positions, total ${this.currency}${totalAssets.toFixed(2)}`}`);
      if (!anon) {
        this.state.allAssets.forEach(a => lines.push(`  - ${a.tag}: ${this.currency}${(a.amount || 0).toFixed(2)}`));
      }
    }

    if (this.state.allShares.length > 0) {
      const totalShares = this.state.allShares.reduce((s, sh) => s + (sh.quantity * sh.price), 0);
      lines.push(`Share portfolio: ${anon ? `${this.state.allShares.length} positions, total ${this.toRange(totalShares)}` : `${this.state.allShares.length} positions, total ${this.currency}${totalShares.toFixed(2)}`}`);
      if (!anon) {
        this.state.allShares.forEach(sh => lines.push(`  - ${sh.tag}: ${sh.quantity} units @ ${this.currency}${sh.price}`));
      }
    }

    if (this.state.allInvestments.length > 0) {
      const totalInv = this.state.allInvestments.reduce((s, inv) => s + (inv.amount || 0), 0);
      lines.push(`Investments: ${anon ? `${this.state.allInvestments.length} positions, total ${this.toRange(totalInv)}` : `${this.state.allInvestments.length} positions, total ${this.currency}${totalInv.toFixed(2)}`}`);
      if (!anon) {
        this.state.allInvestments.forEach(inv => lines.push(`  - ${inv.tag}: value ${this.currency}${(inv.amount || 0).toFixed(2)}, deposit ${this.currency}${(inv.deposit || 0).toFixed(2)}`));
      }
    }

    if (this.state.liabilities.length > 0) {
      const totalLiab = this.state.liabilities.reduce((s, l) => s + (l.amount || 0), 0);
      lines.push(`Liabilities: ${anon ? `${this.state.liabilities.length} obligations, total ${this.toRange(totalLiab)}` : `${this.state.liabilities.length} obligations, total ${this.currency}${totalLiab.toFixed(2)}`}`);
      if (!anon) {
        this.state.liabilities.forEach(l => lines.push(`  - ${l.tag}: ${this.currency}${(l.amount || 0).toFixed(2)}, monthly ${this.currency}${(l.credit || 0).toFixed(2)}`));
      }
    }

    // Net worth
    const nwAssets = this.state.allAssets.reduce((s, a) => s + (a.amount || 0), 0)
      + this.state.allShares.reduce((s, sh) => s + (sh.quantity * sh.price), 0)
      + this.state.allInvestments.reduce((s, inv) => s + (inv.amount || 0), 0);
    const nwLiab = this.state.liabilities.reduce((s, l) => s + (l.amount || 0), 0);
    if (nwAssets > 0 || nwLiab > 0) {
      const netWorth = nwAssets - nwLiab;
      lines.push(`Net worth: ${anon ? this.toRange(Math.abs(netWorth)) + (netWorth < 0 ? ' (negative)' : '') : this.currency + netWorth.toFixed(2)}`);
      const monthlyDebt = this.state.liabilities.reduce((s, l) => s + (l.credit || 0), 0);
      const avgInc = months.length > 0
        ? months.map(m => monthly[m].income).reduce((a, b) => a + b, 0) / months.length
        : this.sumRevenues();
      if (nwLiab > 0 && avgInc > 0) {
        const dti = Math.round((monthlyDebt / avgInc) * 100);
        lines.push(`Debt-to-income ratio: ~${dti}%`);
      }
    }

    // --- Existing grow projects ---
    if (this.state.allGrowProjects.length > 0) {
      lines.push('');
      lines.push(`=== MY EXISTING GROW PROJECTS (${this.state.allGrowProjects.length}) ===`);
      lines.push('These are strategies I am already pursuing or researching. Tailor your suggestions to complement (not duplicate) these:');
      this.state.allGrowProjects.forEach((gp, i) => {
        const parts = [`${i + 1}. "${gp.title}"`];
        if (gp.sub) parts.push(`(${gp.sub})`);
        if (gp.phase) parts.push(`[${gp.phase}]`);
        lines.push(parts.join(' '));
        if (gp.description) lines.push(`   What: ${gp.description}`);
        if (gp.strategy) lines.push(`   Strategy: ${gp.strategy}`);
        if (gp.risks) lines.push(`   Risks: ${gp.risks}`);
        if (gp.riskScore) lines.push(`   Risk score: ${gp.riskScore}/5`);
        if (gp.amount > 0) lines.push(`   Capital: ${anon ? this.toRange(gp.amount) : this.currency + gp.amount}`);
        if (gp.cashflow > 0) lines.push(`   Monthly cashflow: ${anon ? this.toRange(gp.cashflow) : this.currency + gp.cashflow}`);
        if (gp.share) lines.push(`   Type: Share — ${gp.share.tag}, ${gp.share.quantity} units @ ${anon ? 'market price' : this.currency + gp.share.price}`);
        if (gp.investment) lines.push(`   Type: Investment — ${gp.investment.tag}, deposit ${anon ? this.toRange(gp.investment.deposit || 0) : this.currency + (gp.investment.deposit || 0)}`);
        if (gp.liabilitie) lines.push(`   Linked loan: ${gp.liabilitie.tag}, ${anon ? this.toRange(gp.liabilitie.amount || 0) : this.currency + (gp.liabilitie.amount || 0)}, monthly ${anon ? this.toRange(gp.liabilitie.credit || 0) : this.currency + (gp.liabilitie.credit || 0)}`);
        if (gp.isAsset) lines.push(`   Type: Asset`);
      });
    }

    lines.push('');
    lines.push(`Currency: ${this.currency}`);

    return lines.join('\n');
  }

  private buildInstructionBlock(options: PromptOptions): string {
    const lines: string[] = ['=== INSTRUCTIONS ==='];

    lines.push('Act as a financial research analyst. I want you to research, evaluate, and present investment opportunities based on my financial situation.');
    if (options.numberOfSuggestions) {
      lines.push(`Provide exactly ${options.numberOfSuggestions} investment suggestions.`);
    } else {
      lines.push('Provide investment suggestions (you decide how many based on my situation).');
    }
    lines.push('For each suggestion, provide an EXHAUSTIVE deep dive — not a summary. After reading your output, I must fully understand the opportunity without needing to ask any follow-up questions. Every JSON field will be imported directly into my finance app, so each field must be rich, specific, and self-contained.');

    const tracks: string[] = [];
    if (options.includeAssets) tracks.push('Asset Trading (buy physical/digital assets to sell for profit)');
    if (options.includeShares) tracks.push('Shares & Dividends (ETFs, dividend stocks, REITs)');
    if (options.includeInvestments) tracks.push('Leveraged Investments (real estate, business acquisitions)');

    if (tracks.length > 0) {
      lines.push(`Consider these investment tracks:\n${tracks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
    }

    lines.push(`Risk tolerance: ${options.riskTolerance}`);
    lines.push(`Investment horizon: ${options.investmentHorizon} years`);

    if (options.broker) {
      lines.push(`My broker/platform: ${options.broker}. Suggest only instruments available on this platform where possible. Include fee/tax considerations specific to this broker.`);
    }
    if (options.country) {
      lines.push(`Tax residency: ${options.country}. Consider local tax rules (capital gains tax, withholding tax, tax-free allowances) in your analysis.`);
      lines.push(`Use ${options.country} / European market context where relevant.`);
    }

    if (options.considerLoans) {
      lines.push('For each recommendation, evaluate loan/leverage feasibility including debt-to-income impact and break-even timeline.');
    }

    // Goal-aligned instructions
    if (options.primaryGoal) {
      const goalInstructions: Record<string, string> = {
        'build-capital': 'My primary goal is to build capital and grow net worth. Prioritize strategies with strong long-term appreciation potential.',
        'monthly-income': 'My primary goal is generating monthly passive income. Prioritize dividend stocks, REITs, rental income, and other cashflow-generating strategies.',
        'financial-independence': 'My primary goal is achieving financial independence. Focus on building a self-sustaining portfolio that can eventually replace my active income.',
        'large-purchase': 'My primary goal is saving for a large purchase. Focus on capital preservation and growth with manageable risk over my horizon.'
      };
      lines.push(goalInstructions[options.primaryGoal] || '');
    }

    lines.push('');
    lines.push('=== FOR EACH SUGGESTION, INCLUDE ALL OF THE FOLLOWING ===');
    lines.push('1. MARKET RESEARCH: Current market conditions, trends, and timing considerations. Reference real data, indices, or market reports where possible.');
    lines.push('2. DEEP DIVE: Detailed explanation of the strategy, how it works, and why it fits my financial situation. Reference known strategies (DCA, Value Investing, BRRRR, etc.) where applicable.');
    lines.push('3. COMMUNITY INSIGHTS: What are people saying in forums (Reddit, Bogleheads, local finance communities)? What are common pitfalls and success stories?');
    lines.push('4. OPTIONS & ALTERNATIVES: Present concrete options (specific ETFs, specific asset classes, specific markets) with pros/cons for each.');
    lines.push('5. SOURCES & LINKS: Provide real, verifiable links for further reading — broker product pages, fund factsheets, market analysis articles, financial calculators, comparison tools, and relevant forum threads. Focus especially on broker-specific links where the user can directly research or buy the suggested instrument.');
    lines.push('6. RISK ASSESSMENT: Rate risk as a numeric score from 0-5 (use decimals like 2.5 if needed). Provide detailed justification. Include best-case, base-case, and worst-case scenarios with estimated returns.');
    if (options.considerLoans) {
      lines.push('7. LOAN ANALYSIS: Should I use leverage? Estimated monthly payment, break-even timeline, interest rate sensitivity (+2%).');
    }
    lines.push(`${options.considerLoans ? '8' : '7'}. ACTIONABLE NEXT STEPS: Provide 3-5 concrete action items per suggestion. These will become checkable tasks in my app. Be specific — "Open account at X broker" not "Consider opening an account". Order by priority (high → medium → low). Include due date suggestions where useful (e.g. "within 1 week", "before next quarter end").`);

    // Quality directives
    lines.push('');
    lines.push('=== QUALITY REQUIREMENTS ===');
    lines.push('- Rank all suggestions from best to worst fit for my specific situation.');
    lines.push('- Ensure suggestions work together as a coherent portfolio, not isolated standalone ideas.');
    lines.push('- Evaluate whether current market timing is favorable or if waiting/DCA is better.');
    lines.push('- Prefer realistic, actionable strategies over theoretical or generic advice.');
    lines.push('- Highlight asymmetric opportunities (low downside, high upside potential).');

    lines.push('');
    lines.push('=== CRITICAL: JSON FIELD RICHNESS ===');
    lines.push('The JSON fields are imported DIRECTLY into my finance app. Each field must be comprehensive so I never need to re-ask the LLM. Treat the JSON as a complete research dossier:');
    lines.push('- "description" (min 3-5 sentences): Explain WHAT this investment is, WHY it fits my situation, what the expected outcome is, and how it compares to alternatives. A reader should understand the full pitch from this field alone.');
    lines.push('- "strategy" (min 3-5 sentences): Provide a CONCRETE step-by-step execution plan. Name the specific strategy (DCA, BRRRR, dividend growth, etc.), specify exact amounts, frequencies, and milestones. Include entry criteria, rebalancing rules, and exit triggers.');
    lines.push('- "risks" (min 3-5 sentences): Detail ALL key risk factors with severity. Include market risk, liquidity risk, currency risk, regulatory risk as applicable. State best-case/base-case/worst-case return scenarios with numbers. Explain mitigation strategies for each risk.');
    lines.push('- "notes" (min 2-4 sentences): Provide additional context that does not fit in other fields — tax optimization tips, timing considerations, seasonal patterns, community sentiment, personal observations, or caveats. This is your space for everything else the user should know.');
    lines.push('- "links" (3-5 per suggestion): Each link must have a descriptive label. Include: broker product/purchase page, official fund/asset factsheet, a market analysis or news article, a financial calculator or comparison tool, and a community discussion thread (Reddit, forum).');
    lines.push('- "actionItems" (3-5 per suggestion): Each must be a specific, executable task — not vague. Include WHO to contact, WHAT to open/buy/research, and WHEN to do it. Use all three priority levels (high/medium/low).');

    if (options.complexityTolerance) {
      const complexInst: Record<string, string> = {
        low: '- Only suggest simple, passive strategies that require minimal ongoing management.',
        medium: '- Balance between passive and active strategies. Some hands-on work is acceptable.',
        high: '- Feel free to suggest complex, multi-step strategies if the risk/reward justifies it.'
      };
      lines.push(complexInst[options.complexityTolerance] || '');
    }
    if (options.exitStrategy) {
      if (options.exitStrategy === 'sell') {
        lines.push(`- I plan to exit/sell positions after ${options.investmentHorizon} years. Factor in liquidity and exit costs.`);
      } else {
        lines.push('- I am open to holding positions long-term if they perform well. Consider both short-term and long-term returns.');
      }
    }
    if (options.geoFocus) {
      const geoInst: Record<string, string> = {
        local: '- Focus suggestions on my local/domestic market. Avoid foreign-market-only strategies.',
        eu: '- Focus suggestions on European/EU markets. Include cross-border EU opportunities.',
        global: '- Consider global markets and opportunities without geographic restrictions.'
      };
      lines.push(geoInst[options.geoFocus] || '');
    }
    if (options.leveragePreference) {
      const levInst: Record<string, string> = {
        avoid: '- I want to avoid debt. Do not prioritize leverage-dependent strategies.',
        small: '- I am open to small, manageable leverage if the risk/reward is favorable.',
        active: '- I actively seek leverage opportunities. Prioritize strategies where leverage amplifies returns.'
      };
      lines.push(levInst[options.leveragePreference] || '');
    }

    // Response language
    const lang = this.translate?.currentLang || 'en';
    const langName = PromptGeneratorService.LANG_MAP[lang];
    if (lang !== 'en' && langName) {
      lines.push('');
      lines.push(`IMPORTANT: Please write your entire response in ${langName}.`);
    }

    return lines.join('\n');
  }

  private buildOutputFormatBlock(): string {
    return `=== OUTPUT FORMAT ===
For each suggestion, write the full research analysis as described above.
Then, at the END of each suggestion, include a code block with the JSON object for that suggestion so I can copy it directly into my finance app.

CRITICAL: The JSON is my COMPLETE research dossier. After import, I should never need to re-ask the LLM about this project. Pack ALL relevant knowledge into the fields.

Use this exact JSON structure per suggestion:

\`\`\`json
{
  "title": "Short key / acronym (e.g. VWCE, Gold1oz, RentalApt)",
  "sub": "Full descriptive name (e.g. Vanguard FTSE All-World ETF)",
  "phase": "idea",
  "description": "COMPREHENSIVE: What it is, why it fits, expected outcome, comparison to alternatives (3-5 sentences minimum)",
  "strategy": "CONCRETE: Named strategy, exact steps, amounts, frequencies, entry/exit criteria, rebalancing rules (3-5 sentences minimum)",
  "riskScore": 0,
  "risks": "DETAILED: All risk factors with severity, best/base/worst-case scenarios with numbers, mitigation strategies (3-5 sentences minimum)",
  "cashflow": 0,
  "amount": 0,
  "isAsset": false,
  "share": null,
  "investment": null,
  "liabilitie": null,
  "actionItems": [
    { "text": "Specific executable task with WHO/WHAT/WHEN", "done": false, "priority": "high" },
    { "text": "Second concrete step", "done": false, "priority": "high" },
    { "text": "Third step", "done": false, "priority": "medium" },
    { "text": "Fourth step", "done": false, "priority": "low" }
  ],
  "links": [
    { "label": "Descriptive label - Broker product page", "url": "https://..." },
    { "label": "Official factsheet / data sheet", "url": "https://..." },
    { "label": "Market analysis article", "url": "https://..." },
    { "label": "Calculator or comparison tool", "url": "https://..." },
    { "label": "Community discussion (Reddit/forum)", "url": "https://..." }
  ],
  "notes": "ADDITIONAL CONTEXT: Tax tips, timing, seasonal patterns, community sentiment, caveats, personal observations (2-4 sentences minimum)"
}
\`\`\`

=== FIELD EXPLANATIONS & EXAMPLES ===

The JSON represents a "Grow project" in my finance app. Each project tracks one wealth-building activity through phases: idea → research → plan → execute → monitor → completed.
- "title" is the KEY: a short acronym or code used as identifier (asset short name, share ticker, investment key)
- "sub" is the NAME: the full descriptive name of the project
- "phase": the current lifecycle stage. Use "idea" for AI suggestions (initial research phase), or "research"/"plan" for more developed items.
- "description": MUST be comprehensive — explain the investment, why it suits my portfolio, expected returns, and how it compares. A reader should understand the full investment thesis from this field alone.
- "strategy": MUST be a concrete execution plan — name the strategy pattern, specify exact amounts/frequencies/milestones, include entry criteria, when to rebalance, and exit triggers.
- "risks": MUST cover all significant risks with severity levels — market, liquidity, currency, regulatory as applicable. Include three scenarios (best/base/worst) with estimated return percentages. Explain what to do if each risk materializes.
- "notes": MUST include additional valuable context — tax optimization tips specific to the instrument, timing considerations (e.g. buy after ex-dividend, seasonal trends), what the community says, any caveats or watch-outs that don't fit in other fields.
- "actionItems": MUST be 3-5 specific, executable tasks — not vague advice. Each should specify what to do, where, and roughly when. Use all three priority levels.
- "links": MUST be 3-5 per suggestion with descriptive labels. Include: broker product page, official factsheet, market analysis, calculator/tool, and community thread.
The type is determined by which sub-object is filled in:

**ASSET type** — Physical or digital assets bought to hold/sell for profit.
Set "isAsset": true, leave share/investment/liabilitie as null.
\`\`\`json
{ "title": "Gold1oz", "sub": "Gold Bars (1oz) - Physical Precious Metals", "phase": "idea", "description": "Physical gold serves as a proven inflation hedge and portfolio stabilizer. With current inflation running above central bank targets and geopolitical uncertainty elevated, gold allocation of 5-10% is recommended by most advisors. Unlike paper gold (ETFs), physical ownership eliminates counterparty risk. For my portfolio, this adds non-correlated returns that perform well during equity drawdowns, providing a safety net alongside my existing positions.", "strategy": "Dollar Cost Averaging (DCA): Purchase one 1oz gold bar monthly through a reputable dealer (e.g. Degussa, pro aurum). Target total allocation of 5-8% of net worth over 12 months. Store in a bank safe deposit box (annual cost ~60-120 EUR). Entry: buy immediately at market price, do not try to time gold. Rebalance annually — if gold exceeds 10% of portfolio, pause buying. Exit trigger: only sell if emergency fund depleted or allocation exceeds 15%.", "riskScore": 1.5, "risks": "Gold has low volatility compared to equities (annual std dev ~15% vs ~20% for stocks). Main risks: storage cost reduces net returns (~0.3% p.a. for safe deposit), no yield or dividends (pure price appreciation), and wide dealer spreads (2-5% buy/sell). Best case: gold appreciates 8-12% p.a. during inflationary period, portfolio value increases while providing crisis insurance. Base case: 3-5% p.a. long-term average, keeps pace with inflation. Worst case: prolonged deflation scenario, gold drops 15-20% but recovers within 2-3 years historically. Mitigation: only allocate 5-8%, so worst-case portfolio impact is under 2%.", "cashflow": 0, "amount": 2000, "isAsset": true, "share": null, "investment": null, "liabilitie": null, "actionItems": [{ "text": "Compare gold dealer spreads (Degussa, pro aurum, Philoro) and choose cheapest for 1oz bars", "done": false, "priority": "high" }, { "text": "Open safe deposit box at house bank — request pricing and availability this week", "done": false, "priority": "high" }, { "text": "Set up a monthly calendar reminder for gold purchase on first Monday of each month", "done": false, "priority": "medium" }, { "text": "Research gold tax rules: in Germany, physical gold is tax-free after 1 year holding period", "done": false, "priority": "medium" }, { "text": "Track gold allocation quarterly in portfolio overview to monitor target 5-8%", "done": false, "priority": "low" }], "links": [{ "label": "Degussa gold bar prices - Buy direct", "url": "https://www.degussa-goldhandel.de" }, { "label": "Gold price live chart - Kitco", "url": "https://www.kitco.com/charts/livegold.html" }, { "label": "r/Gold community - Buying tips thread", "url": "https://www.reddit.com/r/Gold/" }, { "label": "Gold vs inflation calculator - Macrotrends", "url": "https://www.macrotrends.net/1333/historical-gold-prices-100-year-chart" }], "notes": "In Germany (and most EU countries), physical gold bars and coins are VAT-free. Capital gains are completely tax-free after a 1-year holding period (Spekulationsfrist). This makes physical gold one of the most tax-efficient long-term assets. Best time to buy is typically during summer months (seasonal low) or after sharp equity rallies when gold tends to dip. Community consensus on r/Gold and r/Finanzen favors reputable dealers over bank offerings due to 1-3% lower spreads." }
\`\`\`

**SHARE type** — Stocks, ETFs, REITs, or dividend-paying securities.
Set "share": { "tag": "ticker/name", "quantity": number of units, "price": price per unit }.
The "tag" should match the "title" key.
Leave isAsset false and investment/liabilitie as null.
\`\`\`json
{ "title": "VWCE", "sub": "Vanguard FTSE All-World UCITS ETF (Acc) - Global Equity", "phase": "idea", "description": "VWCE is a single-ETF global equity solution covering ~3,700 stocks across developed and emerging markets. With a TER of only 0.22%, it is one of the cheapest all-world ETFs available in Europe. It fits my portfolio as the core equity holding, providing broad diversification without needing to manage multiple positions. The accumulating variant automatically reinvests dividends, which is tax-efficient in many EU jurisdictions and simplifies tracking.", "strategy": "Dollar Cost Averaging (DCA): Set up an automatic savings plan of a fixed monthly amount into VWCE via broker (e.g. Trade Republic at 0 EUR order fees for savings plans). Start immediately with available capital as lump sum for ~70%, then DCA remaining 30% over 3 months to reduce timing risk. Rebalancing: none needed for a single-ETF core. If other positions are added later, rebalance annually to maintain target allocation. Exit trigger: no planned exit — hold indefinitely. Only sell if fundamental thesis changes (e.g. switch to superior product at lower cost).", "riskScore": 2, "risks": "As a globally diversified equity ETF, VWCE carries systematic market risk (beta ~1.0). Annual standard deviation ~16%, maximum historical drawdown ~34% (COVID crash). Main risks: equity market downturn could reduce value 20-40% in a crash year, currency risk from USD-denominated holdings (60% US stocks), and tracking error vs FTSE All-World index (minimal at <0.1%). Best case: 10-12% annualized return over 10+ years, matching long-term equity averages. Base case: 7-8% annualized (accounting for current elevated valuations). Worst case: negative returns for 2-3 years during recession, but full recovery within 5 years historically. Mitigation: long investment horizon (5+ years) and DCA entry reduces sequence-of-returns risk.", "cashflow": 0, "amount": 5000, "isAsset": false, "share": { "tag": "VWCE", "quantity": 45, "price": 111.00 }, "investment": null, "liabilitie": null, "actionItems": [{ "text": "Set up VWCE savings plan on broker with monthly amount — automate for 1st of each month", "done": false, "priority": "high" }, { "text": "Invest 70% of available capital as lump sum into VWCE this week", "done": false, "priority": "high" }, { "text": "Verify Sparerpauschbetrag (tax-free allowance of 1000 EUR) is allocated to this depot", "done": false, "priority": "medium" }, { "text": "Set annual calendar reminder to review if a lower-cost alternative has emerged", "done": false, "priority": "low" }], "links": [{ "label": "VWCE product page - Vanguard EU", "url": "https://www.vanguard.com" }, { "label": "VWCE on justETF - Compare & analyze", "url": "https://www.justetf.com/en/etf-profile.html?isin=IE00BK5BQT80" }, { "label": "Backtest portfolio with VWCE - Curvo", "url": "https://curvo.eu/backtest" }, { "label": "r/Finanzen ETF discussion", "url": "https://www.reddit.com/r/Finanzen/" }], "notes": "VWCE is the most popular all-world ETF on r/Finanzen and Bogleheads EU communities. The accumulating variant (Acc) is preferred over distributing in Germany because reinvested dividends compound without triggering immediate capital gains tax (only Vorabpauschale applies, which is minimal). Consider setting Freistellungsauftrag at your broker to use the 1000 EUR annual tax-free allowance for capital gains. If you later want emerging market overweight, consider adding a small EMIM position, but most community members agree VWCE alone is sufficient." }
\`\`\`

**INVESTMENT type** — Leveraged or larger-scale investments (real estate, business).
Set "investment": { "tag": "name", "deposit": upfront capital, "amount": total value }.
The "tag" should match the "title" key.
If financed with a loan, also set "liabilitie": { "tag": "loan name", "amount": loan amount, "investment": true, "credit": monthly repayment }. Use the same "tag" as "title".
\`\`\`json
{ "title": "RentalApt", "sub": "Rental Apartment - Buy-to-Let Real Estate", "phase": "idea", "description": "A buy-to-let apartment in a growing B-city suburb (e.g. Leipzig, Dresden, Dortmund) can generate stable monthly rental income while building equity through mortgage paydown and property appreciation. With current EU rental yields of 4-6% in secondary cities, and mortgage rates stabilizing around 3.5-4%, leveraged real estate remains attractive for long-term wealth building. This fits my portfolio by adding a cash-flowing, inflation-hedged asset class that is uncorrelated with my equity positions.", "strategy": "BRRRR strategy (Buy, Renovate, Rent, Refinance, Repeat): Step 1 — identify a 2-3 room apartment (50-70m²) in a growing city with below-market price due to cosmetic renovation needs. Budget: 150-200k purchase + 15-25k renovation. Step 2 — finance with 80% LTV mortgage (20% down payment from savings). Step 3 — renovate within 3 months to increase rental value by 15-20%. Step 4 — rent at market rate (target: cold rent 8-10 EUR/m²). Step 5 — after 12 months, refinance at higher valuation to extract part of equity for next deal. Timeline: acquisition within 6 months, rental income starts month 4-6 after purchase.", "riskScore": 3, "risks": "Real estate is illiquid (selling takes 3-6 months) and requires active management. Key risks: vacancy periods (budget 1 month/year), tenant damage or non-payment (mitigate with Kaution and tenant screening), unexpected maintenance costs (budget 1-2% of property value annually), interest rate risk on refinancing (current fix vs. variable), and regulatory risk (Mietpreisbremse, Mietendeckel in some cities). Best case: 8-12% total return (4-5% rental yield + 3-5% appreciation + leverage amplifier), net rental cashflow of 200-400 EUR/month after costs. Base case: 5-7% total return, 100-250 EUR/month net cashflow. Worst case: property value stagnates, vacancy costs eat into cashflow, net return 1-2% — still positive due to mortgage paydown.", "cashflow": 350, "amount": 40000, "isAsset": false, "share": null, "investment": { "tag": "RentalApt", "deposit": 40000, "amount": 200000 }, "liabilitie": { "tag": "RentalApt", "amount": 160000, "investment": true, "credit": 750 }, "actionItems": [{ "text": "Research target cities: compare rental yields on immowelt.de for Leipzig, Dresden, Dortmund, Essen", "done": false, "priority": "high" }, { "text": "Get mortgage pre-approval from 2-3 banks (ING, Interhyp, local Sparkasse) to know exact budget", "done": false, "priority": "high" }, { "text": "Set up immoscout24 search alerts for 2-3 room apartments under 200k in target cities", "done": false, "priority": "high" }, { "text": "Read 'Investieren in Immobilien' community guide on r/Finanzen wiki for German-specific tips", "done": false, "priority": "medium" }, { "text": "Contact local Hausverwaltung in target city to understand management costs (typically 25-35 EUR/unit/month)", "done": false, "priority": "low" }], "links": [{ "label": "ImmoScout24 - Search apartments", "url": "https://www.immobilienscout24.de" }, { "label": "Interhyp mortgage calculator", "url": "https://www.interhyp.de/rechner/tilgungsrechner/" }, { "label": "Rental yield map Germany - Immowelt", "url": "https://www.immowelt.de" }, { "label": "r/Finanzen real estate guide", "url": "https://www.reddit.com/r/Finanzen/" }], "notes": "In Germany, rental income is taxed at your marginal income tax rate, but you can deduct mortgage interest, depreciation (2% linear AfA over 50 years), and all maintenance/management costs. The AfA alone on a 200k property = 4000 EUR/year tax deduction. Buying costs (Grunderwerbsteuer, Notar, Makler) add 8-12% depending on state — budget this on top. Leipzig and Dresden have shown 5-7% annual appreciation in the last 5 years with strong population growth. Community sentiment on r/Immobilien is cautiously positive for B-cities, negative for A-cities (Munich, Frankfurt) due to high entry prices." }
\`\`\`

General field rules:
- "title": the KEY — short acronym or code (e.g. VWCE, Gold1oz, RentalApt). Used as identifier and tag for sub-objects.
- "sub": the NAME — full descriptive name of the project
- "phase": use "idea" for new AI suggestions (initial exploration), "research" for items being actively researched, "plan" for well-researched items ready for execution
- "cashflow": expected monthly passive income (number, 0 if none yet)
- "amount": required initial capital / deposit (number)
- "riskScore": REQUIRED — numeric risk rating from 0 (no risk) to 5 (very high risk). Use decimals (e.g. 2.5) for precision.
- ALL text fields (description, strategy, risks, notes) MUST be substantive — minimum 3 sentences each. Do NOT use placeholder-level text.
- "actionItems": REQUIRED — 3-5 specific, executable tasks per suggestion with mixed priority levels
- "links": REQUIRED — 3-5 per suggestion with descriptive labels. Do NOT use generic "https://example.com" — use real, relevant URLs.
- Only ONE type per project: either isAsset=true OR share filled OR investment filled
- Use realistic numbers based on my financial context above

After ALL suggestions, end with:
1. A DECISION MATRIX comparing all options across: initial capital, monthly income, break-even time, risk (1-5), liquidity, and loan dependency.
2. A single combined JSON array of all suggestions in a final code block, so I can import all at once:

\`\`\`json
[...all suggestion objects...]
\`\`\``;  
  }

  // --- Helpers ---

  toRange(amount: number, options?: { absolute?: boolean }): string {
    // Handle negative amounts (income subscriptions) by using absolute value
    const absAmount = Math.abs(amount);
    const isNegative = amount < 0;
    
    if (absAmount === 0) return this.currency + '0';
    
    // Use absolute value for range calculation
    const amt = options?.absolute ? absAmount : absAmount;
    
    // More precise ranges for smaller amounts (common in budgets)
    if (amt < 50) return `under ${this.currency}50`;
    if (amt < 100) return `${this.currency}50–${this.currency}100`;
    
    // €100-€250: nearest €50
    if (amt < 250) {
      const low = Math.floor(amt / 50) * 50;
      const high = low + 50;
      return `${this.currency}${low}–${this.currency}${high}`;
    }
    
    // €250-€1,000: nearest €100, offset to avoid exact matches
    if (amt < 1000) {
      const low = Math.floor(amt / 100) * 100;
      const high = low + 100;
      // Add small offset to avoid exact amount boundaries in ranges
      const offsetLow = low === 0 ? low : low + 1;
      return `${this.currency}${offsetLow}–${this.currency}${high}`;
    }
    
    // €1,000-€5,000: nearest €500
    if (amt <= 5000) {
      const low = Math.floor(amt / 500) * 500;
      const high = low + 500;
      return `${this.currency}${low.toLocaleString()}–${this.currency}${high.toLocaleString()}`;
    }
    
    // €5,000-€50,000: nearest €5,000
    if (amt <= 50000) {
      const low = Math.floor(amt / 5000) * 5000;
      const high = low + 5000;
      return `${this.currency}${low.toLocaleString()}–${this.currency}${high.toLocaleString()}`;
    }
    
    // > €50,000: nearest €10,000
    const low = Math.floor(amount / 10000) * 10000;
    const high = low + 10000;
    return `${this.currency}${low.toLocaleString()}–${this.currency}${high.toLocaleString()}`;
  }

  private getMonthlyBreakdown(): Record<string, MonthlyBucket> {
    const expenseAccounts = ['Daily', 'Splurge', 'Smile', 'Fire'];
    const transferExclusions = ['Daily', 'Splurge', 'Smile', 'Fire', 'Income'];
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const buckets: Record<string, MonthlyBucket> = {};

    this.state.allTransactions
      .filter(t => t.amount !== 0 && t.date && t.date.length >= 7)
      .forEach(t => {
        const month = t.date.substring(0, 7);
        if (month === currentMonth) return; // skip partial current month

        const isExpenseAccount = expenseAccounts.includes(t.account);
        const isIncome = t.account === 'Income';

        if (isExpenseAccount) {
          const cleanCat = (t.category || '').replace('@', '');
          if (transferExclusions.includes(cleanCat)) return; // skip inter-account transfers
        } else if (!isIncome) {
          return; // skip unknown accounts
        }

        if (!buckets[month]) {
          buckets[month] = { income: 0, expenses: 0, byAccount: {}, byCategory: {} };
        }

        const b = buckets[month];
        const amount = Number(t.amount);

        if (isIncome && amount > 0) {
          b.income += amount;
        } else if (amount < 0) {
          const absAmt = Math.abs(amount);
          b.expenses += absAmt;
          b.byAccount[t.account] = (b.byAccount[t.account] || 0) + absAmt;
          const cat = (t.category || 'Uncategorized').replace('@', '');
          b.byCategory[cat] = (b.byCategory[cat] || 0) + absAmt;
        }
      });

    return buckets;
  }

  private sumRevenues(): number {
    return this.state.allRevenues.reduce((s, r) => s + (r.amount || 0), 0)
      + this.state.allIntrests.reduce((s, r) => s + (r.amount || 0), 0)
      + this.state.allProperties.reduce((s, r) => s + (r.amount || 0), 0);
  }

  private sumExpenses(): number {
    return [
      ...this.state.dailyExpenses,
      ...this.state.splurgeExpenses,
      ...this.state.smileExpenses,
      ...this.state.fireExpenses,
      ...this.state.mojoExpenses
    ].reduce((s, e) => s + (e.amount || 0), 0)
      + this.state.allSubscriptions.reduce((s, sub) => s + (sub.amount || 0), 0);
  }

  // ===================================================================
  // PHASE 2: BUDGET OPTIMIZER
  // ===================================================================

  generateBudgetOptimizerPrompt(options: PromptOptions): string {
    const sections: string[] = [];
    sections.push(this.buildBudgetContextBlock(options));
    sections.push(this.buildBudgetInstructionBlock(options));
    sections.push(this.buildBudgetOutputFormatBlock(options));
    return sections.join('\n\n');
  }

  private buildBudgetContextBlock(options: PromptOptions): string {
    const lines: string[] = ['=== MY BUDGET CONTEXT ==='];
    const anon = options.anonymized;

    // Get last completed month (previous month)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.toISOString().substring(0, 7); // YYYY-MM format
    const monthName = lastMonth.toLocaleDateString('en', { year: 'numeric', month: 'long' });

    lines.push('Analyzing budgets from: ' + monthName);
    lines.push('');

    // Show Current Budget Allocation (Daily/Splurge/Smile/Fire)
    lines.push('--- Current Budget Allocation (target %) ---');
    lines.push(`Daily: ${this.state.daily}%`);
    lines.push(`Splurge: ${this.state.splurge}%`);
    lines.push(`Smile: ${this.state.smile}%`);
    lines.push(`Fire: ${this.state.fire}%`);
    lines.push('');

    // Show recurring subscriptions if any
    if (this.state.allSubscriptions.length > 0) {
      const activeSub = this.state.allSubscriptions.filter(s => !s.endDate || new Date(s.endDate) >= new Date());
      if (activeSub.length > 0) {
        const subTotal = activeSub.reduce((s, sub) => s + Math.abs(sub.amount || 0), 0);
        lines.push('--- Recurring Subscriptions ---');
        lines.push(`${activeSub.length} active subscriptions, total ${anon ? this.toRange(subTotal) : this.currency + subTotal.toFixed(2)}/mo`);
        lines.push('');
      }
    }

    // If no categories selected, default to ALL budget categories from last month
    let categoriesToAnalyze: string[] = [];
    if (!options.selectedBudgetCategories || options.selectedBudgetCategories.length === 0) {
      // Get all unique budget categories from last month
      const allBudgetCategories = new Set<string>();
      this.state.allBudgets.forEach(budget => {
        if (budget.date === lastMonthKey && budget.tag) {
          const normalized = budget.tag.replace(/@/g, '').trim();
          if (normalized) {
            allBudgetCategories.add(normalized);
          }
        }
      });
      categoriesToAnalyze = Array.from(allBudgetCategories);
      lines.push('(Analyzing all budget categories by default)');
      lines.push('');
    } else {
      categoriesToAnalyze = options.selectedBudgetCategories;
    }

    // Get budgets for last month, filtered to selected/default categories
    const selectedBudgets: Array<{ category: string, budget: number }> = [];
    const normalizedSelectedCategories = categoriesToAnalyze.map(c => c.replace(/@/g, '').trim());
    
    this.state.allBudgets.forEach(budget => {
      const trimmedTag = budget.tag ? budget.tag.replace(/@/g, '').trim() : '';
      if (budget.date === lastMonthKey && trimmedTag && normalizedSelectedCategories.includes(trimmedTag)) {
        selectedBudgets.push({ category: trimmedTag, budget: budget.amount });
      }
    });

    // Calculate actual spending for last month, per selected category
    const monthly = this.getMonthlyBreakdown();
    let lastMonthData = monthly[lastMonthKey];
    let actualMonthName = monthName;
    
    // Fallback: if last month has no data, use the most recent month with data
    if (!lastMonthData) {
      const availableMonths = Object.keys(monthly).sort().reverse();
      if (availableMonths.length > 0) {
        const fallbackMonth = availableMonths[0];
        lastMonthData = monthly[fallbackMonth];
        const fallbackDate = new Date(fallbackMonth + '-01');
        actualMonthName = fallbackDate.toLocaleDateString('en', { year: 'numeric', month: 'long' });
        lines.push(`⚠ No data for ${monthName}, using ${actualMonthName} instead.`);
        lines.push('');
      } else {
        lines.push('❌ No transaction data found for any month.');
        return lines.join('\n');
      }
    }

    const actualByCategory = lastMonthData.byCategory || {};

    // Income & Expenses for context
    const monthIncome = lastMonthData.income || 0;
    const monthExpenses = lastMonthData.expenses || 0;
    const monthSavings = monthIncome - monthExpenses;
    const savingsRate = monthIncome > 0 ? Math.round((monthSavings / monthIncome) * 100) : 0;

    lines.push('--- Monthly Overview (' + monthName + ') ---');
    lines.push('Total income: ' + (anon ? this.toRange(monthIncome) : this.currency + monthIncome.toFixed(0)));
    lines.push('Total expenses: ' + (anon ? this.toRange(monthExpenses) : this.currency + monthExpenses.toFixed(0)));
    lines.push('Surplus: ' + (anon ? this.toRange(Math.abs(monthSavings)) + (monthSavings < 0 ? ' (deficit)' : '') : this.currency + monthSavings.toFixed(0)));
    lines.push('Savings rate: ~' + savingsRate + '%');

    // Budget vs Actual per Selected Category
    lines.push('');
    lines.push('--- BUDGET VS ACTUAL (Selected Categories) ---');
    
    const comparisons: Array<{ cat: string, budget: number, actual: number, diff: number, variance: number }> = [];
    selectedBudgets.forEach(({ category, budget }) => {
      // Normalize transaction category names for comparison (remove @ and trim)
      let actual = actualByCategory[category] || 0;
      
      // Try to find matching category with different normalization if not found
      if (actual === 0) {
        Object.keys(actualByCategory).forEach(key => {
          const normalizedKey = key.replace(/@/g, '').trim();
          if (normalizedKey === category) {
            actual = actualByCategory[key];
          }
        });
      }
      
      const diff = actual - budget;
      const variance = budget > 0 ? Math.round((diff / budget) * 100) : (actual > 0 ? 999 : 0);
      comparisons.push({ cat: category, budget, actual, diff, variance });
    });

    // Sort by absolute variance (biggest problems first)
    comparisons.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    comparisons.forEach(c => {
      const budgetStr = anon ? this.toRange(c.budget) : this.currency + c.budget.toFixed(0);
      const actualStr = anon ? this.toRange(c.actual) : this.currency + c.actual.toFixed(0);
      let status = '';
      if (Math.abs(c.variance) < 5) {
        status = ' ✓ on target';
      } else if (c.variance > 0) {
        status = ' ⚠ ' + c.variance + '% OVER budget (' + (anon ? this.toRange(Math.abs(c.diff)) : this.currency + Math.abs(c.diff).toFixed(0)) + ' overspent)';
      } else {
        status = ' ✓ ' + Math.abs(c.variance) + '% under budget (' + (anon ? this.toRange(Math.abs(c.diff)) : this.currency + Math.abs(c.diff).toFixed(0)) + ' saved)';
      }
      lines.push('  ' + c.cat + ': Budget ' + budgetStr + ', Actual ' + actualStr + status);
    });

    // Summary statistics
    const totalBudget = comparisons.reduce((sum, c) => sum + c.budget, 0);
    const totalActual = comparisons.reduce((sum, c) => sum + c.actual, 0);
    const totalDiff = totalActual - totalBudget;
    const totalVariance = totalBudget > 0 ? Math.round((totalDiff / totalBudget) * 100) : 0;

    lines.push('');
    lines.push('--- Summary ---');
    lines.push('Total budgeted (selected categories): ' + (anon ? this.toRange(totalBudget) : this.currency + totalBudget.toFixed(0)));
    lines.push('Total actual (selected categories): ' + (anon ? this.toRange(totalActual) : this.currency + totalActual.toFixed(0)));
    if (totalDiff > 0) {
      lines.push('Overall: ' + totalVariance + '% over budget (' + (anon ? this.toRange(totalDiff) : this.currency + totalDiff.toFixed(0)) + ' overspent)');
    } else {
      lines.push('Overall: ' + Math.abs(totalVariance) + '% under budget (' + (anon ? this.toRange(Math.abs(totalDiff)) : this.currency + Math.abs(totalDiff).toFixed(0)) + ' saved)');
    }

    // Actual Spending Distribution (Daily/Splurge/Smile/Fire vs target)
    const accountByCategory = lastMonthData.byAccount || {};
    const totalAccountSpending = Object.values(accountByCategory).reduce((s, a) => s + a, 0);
    if (totalAccountSpending > 0) {
      lines.push('');
      lines.push('--- Actual Spending Distribution (actual vs target allocation) ---');
      const accountNames = ['Daily', 'Splurge', 'Smile', 'Fire'];
      accountNames.forEach(acct => {
        const spent = accountByCategory[acct] || 0;
        const pct = Math.round((spent / totalAccountSpending) * 100);
        const targetPct = (this.state as any)[acct.toLowerCase()] || 0;
        const diff = pct - targetPct;
        const status = diff > 5 ? ` (${diff}% over target)` : diff < -5 ? ` (${Math.abs(diff)}% under target)` : ' (on target)';
        lines.push(`${acct}: ${pct}% actual vs ${targetPct}% target${status}`);
      });
    }

    // Top 10 Expense Categories
    const allCategories = Object.entries(actualByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    if (allCategories.length > 0) {
      lines.push('');
      lines.push('--- Top 10 Expense Categories (all categories, not just budgeted) ---');
      allCategories.forEach(([cat, amount]) => {
        const amountStr = anon ? this.toRange(amount) : this.currency + amount.toFixed(0);
        const hasBudget = comparisons.some(c => c.cat === cat.replace(/@/g, '').trim());
        const budgetStatus = hasBudget ? '' : ' (no budget set)';
        lines.push(`  ${cat}: ${amountStr}${budgetStatus}`);
      });
    }

    // Recent Trends (show spending trends over last 3 months if available)
    const sortedMonths = Object.keys(monthly).sort().reverse();
    if (sortedMonths.length >= 2) {
      lines.push('');
      lines.push('--- Recent Trends ---');
      const recentMonths = sortedMonths.slice(0, 3);
      const trends: Array<{ month: string, income: number, expenses: number, savings: number }> = [];
      
      recentMonths.forEach(monthKey => {
        const data = monthly[monthKey];
        const date = new Date(monthKey + '-01');
        const monthLabel = date.toLocaleDateString('en', { year: 'numeric', month: 'short' });
        trends.push({
          month: monthLabel,
          income: data.income || 0,
          expenses: data.expenses || 0,
          savings: (data.income || 0) - (data.expenses || 0)
        });
      });
      
      // Show each month's overview
      trends.forEach((t, idx) => {
        const incomeStr = anon ? this.toRange(t.income) : this.currency + t.income.toFixed(0);
        const expenseStr = anon ? this.toRange(t.expenses) : this.currency + t.expenses.toFixed(0);
        lines.push(`${t.month}: Income ${incomeStr}, Expenses ${expenseStr}`);
        
        // Show trend direction if not the first (most recent) month
        if (idx > 0) {
          const prev = trends[idx - 1];
          const expenseChange = t.expenses - prev.expenses;
          const pctChange = prev.expenses > 0 ? Math.round((expenseChange / prev.expenses) * 100) : 0;
          if (Math.abs(pctChange) >= 10) {
            const direction = expenseChange > 0 ? 'increased' : 'decreased';
            const changeStr = anon ? this.toRange(Math.abs(expenseChange)) : this.currency + Math.abs(expenseChange).toFixed(0);
            lines.push(`  ↳ Expenses ${direction} by ${Math.abs(pctChange)}%  (${changeStr}) vs previous month`);
          }
        }
      });
      
      // Overall trend analysis
      if (trends.length >= 2) {
        const oldest = trends[trends.length - 1];
        const newest = trends[0];
        const totalChange = newest.expenses - oldest.expenses;
        const avgExpenses = trends.reduce((s, t) => s + t.expenses, 0) / trends.length;
        if (totalChange > avgExpenses * 0.1) {
          lines.push(`Overall trend: Spending increasing over ${trends.length} months`);
        } else if (totalChange < -avgExpenses * 0.1) {
          lines.push(`Overall trend: Spending decreasing over ${trends.length} months`);
        } else {
          lines.push(`Overall trend: Spending relatively stable over ${trends.length} months`);
        }
      }
    }

    lines.push('');
    lines.push('Currency: ' + this.currency);

    return lines.join('\n');
  }

  private buildBudgetInstructionBlock(options: PromptOptions): string {
    const lines: string[] = ['=== INSTRUCTIONS ==='];
    
    lines.push('Act as a personal finance advisor. Analyze my category-level budgets vs actual spending to recommend optimizations.');
    lines.push('');
    lines.push('Focus on:');
    lines.push('1. Identifying categories where I significantly overspend (>10% over budget)');
    lines.push('2. Suggesting realistic budget adjustments for categories where I consistently miss targets');
    lines.push('3. Finding categories where I could reduce costs without major lifestyle impact');
    lines.push('4. Recommending new budgets for categories that currently have none but show regular spending');
    lines.push('5. Providing specific, actionable strategies with clear validation criteria');
    lines.push('');
    lines.push('For RELATED categories (e.g., "food" and "backery"), you may bundle them into a single optimization if they share a common strategy.');
    lines.push('');
    if (options.numberOfSuggestions) {
      lines.push(`Provide exactly ${options.numberOfSuggestions} optimization recommendations, prioritized by potential impact.`);
    } else {
      lines.push('Provide optimization recommendations (you decide how many based on the opportunities), prioritized by potential impact.');
    }
    lines.push('');
    lines.push('Each recommendation MUST include:');
    lines.push('- A clear ACTION PLAN: Specific, measurable steps to implement the optimization');
    lines.push('- A VALIDATION PLAN: How I can verify if it worked (e.g., "Track spending over next 4 weeks, target <€200/mo")');
    lines.push('- Helpful LINKS to resources, tools, guides, or articles that make implementation easier');
    lines.push('- Realistic timeframes and milestones');
    lines.push('');
    lines.push('DO NOT recommend changes to account allocations (Daily/Splurge/Smile/Fire) — focus only on category-level budgets.');
    lines.push('Provide specific recommendations, not generic advice. Reference my actual categories and amounts.');

    const lang = this.translate?.currentLang || 'en';
    const langName = PromptGeneratorService.LANG_MAP[lang];
    if (lang !== 'en' && langName) {
      lines.push('');
      lines.push(`IMPORTANT: Please write your entire response in ${langName}.`);
    }

    return lines.join('\n');
  }

  private buildBudgetOutputFormatBlock(options: PromptOptions): string {
    return `=== OUTPUT FORMAT ===

Provide your analysis and recommendations in a structured format.

First, provide a brief summary:

**1. CATEGORY BUDGET ANALYSIS**
- Overall budget adherence rate (% of categories on target)
- Biggest overspending categories (with amounts)
- Categories needing new budgets
- Current daily/splurge/smile/fire allocation status

**2. KEY OPPORTUNITIES**
List the top optimization opportunities, ranked by potential savings or impact.
Include any recommendedAllocation adjustments if category changes suggest Daily/Splurge/Smile/Fire rebalancing would help.

Then, at the END, include a JSON code block with an ARRAY of budget optimization recommendations${options.numberOfSuggestions ? ` (exactly ${options.numberOfSuggestions} items)` : ''}:

⚠️ CRITICAL: In the JSON output, use the EXACT category names as shown in the "BUDGET VS ACTUAL" section above. Do NOT rename, translate, or modify category names. Copy them character-for-character.

\`\`\`json
[
  {
    "title": "Reduce Restaurant Spending to Budget",
    "description": "You're spending 40% over your restaurant budget. Current: €300/mo, Budget: €180/mo",
    "category": "Restaurants",
    "currentCost": 300,
    "targetCost": 180,
    "monthlySavings": 120,
    "annualSavings": 1440,
    "reasoning": "You average 15 restaurant visits per month at €20 each. Reducing to 9 visits would align with budget. Consider meal prepping on Sundays.",
    "actionItems": [
      { "text": "Meal prep every Sunday for weekday lunches", "priority": "high", "done": false },
      { "text": "Limit restaurant visits to weekends only", "priority": "medium", "done": false },
      { "text": "Set price limit: max €15 per meal", "priority": "low", "done": false }
    ],
    "priority": "high"
  },
  {
    "title": "Set Budget for Online Shopping",
    "description": "No budget set for online shopping, but you spend €150/mo regularly",
    "category": "Online Shopping",
    "currentCost": 150,
    "targetCost": 100,
    "monthlySavings": 50,
    "annualSavings": 600,
    "reasoning": "Impulse purchases add up. Setting a strict €100/mo budget with tracking will create awareness and reduce spending.",
    "actionItems": [
      { "text": "Create \"Online Shopping\" budget category at €100/mo", "priority": "high", "done": false },
      { "text": "Wait 48 hours before purchasing non-essentials", "priority": "medium", "done": false },
      { "text": "Unsubscribe from marketing emails", "priority": "low", "done": false }
    ],
    "priority": "medium"
  },
  {
    "title": "Negotiate Cell Phone Plan",
    "description": "Current plan: €45/mo. Cheaper alternatives available at €25/mo for same features",
    "category": "Cell Phone",
    "currentCost": 45,
    "targetCost": 25,
    "monthlySavings": 20,
    "annualSavings": 240,
    "reasoning": "Budget MVNOs offer identical network coverage at 50% cost. 15 minutes of research could save €240/year.",
    "actionItems": [
      { "text": "Research budget providers (Aldi Talk, Lidl Connect)", "priority": "high", "done": false },
      { "text": "Check contract end date and cancellation notice period", "priority": "high", "done": false },
      { "text": "Switch to new provider", "priority": "medium", "done": false }
    ],
    "links": [
      { "label": "Budget MVNO Comparison 2026", "url": "https://example.com/mvno-comparison" },
      { "label": "Contract Cancellation Guide", "url": "https://example.com/cancel-guide" }
    ],
    "priority": "medium"
  },
  {
    "title": "Optimize Food and Bakery Spending",
    "description": "Your combined food and bakery spending exceeds targets, contributing to monthly deficit.",
    "category": ["food", "backery"],
    "currentCost": 375,
    "targetCost": 325,
    "monthlySavings": 50,
    "annualSavings": 600,
    "reasoning": "You are 13% over in 'food' and 112% over in 'backery'. Small, frequent bakery purchases add up. Consolidating shops reduces impulse spending.",
    "actionItems": [
      { "text": "Consolidate grocery shopping to once per week", "priority": "high", "done": false },
      { "text": "Buy bread/pastry staples in bulk and freeze", "priority": "medium", "done": false },
      { "text": "Audit receipts for high-cost convenience items", "priority": "low", "done": false }
    ],
    "priority": "high"
  }
]
\`\`\`
${options.numberOfSuggestions ? `
IMPORTANT: The JSON array must contain EXACTLY ${options.numberOfSuggestions} items, no more, no less.` : ''}

⚠️ CRITICAL REMINDER: 
- The "category" field MUST match EXACTLY the category names from your "BUDGET VS ACTUAL" section
- Do NOT translate category names (e.g., don't change "Groceries" to "Lebensmittel")  
- Do NOT modify capitalization or spelling
- For bundled optimizations affecting MULTIPLE related categories, use an array: "category": ["food", "backery"]
- The system will sum budgets from all categories in the array for accurate calculations
- Include "links" array with helpful resources (articles, tools, guides) to implement the optimization
- Focus on ACTIONABLE items with clear validation criteria

Each item represents a specific budget optimization with a clear action plan and measurable validation.`;
  }

  // ===================================================================
  // PHASE 2: SUBSCRIPTION AUDIT
  // ===================================================================

  generateSubscriptionAuditPrompt(options: PromptOptions): string {
    const sections: string[] = [];
    sections.push(this.buildSubscriptionContextBlock(options));
    sections.push(this.buildSubscriptionInstructionBlock(options));
    sections.push(this.buildSubscriptionOutputFormatBlock(options));
    return sections.join('\n\n');
  }

  private buildSubscriptionContextBlock(options: PromptOptions): string {
    const lines: string[] = ['=== MY SUBSCRIPTIONS ==='];
    const anon = options.anonymized;

    if (this.state.allSubscriptions.length === 0) {
      lines.push('No subscriptions currently tracked.');
      return lines.join('\n');
    }

    // ONLY analyze active subscriptions (not cancelled)
    const today = new Date();
    let subscriptionsToAnalyze = this.state.allSubscriptions.filter(sub => {
      if (!sub.endDate) return true; // No end date = active
      const endDate = new Date(sub.endDate);
      return endDate >= today; // End date in future = active
    });
    
    // Further filter by selected subscriptions if specified
    if (options.selectedSubscriptions && options.selectedSubscriptions.length > 0) {
      subscriptionsToAnalyze = subscriptionsToAnalyze.filter(sub => 
        options.selectedSubscriptions.includes(sub.title || 'Unnamed')
      );
    }

    if (subscriptionsToAnalyze.length === 0) {
      lines.push('No subscriptions selected for analysis.');
      return lines.join('\n');
    }

    const totalMonthly = subscriptionsToAnalyze.reduce((s, sub) => s + (sub.amount || 0), 0);
    const totalAnnual = totalMonthly * 12;

    lines.push('');
    lines.push('--- Subscription Summary ---');
    lines.push('Total subscriptions to analyze: ' + subscriptionsToAnalyze.length);
    lines.push('Total monthly cost: ' + (anon ? this.toRange(totalMonthly) : this.currency + totalMonthly.toFixed(2)));
    lines.push('Total annual cost: ' + (anon ? this.toRange(totalAnnual) : this.currency + totalAnnual.toFixed(2)));

    lines.push('');
    lines.push('--- Selected Subscriptions ---');

    // Group by category
    const byCategory: Record<string, Subscription[]> = {};
    subscriptionsToAnalyze.forEach(sub => {
      const cat = sub.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(sub);
    });

    Object.entries(byCategory).forEach(([cat, subs], catIndex) => {
      const catTotal = subs.reduce((s, sub) => s + (sub.amount || 0), 0);
      const catAbsTotal = Math.abs(catTotal);
      const hasIncome = subs.some(s => s.account === 'Income');
      const catType = hasIncome ? ' [INCOME]' : ' [EXPENSE]';
      lines.push('\n' + cat + ' (' + subs.length + ' subscriptions, ' + (anon ? this.toRange(catAbsTotal) : this.currency + catAbsTotal.toFixed(2)) + '/mo' + catType + '):');
      subs.forEach((sub, subIndex) => {
        const title = anon ? 'Subscription ' + (catIndex + 1) + '-' + (subIndex + 1) : (sub.title || 'Unnamed');
        const amount = sub.amount || 0;
        const absAmount = Math.abs(amount);
        const isIncome = sub.account === 'Income';
        const type = isIncome ? ' [+income]' : ' [-expense]';
        lines.push('  - ' + title + ': ' + (anon ? this.toRange(absAmount) : this.currency + absAmount.toFixed(2)) + '/mo' + type);
      });
    });

    // Context: income and expense data
    const monthly = this.getMonthlyBreakdown();
    const months = Object.keys(monthly).sort();
    if (months.length > 0) {
      const avgIncome = months.map(m => monthly[m].income).reduce((a, b) => a + b, 0) / months.length;
      const avgExpense = months.map(m => monthly[m].expenses).reduce((a, b) => a + b, 0) / months.length;
      const subPct = avgIncome > 0 ? Math.round((totalMonthly / avgIncome) * 100) : 0;
      const expPct = avgExpense > 0 ? Math.round((totalMonthly / avgExpense) * 100) : 0;

      lines.push('');
      lines.push('--- Financial Context ---');
      lines.push(`Subscriptions as % of income: ${subPct}%`);
      lines.push(`Subscriptions as % of total expenses: ${expPct}%`);
      lines.push(`Avg monthly income: ${anon ? this.toRange(avgIncome) : this.currency + avgIncome.toFixed(0)}`);
      lines.push(`Avg monthly expenses: ${anon ? this.toRange(avgExpense) : this.currency + avgExpense.toFixed(0)}`);
    }

    lines.push('');
    lines.push(`Currency: ${this.currency}`);

    return lines.join('\n');
  }

  private buildSubscriptionInstructionBlock(options: PromptOptions): string {
    const lines: string[] = ['=== INSTRUCTIONS ==='];
    
    lines.push('Act as a subscription audit consultant specializing in cost elimination and service optimization.');
    lines.push('Evaluate ONLY the active subscriptions listed above (cancelled subscriptions already excluded).');
    lines.push('');
    lines.push('For each subscription, assess:');
    lines.push('1. VALUE ANALYSIS: Cost per use. Is the pricing justified by actual usage?');
    lines.push('2. USAGE PATTERNS: When do I use this? How frequently? Any periods of zero usage?');
    lines.push('3. COMPLETE REMOVAL: Can I eliminate this cost entirely with free alternatives or lifestyle changes?');
    lines.push('4. ALTERNATIVES: Cheaper paid alternatives with pricing comparisons and specific product names');
    lines.push('5. OVERLAP DETECTION: Multiple subscriptions serving the same purpose (bundle or eliminate)');
    lines.push('6. NEGOTIATION TACTICS: Specific scripts to call customer service and request discounts/retention offers');
    lines.push('7. HIDDEN FEES: Annual fees, price increases, auto-renewals that could be cancelled');
    lines.push('8. SHARING OPPORTUNITIES: Can this be shared with family/friends to split costs?');
    lines.push('');
    
    if (options.numberOfSuggestions) {
      lines.push(`Provide exactly ${options.numberOfSuggestions} high-impact recommendations, prioritized by total annual savings.`);
    } else {
      lines.push('Prioritize recommendations by total annual impact (highest savings first).');
    }
    
    lines.push('');
    lines.push('CRITICAL REQUIREMENTS:');
    lines.push('- Include at least 2 "complete removal" options (free alternatives or lifestyle changes)');
    lines.push('- Provide real alternative product names with actual pricing');
    lines.push('- Include specific cancellation links in the "links" array when known');
    lines.push('- Add negotiation scripts as action items');
    lines.push('- Calculate cost-per-use where possible (e.g., "€15/mo ÷ 2 uses = €7.50 per use")');

    const lang = this.translate?.currentLang || 'en';
    const langName = PromptGeneratorService.LANG_MAP[lang];
    if (lang !== 'en' && langName) {
      lines.push('');
      lines.push(`IMPORTANT: Please write your entire response in ${langName}.`);
    }

    return lines.join('\n');
  }

  private buildSubscriptionOutputFormatBlock(options: PromptOptions): string {
    const lines: string[] = ['=== OUTPUT FORMAT ==='];
    lines.push('');
    lines.push('Provide a detailed audit report with a brief summary of total savings potential.');
    lines.push('');
    
    if (options.numberOfSuggestions) {
      lines.push(`Then, at the END, include a JSON code block with an ARRAY of exactly ${options.numberOfSuggestions} subscription recommendations:`);
    } else {
      lines.push('Then, at the END, include a JSON code block with an ARRAY of your recommended subscription actions:');
    }
    
    const jsonExample = `

\`\`\`json
[
  {
    "title": "Eliminate Gym Membership - Switch to Free Alternatives",
    "description": "Cancel €50/mo gym membership. Replace with free YouTube workouts, outdoor running, and bodyweight exercises at home.",
    "category": ["fitness", "health"],
    "currentCost": 50,
    "targetCost": 0,
    "monthlySavings": 50,
    "annualSavings": 600,
    "reasoning": "Zero check-ins in 90 days. Cost per visit: €50 ÷ 0 visits = infinite. Free alternatives provide equal value.",
    "alternative": "YouTube Fitness channels (FitnessBlender, Yoga with Adriene) + Outdoor running - completely free",
    "alternativeCost": 0,
    "links": [
      { "label": "FitnessBlender - Free Workouts", "url": "https://www.fitnessblender.com" },
      { "label": "Couch to 5K Running Plan", "url": "https://www.nhs.uk/live-well/exercise/running-and-aerobic-exercises/get-running-with-couch-to-5k/" }
    ],
    "actionItems": [
      { "text": "Call gym: 'I want to cancel due to lack of use. What's the process?'", "priority": "high", "dueDate": "2026-04-10" },
      { "text": "Return access card and get written confirmation", "priority": "high" },
      { "text": "Download FitnessBlender app and create workout schedule", "priority": "medium" }
    ]
  },
  {
    "title": "Downgrade Streaming Service Premium & Negotiate Retention Offer",
    "description": "Downgrade from Premium (€17.99) to Basic (€7.99), then call to request loyalty discount. Target: €5.99/mo.",
    "category": ["streaming", "entertainment"],
    "currentCost": 17.99,
    "targetCost": 5.99,
    "monthlySavings": 12,
    "annualSavings": 144,
    "reasoning": "You stream on 1 device in 1080p. Premium 4K unused. Cost per viewing hour: €6. Negotiate after downgrade.",
    "alternative": "Basic plan with retention discount",
    "alternativeCost": 5.99,
    "links": [
      { "label": "Streaming Service Account Settings", "url": "https://example.com/account" },
      { "label": "Alternative: Other Streaming Service (€8.99/mo)", "url": "https://example.com/alternative" }
    ],
    "actionItems": [
      { "text": "Downgrade to Basic plan immediately", "priority": "high", "dueDate": "2026-04-05" },
      { "text": "Call provider 1 week later: 'I'm considering canceling. Can you offer a discount to stay?'", "priority": "high", "dueDate": "2026-04-12" },
      { "text": "If no discount offered, switch to alternative for more content at lower price", "priority": "medium" }
    ]
  },
  {
    "title": "Share Music Streaming Family Plan - Reduce Cost by 80%",
    "description": "Currently paying €9.99/mo for individual. Switch to Family Plan (€15.99/mo) shared with 5 friends = €3.20/person.",
    "category": ["music", "streaming"],
    "currentCost": 9.99,
    "targetCost": 3.20,
    "monthlySavings": 6.79,
    "annualSavings": 81.48,
    "reasoning": "Music streaming Family allows 6 accounts. Sharing reduces your cost to €3.20/mo (€15.99 ÷ 5 people). Quality unchanged.",
    "alternative": "Family Plan (shared)",
    "alternativeCost": 3.20,
    "links": [
      { "label": "Family Plan Info", "url": "https://example.com/family" },
      { "label": "Together Price - Find sharing groups", "url": "https://www.togetherprice.com" }
    ],
    "actionItems": [
      { "text": "Find 4 friends/family members to split plan (ask in group chat)", "priority": "high" },
      { "text": "Upgrade to Family Plan and add members", "priority": "high" },
      { "text": "Set up monthly payment collection (€3.20 per person)", "priority": "medium" }
    ]
  }
]
\`\`\`

Each item represents a specific subscription action (cancel/downgrade/keep) that can be tracked and implemented.

CRITICAL - CATEGORY FIELD REQUIREMENT:
For the "category" field, you MUST use the EXACT category labels from the subscription data above.
These are the category labels with @ prefix (e.g., @phone, @rent, @salary, @insurance).
Copy them exactly as they appear in the "Selected Subscriptions" section.
This ensures the recommendations map correctly to the user's actual subscription categories.`;

    if (options.numberOfSuggestions) {
      return lines.join('\n') + jsonExample + `\n\nIMPORTANT: The JSON array must contain EXACTLY ${options.numberOfSuggestions} items, no more, no less.`;
    }
    
    return lines.join('\n') + jsonExample;
  }

  // ===================================================================
  // PHASE 2: EXPENSE PATTERN ANALYSIS
  // ===================================================================

  generateExpensePatternAnalysisPrompt(options: PromptOptions): string {
    const sections: string[] = [];
    sections.push(this.buildExpensePatternContextBlock(options));
    sections.push(this.buildExpensePatternInstructionBlock());
    sections.push(this.buildExpensePatternOutputFormatBlock());
    return sections.join('\n\n');
  }

  private buildExpensePatternContextBlock(options: PromptOptions): string {
    const lines: string[] = ['=== MY EXPENSE PATTERNS ==='];
    const anon = options.anonymized;
    const monthly = this.getMonthlyBreakdown();
    const months = Object.keys(monthly).sort();

    if (months.length === 0) {
      lines.push('No transaction history available for pattern analysis.');
      return lines.join('\n');
    }

    lines.push(`Analysis period: ${months.length} months (${months[0]} to ${months[months.length - 1]})`);

    // Overall stats
    const incomes = months.map(m => monthly[m].income);
    const expenses = months.map(m => monthly[m].expenses);
    const avgIncome = incomes.reduce((a, b) => a + b, 0) / months.length;
    const avgExpense = expenses.reduce((a, b) => a + b, 0) / months.length;
    const avgSavings = avgIncome - avgExpense;
    const savingsRate = avgIncome > 0 ? Math.round((avgSavings / avgIncome) * 100) : 0;

    lines.push('');
    lines.push('--- Overall Stats ---');
    lines.push(`Avg monthly income: ${anon ? this.toRange(avgIncome) : this.currency + avgIncome.toFixed(0)}`);
    lines.push(`Avg monthly expenses: ${anon ? this.toRange(avgExpense) : this.currency + avgExpense.toFixed(0)}`);
    lines.push(`Savings rate: ${savingsRate}%`);

    // Monthly breakdown
    lines.push('');
    lines.push('--- Month-by-Month Breakdown ---');
    months.forEach(m => {
      const inc = monthly[m].income;
      const exp = monthly[m].expenses;
      const sav = inc - exp;
      const rate = inc > 0 ? Math.round((sav / inc) * 100) : 0;
      lines.push(`${m}: Income ${anon ? this.toRange(inc) : this.currency + inc.toFixed(0)}, Expenses ${anon ? this.toRange(exp) : this.currency + exp.toFixed(0)}, Savings ${rate}%`);
    });

    // Category totals and trends
    const categoryTotals: Record<string, number> = {};
    months.forEach(m => {
      Object.entries(monthly[m].byCategory).forEach(([cat, amt]) => {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      });
    });

    const sortedCats = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15);

    if (sortedCats.length > 0) {
      lines.push('');
      lines.push('--- Top 15 Expense Categories (over entire period) ---');
      sortedCats.forEach(([cat, total]) => {
        const avg = total / months.length;
        const pct = Math.round((total / (avgExpense * months.length)) * 100);
        lines.push(`${cat}: ${anon ? this.toRange(avg) : this.currency + avg.toFixed(0)}/mo avg, ${pct}% of total`);
      });
    }

    // Volatility and outliers
    if (months.length >= 3) {
      const expStdDev = Math.sqrt(expenses.reduce((s, v) => s + Math.pow(v - avgExpense, 2), 0) / months.length);
      const expCV = avgExpense > 0 ? expStdDev / avgExpense : 0;

      lines.push('');
      lines.push('--- Spending Volatility ---');
      if (expCV > 0.3) {
        lines.push('Volatility: HIGH (>30% variation) — spending varies significantly month-to-month');
      } else if (expCV > 0.15) {
        lines.push('Volatility: MODERATE (15-30% variation) — some month-to-month fluctuation');
      } else {
        lines.push('Volatility: LOW (<15% variation) — consistent spending patterns');
      }

      const maxExp = Math.max(...expenses);
      const minExp = Math.min(...expenses);
      const maxMonth = months[expenses.indexOf(maxExp)];
      const minMonth = months[expenses.indexOf(minExp)];

      lines.push(`Highest expense month: ${maxMonth} (${anon ? this.toRange(maxExp) : this.currency + maxExp.toFixed(0)})`);
      lines.push(`Lowest expense month: ${minMonth} (${anon ? this.toRange(minExp) : this.currency + minExp.toFixed(0)})`);
    }

    // Trends
    if (months.length >= 6) {
      const first3 = months.slice(0, 3);
      const last3 = months.slice(-3);
      const firstAvgExp = first3.map(m => monthly[m].expenses).reduce((a, b) => a + b, 0) / 3;
      const lastAvgExp = last3.map(m => monthly[m].expenses).reduce((a, b) => a + b, 0) / 3;
      const trendPct = firstAvgExp > 0 ? Math.round(((lastAvgExp - firstAvgExp) / firstAvgExp) * 100) : 0;

      lines.push('');
      lines.push('--- Long-term Trend ---');
      if (Math.abs(trendPct) >= 10) {
        lines.push(`Spending is ${trendPct > 0 ? 'INCREASING' : 'DECREASING'} by ${Math.abs(trendPct)}% (first 3 mo vs last 3 mo)`);
      } else {
        lines.push('Spending is STABLE (less than 10% change over time)');
      }
    }

    lines.push('');
    lines.push(`Currency: ${this.currency}`);

    return lines.join('\n');
  }

  private buildExpensePatternInstructionBlock(): string {
    const lines: string[] = ['=== INSTRUCTIONS ==='];
    lines.push('');
    lines.push('Act as a behavioral finance analyst specializing in spending forensics and money psychology.');
    lines.push('');
    lines.push('Analyze the transaction data above to identify money leaks, spending blind spots, triggers, and behavioral patterns.');
    lines.push('');
    lines.push('Go beyond basic category totals. Focus on the following key PATTERNS, ANOMALIES, CATEGORIES, HIDDEN WASTE, and OPPORTUNITIES:');
    lines.push('');
    lines.push('**TIMING PATTERNS:**');
    lines.push('1. Day-of-week analysis: Do I spend more on weekends? Fridays (payday)? Mondays (stress)?');
    lines.push('2. Time-of-day patterns: Late-night impulse purchases? Lunch hour spending? After-work treats?');
    lines.push('3. Seasonal patterns: Holiday spikes? Summer vacation spending? Back-to-school?');
    lines.push('4. Monthly cycles: Beginning vs end of month spending? Payday effect?');
    lines.push('');
    lines.push('**BEHAVIORAL TRIGGERS:**');
    lines.push('1. Emotional spending: Stress purchases? Boredom buying? Reward spending?');
    lines.push('2. Social spending: Going out because friends are? Peer pressure purchases?');
    lines.push('3. Environmental triggers: Passing certain stores? Email promotions? Social media ads?');
    lines.push('4. Habit loops: Daily coffee run? Weekend brunch ritual? Evening delivery orders?');
    lines.push('');
    lines.push('**TRANSACTION CLUSTERS:**');
    lines.push('1. Small frequent purchases that compound (€3-10 items adding to €100+/mo)');
    lines.push('2. Unexpected large purchases disrupting budgets');
    lines.push('3. "Domino spending": One purchase leading to related purchases (new clothes → new shoes → alterations)');
    lines.push('4. Forgotten recurring charges (old subscriptions, auto-renewals)');
    lines.push('');
    lines.push('**COST-PER-USE ANALYSIS:**');
    lines.push('1. Calculate actual cost per use/hour/enjoyment unit');
    lines.push('2. Compare planned vs actual usage for big purchases');
    lines.push('3. Identify high-cost, low-use items');
    lines.push('');
    lines.push('**SUBSTITUTION OPPORTUNITIES:**');
    lines.push('1. Free alternatives for paid services');
    lines.push('2. DIY vs outsource decisions');
    lines.push('3. Bulk buying vs frequent small purchases');
    lines.push('4. Quality trade-offs (Is premium worth the price?)');
    lines.push('');
    lines.push('**WASTE DETECTION:**');
    lines.push('1. Food waste (groceries bought but not used → delivery orders)');
    lines.push('2. Unused app/software licenses');
    lines.push('3. Duplicate purchases (buying what you already own)');
    lines.push('4. Impulse returns (bought and returned, wasting time/shipping)');
    lines.push('');
    lines.push('Provide 3-5 high-impact insights that combine multiple dimensions.');
    lines.push('Example: "Weekend restaurant spending (€300/mo) is 4x higher than weekdays. This correlates with Friday payday and social plans. Cost per outing: €75. Alternative: Host potluck dinners at home (€20/event, same social value)."');
    lines.push('');
    lines.push('Be specific, actionable, and insightful — not just descriptive.');

    const lang = this.translate?.currentLang || 'en';
    const langName = PromptGeneratorService.LANG_MAP[lang];
    if (lang !== 'en' && langName) {
      lines.push('');
      lines.push(`IMPORTANT: Please write your entire response in ${langName}.`);
    }

    return lines.join('\n');
  }

  private buildExpensePatternOutputFormatBlock(): string {
    return `=== OUTPUT FORMAT ===

Provide a detailed behavioral spending analysis with key pattern discoveries.

**1. KEY INSIGHTS**
Summarize your keyInsights about spending patterns, behavioral triggers, and moneyLeaks.

**2. PATTERN TYPES**
Identify specific patterns: recurring-waste, seasonal-spike, impulse-clusters, and behavioral triggers.

**3. RECOMMENDATIONS**
Provide actionable recommendations prioritized by impact.

Then, at the END, include a JSON code block with an ARRAY of expense insights:

\`\`\`json
[
  {
    "title": "Friday Payday Effect - Weekend Spending Surge",
    "description": "Your spending spikes 3.5x on Fridays-Sundays (€280/weekend vs €80/weekday). This accounts for 60% of monthly discretionary spend.",
    "category": ["restaurants", "bars", "entertainment"],
    "currentCost": 320,
    "targetCost": 180,
    "monthlySavings": 140,
    "annualSavings": 1680,
    "pattern": "Weekend Social Spending Surge (Fri-Sun)",
    "insights": "Spending peaks Friday evening (payday celebration, 85%) and Saturday night (social plans, 92%). Cost per outing: €70 avg. Zero similar spending Mon-Thu. Trigger: Feeling 'earned the right to treat myself' after work week.",
    "reasoning": "This is a behavioral trigger (payday + weekend freedom) rather than genuine need. Same social enjoyment achievable at 50% cost with home-based alternatives.",
    "links": [
      { "label": "Budget-Friendly Social Activities", "url": "https://www.moneysavingexpert.com/family/free-days-out/" },
      { "label": "Hosting on a Budget Guide", "url": "https://www.thekitchn.com/how-to-host-on-a-budget" }
    ],
    "actionItems": [
      { "text": "Pre-plan 2 weekend activities under €40 each (movie night at home, potluck dinner, park picnic)", "priority": "high" },
      { "text": "Friday rule: Wait 24hrs before going out. Ask 'Do I want this, or just celebrating Friday?'", "priority": "high" },
      { "text": "Set weekend budget alert at €180/month (45% reduction, still social)", "priority": "medium" },
      { "text": "Track weekend spending separately for 1 month to build awareness", "priority": "medium" }
    ]
  },
  {
    "title": "Evening Delivery Trap - Convenience Tax After 8PM",
    "description": "You order food delivery 12-15x/month, exclusively between 8-11PM. Average cost: €18/order. Total: €240/mo.",
    "category": ["food delivery", "uber eats", "takeout"],
    "currentCost": 240,
    "targetCost": 80,
    "monthlySavings": 160,
    "annualSavings": 1920,
    "pattern": "Late Evening Convenience Spending (8-11PM)",
    "insights": "94% of delivery orders happen after 8PM when you're tired and don't want to cook. Average order time: 8:43PM. Pattern: Get home from work (7PM) → relax → realize hungry at 8PM → too tired to cook → order delivery. This is a predictable habit loop, not spontaneous hunger.",
    "reasoning": "This is an avoidable convenience tax caused by poor meal planning. Delivery markup: ~40% vs cooking same meal. Missing opportunity: meal prep Sunday = €60/week savings.",
    "links": [
      { "label": "15-Minute Meal Prep Ideas", "url": "https://www.budgetbytes.com/category/extra-bytes/budget-friendly-meal-prep/" },
      { "label": "No-Cook Dinner Recipes", "url": "https://www.eatingwell.com/recipes/22189/quick-easy/no-cook-dinners/" }
    ],
    "actionItems": [
      { "text": "Sunday meal prep: Cook 3-4 dinners for the week (Budget: €40, saves €200)", "priority": "high" },
      { "text": "Delete delivery apps from phone (Re-install only for special occasions)", "priority": "high" },
      { "text": "8PM rule: If hungry, eat pre-prepped meal or simple 10-min option (pasta, eggs, salad)", "priority": "high" },
      { "text": "Keep emaergency backup meals in freezer for tired days", "priority": "medium" }
    ]
  },
  {
    "title": "Micro-Transaction Bleeding - Death by €5 Purchases",
    "description": "You make 40-50 small purchases/month under €10 each (coffee, snacks, apps, small items). Total: €200+/mo that goes unnoticed.",
    "category": ["coffee shops", "convenience stores", "app purchases", "small items"],
    "currentCost": 220,
    "targetCost": 60,
    "monthlySavings": 160,
    "annualSavings": 1920,
    "pattern": "High-Frequency Micro-Transactions (40-50/mo)",
    "insights": "These purchases feel insignificant individually (€3-9 each), so you don't track them. But they compound to €220/mo. Peak times: Mornings (7-9AM, coffee runs, 48%), lunch breaks (12-1PM, snacks/drinks, 32%), after work (6-7PM, convenience store stops, 20%). None are planned — all are impulse.",
    "reasoning": "Classic 'latte factor'. Each €5 purchase seems harmless, but 44 per month = €220. These provide minimal lasting value (consumed in minutes) vs cost. Eliminating 75% saves €160/mo with almost zero lifestyle impact.",
    "links": [
      { "label": "Latte Factor Calculator", "url": "https://www.bankrate.com/retirement/latte-calculator/" },
      { "label": "Meal Prep for Busy Professionals", "url": "https://www.budgetbytes.com" }
    ],
    "actionItems": [
      { "text": "Morning: Brew coffee at home (invest €150 in coffee maker, break-even in 6 weeks)", "priority": "high" },
      { "text": "Pack lunch/snacks the night before to avoid convenience store stops", "priority": "high" },
      { "text": "Implement '€20 week' challenge: Only spend €20 total on these micro-purchases for 1 week", "priority": "high" },
      { "text": "Remove saved payment methods from app stores (adds friction to impulse purchases)", "priority": "medium" }
    ]
  },
  {
    "title": "December Holiday Debt Cycle - Predictable Annual Spike",
    "description": "Every December, spending jumps by €600-800 (gifts, events, food). This creates January credit card debt that takes until March to clear.",
    "category": ["gifts", "dining", "events", "seasonal"],
    "currentCost": 700,
    "targetCost": 300,
    "monthlySavings": 400,
    "annualSavings": 400,
    "pattern": "Seasonal Holiday Spending Spike (December)",
    "insights": "This happens every year (Last 3 Decembers averaged €720 spike), yet you never budget for it. Result: Debt in January that carries interest (€45 extra in interest charges per year). The pattern is 100% predictable, making it 100% preventable.",
    "reasoning": "This is a failure of planning, not income. Solution: Save €30/mo starting January → €360 December fund. Set strict gift budget (€200) + host potluck instead of expensive dinners (€save €250). Total cost: €300, no debt.",
    "links": [
      { "label": "Budget Gift Ideas Under €20", "url": "https://www.goodhousekeeping.com/holidays/gift-ideas/g23601117/cheap-christmas-gifts/" },
      { "label": "Potluck Holiday Hosting", "url": "https://www.thekitchn.com/holiday-potluck-ideas" }
    ],
    "actionItems": [
      { "text": "Open separate savings account for 'December Fund' and auto-transfer €30/mo", "priority": "high", "dueDate": "2026-04-30" },
      { "text": "Create gift list in November with €20 per person limit", "priority": "medium" },
      { "text": "Host potluck dinner instead of paying for full holiday meal", "priority": "medium" },
      { "text": "Shop Black Friday for December gifts (save 30-50%)", "priority": "low" }
    ]
  }
]
\`\`\`

CRITICAL FIELDS:
- "pattern": One-sentence pattern description (e.g., "Weekend Social Spending Surge", "Late Evening Convenience Spending")
- "insights": Detailed behavioral analysis with specific numbers (%, time ranges, triggers, cost-per-use, frequency)
- "timing": Include day-of-week, time-of-day, or seasonal specifics wherever possible
- "triggers": Identify emotional, environmental, or habitual triggers
- "alternatives": Suggest specific free/cheap alternatives with equal value

Each item represents a distinct spending pattern with deep behavioral insights and practical fixes.`;
  }

  // ========================================
  // PHASE 3: Smile Project AI Generator
  // ========================================

  /**
   * Generates a prompt for creating a new Smile project from a dream/goal
   */
  generateSmileCreatePrompt(config: {
    goal: string;
    urgency: string;
    researchDepth: string;
    informationFocus: string[];
    budgetFlexibility: string;
    complexity: string;
    numberOfSuggestions?: number;
    anonymized: boolean;
  }): string {
    const anon = config.anonymized;
    const lang = this.getCurrentLanguage();

    let prompt = `# CREATE NEW SMILE PROJECT\n\n`;
    prompt += `I want to create a detailed Smile Project plan for: **${config.goal}**\n\n`;

    prompt += `## YOUR TASK\n`;
    prompt += `1. Research this goal thoroughly (depth: ${config.researchDepth})\n`;
    prompt += `2. Break down the goal into logical buckets with realistic budget upper limits\n`;
    prompt += `3. Create actionable steps with priorities and target dates\n`;
    prompt += `4. Provide curated links to helpful resources (focus: ${config.informationFocus.join(', ')})\n`;
    prompt += `5. Design a payment plan strategy based on my financial situation\n`;
    prompt += `6. Add expert notes/tips that don't fit other categories\n\n`;

    // Financial context
    prompt += `## MY FINANCIAL SITUATION\n`;
    prompt += this.extractSmileFinancialContext(anon);
    prompt += `\nUrgency: ${config.urgency}\n`;
    prompt += `Budget flexibility: ${config.budgetFlexibility}\n`;
    prompt += `Project complexity: ${config.complexity}\n\n`;

    // Research requirements
    prompt += `## RESEARCH REQUIREMENTS\n`;
    prompt += `- Research depth: ${config.researchDepth}\n`;
    prompt += `- Information focus: ${config.informationFocus.join(', ')}\n`;
    prompt += `- Provide 5-10 high-quality, clickable links per bucket:\n`;
    prompt += `  • Product pages / shopping sites (with price estimates)\n`;
    prompt += `  • Comparison tools / review aggregators\n`;
    prompt += `  • Expert guides / how-to articles\n`;
    prompt += `  • Community forums / user experiences\n`;
    prompt += `  • Tips & tricks / money-saving hacks\n`;
    prompt += `  • All links must be real, currently active URLs\n`;
    prompt += `  • Label each link clearly (e.g., "Product Comparison: Wirecutter Review")\n\n`;

    // Output format
    prompt += `## OUTPUT FORMAT (JSON for direct import)\n\n`;
    prompt += `**CRITICAL: Return a single JSON object with this EXACT structure. Follow all field requirements precisely.**\n\n`;
    
    prompt += `### Understanding Buckets\n`;
    prompt += `Buckets organize the project into logical cost categories. Each bucket represents a component of the dream:\n`;
    prompt += `- For a world tour: "Flights", "Accommodation", "Food & Activities", "Travel Insurance", "Emergency Fund"\n`;
    prompt += `- For a car: "Down Payment", "Registration & Taxes", "Insurance First Year", "Accessories"\n`;
    prompt += `- For a wedding: "Venue", "Catering", "Photography", "Attire", "Flowers & Decor"\n\n`;
    prompt += `Each bucket tracks its own progress (target amount vs. amount saved).\n\n`;

    prompt += `### Understanding Payment Plans\n`;
    prompt += `Payment plans define HOW the user will fund their buckets over time. Key concepts:\n\n`;
    prompt += `**targetBuckets field:**\n`;
    prompt += `- ["all"] = Payment is split proportionally across ALL buckets based on their remaining balance\n`;
    prompt += `  Example: €300/month on a €10,000 project distributes proportionally to all incomplete buckets\n`;
    prompt += `- ["bucket-1", "bucket-2"] = Payment goes ONLY to these specific buckets\n`;
    prompt += `  Example: €200/month to "Flights" and "Hotel" buckets only, ignoring other buckets\n`;
    prompt += `- ["bucket-3"] = Payment goes to a single specific bucket\n`;
    prompt += `  Example: €500/month dedicated entirely to "Down Payment" bucket\n\n`;

    prompt += `**Multiple Payment Plans for Different Timelines:**\n`;
    prompt += `You can create multiple payment plans with different strategies:\n`;
    prompt += `- Plan 1: €200/month to ["all"] buckets (general savings)\n`;
    prompt += `- Plan 2: €100/month to ["bucket-flights"] starting 6 months earlier (priority item)\n`;
    prompt += `- Plan 3: One-time €1000 payment to ["bucket-downpayment"] using a bonus\n\n`;

    prompt += `**Payment Plan Requirements:**\n`;
    prompt += `- amount: Positive number (the payment amount)\n`;
    prompt += `- frequency: EXACTLY ONE OF: "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    prompt += `- startDate & endDate: YYYY-MM-DD format, endDate must be after startDate\n`;
    prompt += `- active: ALWAYS false (user activates after reviewing)\n\n`;

    prompt += `### Complete JSON Structure\n\n`;
    prompt += `\`\`\`json\n{\n`;
    prompt += `  "title": "Short project name (3-5 words)",\n`;
    prompt += `  "sub": "One-line subtitle describing the dream",\n`;
    prompt += `  "description": "Detailed description (2-3 paragraphs) explaining the goal, why it matters, and the plan overview",\n`;
    prompt += `  "phase": "idea",\n`;
    prompt += `  "targetDate": "YYYY-MM-DD",\n`;
    prompt += `  "buckets": [\n`;
    prompt += `    {\n`;
    prompt += `      "id": "bucket-1",\n`;
    prompt += `      "title": "Bucket name (e.g., Flights, Equipment, Venue)",\n`;
    prompt += `      "target": 1500,\n`;
    prompt += `      "amount": 0,\n`;
    prompt += `      "notes": "Explanation: Why this bucket exists, cost breakdown, estimation methodology",\n`;
    prompt += `      "links": [\n`;
    prompt += `        { "label": "Clear description (e.g., Skyscanner Flight Comparison)", "url": "https://actual-working-url.com" }\n`;
    prompt += `      ],\n`;
    prompt += `      "targetDate": "YYYY-MM-DD"\n`;
    prompt += `    },\n`;
    prompt += `    {\n`;
    prompt += `      "id": "bucket-2",\n`;
    prompt += `      "title": "Another bucket",\n`;
    prompt += `      "target": 800,\n`;
    prompt += `      "amount": 0,\n`;
    prompt += `      "notes": "Detailed notes for this bucket",\n`;
    prompt += `      "links": [],\n`;
    prompt += `      "targetDate": "YYYY-MM-DD"\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "links": [\n`;
    prompt += `    { "label": "General project resource (not bucket-specific)", "url": "https://..." }\n`;
    prompt += `  ],\n`;
    prompt += `  "actionItems": [\n`;
    prompt += `    {\n`;
    prompt += `      "text": "Specific actionable task with clear outcome",\n`;
    prompt += `      "done": false,\n`;
    prompt += `      "priority": "high",\n`;
    prompt += `      "dueDate": "YYYY-MM-DD"\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "notes": [\n`;
    prompt += `    {\n`;
    prompt += `      "text": "Expert tip, warning, or context that doesn't fit elsewhere",\n`;
    prompt += `      "createdAt": "YYYY-MM-DDTHH:mm:ssZ"\n`;
    prompt += `    }\n`;
    prompt += `  ],
`;
    prompt += `  "plannedSubscriptions": [
`;
    prompt += `    {
`;
    prompt += `      "id": "payment-main",
`;
    prompt += `      "targetBuckets": ["all"],
`;
    prompt += `      "amount": 250,
`;
    prompt += `      "frequency": "monthly",
`;
    prompt += `      "startDate": "2026-05-01",
`;
    prompt += `      "endDate": "2027-08-01",
`;
    prompt += `      "description": "Primary savings plan - distributes across all buckets proportionally",
`;
    prompt += `      "active": false
`;
    prompt += `    },
`;
    prompt += `    {
`;
    prompt += `      "id": "payment-priority",
`;
    prompt += `      "targetBuckets": ["bucket-1"],
`;
    prompt += `      "amount": 150,
`;
    prompt += `      "frequency": "monthly",
`;
    prompt += `      "startDate": "2026-04-01",
`;
    prompt += `      "endDate": "2026-12-01",
`;
    prompt += `      "description": "Extra funding for priority bucket (Flights) - needs early booking",
`;
    prompt += `      "active": false
`;
    prompt += `    }
`;
    prompt += `  ]
`;
    prompt += `}\n\`\`\`\n\n`;
    
    prompt += `### Field Requirements\n`;
    prompt += `- **phase**: MUST be exactly "idea" (system assigns other phases later)\n`;
    prompt += `- **targetDate**: Must be realistic based on my financial situation\n`;
    prompt += `- **bucket.id**: Use format "bucket-{name}" (e.g., "bucket-flights", "bucket-hotel")\n`;
    prompt += `- **bucket.target**: Positive number, realistic market price\n`;
    prompt += `- **bucket.amount**: ALWAYS 0 for new projects (user hasn't saved yet)\n`;
    prompt += `- **actionItem.priority**: EXACTLY one of "high", "medium", "low"\n`;
    prompt += `- **frequency**: EXACTLY one of "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    prompt += `- **active**: ALWAYS false (user reviews before activating)\n`;
    prompt += `- **All dates**: YYYY-MM-DD format (e.g., "2026-12-25"), except note createdAt which uses ISO 8601 with time: YYYY-MM-DDTHH:mm:ssZ (e.g., "2026-04-08T14:30:00Z")\n\n`;
    
    prompt += `### Tips for Quality Output\n`;
    prompt += `1. Create 2-4 payment plans: one for ["all"] and 1-3 for specific priority buckets\n`;
    prompt += `2. Early start dates for priority items (flights, deposits)\n`;
    prompt += `3. Later start dates for optional items (accessories, extras)\n`;
    prompt += `4. Ensure sum of all bucket targets matches your cost analysis\n`;
    prompt += `5. Verify payment plans can realistically complete before targetDate\n\n`;

    // Affordability analysis
    prompt += `## AFFORDABILITY ANALYSIS\n`;
    prompt += `Based on my financial snapshot, provide:\n`;
    prompt += `- Total project cost estimate: €[SUM_OF_BUCKETS]\n`;
    prompt += `- Recommended savings rate: €[AMOUNT]/[FREQUENCY]\n`;
    prompt += `- Estimated completion date: [DATE]\n`;
    prompt += `- Risk assessment: [Low/Medium/High] with justification\n`;
    prompt += `- If currently unaffordable: "Current finances suggest you should focus on growing income first (see Grow feature). However, here's a preliminary plan for when you're ready..."\n\n`;

    prompt += `## DECISION GUIDANCE\n`;
    prompt += `1. Is this achievable now, or should I wait?\n`;
    prompt += `2. Alternative cheaper versions of this goal (if applicable)\n`;
    prompt += `3. Which buckets could be optional/delayed?\n`;
    prompt += `4. Timeline trade-offs (faster = higher monthly cost, slower = lower monthly cost)\n\n`;

    prompt += `## YOUR RESPONSE FORMAT\n`;
    prompt += `**CRITICAL**: Structure your response in TWO DISTINCT sections:\n\n`;
    prompt += `**SECTION 1: YOUR REASONING & ANALYSIS (Plain text)**\n`;
    prompt += `Start your response by explaining your research process and key findings:\n`;
    prompt += `- What you searched for and what you found\n`;
    prompt += `- Price ranges and cost breakdown for each bucket\n`;
    prompt += `- Why you chose specific amounts (upper limits strategy)\n`;
    prompt += `- Affordability analysis and risk assessment\n`;
    prompt += `- Alternative options or cheaper approaches\n`;
    prompt += `- Timeline considerations and payment plan strategy\n`;
    prompt += `- Any important warnings or tips for the user\n\n`;
    prompt += `Write this section in normal text (no JSON, no code blocks). Be thorough and explain your reasoning.\n\n`;
    prompt += `**SECTION 2: COMPLETE JSON OUTPUT (Code block)**\n`;
    prompt += `After your analysis, provide the complete project data in a single JSON code block:\n`;
    prompt += `- Start with exactly \`\`\`json on its own line\n`;
    prompt += `- Include the COMPLETE project object with ALL fields\n`;
    prompt += `- End with exactly \`\`\` on its own line\n`;
    prompt += `- This should be the ONLY code block in your response\n`;
    prompt += `- Use proper JSON syntax (no comments, trailing commas, or syntax errors)\n`;
    prompt += `- All text fields in ${lang}\n\n`;
    prompt += `**Example response structure:**\n`;
    prompt += `\`\`\`\n`;
    prompt += `SECTION 1 - YOUR ANALYSIS:\n`;
    prompt += `I researched mountain guide prices in Garmisch and found that UIAGM-certified guides charge...\n`;
    prompt += `Based on your financial situation of €250/month Smile allocation...\n`;
    prompt += `[More detailed analysis, reasoning, and explanations here...]\n\n`;
    prompt += `SECTION 2 - JSON OUTPUT:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "title": "August Guided Climb",\n`;
    prompt += `  "sub": "2.5-day mountain guide climbing trip",\n`;
    prompt += `  ...complete project object here...\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n`;
    prompt += `\`\`\`\n`;

    return prompt;
  }

  /**
   * Extracts Smile-specific financial context
   */
  private extractSmileFinancialContext(anonymized: boolean): string {
    const monthlyIncome = this.calculateAverageMonthlyIncome();
    const smileAllocation = this.state.smile; // percentage
    const smileMonthlyBudget = (monthlyIncome * smileAllocation) / 100;
    
    // Get Smile account balance
    const smileAccountBalance = this.state.getAmount('Smile', smileAllocation / 100);
    
    // Calculate last month's contribution (simplified)
    const lastMonthContribution = smileMonthlyBudget; // Approximation
    
    // Existing Smile projects
    const existingProjects = this.state.allSmileProjects || [];
    const totalSmileTarget = existingProjects.reduce((sum, p) => {
      const bucketTotal = (p.buckets || []).reduce((s, b) => s + (b.target || 0), 0);
      return sum + bucketTotal;
    }, 0);
    const totalSmileSaved = existingProjects.reduce((sum, p) => {
      const bucketTotal = (p.buckets || []).reduce((s, b) => s + (b.amount || 0), 0);
      return sum + bucketTotal;
    }, 0);
    
    const netWorth = this.calculateNetWorth();
    
    if (anonymized) {
      return `- Monthly income range: ${this.toRange(monthlyIncome)}/mo
- Smile allocation: ${smileAllocation}% (~${this.toRange(smileMonthlyBudget)}/mo)
- Current Smile savings: ${this.toRange(smileAccountBalance)}
- Last month contribution: ${this.toRange(lastMonthContribution)}
- Existing Smile projects: ${existingProjects.length} totaling ${this.toRange(totalSmileTarget)} (${this.toRange(totalSmileSaved)} saved)
- Net worth range: ${this.toRange(netWorth)}`;
    } else {
      return `- Monthly income: ${this.currency}${monthlyIncome.toFixed(0)}
- Smile allocation: ${smileAllocation}% (${this.currency}${smileMonthlyBudget.toFixed(0)}/mo)
- Current Smile savings: ${this.currency}${smileAccountBalance.toFixed(2)}
- Last month contribution: ${this.currency}${lastMonthContribution.toFixed(0)}
- Existing Smile projects: ${existingProjects.length} totaling ${this.currency}${totalSmileTarget.toFixed(0)} (${this.currency}${totalSmileSaved.toFixed(0)} saved)
- Net worth: ${this.currency}${netWorth.toFixed(0)}`;
    }
  }

  // ========================================
  // PHASE 3: Fire Emergency AI Generator
  // ========================================

  /**
   * Generates a prompt for creating a new Fire emergency plan
   */
  generateFireCreatePrompt(config: {
    emergencyType: string;
    totalAmount: number;
    alreadyBorrowed: boolean;
    lenderDetails?: string;
    urgency: string;
    paybackStrategy: string;
    researchNeeds: string[];
    numberOfSuggestions?: number;
    anonymized: boolean;
  }): string {
    const anon = config.anonymized;
    const lang = this.getCurrentLanguage();

    let prompt = `# CREATE NEW FIRE EMERGENCY PLAN\n\n`;
    prompt += `I need help planning for this emergency: **${config.emergencyType}**\n`;
    prompt += `Amount needed/owed: ${this.currency}${config.totalAmount}\n`;
    prompt += `Already borrowed: ${config.alreadyBorrowed ? 'Yes' : 'No'}`;
    if (config.alreadyBorrowed && config.lenderDetails) {
      prompt += ` — ${config.lenderDetails}`;
    }
    prompt += `\n\n`;

    prompt += `## YOUR TASK\n`;
    prompt += `1. Break down this emergency into logical buckets (if complex)\n`;
    prompt += `2. Provide research links for solving this emergency efficiently\n`;
    prompt += `3. Create a realistic payback/funding plan based on my finances\n`;
    prompt += `4. Design action items prioritized by urgency\n`;
    prompt += `5. Apply ${config.paybackStrategy} strategy if this is debt\n`;
    prompt += `6. Add expert notes on damage control & prevention\n\n`;

    // Financial context
    prompt += `## MY FINANCIAL SITUATION\n`;
    prompt += this.extractFireFinancialContext(anon);
    prompt += `\nUrgency: ${config.urgency}\n`;
    prompt += `Preferred payback strategy: ${config.paybackStrategy}\n\n`;

    // Research requirements
    prompt += `## RESEARCH REQUIREMENTS\n`;
    prompt += `Focus: ${config.researchNeeds.join(', ')}\n`;
    prompt += `- Provide 5-10 curated links per bucket\n`;
    prompt += `- Focus on: price comparisons, DIY guides, financing options, warranties, insurance\n`;
    prompt += `- All links must be real, currently active URLs\n`;
    prompt += `- Label clearly\n\n`;

    // Output format (similar to Smile but Fire-specific)
    prompt += `## OUTPUT FORMAT (JSON for direct import)\n\n`;
    prompt += `**CRITICAL: Return a single JSON object with this EXACT structure. Follow all field requirements precisely.**\n\n`;
    
    prompt += `### Understanding Buckets for Emergencies\n`;
    prompt += `Buckets organize the emergency into logical cost categories. Each bucket represents a component:\n`;
    prompt += `- For appliance replacement: "New Dishwasher", "Installation", "Disposal of Old Unit", "Extended Warranty"\n`;
    prompt += `- For medical emergency: "Medical Bills", "Medications", "Follow-up Visits", "Lost Income"\n`;
    prompt += `- For debt payback: "Principal Repayment", "Interest (if any)", "Buffer for Emergencies"\n`;
    prompt += `- For car repair: "Parts", "Labor", "Rental Car", "Diagnostic Fee"\n\n`;
    prompt += `Each bucket tracks progress and completion independently.\n\n`;

    prompt += `### Understanding Payment Plans for Emergencies\n`;
    prompt += `Payment plans define HOW the user will fund or pay back the emergency. Critical for debt management:\n\n`;
    prompt += `**targetBuckets field:**\n`;
    prompt += `- ["all"] = Payment distributes across ALL buckets proportionally\n`;
    prompt += `  Use for: General emergency fund rebuilding after crisis\n`;
    prompt += `- ["bucket-payback"] = Payment goes to specific debt bucket\n`;
    prompt += `  Use for: Focused debt elimination (e.g., paying back family loan)\n`;
    prompt += `- ["bucket-medical", "bucket-followup"] = Payment to multiple specific buckets\n`;
    prompt += `  Use for: When certain costs must be paid before others\n\n`;

    prompt += `**Multiple Payment Plans for Complex Emergencies:**\n`;
    prompt += `- Plan 1: €150/month to ["bucket-payback-parents"] (dedicated debt repayment)\n`;
    prompt += `- Plan 2: €100/month to ["all"] remaining buckets (rebuild emergency fund)\n`;
    prompt += `- Plan 3: €50/biweekly to ["bucket-preventive-maintenance"] (avoid future issues)\n\n`;

    prompt += `**Payment Plan Requirements:**\n`;
    prompt += `- amount: Positive number (payment amount)\n`;
    prompt += `- frequency: EXACTLY ONE OF: "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    prompt += `- startDate & endDate: YYYY-MM-DD format, endDate after startDate\n`;
    prompt += `- active: ALWAYS false (user activates after review)\n`;
    prompt += `- description: Clear explanation of what this payment accomplishes\n\n`;

    prompt += `### Complete JSON Structure\n\n`;
    prompt += `\`\`\`json\n{\n`;
    prompt += `  "title": "Short emergency name (e.g., Dishwasher Replacement, Pay Back Parents)",\n`;
    prompt += `  "sub": "One-line description of the emergency",\n`;
    prompt += `  "description": "What happened + plan overview (2-3 paragraphs). Include severity, impact, and resolution strategy",\n`;
    prompt += `  "phase": "idea",\n`;
    prompt += `  "targetDate": "YYYY-MM-DD",\n`;
    prompt += `  "buckets": [\n`;
    prompt += `    {\n`;
    prompt += `      "id": "bucket-1",\n`;
    prompt += `      "title": "Bucket name (e.g., New Appliance, Repair Cost, Debt Principal)",\n`;
    prompt += `      "target": 800,\n`;
    prompt += `      "amount": 0,\n`;
    prompt += `      "notes": "Cost breakdown, why this amount, vendor quotes if available",\n`;
    prompt += `      "links": [\n`;
    prompt += `        { "label": "Clear description (e.g., Home Depot Dishwasher Comparison)", "url": "https://..." }\n`;
    prompt += `      ],\n`;
    prompt += `      "targetDate": "YYYY-MM-DD"\n`;
    prompt += `    },\n`;
    prompt += `    {\n`;
    prompt += `      "id": "bucket-2",\n`;
    prompt += `      "title": "Another emergency component",\n`;
    prompt += `      "target": 200,\n`;
    prompt += `      "amount": 0,\n`;
    prompt += `      "notes": "Details for this bucket",\n`;
    prompt += `      "links": [],\n`;
    prompt += `      "targetDate": "YYYY-MM-DD"\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "links": [\n`;
    prompt += `    { "label": "General emergency resource", "url": "https://..." }\n`;
    prompt += `  ],\n`;
    prompt += `  "actionItems": [\n`;
    prompt += `    {\n`;
    prompt += `      "text": "Immediate action required (e.g., Get 3 quotes, Call insurance, Schedule repair)",\n`;
    prompt += `      "done": false,\n`;
    prompt += `      "priority": "high",\n`;
    prompt += `      "dueDate": "YYYY-MM-DD"\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "notes": [\n`;
    prompt += `    {\n`;
    prompt += `      "text": "Prevention tip: How to avoid this in the future OR Damage control: What to do right now",\n`;
    prompt += `      "createdAt": "YYYY-MM-DDTHH:mm:ssZ"\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "plannedSubscriptions": [\n`;
    prompt += `    {\n`;
    prompt += `      "id": "payment-debt",\n`;
    prompt += `      "targetBuckets": ["bucket-1"],\n`;
    prompt += `      "amount": 150,\n`;
    prompt += `      "frequency": "monthly",\n`;
    prompt += `      "startDate": "2026-05-01",\n`;
    prompt += `      "endDate": "2027-03-01",\n`;
    prompt += `      "description": "Monthly debt repayment - priority payment",\n`;
    prompt += `      "active": false\n`;
    prompt += `    },\n`;
    prompt += `    {\n`;
    prompt += `      "id": "payment-rebuild",\n`;
    prompt += `      "targetBuckets": ["all"],\n`;
    prompt += `      "amount": 100,\n`;
    prompt += `      "frequency": "monthly",\n`;
    prompt += `      "startDate": "2026-05-01",\n`;
    prompt += `      "endDate": "2026-12-01",\n`;
    prompt += `      "description": "Rebuild emergency fund after this crisis",\n`;
    prompt += `      "active": false\n`;
    prompt += `    }\n`;
    prompt += `  ]\n`;
    prompt += `}\n\`\`\`\n\n`;
    
    prompt += `### Field Requirements\n`;
    prompt += `- **phase**: MUST be exactly "idea" (system manages phase progression)\n`;
    prompt += `- **targetDate**: Resolution deadline based on urgency\n`;
    prompt += `- **bucket.id**: Format "bucket-{name}" (e.g., "bucket-repairs", "bucket-payback")\n`;
    prompt += `- **bucket.target**: Realistic cost estimate\n`;
    prompt += `- **bucket.amount**: ALWAYS 0 for new emergencies (not yet funded)\n`;
    prompt += `- **actionItem.priority**: EXACTLY "high", "medium", or "low"\n`;
    prompt += `- **frequency**: EXACTLY one of "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    prompt += `- **active**: ALWAYS false\n`;
    prompt += `- **All dates**: YYYY-MM-DD format, except note createdAt which uses ISO 8601 with time: YYYY-MM-DDTHH:mm:ssZ (e.g., "2026-04-08T14:30:00Z")\n\n`;
    
    prompt += `### Tips for Debt Payback Plans\n`;
    prompt += `1. For family loans: Create gentle payment plan (€100-150/month) respecting relationship\n`;
    prompt += `2. For high-interest debt: Aggressive payment plan targeting this bucket first\n`;
    prompt += `3. For complex emergencies: Multiple payment plans - one for debt, one for rebuilding fund\n`;
    prompt += `4. Always leave buffer: Don't commit 100% of Fire allocation to single emergency\n`;
    prompt += `5. Priority order: Immediate danger > High interest debt > Family obligations > Fund rebuilding\n\n`;

    // Payback strategy analysis
    if (config.alreadyBorrowed) {
      prompt += `## PAYBACK STRATEGY ANALYSIS\n`;
      prompt += `${config.paybackStrategy} Strategy:\n`;
      prompt += `- Snowball: Attack smallest debt first for psychological wins\n`;
      prompt += `- Avalanche: Attack highest interest first for math optimization\n`;
      prompt += `- Realistic: Balanced approach considering interest, urgency, and emotional factors\n`;
      prompt += `- Let AI decide: You choose the best based on my situation\n\n`;
      prompt += `Provide:\n`;
      prompt += `- Monthly payment plan\n`;
      prompt += `- Debt-free target date\n`;
      prompt += `- Total interest saved vs. minimum payments (if applicable)\n\n`;
    }

    // Affordability & risk
    prompt += `## AFFORDABILITY & RISK ASSESSMENT\n`;
    prompt += `- Can I afford this now? [YES/NO with justification]\n`;
    prompt += `- Impact on Debt-to-Income ratio: [CURRENT]% → [NEW]% (safe: <36%)\n`;
    if (config.alreadyBorrowed) {
      prompt += `- Timeline is [COMFORTABLE/TIGHT/UNSUSTAINABLE]\n`;
    }
    prompt += `- Alternatives considered: [LIST]\n`;
    prompt += `- What if income drops 20%? [CONTINGENCY]\n\n`;

    prompt += `## YOUR RESPONSE FORMAT\n`;
    prompt += `**CRITICAL**: Structure your response in TWO DISTINCT sections:\n\n`;
    prompt += `**SECTION 1: YOUR REASONING & ANALYSIS (Plain text)**\n`;
    prompt += `Start your response by explaining your research process and key findings:\n`;
    prompt += `- What you searched for and what you found\n`;
    prompt += `- Cost breakdown for each emergency component (buckets)\n`;
    prompt += `- Why you chose specific amounts\n`;
    prompt += `- Affordability analysis and payback strategy assessment\n`;
    prompt += `- Timeline considerations and payment plan strategy\n`;
    prompt += `- Risk factors and contingency planning\n`;
    prompt += `- Any important warnings or tips for handling this emergency\n\n`;
    prompt += `Write this section in normal text (no JSON, no code blocks). Be thorough and explain your reasoning.\n\n`;
    prompt += `**SECTION 2: COMPLETE JSON OUTPUT (Code block)**\n`;
    prompt += `After your analysis, provide the complete emergency plan in a single JSON code block:\n`;
    prompt += `- Start with exactly \`\`\`json on its own line\n`;
    prompt += `- Include the COMPLETE emergency object with ALL fields\n`;
    prompt += `- End with exactly \`\`\` on its own line\n`;
    prompt += `- This should be the ONLY code block in your response\n`;
    prompt += `- Use proper JSON syntax (no comments, trailing commas, or syntax errors)\n`;
    prompt += `- All text fields in ${lang}\n\n`;
    prompt += `**Example response structure:**\n`;
    prompt += `\`\`\`\n`;
    prompt += `SECTION 1 - YOUR ANALYSIS:\n`;
    prompt += `I researched appliance replacement costs and found that quality dishwashers range from...\n`;
    prompt += `Based on your Fire allocation of €150/month...\n`;
    prompt += `[More detailed analysis, reasoning, and explanations here...]\n\n`;
    prompt += `SECTION 2 - JSON OUTPUT:\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "title": "Dishwasher Replacement",\n`;
    prompt += `  "sub": "Emergency appliance replacement plan",\n`;
    prompt += `  ...complete emergency object here...\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n`;
    prompt += `\`\`\`\n`;

    return prompt;
  }

  /**
   * Extracts Fire-specific financial context
   */
  private extractFireFinancialContext(anonymized: boolean): string {
    const monthlyIncome = this.calculateAverageMonthlyIncome();
    const fireAllocation = this.state.fire; // percentage
    const fireMonthlyBudget = (monthlyIncome * fireAllocation) / 100;
    
    // Get Fire account balance
    const fireAccountBalance = this.state.getAmount('Fire', fireAllocation / 100);
    
    // Last month contribution (approximation)
    const lastMonthContribution = fireMonthlyBudget;
    
    // Existing Fire emergencies
    const existingEmergencies = this.state.allFireEmergencies || [];
    const totalFireTarget = existingEmergencies.reduce((sum, e) => {
      const bucketTotal = (e.buckets || []).reduce((s, b) => s + (b.target || 0), 0);
      return sum + bucketTotal;
    }, 0);
    const totalFireResolved = existingEmergencies.reduce((sum, e) => {
      const bucketTotal = (e.buckets || []).reduce((s, b) => s + (b.amount || 0), 0);
      return sum + bucketTotal;
    }, 0);
    
    // Calculate debt-to-income ratio
    const monthlyDebtPayments = this.calculateMonthlyDebtPayments();
    const debtToIncomeRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;
    
    // Calculate available surplus
    const totalExpenses = this.sumExpenses();
    const availableSurplus = monthlyIncome - totalExpenses;
    
    if (anonymized) {
      return `- Monthly income range: ${this.toRange(monthlyIncome)}/mo
- Fire allocation: ${fireAllocation}% (~${this.toRange(fireMonthlyBudget)}/mo)
- Current Fire savings: ${this.toRange(fireAccountBalance)}
- Last month contribution: ${this.toRange(lastMonthContribution)}
- Existing Fire emergencies: ${existingEmergencies.length} totaling ${this.toRange(totalFireTarget)} (${this.toRange(totalFireResolved)} resolved)
- Debt-to-income ratio: ${Math.round(debtToIncomeRatio)}% (safe limit: <36%)
- Available surplus after obligations: ${this.toRange(availableSurplus)}/mo`;
    } else {
      return `- Monthly income: ${this.currency}${monthlyIncome.toFixed(0)}
- Fire allocation: ${fireAllocation}% (${this.currency}${fireMonthlyBudget.toFixed(0)}/mo)
- Current Fire savings: ${this.currency}${fireAccountBalance.toFixed(2)}
- Last month contribution: ${this.currency}${lastMonthContribution.toFixed(0)}
- Existing Fire emergencies: ${existingEmergencies.length} totaling ${this.currency}${totalFireTarget.toFixed(0)} (${this.currency}${totalFireResolved.toFixed(0)} resolved)
- Debt-to-income ratio: ${Math.round(debtToIncomeRatio)}% (safe limit: <36%)
- Available surplus after obligations: ${this.currency}${availableSurplus.toFixed(0)}/mo`;
    }
  }

  /**
   * Calculates monthly debt payments from liabilities
   */
  private calculateMonthlyDebtPayments(): number {
    const liabilities = this.state.liabilities || [];
    // Sum up liabilities with credit info (monthly payments)
    // This is a simplification - in reality you'd need more data about payment schedules
    return liabilities.reduce((sum, lib) => {
      if (lib.credit && lib.credit > 0) {
        // Estimate monthly payment as amount / 12 (1 year payback assumption)
        const estimatedMonthly = (lib.amount || 0) / 12;
        return sum + estimatedMonthly;
      }
      return sum;
    }, 0);
  }

  /**
   * Calculates average monthly income from transactions or static data
   */
  private calculateAverageMonthlyIncome(): number {
    // Try from transactions first
    const transactions = this.state.allTransactions || [];
    if (transactions.length > 0) {
      const incomeTransactions = transactions.filter(t => t.account === 'Income' && t.amount > 0);
      if (incomeTransactions.length > 0) {
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        // Get unique months
        const months = new Set(incomeTransactions.map(t => {
          const date = new Date(t.date);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }));
        const monthCount = Math.max(months.size, 1);
        return totalIncome / monthCount;
      }
    }
    
    // Fallback to static data
    return this.sumRevenues();
  }

  /**
   * Calculates net worth (assets - liabilities)
   */
  private calculateNetWorth(): number {
    const assets = (this.state.allAssets || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const shares = (this.state.allShares || []).reduce((sum, s) => sum + ((s.quantity || 0) * (s.price || 0)), 0);
    const investments = (this.state.allInvestments || []).reduce((sum, i) => sum + (i.amount || 0), 0);
    const liabilities = (this.state.liabilities || []).reduce((sum, l) => sum + (l.amount || 0), 0);
    
    return assets + shares + investments - liabilities;
  }

  /**
   * Generates a prompt for improving existing Smile projects
   */
  generateSmileImprovePrompt(existingProjects: any[], config: {
    userPlan: string;
    improvementAreas: string[];
    researchDepth: string;
    informationFocus: string[];
    customInstructions: string;
    anonymized: boolean;
  }): string {
    const anon = config.anonymized;
    const lang = this.getCurrentLanguage();
    const multi = existingProjects.length > 1;

    let prompt = `# UPDATE EXISTING SMILE PROJECT${multi ? 'S' : ''}\n\n`;
    prompt += `I want to update and improve ${multi ? 'these' : 'this'} existing Smile Project${multi ? 's' : ''}.\n\n`;

    // User's plan / intent
    if (config.userPlan) {
      prompt += `## MY PLAN & INTENT\n`;
      prompt += `${config.userPlan}\n\n`;
    }

    // Current state of each project
    prompt += `## CURRENT PROJECT STATE${multi ? 'S' : ''}\n\n`;
    prompt += `⚠️ REMINDER: You MUST use the EXACT "title" from each project below in your output. Changing even one character will cause the update to fail.\n\n`;
    for (const project of existingProjects) {
      prompt += `### ${project.title}\n`;
      prompt += `Phase: ${project.phase} | Target Date: ${project.targetDate || 'Not set'}\n`;
      const totalTarget = (project.buckets || []).reduce((s: number, b: any) => s + (b.target || 0), 0);
      const totalSaved = (project.buckets || []).reduce((s: number, b: any) => s + (b.amount || 0), 0);
      prompt += `Total Target: ${this.currency}${totalTarget} | Saved: ${this.currency}${totalSaved}\n`;
      const lockedBuckets = (project.buckets || []).filter((b: any) => (b.amount || 0) > 0);
      if (lockedBuckets.length > 0) {
        prompt += `⚠ LOCKED buckets (have money): ${lockedBuckets.map((b: any) => `"${b.title}" (${this.currency}${b.amount}/${this.currency}${b.target})`).join(', ')}\n`;
      }
      const existingPlans = (project.plannedSubscriptions || []);
      if (existingPlans.length > 0) {
        prompt += `⚠ Existing payment plans: ${existingPlans.map((p: any) => `"${p.title}" (${this.currency}${p.amount}/${p.frequency})`).join(', ')}\n`;
      }
      prompt += `\`\`\`json\n${JSON.stringify(project, null, 2)}\n\`\`\`\n\n`;
    }

    // Improvement tasks
    prompt += `## YOUR TASK\n`;
    prompt += `Analyze ${multi ? 'each project' : 'my project'} and improve these areas: **${config.improvementAreas.join(', ')}**\n`;
    prompt += `Research depth: ${config.researchDepth}\n`;
    if (config.informationFocus.length > 0) {
      prompt += `Information focus: ${config.informationFocus.join(', ')}\n`;
    }
    prompt += `\n`;

    // Improvement area details
    prompt += `## IMPROVEMENT REQUIREMENTS\n`;
    if (config.improvementAreas.includes('description')) {
      prompt += `**Description & Details:**\n`;
      prompt += `- Expand or refine the project description\n`;
      prompt += `- Update subtitle if needed\n`;
      prompt += `- Add missing context or strategy overview\n\n`;
    }
    if (config.improvementAreas.includes('budget-realism')) {
      prompt += `**Budget Realism:**\n`;
      prompt += `- Research current market prices for each bucket\n`;
      prompt += `- Update bucket targets if outdated (respect locked bucket constraints!)\n`;
      prompt += `- Flag overestimates or underestimates\n`;
      prompt += `- Add inflation buffer if target date is >1 year away\n\n`;
    }
    if (config.improvementAreas.includes('add-buckets')) {
      prompt += `**Add/Revise Buckets:**\n`;
      prompt += `- Identify overlooked expense categories\n`;
      prompt += `- Suggest optional vs. required buckets\n`;
      prompt += `- Add tax/fee/shipping buckets if missing\n`;
      prompt += `- Add detailed notes to each bucket explaining cost estimates\n\n`;
    }
    if (config.improvementAreas.includes('add-links')) {
      prompt += `**Add Links:**\n`;
      prompt += `- Add 5-10 high-quality links per bucket\n`;
      prompt += `- Focus on: ${config.informationFocus.join(', ')}\n`;
      prompt += `- All links must be real, currently active URLs\n`;
      prompt += `- Labels should be descriptive (e.g., "Price Comparison: Idealo.de")\n\n`;
    }
    if (config.improvementAreas.includes('action-items')) {
      prompt += `**Action Items:**\n`;
      prompt += `- Add missing action items based on current phase\n`;
      prompt += `- Suggest priorities for existing items\n`;
      prompt += `- Add realistic due dates\n`;
      prompt += `- Preserve existing done=true items\n\n`;
    }
    if (config.improvementAreas.includes('payment-plan')) {
      prompt += `**Payment Plans:**\n`;
      prompt += `- Design or update payment plans based on my financial situation\n`;
      prompt += `- Suggest contribution amounts and frequencies\n`;
      prompt += `- Calculate completion dates at proposed savings rates\n`;
      prompt += `- DO NOT remove existing payment plans (only add or adjust)\n\n`;
    }
    if (config.improvementAreas.includes('timeline')) {
      prompt += `**Timeline Optimization:**\n`;
      prompt += `- Assess if target date is realistic\n`;
      prompt += `- Suggest bucket-specific deadlines\n`;
      prompt += `- Flag buckets that could be saved faster\n`;
      prompt += `- Recommend timeline adjustments\n\n`;
    }
    if (config.improvementAreas.includes('notes')) {
      prompt += `**Notes & Comments:**\n`;
      prompt += `- Add expert tips, warnings, or context\n`;
      prompt += `- Add notes per bucket with cost breakdown details\n`;
      prompt += `- Preserve existing notes (append new ones)\n\n`;
    }

    // Custom instructions
    if (config.customInstructions) {
      prompt += `## ADDITIONAL INSTRUCTIONS\n`;
      prompt += `${config.customInstructions}\n\n`;
    }

    // Update constraints
    prompt += `## ⚠ UPDATE CONSTRAINTS (CRITICAL — FOLLOW EXACTLY)\n\n`;
    prompt += `These rules protect existing data. Violating them will cause import failures.\n\n`;
    prompt += `**🔴 PROJECT TITLE — NEVER CHANGE:**\n`;
    prompt += `- The "title" field MUST remain EXACTLY as provided — character for character\n`;
    prompt += `- The system matches projects by title to apply updates\n`;
    prompt += `- If you change the title, the update WILL FAIL and create a duplicate instead\n`;
    prompt += `- This is the #1 most important rule\n\n`;
    prompt += `**🔴 LOCKED BUCKETS ("amount" > 0 = money already saved):**\n`;
    prompt += `- These buckets contain real money the user has already saved\n`;
    prompt += `- DO NOT rename them — keep the EXACT same "id" AND "title", character for character\n`;
    prompt += `- DO NOT remove them under any circumstances\n`;
    prompt += `- DO NOT reduce their "target" below their current "amount"\n`;
    prompt += `- DO NOT change their "amount" value (this is real saved money)\n`;
    prompt += `- You CAN: add notes, links, adjust target UPWARD, add/update targetDate\n\n`;
    prompt += `**Buckets with "amount" === 0:**\n`;
    prompt += `- Can be freely modified, renamed, or removed\n`;
    prompt += `- New buckets can be added\n\n`;
    prompt += `**Payment Plans (plannedSubscriptions):**\n`;
    prompt += `- DO NOT remove existing payment plans\n`;
    prompt += `- You CAN add new payment plans\n`;
    prompt += `- You CAN adjust amounts, dates, descriptions on existing plans\n`;
    prompt += `- Keep existing plan IDs unchanged\n\n`;
    prompt += `**Preserved Fields (copy from existing):**\n`;
    prompt += `- Keep all bucket "amount" values exactly as-is (money already saved)\n`;
    prompt += `- Keep all bucket "id" values for locked buckets\n`;
    prompt += `- Keep "createdAt" timestamps from existing project\n`;
    prompt += `- Set "updatedAt" to current date\n`;
    prompt += `- Keep "phase" as-is unless explicitly asked to change\n`;
    prompt += `- Keep "completionDate" if set\n\n`;

    // Financial context
    prompt += `## MY CURRENT FINANCIAL SITUATION\n`;
    prompt += this.extractSmileFinancialContext(anon);
    prompt += `\n\n`;

    // Complete JSON structure example (same as create)
    prompt += this.buildSmileJsonStructureExample();

    // Response format
    prompt += `## YOUR RESPONSE FORMAT\n`;
    prompt += `**CRITICAL**: Structure your response in TWO DISTINCT sections:\n\n`;
    prompt += `**SECTION 1: YOUR REASONING & ANALYSIS (Plain text)**\n`;
    prompt += `- What you found during research\n`;
    prompt += `- What you changed and why\n`;
    prompt += `- Which buckets are locked vs. modified\n`;
    prompt += `- Budget impact analysis\n`;
    prompt += `- Timeline assessment\n\n`;
    prompt += `**SECTION 2: COMPLETE JSON OUTPUT (Code block)**\n`;
    prompt += `- ${multi ? `Return a JSON ARRAY containing ${existingProjects.length} complete project objects` : 'Return a single JSON object with the complete updated project'}\n`;
    prompt += `- ⚠️ TITLES MUST BE IDENTICAL to the originals (copy-paste them, do not retype)\n`;
    prompt += `- ⚠️ Locked bucket titles and IDs must be identical to the originals\n`;
    prompt += `- Start with exactly \`\`\`json on its own line\n`;
    prompt += `- Include ALL fields from the original + your improvements\n`;
    prompt += `- End with exactly \`\`\` on its own line\n`;
    prompt += `- Use proper JSON syntax (no comments, trailing commas, or syntax errors)\n`;
    prompt += `- All text fields in ${lang}\n\n`;

    return prompt;
  }

  /**
   * Builds the Smile JSON structure example section (shared between create and improve)
   */
  private buildSmileJsonStructureExample(): string {
    let s = `## OUTPUT FORMAT (JSON for direct import)\n\n`;
    s += `**CRITICAL: Return the project(s) with this EXACT structure. Follow all field requirements precisely.**\n\n`;
    
    s += `### Understanding Buckets\n`;
    s += `Buckets organize the project into logical cost categories. Each bucket represents a component of the dream:\n`;
    s += `- For a world tour: "Flights", "Accommodation", "Food & Activities", "Travel Insurance", "Emergency Fund"\n`;
    s += `- For a car: "Down Payment", "Registration & Taxes", "Insurance First Year", "Accessories"\n`;
    s += `- For a wedding: "Venue", "Catering", "Photography", "Attire", "Flowers & Decor"\n\n`;
    s += `Each bucket tracks its own progress (target amount vs. amount saved).\n\n`;

    s += `### Understanding Payment Plans\n`;
    s += `Payment plans define HOW the user will fund their buckets over time. Key concepts:\n\n`;
    s += `**targetBuckets field:**\n`;
    s += `- ["all"] = Payment is split proportionally across ALL buckets based on their remaining balance\n`;
    s += `- ["bucket-1", "bucket-2"] = Payment goes ONLY to these specific buckets\n`;
    s += `- ["bucket-3"] = Payment goes to a single specific bucket\n\n`;
    s += `**Multiple Payment Plans:** You can create multiple plans with different strategies.\n\n`;
    s += `**Payment Plan Requirements:**\n`;
    s += `- amount: Positive number\n`;
    s += `- frequency: EXACTLY ONE OF: "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    s += `- startDate & endDate: YYYY-MM-DD format, endDate after startDate\n`;
    s += `- active: ALWAYS false (user activates after reviewing)\n\n`;

    s += `### Complete JSON Structure\n\n`;
    s += `\`\`\`json\n{\n`;
    s += `  "title": "Short project name (3-5 words)",\n`;
    s += `  "sub": "One-line subtitle",\n`;
    s += `  "description": "Detailed description (2-3 paragraphs)",\n`;
    s += `  "phase": "idea",\n`;
    s += `  "targetDate": "YYYY-MM-DD",\n`;
    s += `  "buckets": [\n`;
    s += `    {\n`;
    s += `      "id": "bucket-1",\n`;
    s += `      "title": "Bucket name",\n`;
    s += `      "target": 1500,\n`;
    s += `      "amount": 0,\n`;
    s += `      "notes": "Explanation: cost breakdown, estimation methodology",\n`;
    s += `      "links": [\n`;
    s += `        { "label": "Clear description", "url": "https://actual-working-url.com" }\n`;
    s += `      ],\n`;
    s += `      "targetDate": "YYYY-MM-DD"\n`;
    s += `    }\n`;
    s += `  ],\n`;
    s += `  "links": [ { "label": "General resource", "url": "https://..." } ],\n`;
    s += `  "actionItems": [\n`;
    s += `    { "text": "Specific actionable task", "done": false, "priority": "high", "dueDate": "YYYY-MM-DD" }\n`;
    s += `  ],\n`;
    s += `  "notes": [\n`;
    s += `    { "text": "Expert tip or context", "createdAt": "YYYY-MM-DDTHH:mm:ssZ" }\n`;
    s += `  ],\n`;
    s += `  "plannedSubscriptions": [\n`;
    s += `    {\n`;
    s += `      "id": "payment-main",\n`;
    s += `      "targetBuckets": ["all"],\n`;
    s += `      "amount": 250,\n`;
    s += `      "frequency": "monthly",\n`;
    s += `      "startDate": "2026-05-01",\n`;
    s += `      "endDate": "2027-08-01",\n`;
    s += `      "description": "Primary savings plan",\n`;
    s += `      "active": false\n`;
    s += `    }\n`;
    s += `  ]\n`;
    s += `}\n\`\`\`\n\n`;
    
    s += `### Field Requirements\n`;
    s += `- **phase**: Keep existing unless asked to change\n`;
    s += `- **bucket.id**: Format "bucket-{name}" — keep existing IDs for locked buckets\n`;
    s += `- **bucket.target**: Positive number, realistic market price\n`;
    s += `- **bucket.amount**: KEEP EXISTING VALUES — this is money already saved\n`;
    s += `- **actionItem.priority**: EXACTLY one of "high", "medium", "low"\n`;
    s += `- **frequency**: EXACTLY one of "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    s += `- **active**: ALWAYS false\n`;
    s += `- **All dates**: YYYY-MM-DD, except note createdAt: YYYY-MM-DDTHH:mm:ssZ\n\n`;

    return s;
  }

  /**
   * Generates a prompt for improving existing Fire emergencies
   */
  generateFireImprovePrompt(existingEmergencies: any[], config: {
    userPlan: string;
    improvementAreas: string[];
    researchDepth: string;
    informationFocus: string[];
    customInstructions: string;
    anonymized: boolean;
  }): string {
    const anon = config.anonymized;
    const lang = this.getCurrentLanguage();
    const multi = existingEmergencies.length > 1;

    let prompt = `# UPDATE EXISTING FIRE EMERGENCY${multi ? ' PLANS' : ' PLAN'}\n\n`;
    prompt += `I want to update and improve ${multi ? 'these' : 'this'} existing Fire Emergency plan${multi ? 's' : ''}.\n\n`;

    // User's plan / intent
    if (config.userPlan) {
      prompt += `## MY PLAN & INTENT\n`;
      prompt += `${config.userPlan}\n\n`;
    }

    // Current state of each emergency
    prompt += `## CURRENT EMERGENCY STATE${multi ? 'S' : ''}\n\n`;
    prompt += `⚠️ REMINDER: You MUST use the EXACT "title" from each emergency below in your output. Changing even one character will cause the update to fail.\n\n`;
    for (const emergency of existingEmergencies) {
      prompt += `### ${emergency.title}\n`;
      prompt += `Phase: ${emergency.phase} | Target Date: ${emergency.targetDate || 'Not set'}\n`;
      const totalTarget = (emergency.buckets || []).reduce((s: number, b: any) => s + (b.target || 0), 0);
      const totalResolved = (emergency.buckets || []).reduce((s: number, b: any) => s + (b.amount || 0), 0);
      prompt += `Total Target: ${this.currency}${totalTarget} | Resolved: ${this.currency}${totalResolved}\n`;
      const lockedBuckets = (emergency.buckets || []).filter((b: any) => (b.amount || 0) > 0);
      if (lockedBuckets.length > 0) {
        prompt += `⚠ LOCKED buckets (have money): ${lockedBuckets.map((b: any) => `"${b.title}" (${this.currency}${b.amount}/${this.currency}${b.target})`).join(', ')}\n`;
      }
      const existingPlans = (emergency.plannedSubscriptions || []);
      if (existingPlans.length > 0) {
        prompt += `⚠ Existing payment plans: ${existingPlans.map((p: any) => `"${p.title}" (${this.currency}${p.amount}/${p.frequency})`).join(', ')}\n`;
      }
      prompt += `\`\`\`json\n${JSON.stringify(emergency, null, 2)}\n\`\`\`\n\n`;
    }

    // Task
    prompt += `## YOUR TASK\n`;
    prompt += `Analyze ${multi ? 'each emergency plan' : 'my emergency plan'} and improve these areas: **${config.improvementAreas.join(', ')}**\n`;
    prompt += `Research depth: ${config.researchDepth}\n`;
    if (config.informationFocus.length > 0) {
      prompt += `Research focus: ${config.informationFocus.join(', ')}\n`;
    }
    prompt += `\n`;

    // Improvement area details
    prompt += `## IMPROVEMENT REQUIREMENTS\n`;
    if (config.improvementAreas.includes('description')) {
      prompt += `**Description & Details:**\n`;
      prompt += `- Expand or refine the emergency description\n`;
      prompt += `- Update subtitle and severity assessment\n`;
      prompt += `- Add resolution strategy overview\n\n`;
    }
    if (config.improvementAreas.includes('budget-realism')) {
      prompt += `**Budget Realism:**\n`;
      prompt += `- Research current costs for repairs/replacements\n`;
      prompt += `- Update bucket targets based on market rates (respect locked constraints!)\n`;
      prompt += `- Add emergency cost buffers (10-20%)\n\n`;
    }
    if (config.improvementAreas.includes('add-buckets')) {
      prompt += `**Add/Revise Buckets:**\n`;
      prompt += `- Identify overlooked cost components\n`;
      prompt += `- Add warranty, insurance, or prevention buckets\n`;
      prompt += `- Add detailed notes to each bucket explaining cost estimates\n\n`;
    }
    if (config.improvementAreas.includes('add-links')) {
      prompt += `**Add Links:**\n`;
      prompt += `- Repair guides / DIY options\n`;
      prompt += `- Price comparison tools\n`;
      prompt += `- Warranty / insurance info\n`;
      prompt += `- Legal/financial aid resources\n\n`;
    }
    if (config.improvementAreas.includes('action-items')) {
      prompt += `**Action Items:**\n`;
      prompt += `- Add immediate actions (stop damage, file claims)\n`;
      prompt += `- Add short-term actions (get quotes, apply for aid)\n`;
      prompt += `- Add long-term prevention actions\n`;
      prompt += `- Preserve existing done=true items\n\n`;
    }
    if (config.improvementAreas.includes('payment-plan')) {
      prompt += `**Payment Plans:**\n`;
      prompt += `- Design or update debt payback schedule\n`;
      prompt += `- Optimize interest payments\n`;
      prompt += `- DO NOT remove existing payment plans (only add or adjust)\n\n`;
    }
    if (config.improvementAreas.includes('timeline')) {
      prompt += `**Timeline:**\n`;
      prompt += `- Assess urgency vs. affordability\n`;
      prompt += `- Suggest phased resolution if needed\n`;
      prompt += `- Flag time-sensitive actions\n\n`;
    }
    if (config.improvementAreas.includes('notes')) {
      prompt += `**Notes & Damage Control:**\n`;
      prompt += `- Add prevention tips for the future\n`;
      prompt += `- Add cost-saving alternatives\n`;
      prompt += `- Add expert advice and warnings\n`;
      prompt += `- Preserve existing notes (append new ones)\n\n`;
    }

    // Custom instructions
    if (config.customInstructions) {
      prompt += `## ADDITIONAL INSTRUCTIONS\n`;
      prompt += `${config.customInstructions}\n\n`;
    }

    // Update constraints
    prompt += `## ⚠ UPDATE CONSTRAINTS (CRITICAL — FOLLOW EXACTLY)\n\n`;
    prompt += `These rules protect existing data. Violating them will cause import failures.\n\n`;
    prompt += `**🔴 EMERGENCY TITLE — NEVER CHANGE:**\n`;
    prompt += `- The "title" field MUST remain EXACTLY as provided — character for character\n`;
    prompt += `- The system matches emergencies by title to apply updates\n`;
    prompt += `- If you change the title, the update WILL FAIL and create a duplicate instead\n`;
    prompt += `- This is the #1 most important rule\n\n`;
    prompt += `**🔴 LOCKED BUCKETS ("amount" > 0 = money already saved):**\n`;
    prompt += `- These buckets contain real money the user has already saved\n`;
    prompt += `- DO NOT rename them — keep the EXACT same "id" AND "title", character for character\n`;
    prompt += `- DO NOT remove them under any circumstances\n`;
    prompt += `- DO NOT reduce their "target" below their current "amount"\n`;
    prompt += `- DO NOT change their "amount" value (this is real saved money)\n`;
    prompt += `- You CAN: add notes, links, adjust target UPWARD, add/update targetDate\n\n`;
    prompt += `**Buckets with "amount" === 0:**\n`;
    prompt += `- Can be freely modified, renamed, or removed\n`;
    prompt += `- New buckets can be added\n\n`;
    prompt += `**Payment Plans (plannedSubscriptions):**\n`;
    prompt += `- DO NOT remove existing payment plans\n`;
    prompt += `- You CAN add new payment plans\n`;
    prompt += `- You CAN adjust amounts, dates, descriptions on existing plans\n`;
    prompt += `- Keep existing plan IDs unchanged\n\n`;
    prompt += `**Preserved Fields:**\n`;
    prompt += `- Keep all bucket "amount" values exactly as-is (this is real saved money)\n`;
    prompt += `- Keep all bucket "id" values for locked buckets\n`;
    prompt += `- Keep "createdAt" timestamps\n`;
    prompt += `- Set "updatedAt" to current date\n`;
    prompt += `- Keep "phase" as-is unless explicitly asked to change\n\n`;

    // Financial context
    prompt += `## MY CURRENT FINANCIAL SITUATION\n`;
    prompt += this.extractFireFinancialContext(anon);
    prompt += `\n\n`;

    // JSON structure example
    prompt += this.buildFireJsonStructureExample();

    // Response format
    prompt += `## YOUR RESPONSE FORMAT\n`;
    prompt += `**CRITICAL**: Structure your response in TWO DISTINCT sections:\n\n`;
    prompt += `**SECTION 1: YOUR REASONING & ANALYSIS (Plain text)**\n`;
    prompt += `- What you found during research\n`;
    prompt += `- What you changed and why\n`;
    prompt += `- Which buckets are locked vs. modified\n`;
    prompt += `- Cost impact analysis\n`;
    prompt += `- Timeline and payback assessment\n\n`;
    prompt += `**SECTION 2: COMPLETE JSON OUTPUT (Code block)**\n`;
    prompt += `- ${multi ? `Return a JSON ARRAY containing ${existingEmergencies.length} complete emergency objects` : 'Return a single JSON object with the complete updated emergency'}\n`;
    prompt += `- ⚠️ TITLES MUST BE IDENTICAL to the originals (copy-paste them, do not retype)\n`;
    prompt += `- ⚠️ Locked bucket titles and IDs must be identical to the originals\n`;
    prompt += `- Start with exactly \`\`\`json on its own line\n`;
    prompt += `- Include ALL fields from the original + your improvements\n`;
    prompt += `- End with exactly \`\`\` on its own line\n`;
    prompt += `- Use proper JSON syntax\n`;
    prompt += `- All text fields in ${lang}\n\n`;

    return prompt;
  }

  /**
   * Builds the Fire JSON structure example section (shared between create and improve)
   */
  private buildFireJsonStructureExample(): string {
    let s = `## OUTPUT FORMAT (JSON for direct import)\n\n`;
    s += `**CRITICAL: Return the emergency plan(s) with this EXACT structure.**\n\n`;
    
    s += `### Understanding Buckets for Emergencies\n`;
    s += `Buckets organize the emergency into logical cost categories:\n`;
    s += `- For appliance: "New Appliance", "Installation", "Disposal", "Extended Warranty"\n`;
    s += `- For medical: "Medical Bills", "Medications", "Follow-up Visits", "Lost Income"\n`;
    s += `- For debt: "Principal Repayment", "Interest", "Buffer for Emergencies"\n\n`;

    s += `### Understanding Payment Plans\n`;
    s += `**targetBuckets field:**\n`;
    s += `- ["all"] = Distributes across ALL buckets proportionally\n`;
    s += `- ["bucket-payback"] = Goes to specific debt bucket\n`;
    s += `- ["bucket-medical", "bucket-followup"] = To multiple specific buckets\n\n`;
    s += `**Payment Plan Requirements:**\n`;
    s += `- amount: Positive number\n`;
    s += `- frequency: EXACTLY ONE OF: "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    s += `- startDate & endDate: YYYY-MM-DD format\n`;
    s += `- active: ALWAYS false\n\n`;

    s += `### Complete JSON Structure\n\n`;
    s += `\`\`\`json\n{\n`;
    s += `  "title": "Short emergency name",\n`;
    s += `  "sub": "One-line description",\n`;
    s += `  "description": "What happened + plan overview (2-3 paragraphs)",\n`;
    s += `  "phase": "idea",\n`;
    s += `  "targetDate": "YYYY-MM-DD",\n`;
    s += `  "buckets": [\n`;
    s += `    {\n`;
    s += `      "id": "bucket-1",\n`;
    s += `      "title": "Bucket name",\n`;
    s += `      "target": 800,\n`;
    s += `      "amount": 0,\n`;
    s += `      "notes": "Cost breakdown, vendor quotes",\n`;
    s += `      "links": [ { "label": "Description", "url": "https://..." } ],\n`;
    s += `      "targetDate": "YYYY-MM-DD"\n`;
    s += `    }\n`;
    s += `  ],\n`;
    s += `  "links": [ { "label": "General resource", "url": "https://..." } ],\n`;
    s += `  "actionItems": [\n`;
    s += `    { "text": "Immediate action required", "done": false, "priority": "high", "dueDate": "YYYY-MM-DD" }\n`;
    s += `  ],\n`;
    s += `  "notes": [\n`;
    s += `    { "text": "Prevention tip or damage control advice", "createdAt": "YYYY-MM-DDTHH:mm:ssZ" }\n`;
    s += `  ],\n`;
    s += `  "plannedSubscriptions": [\n`;
    s += `    {\n`;
    s += `      "id": "payment-debt",\n`;
    s += `      "targetBuckets": ["bucket-1"],\n`;
    s += `      "amount": 150,\n`;
    s += `      "frequency": "monthly",\n`;
    s += `      "startDate": "2026-05-01",\n`;
    s += `      "endDate": "2027-03-01",\n`;
    s += `      "description": "Monthly debt repayment",\n`;
    s += `      "active": false\n`;
    s += `    }\n`;
    s += `  ]\n`;
    s += `}\n\`\`\`\n\n`;
    
    s += `### Field Requirements\n`;
    s += `- **phase**: Keep existing unless asked to change\n`;
    s += `- **bucket.id**: Format "bucket-{name}" — keep existing IDs for locked buckets\n`;
    s += `- **bucket.target**: Realistic cost estimate\n`;
    s += `- **bucket.amount**: KEEP EXISTING VALUES — money already saved/paid\n`;
    s += `- **actionItem.priority**: EXACTLY "high", "medium", or "low"\n`;
    s += `- **frequency**: EXACTLY one of "monthly", "weekly", "biweekly", "quarterly", "yearly", "once"\n`;
    s += `- **active**: ALWAYS false\n`;
    s += `- **All dates**: YYYY-MM-DD, except note createdAt: YYYY-MM-DDTHH:mm:ssZ\n\n`;

    return s;
  }

  /**
   * Gets current UI language
   */
  private getCurrentLanguage(): string {
    const lang = this.translate.currentLang || 'en';
    return PromptGeneratorService.LANG_MAP[lang] || 'English';
  }
}
