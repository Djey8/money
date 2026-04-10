import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Transaction } from '../../interfaces/transaction';
import { Subscription } from '../../interfaces/subscription';
import { Revenue } from '../../interfaces/revenue';
import { Interest } from '../../interfaces/interest';
import { Property } from '../../interfaces/property';
import { Expense } from '../../interfaces/expense';
import { Asset } from '../../interfaces/asset';
import { Share } from '../../interfaces/share';
import { Investment } from '../../interfaces/investment';
import { Liability } from '../../interfaces/liability';
import { Budget } from '../../interfaces/budget';
import { Grow } from '../../interfaces/grow';
import { Smile } from '../../interfaces/smile';
import { Fire } from '../../interfaces/fire';
import { Mojo } from '../../interfaces/mojo';

@Injectable({ providedIn: 'root' })
/**
 * Centralized application state holding all shared data collections.
 * Uses an eager static instance (`AppStateService.instance`) for
 * backward-compatible static access across all components.
 */
export class AppStateService {
  private static _instance: AppStateService;
  static get instance(): AppStateService {
    if (!AppStateService._instance) {
      AppStateService._instance = new AppStateService();
    }
    return AppStateService._instance;
  }
  static set instance(v: AppStateService) {
    AppStateService._instance = v;
  }

  // Signals
  transactionsUpdated$ = new Subject<void>();

  // Phase A: Transaction data
  allTransactions: Transaction[] = [];
  allSubscriptions: Subscription[] = [];

  // Phase B: Income statement data
  allRevenues: Revenue[] = [];
  allIntrests: Interest[] = [];
  allProperties: Property[] = [];
  dailyExpenses: Expense[] = [];
  splurgeExpenses: Expense[] = [];
  smileExpenses: Expense[] = [];
  fireExpenses: Expense[] = [];
  mojoExpenses: Expense[] = [];

  // Phase B: Balance sheet data
  allAssets: Asset[] = [];
  allShares: Share[] = [];
  allInvestments: Investment[] = [];
  liabilities: Liability[] = [];

  // Phase B: Budgets & Projects
  allBudgets: Budget[] = [];
  allGrowProjects: Grow[] = [];
  allSmileProjects: Smile[] = [];
  allFireEmergencies: Fire[] = [];
  mojo: Mojo = { amount: 0, target: 0 };

  // Phase C: Settings
  currency: string = '€';
  isLoading: boolean = true;
  lastUpdatedAt: string | null = null;
  tier2Loaded = false;
  tier3GrowLoaded = false;
  tier3BalanceLoaded = false;
  daily: number = 60.0;
  splurge: number = 10.0;
  smile: number = 10.0;
  fire: number = 20.0;
  key: string = 'default';
  dateFormat: string = 'dd.MM.yyyy';
  isEuropeanFormat: boolean = true;
  isLocal: boolean = true;
  isDatabase: boolean = false;
  username: string = 'Username';
  email: string = 'test@web.de';

  constructor() {
    AppStateService.instance = this;
  }

  getAmount(account: string, p: number): number {
    if (this.allTransactions) {
      let result = 0.0;
      for (let i = 0; i < this.allTransactions.length; i++) {
        if (this.allTransactions[i].account == account) {
          result += this.allTransactions[i].amount;
        } else if (this.allTransactions[i].account == 'Income') {
          result += Math.round(((this.allTransactions[i].amount * p) + Number.EPSILON) * 100) / 100;
        }
      }
      return result;
    } else {
      return 0.0;
    }
  }
}
