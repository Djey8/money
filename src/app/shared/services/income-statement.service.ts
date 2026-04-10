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

@Injectable({
  providedIn: 'root'
})
/**
 * Recalculates the income statement, balance sheet, and fund allocations
 * from the full transaction list. Also provides persistence helpers
 * for writing income data to the database and local storage.
 */
export class IncomeStatementService {

  constructor(private localStorage: LocalService) {}

  /**
   * Parse bucket allocation tags from transaction comment.
   * Returns array of {bucket, amount} for allocations found in comment.
   * Format: #bucket:BucketName:Amount
   */
  private parseTransactionBucketAllocations(transaction: any, project: any): Array<{bucket: any, amount: number}> {
    if (!transaction.comment || !project.buckets) return [];
    
    const bucketTagMatches = transaction.comment.match(/#bucket:([^:]+):([\d.]+)/g);
    if (!bucketTagMatches) return [];
    
    const allocations: Array<{bucket: any, amount: number}> = [];
    bucketTagMatches.forEach((tag: string) => {
      const match = tag.match(/#bucket:([^:]+):([\d.]+)/);
      if (match) {
        const bucketName = match[1];
        const amount = parseFloat(match[2]);
        const bucket = project.buckets.find((b: any) => b.title === bucketName);
        if (bucket) {
          allocations.push({ bucket, amount });
        }
      }
    });
    
    return allocations;
  }

  /**
   * Clears all income/expense/project amounts and rebuilds the full income statement
   * from {@link AppStateService.instance.allTransactions}.
   *
   * Resets revenues, interests, properties, and per-account expense arrays to empty,
   * zeroes Smile/Fire/Mojo project amounts, then iterates every transaction to:
   * - Accumulate fund project contributions (Mojo, Smile, Fire) up to their targets
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

    // Reset project amounts - reset all bucket amounts to 0
    AppStateService.instance.allSmileProjects.forEach(project => 
      project.buckets?.forEach(bucket => bucket.amount = 0)
    );
    AppStateService.instance.allFireEmergencies.forEach(emergency => 
      emergency.buckets?.forEach(bucket => bucket.amount = 0)
    );
    AppStateService.instance.mojo.amount = 0;

    // Rebuild from remaining transactions
    AppStateService.instance.allTransactions.forEach(transaction => {
      const { amount, account, category } = transaction;
      if (amount != 0) {
        let amountStr = String(amount);

        // Handle @Mojo
        if (category === "@Mojo") {
          if (AppStateService.instance.mojo.amount >= AppStateService.instance.mojo.target) {
            console.warn("Mojo full, skipping transaction:", category, amountStr);
          } else {
            let result = parseFloat(amountStr);
            if (AppStateService.instance.mojo.amount - result > AppStateService.instance.mojo.target) {
              result = AppStateService.instance.mojo.target - AppStateService.instance.mojo.amount;
              result = result * -1;
            }
            AppStateService.instance.mojo.amount -= result;
          }
        }

        // Handle Smile projects - use bucket allocations from comment tags
        if (category !== "@Mojo") {
          for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
            if ("@" + AppStateService.instance.allSmileProjects[i].title === category) {
              const project = AppStateService.instance.allSmileProjects[i];
              
              // Parse bucket allocation tags from comment: #bucket:BucketName:Amount
              const bucketAllocations = this.parseTransactionBucketAllocations(transaction, project);
              
              if (bucketAllocations.length > 0) {
                // Use stored allocations from comment tags (amounts are positive, so add them)
                // BUT cap each bucket at its target to prevent overflow
                const actualAllocations: Array<{bucketName: string, requestedAmount: number, appliedAmount: number}> = [];
                
                bucketAllocations.forEach(allocation => {
                  if (allocation.bucket) {
                    // Calculate remaining capacity in the bucket
                    const remaining = Math.max(0, allocation.bucket.target - allocation.bucket.amount);
                    // Cap the allocation amount at the remaining capacity
                    const cappedAmount = Math.min(allocation.amount, remaining);
                    
                    actualAllocations.push({
                      bucketName: allocation.bucket.title,
                      requestedAmount: allocation.amount,
                      appliedAmount: cappedAmount
                    });
                    
                    if (cappedAmount > 0) {
                      allocation.bucket.amount = Math.round((allocation.bucket.amount + cappedAmount) * 100) / 100;
                    }
                    
                    // Log if we had to cap the amount
                    if (cappedAmount < allocation.amount) {
                      console.warn(
                        `Bucket '${allocation.bucket.title}' in project '${project.title}' capped at target. ` +
                        `Requested: ${allocation.amount}, Applied: ${cappedAmount}, Overflow: ${allocation.amount - cappedAmount}`
                      );
                    }
                  }
                });
                
                // Update transaction comment to reflect actual applied amounts
                const needsCommentUpdate = actualAllocations.some(a => a.appliedAmount !== a.requestedAmount);
                if (needsCommentUpdate && transaction.comment) {
                  // Remove old bucket tags
                  let cleanComment = transaction.comment;
                  const oldTags = transaction.comment.match(/#bucket:([^:]+):([\d.]+)/g);
                  if (oldTags) {
                    oldTags.forEach((tag: string) => {
                      cleanComment = cleanComment.replace(tag, '').trim();
                    });
                  }
                  
                  // Add new tags with actual applied amounts
                  const newTags = actualAllocations
                    .filter(a => a.appliedAmount > 0)
                    .map(a => `#bucket:${a.bucketName}:${a.appliedAmount.toFixed(2)}`)
                    .join(' ');
                  
                  transaction.comment = cleanComment
                    ? `${cleanComment}\n${newTags}`
                    : newTags;
                  
                  // Also adjust transaction amount to match total applied
                  const totalApplied = actualAllocations.reduce((sum, a) => sum + a.appliedAmount, 0);
                  transaction.amount = transaction.amount < 0 ? -totalApplied : totalApplied;
                }
              } else {
                // Fallback for old transactions without allocation tags: distribute equally
                let result = parseFloat(amountStr);
                const totalTarget = project.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
                const totalAmount = project.buckets.reduce((sum, b) => sum + (b.amount || 0), 0);
                
                if (totalAmount >= totalTarget) {
                  console.warn("Smile project '" + project.title + "' full, skipping transaction:", category, amountStr);
                } else {
                  if (totalAmount - result > totalTarget) {
                    result = totalTarget - totalAmount;
                    result = result * -1;
                  }
                  // Distribute result equally across all buckets
                  if (project.buckets?.length > 0) {
                    const amountPerBucket = result / project.buckets.length;
                    project.buckets.forEach(bucket => { 
                      bucket.amount = Math.round((bucket.amount - amountPerBucket) * 100) / 100;
                    });
                  }
                }
              }
            }
          }
        }

        // Handle Fire emergencies
        if (category !== "@Mojo") {
          let result = parseFloat(amountStr);
          for (let i = 0; i < AppStateService.instance.allFireEmergencies.length; i++) {
            const emergency = AppStateService.instance.allFireEmergencies[i];
            
            // Check if transaction matches emergency title or any bucket
            let matchedBucket = null;
            
            // First check for exact bucket match
            for (let b = 0; b < emergency.buckets.length; b++) {
              if ("@" + emergency.buckets[b].title === category) {
                matchedBucket = emergency.buckets[b];
                break;
              }
            }
            
            // If no bucket match, check emergency title (backwards compatibility)
            if (!matchedBucket && "@" + emergency.title === category) {
              // Use first bucket as default
              matchedBucket = emergency.buckets[0];
            }
            
            if (matchedBucket) {
              // Check if bucket has explicit allocation in comment
              const allocations = this.parseTransactionBucketAllocations(transaction, emergency);
              
              if (allocations.length > 0) {
                // Distribute to specified buckets
                allocations.forEach(({ bucket, amount }) => {
                  const bucketRemaining = bucket.target - bucket.amount;
                  const contribution = Math.min(Math.abs(amount), bucketRemaining);
                  bucket.amount = Math.round((bucket.amount + contribution) * 100) / 100;
                  this.addOrUpdateExpense(AppStateService.instance.fireExpenses, "@" + bucket.title, contribution);
                });
              } else {
                // Allocate to matched bucket
                const bucketRemaining = matchedBucket.target - matchedBucket.amount;
                
                if (bucketRemaining <= 0) {
                  console.warn(`Fire bucket '${matchedBucket.title}' in '${emergency.title}' is full, skipping transaction:`, category, amountStr);
                } else {
                  // Cap contribution to remaining bucket target
                  const contribution = Math.min(Math.abs(result), bucketRemaining);
                  matchedBucket.amount = Math.round((matchedBucket.amount + contribution) * 100) / 100;
                  this.addOrUpdateExpense(AppStateService.instance.fireExpenses, "@" + matchedBucket.title, contribution);
                }
              }
              
              // Check if all buckets are now full and auto-complete
              const allBucketsFull = emergency.buckets.every((b: any) => b.amount >= b.target);
              if (allBucketsFull && emergency.phase !== 'completed') {
                // Set phase to completed and use transaction date as completion date
                emergency.phase = 'completed';
                if (!emergency.completionDate) {
                  emergency.completionDate = transaction.date;
                }
              }
              
              break;
            }
          }
        }

        // Spending FROM Mojo account
        if (account === "Mojo") {
          AppStateService.instance.mojo.amount += parseFloat(amountStr);
        }

        // Calculating Revenue
        if (account === "Income") {
          let found = false;
          while (!found) {
            for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
              if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase()) {
                found = true;
                AppStateService.instance.allIntrests[i].amount += parseFloat(amountStr);
              }
            }
            if (!found) {
              for (let i = 0; i < AppStateService.instance.allShares.length; i++) {
                if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allShares[i].tag.toLocaleLowerCase()) {
                  found = true;
                  let new_interest: Revenue = { tag: category.replace("@", ""), amount: parseFloat(amountStr) };
                  AppStateService.instance.allIntrests.push(new_interest);
                }
              }
            }
            for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
              if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase()) {
                found = true;
                AppStateService.instance.allProperties[i].amount += parseFloat(amountStr);
              }
            }
            if (!found) {
              for (let i = 0; i < AppStateService.instance.allInvestments.length; i++) {
                if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allInvestments[i].tag.toLocaleLowerCase()) {
                  found = true;
                  let new_property: Revenue = { tag: category.replace("@", ""), amount: parseFloat(amountStr) };
                  AppStateService.instance.allProperties.push(new_property);
                }
              }
            }
            for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
              if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase()) {
                found = true;
                AppStateService.instance.allRevenues[i].amount += parseFloat(amountStr);
              }
            }
            if (!found) {
              let new_revenue: Revenue = { tag: category.replace("@", ""), amount: parseFloat(amountStr) };
              AppStateService.instance.allRevenues.push(new_revenue);
              found = true;
            }
          }
        }

        // Calculating account expenses
        const expenseMap: { [key: string]: Expense[] } = {
          "Daily": AppStateService.instance.dailyExpenses,
          "Splurge": AppStateService.instance.splurgeExpenses,
          "Smile": AppStateService.instance.smileExpenses,
          "Fire": AppStateService.instance.fireExpenses,
          "Mojo": AppStateService.instance.mojoExpenses
        };
        const expenseArray = expenseMap[account];
        if (expenseArray) {
          let found = false;
          for (let i = 0; i < expenseArray.length; i++) {
            if (category.toLocaleLowerCase() === "@" + expenseArray[i].tag.toLocaleLowerCase()) {
              found = true;
              expenseArray[i].amount += parseFloat(amountStr);
            }
          }
          if (!found) {
            expenseArray.push({ tag: category.replace("@", ""), amount: parseFloat(amountStr) });
          }
        }
      }
    });
  }

  /**
   * Returns the income statement write operations for database persistence.
   */
  getWrites(): { tag: string, data: any }[] {
    return [
      { tag: "income/revenue/interests", data: AppStateService.instance.allIntrests },
      { tag: "income/revenue/properties", data: AppStateService.instance.allProperties },
      { tag: "income/revenue/revenues", data: AppStateService.instance.allRevenues },
      { tag: "income/expenses/daily", data: AppStateService.instance.dailyExpenses },
      { tag: "income/expenses/splurge", data: AppStateService.instance.splurgeExpenses },
      { tag: "income/expenses/smile", data: AppStateService.instance.smileExpenses },
      { tag: "income/expenses/fire", data: AppStateService.instance.fireExpenses },
      { tag: "income/expenses/mojo", data: AppStateService.instance.mojoExpenses },
      { tag: "smile", data: AppStateService.instance.allSmileProjects },
      { tag: "fire", data: AppStateService.instance.allFireEmergencies },
      { tag: "mojo", data: AppStateService.instance.mojo }
    ];
  }

  /**
   * Saves all income statement data to localStorage.
   */
  saveToLocalStorage() {
    this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests));
    this.localStorage.saveData("properties", JSON.stringify(AppStateService.instance.allProperties));
    this.localStorage.saveData("revenues", JSON.stringify(AppStateService.instance.allRevenues));
    this.localStorage.saveData("dailyEx", JSON.stringify(AppStateService.instance.dailyExpenses));
    this.localStorage.saveData("splurgeEx", JSON.stringify(AppStateService.instance.splurgeExpenses));
    this.localStorage.saveData("smileEx", JSON.stringify(AppStateService.instance.smileExpenses));
    this.localStorage.saveData("fireEx", JSON.stringify(AppStateService.instance.fireExpenses));
    this.localStorage.saveData("mojoEx", JSON.stringify(AppStateService.instance.mojoExpenses));
    this.localStorage.saveData("smile", JSON.stringify(AppStateService.instance.allSmileProjects));
    this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies));
    this.localStorage.saveData("mojo", JSON.stringify(AppStateService.instance.mojo));
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
    const existing = expenseArray.find(e => e.tag.toLowerCase() === category.replace("@", "").toLowerCase());
    if (existing) {
      existing.amount += amount;
    } else {
      expenseArray.push({ tag: category.replace("@", ""), amount });
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
