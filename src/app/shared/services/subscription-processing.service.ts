import { Injectable } from '@angular/core';
import { AppStateService } from './app-state.service';
import { AppDataService } from './app-data.service';
import { AuthService } from './auth.service';
import { FrontendLoggerService } from './frontend-logger.service';
import { FrequencyCalculatorService } from './frequency-calculator.service';
import { AccountingComponent } from '../../main/accounting/accounting.component';
import { Transaction } from '../../interfaces/transaction';
import { Revenue } from '../../interfaces/revenue';
import { Expense } from '../../interfaces/expense';
import { Subscription, SubscriptionFrequency } from '../../interfaces/subscription';

@Injectable({
  providedIn: 'root'
})
/**
 * Generates transactions from active subscriptions and manages
 * fund allocations (Mojo, Smile projects, Fire emergencies).
 */
export class SubscriptionProcessingService {

  static instance: SubscriptionProcessingService;
  private isProcessing = false;

  constructor(
    private authService: AuthService,
    private frontendLogger: FrontendLoggerService
  ) {
    SubscriptionProcessingService.instance = this;
  }

  /**
   * Checks if a transaction already exists for a given subscription + date.
   * Matches on date, account, amount, category, and the constructed comment.
   */
  private transactionExistsForDate(subscription: any, date: string): boolean {
    const commentCompare = subscription.comment
      ? subscription.title + " + " + subscription.comment
      : subscription.title;

    for (let i = 0; i < AppStateService.instance.allTransactions.length; i++) {
      const t = AppStateService.instance.allTransactions[i];
      if (
        t.date === date &&
        t.account === subscription.account &&
        t.amount === subscription.amount &&
        t.category === subscription.category &&
        t.comment === commentCompare
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculates all occurrence dates for a subscription based on its frequency,
   * from its start date up to the boundary date (end date or today).
   * 
   * @param startDateString - Start date in ISO format (YYYY-MM-DD)
   * @param boundaryDate - End boundary (subscription end date or today)
   * @param frequency - Subscription frequency ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')
   * @returns Array of occurrence dates in ISO format
   */
  private getOccurrenceDates(
    startDateString: string,
    boundaryDate: Date,
    frequency: SubscriptionFrequency = 'monthly'
  ): string[] {
    // Use FrequencyCalculatorService to get appropriate strategy and calculate dates
    return FrequencyCalculatorService.instance.calculateOccurrences(
      frequency,
      startDateString,
      boundaryDate
    );
  }

  async setTransactionsForSubscriptions() {
    // Prevent concurrent runs — if already processing, skip.
    // This avoids duplicate transactions from overlapping calls
    // (e.g. init + visibility change firing close together).
    if (this.isProcessing) {
      return { transactionsCreated: 0, subscriptionsProcessed: 0 };
    }
    this.isProcessing = true;

    let transactionsCreated = 0;
    let subscriptionsProcessed = 0;

    try {
      for (const s in AppStateService.instance.allSubscriptions) {
        const subscription = AppStateService.instance.allSubscriptions[s];
        const startDate = new Date(subscription.startDate);
        const startDateString = subscription.startDate;
        const endDateString = subscription.endDate;
        const endDate = new Date(subscription.endDate);
        const today = new Date();

        if (startDate >= today) {
          continue;
        }

        subscriptionsProcessed++;

        // Determine boundary: use end date if set and in the past, otherwise today
        const boundary = (endDateString !== "" && endDate < today) ? endDate : today;
        
        // Get subscription frequency (default to 'monthly' for backward compatibility)
        const frequency = subscription.frequency || 'monthly';
        const dates = this.getOccurrenceDates(startDateString, boundary, frequency);

        // Process each date SEQUENTIALLY so the duplicate check always sees
        // transactions added by previous iterations in the same run.
        for (const date of dates) {
          if (!this.transactionExistsForDate(subscription, date)) {
            await this.addTransactionSubscription(
              subscription.title,
              subscription.amount,
              subscription.account,
              subscription.category,
              date,
              "",
              subscription.comment
            );
            transactionsCreated++;
          }
        }
      }
      
      return { transactionsCreated, subscriptionsProcessed };
    } finally {
      this.isProcessing = false;
    }
  }

  async addTransactionSubscription(title, amount, selectedOption, category, date, time, comment) {
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      console.error('Authentication failed:', authResult.error);
      return;
    }

    if (amount === "" || selectedOption === "" || category === "" || category === "@") {
      return;
    }

    // Check if target project is already full
    if (category === "@Mojo") {
      if (AppStateService.instance.mojo.amount >= AppStateService.instance.mojo.target) {
        return;
      }
    } else {
      for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
        if ("@" + AppStateService.instance.allSmileProjects[i].title === category) {
          const project = AppStateService.instance.allSmileProjects[i];
          const totalTarget = project.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
          const totalAmount = project.buckets.reduce((sum, b) => sum + (b.amount || 0), 0);
          if (totalAmount >= totalTarget) {
            return;
          }
        }
      }
      // Fire emergency target checking removed - bucket-based system allows flexible allocations
      // Bucket targets are informational; contributions are tracked per transaction
    }

    if (category === "@Mojo") {
      amount = String(this.returnCorrectMojo(amount));
      this.addToMojo(amount);
    }

    amount = String(this.returnCorrectSmileAmount(category, amount));
    this.addToSmileProject(category, amount);

    amount = String(this.returnCorrectFireAmount(amount, category));
    this.addToFireEmergency(category, amount);

    if (selectedOption === "Mojo") {
      this.removeFromMojo(amount);
    }

    if (selectedOption === "Income") {
      this.updateIncomeStatement(category, amount);
    }

    if (selectedOption === "Daily") {
      this.updateExpenseCategory(AppStateService.instance.dailyExpenses, 'dailyExpense', category, amount);
    }
    if (selectedOption === "Splurge") {
      this.updateExpenseCategory(AppStateService.instance.splurgeExpenses, 'splurgeExpense', category, amount);
    }
    if (selectedOption === "Smile") {
      this.updateExpenseCategory(AppStateService.instance.smileExpenses, 'smileExpense', category, amount);
    }
    if (selectedOption === "Fire") {
      this.updateExpenseCategory(AppStateService.instance.fireExpenses, 'fireExpense', category, amount);
    }
    if (selectedOption === "Mojo") {
      this.updateExpenseCategory(AppStateService.instance.mojoExpenses, 'mojoExpense', category, amount);
    }

    let newTransaction: Transaction = { account: selectedOption, amount: parseFloat(amount), date: date, time: time, category: category, comment: comment ? title + " + " + comment : title }
    AppStateService.instance.allTransactions.push(newTransaction);
    AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
    AccountingComponent.dataSource.data = AppStateService.instance.allTransactions;
    AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
      return { ...transaction, id: index };
    });
    AppStateService.instance.transactionsUpdated$.next();

    this.frontendLogger.logActivity('subscription_generated_transaction', 'info', {
      subscriptionTitle: title,
      account: selectedOption,
      amount: parseFloat(amount),
      category: category,
      date: date,
      comment: comment || ''
    });

    AppDataService.instance.updateDatabase();
  }

  private updateIncomeStatement(category: string, amount) {
    let found = false;
    let itemType = '';
    while (!found) {
      for (let i = 0; i < AppStateService.instance.allIntrests.length; i++) {
        if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allIntrests[i].tag.toLocaleLowerCase()) {
          found = true;
          itemType = 'interest';
          AppStateService.instance.allIntrests[i].amount += parseFloat(amount);
          this.frontendLogger.logActivity('update_income_statement_item', 'info', {
            itemType, itemTag: AppStateService.instance.allIntrests[i].tag,
            amount: parseFloat(amount), newTotal: AppStateService.instance.allIntrests[i].amount,
            operation: 'update', source: 'subscription_transaction'
          });
        }
      }
      for (let i = 0; i < AppStateService.instance.allProperties.length; i++) {
        if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allProperties[i].tag.toLocaleLowerCase()) {
          found = true;
          itemType = 'property';
          AppStateService.instance.allProperties[i].amount += parseFloat(amount);
          this.frontendLogger.logActivity('update_income_statement_item', 'info', {
            itemType, itemTag: AppStateService.instance.allProperties[i].tag,
            amount: parseFloat(amount), newTotal: AppStateService.instance.allProperties[i].amount,
            operation: 'update', source: 'subscription_transaction'
          });
        }
      }
      for (let i = 0; i < AppStateService.instance.allRevenues.length; i++) {
        if (category.toLocaleLowerCase() === "@" + AppStateService.instance.allRevenues[i].tag.toLocaleLowerCase()) {
          found = true;
          itemType = 'revenue';
          AppStateService.instance.allRevenues[i].amount += parseFloat(amount);
          this.frontendLogger.logActivity('update_income_statement_item', 'info', {
            itemType, itemTag: AppStateService.instance.allRevenues[i].tag,
            amount: parseFloat(amount), newTotal: AppStateService.instance.allRevenues[i].amount,
            operation: 'update', source: 'subscription_transaction'
          });
        }
      }
      if (!found) {
        let new_revenue: Revenue = { tag: category.replace("@", ""), amount: parseFloat(amount) }
        AppStateService.instance.allRevenues.push(new_revenue);
        found = true;
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType: 'revenue', itemTag: new_revenue.tag,
          amount: parseFloat(amount), newTotal: new_revenue.amount,
          operation: 'create', source: 'subscription_transaction'
        });
      }
    }
  }

  private updateExpenseCategory(expenses: Expense[], itemType: string, category: string, amount) {
    let found = false;
    while (!found) {
      for (let i = 0; i < expenses.length; i++) {
        if (category.toLocaleLowerCase() === "@" + expenses[i].tag.toLocaleLowerCase()) {
          found = true;
          expenses[i].amount += parseFloat(amount);
          this.frontendLogger.logActivity('update_income_statement_item', 'info', {
            itemType, itemTag: expenses[i].tag,
            amount: parseFloat(amount), newTotal: expenses[i].amount,
            operation: 'update', source: 'subscription_transaction'
          });
        }
      }
      if (!found) {
        let new_expense: Expense = { tag: category.replace("@", ""), amount: parseFloat(amount) }
        expenses.push(new_expense);
        found = true;
        this.frontendLogger.logActivity('update_income_statement_item', 'info', {
          itemType, itemTag: new_expense.tag,
          amount: parseFloat(amount), newTotal: new_expense.amount,
          operation: 'create', source: 'subscription_transaction'
        });
      }
    }
  }

  removeFromMojo(amount) {
    AppStateService.instance.mojo.amount += parseFloat(amount);
  }

  addToMojo(amount) {
    AppStateService.instance.mojo.amount -= parseFloat(amount);
    this.frontendLogger.logActivity('update_mojo_from_transaction', 'info', {
      projectType: 'mojo',
      amount: parseFloat(amount),
      newBalance: AppStateService.instance.mojo.amount,
      target: AppStateService.instance.mojo.target
    });
  }

  returnCorrectMojo(amount) {
    let result = parseFloat(amount);
    if (AppStateService.instance.mojo.amount - result > AppStateService.instance.mojo.target) {
      result = AppStateService.instance.mojo.target - AppStateService.instance.mojo.amount;
      return result * -1;
    }
    return result;
  }

  /**
   * Distribute amount across buckets based on their remaining capacity
   * Returns array of allocations: {bucketName, amount}
   */
  distributeAmountToBuckets(buckets: any[], transactionAmount: number): Array<{bucketName: string, amount: number}> {
    // Amount is negative for contributions
    const amountToDistribute = Math.abs(transactionAmount);
    const allocations: Array<{bucketName: string, amount: number}> = [];
    
    // Get buckets with remaining capacity
    const bucketsWithSpace = buckets
      .map(bucket => ({
        bucket,
        remaining: Math.max(0, bucket.target - bucket.amount)
      }))
      .filter(b => b.remaining > 0);
    
    if (bucketsWithSpace.length === 0) {
      // All buckets full - distribute equally anyway
      const perBucket = amountToDistribute / buckets.length;
      buckets.forEach(bucket => {
        allocations.push({
          bucketName: bucket.title,
          amount: perBucket
        });
      });
      return allocations;
    }
    
    // Calculate total remaining capacity
    const totalRemaining = bucketsWithSpace.reduce((sum, b) => sum + b.remaining, 0);
    
    if (amountToDistribute <= totalRemaining) {
      // We can fit the amount - distribute proportionally to remaining capacity
      bucketsWithSpace.forEach(({bucket, remaining}) => {
        const proportion = remaining / totalRemaining;
        const allocated = amountToDistribute * proportion;
        allocations.push({
          bucketName: bucket.title,
          amount: allocated
        });
      });
    } else {
      // Amount exceeds total capacity - fill each bucket to target, distribute overflow equally
      let overflow = amountToDistribute - totalRemaining;
      
      bucketsWithSpace.forEach(({bucket, remaining}) => {
        allocations.push({
          bucketName: bucket.title,
          amount: remaining + (overflow / bucketsWithSpace.length)
        });
      });
    }
    
    return allocations;
  }

  addToSmileProject(category: string, amount) {
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if (category === ("@" + AppStateService.instance.allSmileProjects[i].title)) {
        const project = AppStateService.instance.allSmileProjects[i];
        const amt = parseFloat(amount);
        
        // Find the most recent transaction for this subscription
        const latestTransaction = AppStateService.instance.allTransactions[AppStateService.instance.allTransactions.length - 1];
        
        // Distribute amount based on capacity and append to comment
        if (project.buckets?.length > 0) {
          const allocations = this.distributeAmountToBuckets(project.buckets, amt);
          
          // Update bucket amounts
          allocations.forEach(allocation => {
            const bucket = project.buckets.find(b => b.title === allocation.bucketName);
            if (bucket) {
              bucket.amount += allocation.amount;
            }
          });
          
          // Append allocation tags to comment
          if (latestTransaction) {
            const allocationTags = allocations
              .map(a => `#bucket:${a.bucketName}:${a.amount.toFixed(2)}`)
              .join(' ');
            
            latestTransaction.comment = latestTransaction.comment
              ? `${latestTransaction.comment}\n${allocationTags}`
              : allocationTags;
          }
        }
        
        this.frontendLogger.logActivity('update_smile_project_from_transaction', 'info', {
          projectType: 'smile',
          projectTitle: project.title,
          amount: amt,
          category: category
        });
      }
    }
  }

  addToFireEmergency(category: string, amount) {
    // Fire emergency amounts are recalculated automatically by incomeStatement.recalculate()
    // No manual updates needed - bucket amounts are computed from transactions
  }

  returnCorrectSmileAmount(category, amount) {
    let result = parseFloat(amount);
    for (let i = 0; i < AppStateService.instance.allSmileProjects.length; i++) {
      if ("@" + AppStateService.instance.allSmileProjects[i].title === category) {
        const project = AppStateService.instance.allSmileProjects[i];
        const totalTarget = project.buckets.reduce((sum, b) => sum + (b.target || 0), 0);
        const totalAmount = project.buckets.reduce((sum, b) => sum + (b.amount || 0), 0);
        if (totalAmount - result > totalTarget) {
          result = totalTarget - totalAmount;
          return result * -1;
        }
      }
      return result;
    }
    return result;
  }

  returnCorrectFireAmount(amount, category) {
    // Fire no longer has target capping - bucket-based system allows flexible allocations
    // Return the entered amount as-is; bucket targets are informational only
    return parseFloat(amount);
  }
}
