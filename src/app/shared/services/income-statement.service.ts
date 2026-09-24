import { Injectable } from '@angular/core';
import { LocalService } from './local.service';
import { IncomeComponent } from '../../main/cashflow/income/income.component';
import { BalanceComponent } from '../../main/cashflow/balance/balance.component';
import { SmileProjectsComponent } from '../../main/smile/smile-projects/smile-projects.component';
import { FireEmergenciesComponent } from '../../main/fire/fire-emergencies/fire-emergencies.component';
import { FireComponent } from '../../main/fire/fire.component';
import { Revenue } from '../../interfaces/revenue';
import { Expense } from '../../interfaces/expense';
import { AppStateService } from './app-state.service';
import { fromMinorUnits, FundProject, recalculateFundState, toMinorUnits } from '@money/domain';

@Injectable({
  providedIn: 'root',
})
/**
 * Recalculates the income statement, balance sheet, and fund allocations
 * from the full transaction list. Also provides persistence helpers
 * for writing income data to the database and local storage.
 */
export class IncomeStatementService {
  constructor(private localStorage: LocalService) {}

  /**
   * Clears all income/expense/project amounts and rebuilds the full income statement
   * from {@link AppStateService.instance.allTransactions}.
   *
   * Resets revenues, interests, properties, and per-account expense arrays to empty,
   * zeroes Smile/Fire/Mojo project amounts, then iterates every transaction to:
   * - Rebuild Smile/Fire buckets (incl. settlements) and Mojo with the shared fund engine (see recalculateFunds)
   * - Classify income into revenues, interests, or properties (auto-creating entries for shares/investments)
   * - Bucket expenses by account (Daily, Splurge, Smile, Fire, Mojo) and category
   */
  recalculate() {
    // Clear all income statement values
    AppStateService.instance.allRevenues = [];
    AppStateService.instance.allIntrests = [];
    AppStateService.instance.allProperties = [];
    AppStateService.instance.dailyExpenses = [];
    AppStateService.instance.splurgeExpenses = [];
    AppStateService.instance.smileExpenses = [];
    AppStateService.instance.fireExpenses = [];
    AppStateService.instance.mojoExpenses = [];

    // Smile/Fire buckets, their settlement, Mojo — and any capping of the
    // transactions that feed them — come from the shared fund engine first,
    // so the income statement below sees the same (capped) amounts.
    this.recalculateFunds();

    // Rebuild from remaining transactions
    AppStateService.instance.allTransactions.forEach((transaction) => {
      const { amount, account, category } = transaction;
      if (amount != 0) {
        const amountStr = String(amount);

        // Calculating Revenue
        if (account === 'Income') {
          let found = false;
          while (!found) {
            for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
              if (
                category.toLocaleLowerCase() ===
                '@' + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase()
              ) {
                found = true;
                AppStateService.instance.allIntrests[i].amount += parseFloat(amountStr);
              }
            }
            if (!found) {
              for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
                if (
                  category.toLocaleLowerCase() ===
                  '@' + AppStateService.instance.allShares[i].tag.toLocaleLowerCase()
                ) {
                  found = true;
                  const new_interest: Revenue = {
                    tag: category.replace('@', ''),
                    amount: parseFloat(amountStr),
                  };
                  AppStateService.instance.allIntrests.push(new_interest);
                }
              }
            }
            for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
              if (
                category.toLocaleLowerCase() ===
                '@' + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase()
              ) {
                found = true;
                AppStateService.instance.allProperties[i].amount += parseFloat(amountStr);
              }
            }
            if (!found) {
              for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
                if (
                  category.toLocaleLowerCase() ===
                  '@' + AppStateService.instance.allInvestments[i].tag.toLocaleLowerCase()
                ) {
                  found = true;
                  const new_property: Revenue = {
                    tag: category.replace('@', ''),
                    amount: parseFloat(amountStr),
                  };
                  AppStateService.instance.allProperties.push(new_property);
                }
              }
            }
            for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
              if (
                category.toLocaleLowerCase() ===
                '@' + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase()
              ) {
                found = true;
                AppStateService.instance.allRevenues[i].amount += parseFloat(amountStr);
              }
            }
            if (!found) {
              const new_revenue: Revenue = {
                tag: category.replace('@', ''),
                amount: parseFloat(amountStr),
              };
              AppStateService.instance.allRevenues.push(new_revenue);
              found = true;
            }
          }
        }

        // Calculating account expenses
        const expenseMap: Record<string, Expense[]> = {
          Daily: AppStateService.instance.dailyExpenses,
          Splurge: AppStateService.instance.splurgeExpenses,
          Smile: AppStateService.instance.smileExpenses,
          Fire: AppStateService.instance.fireExpenses,
          Mojo: AppStateService.instance.mojoExpenses,
        };
        const expenseArray = expenseMap[account];
        if (expenseArray) {
          let found = false;
          for (let i = 0; i < expenseArray.length; i++) {
            if (category.toLocaleLowerCase() === '@' + expenseArray[i].tag.toLocaleLowerCase()) {
              found = true;
              expenseArray[i].amount += parseFloat(amountStr);
            }
          }
          if (!found) {
            expenseArray.push({ tag: category.replace('@', ''), amount: parseFloat(amountStr) });
          }
        }
      }
    });
  }

  /**
   * Rebuilds every Smile/Fire bucket amount, bucket settlement, Fire
   * auto-completion and the Mojo balance from all transactions, using the
   * domain package's fund engine — the exact rules the self-hosted backend
   * applies on every write (`recalculateFundState`), instead of the app's
   * former separate copy of them (PLAN.md D-9). That includes capping a
   * contribution at the room left (rewriting the transaction's amount and
   * `#bucket:` tags, as before) and `#settle:` settlements.
   *
   * The app works in decimal floats; the engine in integer minor units —
   * converted at this boundary only (docs/adr/0002).
   */
  private recalculateFunds(): void {
    const state = AppStateService.instance;
    const toFundProjects = (projects: any[]): FundProject[] =>
      projects.map((project) => ({
        title: project.title,
        phase: project.phase,
        completionDate: project.completionDate,
        buckets: (project.buckets || []).map((bucket: any) => ({
          id: bucket.id,
          title: bucket.title,
          targetMinor: toMinorUnits(Number(bucket.target) || 0),
          amountMinor: 0,
        })),
      }));
    const transactions = state.allTransactions.map((transaction, index) => ({
      id: String(index),
      account: transaction.account,
      amountMinor: toMinorUnits(Number(transaction.amount) || 0),
      currency: '',
      date: transaction.date,
      time: transaction.time || '',
      category: transaction.category,
      comment: transaction.comment || '',
    }));

    const result = recalculateFundState(transactions, {
      mojo: { amountMinor: 0, targetMinor: toMinorUnits(Number(state.mojo.target) || 0) },
      smile: toFundProjects(state.allSmileProjects),
      fire: toFundProjects(state.allFireEmergencies),
    });

    const applyProjects = (projects: any[], rebuilt: FundProject[]) =>
      projects.forEach((project, index) => {
        const next = rebuilt[index];
        (project.buckets || []).forEach((bucket: any, bucketIndex: number) => {
          const rebuiltBucket = next.buckets[bucketIndex];
          bucket.amount = fromMinorUnits(rebuiltBucket.amountMinor);
          if (rebuiltBucket.settledMinor !== undefined) {
            bucket.settledAmount = fromMinorUnits(rebuiltBucket.settledMinor);
            bucket.settledDate = rebuiltBucket.settledDate;
          } else {
            delete bucket.settledAmount;
            delete bucket.settledDate;
          }
        });
        if (next.phase === 'completed' && project.phase !== 'completed') {
          project.phase = 'completed';
          project.completionDate = next.completionDate;
        }
      });
    applyProjects(state.allSmileProjects, result.smile);
    applyProjects(state.allFireEmergencies, result.fire);
    state.mojo.amount = fromMinorUnits(result.mojo.amountMinor);

    // Capping/settlement rewrites (the engine drops zero-amount transactions
    // from its output; those are left exactly as they are here).
    const effective = new Map(
      result.transactions.map((transaction) => [transaction.id, transaction]),
    );
    state.allTransactions.forEach((transaction, index) => {
      const rebuilt = effective.get(String(index));
      if (!rebuilt) return;
      const amount = fromMinorUnits(rebuilt.amountMinor);
      if (amount !== Number(transaction.amount)) transaction.amount = amount;
      if (rebuilt.comment !== (transaction.comment || '')) transaction.comment = rebuilt.comment;
    });
  }

  /**
   * Returns the income statement write operations for database persistence.
   */
  getWrites(): { tag: string; data: any }[] {
    return [
      { tag: 'income/revenue/interests', data: AppStateService.instance.allIntrests },
      { tag: 'income/revenue/properties', data: AppStateService.instance.allProperties },
      { tag: 'income/revenue/revenues', data: AppStateService.instance.allRevenues },
      { tag: 'income/expenses/daily', data: AppStateService.instance.dailyExpenses },
      { tag: 'income/expenses/splurge', data: AppStateService.instance.splurgeExpenses },
      // Only include tier2 data (smile/fire/mojo) if tier2 has been loaded.
      // Writing before load would overwrite real DB data with empty defaults.
      ...(AppStateService.instance.tier2Loaded
        ? [
            { tag: 'income/expenses/smile', data: AppStateService.instance.smileExpenses },
            { tag: 'income/expenses/fire', data: AppStateService.instance.fireExpenses },
            { tag: 'income/expenses/mojo', data: AppStateService.instance.mojoExpenses },
            { tag: 'smile', data: AppStateService.instance.allSmileProjects },
            { tag: 'fire', data: AppStateService.instance.allFireEmergencies },
            { tag: 'mojo', data: AppStateService.instance.mojo },
          ]
        : []),
    ];
  }

  /**
   * Saves all income statement data to localStorage.
   */
  saveToLocalStorage() {
    this.localStorage.saveData('interests', JSON.stringify(AppStateService.instance.allIntrests));
    this.localStorage.saveData(
      'properties',
      JSON.stringify(AppStateService.instance.allProperties),
    );
    this.localStorage.saveData('revenues', JSON.stringify(AppStateService.instance.allRevenues));
    this.localStorage.saveData('dailyEx', JSON.stringify(AppStateService.instance.dailyExpenses));
    this.localStorage.saveData(
      'splurgeEx',
      JSON.stringify(AppStateService.instance.splurgeExpenses),
    );
    this.localStorage.saveData('smileEx', JSON.stringify(AppStateService.instance.smileExpenses));
    this.localStorage.saveData('fireEx', JSON.stringify(AppStateService.instance.fireExpenses));
    this.localStorage.saveData('mojoEx', JSON.stringify(AppStateService.instance.mojoExpenses));
    this.localStorage.saveData('smile', JSON.stringify(AppStateService.instance.allSmileProjects));
    this.localStorage.saveData('fire', JSON.stringify(AppStateService.instance.allFireEmergencies));
    this.localStorage.saveData('mojo', JSON.stringify(AppStateService.instance.mojo));
  }

  /**
   * Calculates total target across all buckets for a Fire emergency fund
   */
  getTotalFireTarget(fire: any): number {
    return fire.buckets?.reduce((sum: number, bucket: any) => sum + (bucket.target || 0), 0) || 0;
  }

  /**
   * Calculates total saved amount across all buckets for a Fire emergency fund
   */
  getTotalFireAmount(fire: any): number {
    return fire.buckets?.reduce((sum: number, bucket: any) => sum + (bucket.amount || 0), 0) || 0;
  }

  /**
   * Calculates completion percentage for a Fire emergency fund
   */
  getFireProgress(fire: any): number {
    const target = this.getTotalFireTarget(fire);
    const amount = this.getTotalFireAmount(fire);
    return target > 0 ? (amount / target) * 100 : 0;
  }

  /**
   * Helper method to add or update an expense entry in the array
   */
  private addOrUpdateExpense(expenseArray: Expense[], category: string, amount: number): void {
    const existing = expenseArray.find(
      (e) => e.tag.toLowerCase() === category.replace('@', '').toLowerCase(),
    );
    if (existing) {
      existing.amount += amount;
    } else {
      expenseArray.push({ tag: category.replace('@', ''), amount });
    }
  }

  /**
   * Calculate total target across all buckets in a Fire emergency
   */
  static getTotalFireTarget(fire: any): number {
    if (!fire.buckets || fire.buckets.length === 0) return 0;
    return fire.buckets.reduce((sum: number, bucket: any) => sum + (bucket.target || 0), 0);
  }

  /**
   * Calculate total current amount across all buckets in a Fire emergency
   */
  static getTotalFireAmount(fire: any): number {
    if (!fire.buckets || fire.buckets.length === 0) return 0;
    return fire.buckets.reduce((sum: number, bucket: any) => sum + (bucket.amount || 0), 0);
  }
}
