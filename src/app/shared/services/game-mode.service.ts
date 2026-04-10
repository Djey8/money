import { Injectable } from '@angular/core';
import { ProfileComponent } from '../../panels/profile/profile.component';
import { AppStateService } from './app-state.service';
import { AppDataService } from './app-data.service';
import { AccountingComponent } from '../../main/accounting/accounting.component';
import { HomeComponent } from '../../main/home/home.component';
import { StatsComponent } from '../../stats/stats.component';
import { FrontendLoggerService } from './frontend-logger.service';
import { SubscriptionProcessingService } from './subscription-processing.service';

@Injectable({
  providedIn: 'root'
})
/**
 * Manages the cashflow game mode — detected by a special email pattern.
 * Provides month-shifting operations that move all transactions forward/backward
 * and add/remove subscription-generated transactions accordingly.
 */
export class GameModeService {

  static instance: GameModeService;

  constructor(private frontendLogger: FrontendLoggerService) {
    GameModeService.instance = this;
  }

  static isCashflowGame(): boolean {
    let isGame = false;
    if (ProfileComponent.mail && ProfileComponent.mail.includes('cashflow')) {
      isGame = true;
    }
    return isGame;
  }

  moveTransactionsOneMonthBackAndAddCurrentSubscriptions() {
    AppStateService.instance.allTransactions.forEach((t) => {
      if (t.date) {
        const [year, month, day] = t.date.split('-').map(Number);
        let newYear = year;
        let newMonth = month - 1;
        if (newMonth < 1) {
          newMonth = 12;
          newYear -= 1;
        }
        const maxDays = new Date(newYear, newMonth, 0).getDate();
        const newDay = Math.min(day, maxDays);
        t.date = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
      }
    });

    const today = new Date();
    const subscriptionProcessing = SubscriptionProcessingService.instance;
    AppStateService.instance.allSubscriptions.forEach((subscription) => {
      if (!subscription.endDate || subscription.endDate === "") {
        const startDate = new Date(subscription.startDate);
        const year = startDate.getFullYear();
        const day = startDate.getDate();
        const currentMonth = today.getMonth() + 1;
        const maxDays = new Date(today.getFullYear(), currentMonth, 0).getDate();
        const adjustedDay = Math.min(day, maxDays);
        const currentDateString = `${year}-${String(currentMonth).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;

        subscriptionProcessing.addTransactionSubscription(
          subscription.title,
          subscription.amount,
          subscription.account,
          subscription.category,
          currentDateString,
          "",
          subscription.comment
        );
      }
    });

    AppDataService.instance.updateDatabase();
    setTimeout(() => {
      HomeComponent.getAmounts();
      StatsComponent.refreshCharts();
    }, 100);
  }

  moveTransactionsOneMonthForwardAndRemoveCurrentSubscriptions() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    AppStateService.instance.allSubscriptions.forEach((subscription) => {
      const startDate = new Date(subscription.startDate);
      const day = startDate.getDate();
      const maxDays = new Date(currentYear, currentMonth, 0).getDate();
      const adjustedDay = Math.min(day, maxDays);
      const currentDateString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
      const commentCompare = subscription.comment ? subscription.title + " + " + subscription.comment : subscription.title;

      const beforeCount = AppStateService.instance.allTransactions.length;
      AppStateService.instance.allTransactions = AppStateService.instance.allTransactions.filter(t =>
        !(
          t.date === currentDateString &&
          t.account === subscription.account &&
          t.amount === subscription.amount &&
          t.category === subscription.category &&
          t.comment === commentCompare
        )
      );
      const afterCount = AppStateService.instance.allTransactions.length;
      if (beforeCount !== afterCount) {
        this.frontendLogger.logActivity('mass_delete_transactions', 'info', {
          subscriptionTitle: subscription.title,
          account: subscription.account,
          category: subscription.category,
          amount: subscription.amount,
          transactionsDeleted: beforeCount - afterCount,
          dateRemoved: currentDateString,
          reason: 'month_rollover'
        });
      }
    });

    AppStateService.instance.allTransactions.forEach((t) => {
      if (t.date) {
        const [year, month, day] = t.date.split('-').map(Number);
        let newYear = year;
        let newMonth = month + 1;
        if (newMonth > 12) {
          newMonth = 1;
          newYear += 1;
        }
        const maxDays = new Date(newYear, newMonth, 0).getDate();
        const newDay = Math.min(day, maxDays);
        t.date = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
      }
    });

    AppDataService.instance.updateDatabase();
    AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
    AccountingComponent.dataSource.data = AppStateService.instance.allTransactions;
    AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
      return { ...transaction, id: index };
    });
    AppStateService.instance.transactionsUpdated$.next();
    setTimeout(() => {
      HomeComponent.getAmounts();
      StatsComponent.refreshCharts();
    }, 100);
  }
}
