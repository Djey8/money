import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';
import { LocalService } from './local.service';
import { DatabaseService } from './database.service';
import { CrypticService } from './cryptic.service';
import { AuthService } from './auth.service';
import { PersistenceService } from './persistence.service';
import { IncomeStatementService } from './income-statement.service';
import { AppStateService } from './app-state.service';
import { SubscriptionProcessingService } from './subscription-processing.service';
import { ToastService } from './toast.service';
import { Transaction } from '../../interfaces/transaction';
import { Subscription } from '../../interfaces/subscription';
import { Revenue } from '../../interfaces/revenue';
import { Property } from '../../interfaces/property';
import { Interest } from '../../interfaces/interest';
import { migrateGrowArray } from '../grow-migration.utils';
import { migrateSmileArray } from '../smile-migration.utils';
import { migrateFire } from '../fire-migration.utils';
import { migrateSubscriptionArray } from '../migrations/subscription-migration.utils';
import { Expense } from '../../interfaces/expense';
import { Share } from '../../interfaces/share';
import { Investment } from '../../interfaces/investment';
import { Liability } from '../../interfaces/liability';
import { Smile } from '../../interfaces/smile';
import { Fire } from '../../interfaces/fire';
import { Mojo } from '../../interfaces/mojo';
import { Budget } from '../../interfaces/budget';
import { AccountingComponent } from '../../main/accounting/accounting.component';
import { SubscriptionComponent } from '../../main/subscription/subscription.component';
import { FireEmergenciesComponent } from '../../main/fire/fire-emergencies/fire-emergencies.component';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
/**
 * Handles data loading from the database, syncing after mutations,
 * persistence to local storage, and authentication checks.
 */
export class AppDataService {

  static instance: AppDataService;
  private appMode: 'firebase' | 'selfhosted' = environment.mode as 'firebase' | 'selfhosted';

  // Tier 1: Critical path — blocks UI, loaded on startup
  static readonly TIER1_PATHS = [
    'transactions', 'subscriptions',
    'income/revenue/revenues', 'income/revenue/interests', 'income/revenue/properties',
    'income/expenses/daily', 'income/expenses/splurge', 'income/expenses/smile',
    'income/expenses/fire', 'income/expenses/mojo'
  ];
  // Tier 2: Deferred — loaded async after UI renders
  static readonly TIER2_PATHS = ['smile', 'fire', 'mojo', 'budget'];
  // Tier 3: On-demand — loaded when user navigates to the page
  static readonly TIER3_GROW_PATHS = ['grow'];
  static readonly TIER3_BALANCE_PATHS = [
    'balance/asset/assets', 'balance/asset/shares',
    'balance/asset/investments', 'balance/liabilities'
  ];

  constructor(
    private localStorage: LocalService,
    private database: DatabaseService,
    private afAuth: AngularFireAuth,
    private cryptic: CrypticService,
    private authService: AuthService,
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService,
    private toastService: ToastService,
    private subscriptionProcessing: SubscriptionProcessingService
  ) {
    AppDataService.instance = this;
  }

  async checkAuthentication(): Promise<boolean> {
    if (this.appMode === 'firebase') {
      try {
        const user = await firstValueFrom(this.afAuth.authState);
        return user !== null;
      } catch (error) {
        console.error('Error checking Firebase auth state:', error);
        return false;
      }
    } else {
      const token = localStorage.getItem('selfhosted_token');
      if (!token) {
        return false;
      }
      try {
        const isValid = await this.database.getData('info/username')
          .then(() => true)
          .catch(() => false);
        return isValid;
      } catch {
        return false;
      }
    }
  }

  async updateBasedOnTransaction() {
    const authResult = await this.authService.checkAuthentication();
    if (!authResult.authenticated) {
      console.error('Authentication failed:', authResult.error);
      return;
    }

    // AppState is already up-to-date from the calling code.
    // Do NOT re-read from localStorage — it may be stale if a prior
    // DB write hasn't returned yet.

    this.incomeStatement.recalculate();

    // Save to localStorage immediately so reload always reflects the latest state.
    this.saveAllToLocalStorage();

    try {
      const write1 = this.database.writeObject("income/revenue/interests", AppStateService.instance.allIntrests);
      const write2 = this.database.writeObject("income/revenue/properties", AppStateService.instance.allProperties);
      const write3 = this.database.writeObject("income/revenue/revenues", AppStateService.instance.allRevenues);
      const write4 = this.database.writeObject("balance/liabilities", AppStateService.instance.liabilities);
      const write5 = this.database.writeObject("income/expenses/daily", AppStateService.instance.dailyExpenses);
      const write6 = this.database.writeObject("income/expenses/splurge", AppStateService.instance.splurgeExpenses);
      const write7 = this.database.writeObject("income/expenses/smile", AppStateService.instance.smileExpenses);
      const write8 = this.database.writeObject("income/expenses/fire", AppStateService.instance.fireExpenses);
      const write9 = this.database.writeObject("income/expenses/mojo", AppStateService.instance.mojoExpenses);
      const write10 = this.database.writeObject("smile", AppStateService.instance.allSmileProjects);
      const write11 = this.database.writeObject("fire", AppStateService.instance.allFireEmergencies);
      const write12 = this.database.writeObject("mojo", AppStateService.instance.mojo);
      const write13 = this.database.writeObject("balance/liabilities", AppStateService.instance.liabilities);

      if (environment.mode === 'selfhosted') {
        const observables = [];
        if (write1) observables.push(write1);
        if (write2) observables.push(write2);
        if (write3) observables.push(write3);
        if (write4) observables.push(write4);
        if (write5) observables.push(write5);
        if (write6) observables.push(write6);
        if (write7) observables.push(write7);
        if (write8) observables.push(write8);
        if (write9) observables.push(write9);
        if (write10) observables.push(write10);
        if (write11) observables.push(write11);
        if (write12) observables.push(write12);
        if (write13) observables.push(write13);

        if (observables.length > 0) {
          observables.forEach(obs => {
            obs.subscribe({
              error: (error) => {
                console.error(error);
              }
            });
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  private saveAllToLocalStorage() {
    this.localStorage.saveData("interests", JSON.stringify(AppStateService.instance.allIntrests));
    this.localStorage.saveData("properties", JSON.stringify(AppStateService.instance.allProperties));
    this.localStorage.saveData("revenues", JSON.stringify(AppStateService.instance.allRevenues));
    this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities));
    this.localStorage.saveData("dailyEx", JSON.stringify(AppStateService.instance.dailyExpenses));
    this.localStorage.saveData("splurgeEx", JSON.stringify(AppStateService.instance.splurgeExpenses));
    this.localStorage.saveData("smileEx", JSON.stringify(AppStateService.instance.smileExpenses));
    this.localStorage.saveData("fireEx", JSON.stringify(AppStateService.instance.fireExpenses));
    this.localStorage.saveData("mojoEx", JSON.stringify(AppStateService.instance.mojoExpenses));
    this.localStorage.saveData("smile", JSON.stringify(AppStateService.instance.allSmileProjects));
    this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies));
    this.localStorage.saveData("mojo", JSON.stringify(AppStateService.instance.mojo));
    this.localStorage.saveData("liabilities", JSON.stringify(AppStateService.instance.liabilities));
  }

  updateDatabase() {
    this.persistence.batchWriteAndSync({
      writes: [
        { tag: "income/revenue/interests", data: AppStateService.instance.allIntrests },
        { tag: "income/revenue/properties", data: AppStateService.instance.allProperties },
        { tag: "income/revenue/revenues", data: AppStateService.instance.allRevenues },
        { tag: "balance/liabilities", data: AppStateService.instance.liabilities },
        { tag: "income/expenses/daily", data: AppStateService.instance.dailyExpenses },
        { tag: "income/expenses/splurge", data: AppStateService.instance.splurgeExpenses },
        { tag: "income/expenses/smile", data: AppStateService.instance.smileExpenses },
        { tag: "income/expenses/fire", data: AppStateService.instance.fireExpenses },
        { tag: "income/expenses/mojo", data: AppStateService.instance.mojoExpenses },
        { tag: "smile", data: AppStateService.instance.allSmileProjects },
        { tag: "fire", data: AppStateService.instance.allFireEmergencies },
        { tag: "mojo", data: AppStateService.instance.mojo },
        { tag: "transactions", data: AppStateService.instance.allTransactions }
      ],
      localStorageSaves: [
        { key: "interests", data: JSON.stringify(AppStateService.instance.allIntrests) },
        { key: "properties", data: JSON.stringify(AppStateService.instance.allProperties) },
        { key: "revenues", data: JSON.stringify(AppStateService.instance.allRevenues) },
        { key: "liabilities", data: JSON.stringify(AppStateService.instance.liabilities) },
        { key: "dailyEx", data: JSON.stringify(AppStateService.instance.dailyExpenses) },
        { key: "splurgeEx", data: JSON.stringify(AppStateService.instance.splurgeExpenses) },
        { key: "smileEx", data: JSON.stringify(AppStateService.instance.smileExpenses) },
        { key: "fireEx", data: JSON.stringify(AppStateService.instance.fireExpenses) },
        { key: "mojoEx", data: JSON.stringify(AppStateService.instance.mojoExpenses) },
        { key: "smile", data: JSON.stringify(AppStateService.instance.allSmileProjects) },
        { key: "fire", data: JSON.stringify(AppStateService.instance.allFireEmergencies) },
        { key: "mojo", data: JSON.stringify(AppStateService.instance.mojo) },
        { key: "transactions", data: JSON.stringify(AppStateService.instance.allTransactions) }
      ]
    });
  }

  loadFromDB(): Promise<void> {
    this.database.clearReadCache();
    return this.loadTier1().then(() => this.loadTier2());
  }

  async loadTier1(): Promise<void> {
    this.database.clearReadCache();
    try {
      const response = await this.database.getBatchData(AppDataService.TIER1_PATHS);
      if (response === null) return;  // 304 Not Modified — data unchanged
      this.applyBatchData(response.data);
      AppStateService.instance.lastUpdatedAt = response.updatedAt;
    } catch (err) {
      console.error('Tier 1 load error:', err);
    }
  }

  async loadTier2(): Promise<void> {
    try {
      const response = await this.database.getBatchData(AppDataService.TIER2_PATHS);
      if (response === null) {        // 304 Not Modified
        AppStateService.instance.tier2Loaded = true;
        return;
      }
      this.applyBatchData(response.data);
      AppStateService.instance.tier2Loaded = true;
    } catch (err) {
      console.error('Tier 2 load error:', err);
    }
  }

  async loadGrowData(): Promise<void> {
    if (AppStateService.instance.tier3GrowLoaded) return;
    try {
      const response = await this.database.getBatchData(AppDataService.TIER3_GROW_PATHS);
      if (response === null) {        // 304 Not Modified
        AppStateService.instance.tier3GrowLoaded = true;
        return;
      }
      this.applyBatchData(response.data);
      AppStateService.instance.tier3GrowLoaded = true;
    } catch (err) {
      console.error('Grow data load error:', err);
    }
  }

  async loadBalanceData(): Promise<void> {
    if (AppStateService.instance.tier3BalanceLoaded) return;
    try {
      const response = await this.database.getBatchData(AppDataService.TIER3_BALANCE_PATHS);
      if (response === null) {        // 304 Not Modified
        AppStateService.instance.tier3BalanceLoaded = true;
        return;
      }
      this.applyBatchData(response.data);
      AppStateService.instance.tier3BalanceLoaded = true;
    } catch (err) {
      console.error('Balance data load error:', err);
    }
  }

  async checkUpdatedAt(): Promise<boolean> {
    const serverUpdatedAt = await this.database.getUpdatedAt();
    if (serverUpdatedAt === null) return true;
    return serverUpdatedAt !== AppStateService.instance.lastUpdatedAt;
  }

  private applyBatchData(data: Record<string, any>): void {
    for (const path in data) {
      try {
        this.applyPathData(path, data[path]);
      } catch (err) {
        console.error(`Error applying data for path "${path}":`, err);
      }
    }
  }

  private applyPathData(path: string, raw: any): void {
    switch (path) {
      case 'transactions': {
        if (raw == null) {
          AccountingComponent.allTransactions = [];
          AppStateService.instance.allTransactions = [];
          this.localStorage.saveData("transactions", JSON.stringify([]));
        } else {
          let myTransactions: Transaction[] = [];
          let invalidCount = 0;
          const totalCount = Object.keys(raw).length;
          
          for (const k in raw) {
            try {
              // Decrypt all fields
              const account = this.cryptic.decrypt(raw[k].account, 'database');
              const amount = this.cryptic.decrypt(raw[k].amount, 'database');
              const dateStr = this.cryptic.decrypt(raw[k].date, 'database');
              const time = this.cryptic.decrypt(raw[k].time, 'database');
              const category = this.cryptic.decrypt(raw[k].category, 'database');
              const comment = this.cryptic.decrypt(raw[k].comment, 'database');

              // Validate date - if it's invalid (like 'S'), this is likely a wrong decryption key
              if (!dateStr || dateStr.length < 8 || !dateStr.includes('-')) {
                invalidCount++;
                console.warn('Invalid transaction data (wrong decryption key?):', {
                  key: k,
                  dateStr,
                  account: account?.substring(0, 20),
                  category: category?.substring(0, 20)
                });
                continue; // Skip this transaction
              }

              let newT: Transaction = { 
                account, 
                amount: parseFloat(amount) || 0, 
                date: dateStr, 
                time, 
                category, 
                comment
              };
              myTransactions.push(newT);
            } catch (error) {
              invalidCount++;
              console.warn('Failed to decrypt transaction at key:', k, 'Error:', error);
              continue; // Skip corrupted transactions
            }
          }
          
          // If more than 50% of transactions failed to decrypt, likely wrong key
          if (totalCount > 0 && invalidCount / totalCount > 0.5) {
            console.error(`❌ DECRYPTION ERROR: ${invalidCount}/${totalCount} transactions failed to decrypt.`);
            console.error('⚠️  This usually means you entered the WRONG DECRYPTION KEY.');
            console.error('💡 Please log out and log back in with the correct key.');
            
            // Optional: Show user-facing alert
            if (typeof window !== 'undefined' && window.alert) {
              setTimeout(() => {
                alert('⚠️ Decryption Error\n\nMost of your data could not be decrypted.\nThis usually means you entered the wrong decryption key.\n\nPlease log out and log back in with the correct key.');
              }, 500);
            }
          } else if (invalidCount > 0) {
            console.warn(`⚠️  Skipped ${invalidCount}/${totalCount} corrupted transactions.`);
          }
          
          this.localStorage.removeData("transactions");
          AppStateService.instance.allTransactions = myTransactions;
          AccountingComponent.allTransactions = AppStateService.instance.allTransactions;
          AccountingComponent.dataSource.data = [...AppStateService.instance.allTransactions];
          AccountingComponent.dataSource.data = AccountingComponent.dataSource.data.map((transaction, index) => {
            return { ...transaction, id: index };
          });
          this.localStorage.saveData("transactions", JSON.stringify(myTransactions));
        }
        break;
      }
      case 'subscriptions': {
        if (raw == null) {
          SubscriptionComponent.allSubscriptions = [];
          AppStateService.instance.allSubscriptions = [];
          this.localStorage.saveData("subscriptions", JSON.stringify([]));
        } else {
          // Decrypt subscription data
          let rawSubscriptions: any[] = [];
          for (const k in raw) {
            const decrypted = {
              title: this.cryptic.decrypt(raw[k].title, 'database'),
              account: this.cryptic.decrypt(raw[k].account, 'database'),
              amount: this.cryptic.decrypt(raw[k].amount, 'database'),
              startDate: this.cryptic.decrypt(raw[k].startDate, 'database'),
              endDate: this.cryptic.decrypt(raw[k].endDate, 'database'),
              category: this.cryptic.decrypt(raw[k].category, 'database'),
              comment: this.cryptic.decrypt(raw[k].comment, 'database'),
              frequency: raw[k].frequency ? this.cryptic.decrypt(raw[k].frequency, 'database') : undefined,
              changeHistory: raw[k].changeHistory ? this.decryptChangeHistory(raw[k].changeHistory) : undefined
            };
            rawSubscriptions.push(decrypted);
          }
          
          // Apply migration to ensure all fields are present with defaults
          const mySubscriptions = migrateSubscriptionArray(rawSubscriptions);
          
          AppStateService.instance.allSubscriptions = mySubscriptions;
          SubscriptionComponent.allSubscriptions = AppStateService.instance.allSubscriptions;
          SubscriptionComponent.activeDataSource.data = [...SubscriptionComponent.allSubscriptions];
          SubscriptionComponent.activeDataSource.data = SubscriptionComponent.activeDataSource.data.map((subscription, index) => {
            return { ...subscription, id: index };
          });
          SubscriptionComponent.inactiveDataSource.data = [...SubscriptionComponent.allSubscriptions];
          SubscriptionComponent.inactiveDataSource.data = SubscriptionComponent.inactiveDataSource.data.map((subscription, index) => {
            return { ...subscription, id: index };
          });
          this.localStorage.saveData("subscriptions", JSON.stringify(mySubscriptions));
        }
        break;
      }
      case 'income/revenue/interests': {
        if (raw == null) {
          AppStateService.instance.allIntrests = [];
          this.localStorage.saveData("interests", JSON.stringify([]));
        } else {
          let myInterests: Interest[] = [];
          for (const k in raw) {
            let newR: Interest = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myInterests.push(newR);
          }
          AppStateService.instance.allIntrests = myInterests;
          this.localStorage.saveData("interests", JSON.stringify(myInterests));
        }
        break;
      }
      case 'income/revenue/properties': {
        if (raw == null) {
          AppStateService.instance.allProperties = [];
          this.localStorage.saveData("properties", JSON.stringify([]));
        } else {
          let myProperties: Property[] = [];
          for (const k in raw) {
            let newP: Property = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myProperties.push(newP);
          }
          AppStateService.instance.allProperties = myProperties;
          this.localStorage.saveData("properties", JSON.stringify(myProperties));
        }
        break;
      }
      case 'income/revenue/revenues': {
        if (raw == null) {
          AppStateService.instance.allRevenues = [];
          this.localStorage.saveData("revenues", JSON.stringify([]));
        } else {
          let myRevenues: Revenue[] = [];
          for (const k in raw) {
            let newR: Revenue = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myRevenues.push(newR);
          }
          AppStateService.instance.allRevenues = myRevenues;
          this.localStorage.saveData("revenues", JSON.stringify(myRevenues));
        }
        break;
      }
      case 'income/expenses/daily': {
        if (raw == null) {
          AppStateService.instance.dailyExpenses = [];
          this.localStorage.saveData("dailyEx", JSON.stringify([]));
        } else {
          let myExpenses: Expense[] = [];
          for (const k in raw) {
            let newR: Expense = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myExpenses.push(newR);
          }
          AppStateService.instance.dailyExpenses = myExpenses;
          this.localStorage.saveData("dailyEx", JSON.stringify(myExpenses));
        }
        break;
      }
      case 'income/expenses/splurge': {
        if (raw == null) {
          AppStateService.instance.splurgeExpenses = [];
          this.localStorage.saveData("splurgeEx", JSON.stringify([]));
        } else {
          let myExpenses: Expense[] = [];
          for (const k in raw) {
            let newR: Expense = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myExpenses.push(newR);
          }
          AppStateService.instance.splurgeExpenses = myExpenses;
          this.localStorage.saveData("splurgeEx", JSON.stringify(myExpenses));
        }
        break;
      }
      case 'income/expenses/smile': {
        if (raw == null) {
          AppStateService.instance.smileExpenses = [];
          this.localStorage.saveData("smileEx", JSON.stringify([]));
        } else {
          let myExpenses: Expense[] = [];
          for (const k in raw) {
            let newR: Expense = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myExpenses.push(newR);
          }
          AppStateService.instance.smileExpenses = myExpenses;
          this.localStorage.saveData("smileEx", JSON.stringify(myExpenses));
        }
        break;
      }
      case 'income/expenses/fire': {
        if (raw == null) {
          AppStateService.instance.fireExpenses = [];
          this.localStorage.saveData("fireEx", JSON.stringify([]));
        } else {
          let myExpenses: Expense[] = [];
          for (const k in raw) {
            let newR: Expense = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myExpenses.push(newR);
          }
          AppStateService.instance.fireExpenses = myExpenses;
          this.localStorage.saveData("fireEx", JSON.stringify(myExpenses));
        }
        break;
      }
      case 'income/expenses/mojo': {
        if (raw == null) {
          AppStateService.instance.mojoExpenses = [];
          this.localStorage.saveData("mojoEx", JSON.stringify([]));
        } else {
          let myExpenses: Expense[] = [];
          for (const k in raw) {
            let newR: Expense = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myExpenses.push(newR);
          }
          AppStateService.instance.mojoExpenses = myExpenses;
          this.localStorage.saveData("mojoEx", JSON.stringify(myExpenses));
        }
        break;
      }
      case 'smile': {
        if (raw == null) {
          AppStateService.instance.allSmileProjects = [];
          this.localStorage.saveData("smile", JSON.stringify([]));
        } else {
          let mySmile: any[] = [];
          for (const k in raw) {
            // Decrypt all Smile fields
            let rawSmile: any = { 
              title: this.cryptic.decrypt(raw[k].title, 'database')
            };

            // Decrypt legacy fields if they exist (for migration)
            if (raw[k].target) rawSmile.target = parseFloat(this.cryptic.decrypt(raw[k].target, 'database'));
            if (raw[k].amount) rawSmile.amount = parseFloat(this.cryptic.decrypt(raw[k].amount, 'database'));

            // Decrypt optional fields if they exist
            if (raw[k].sub) rawSmile.sub = this.cryptic.decrypt(raw[k].sub, 'database');
            if (raw[k].phase) rawSmile.phase = this.cryptic.decrypt(raw[k].phase, 'database');
            if (raw[k].description) rawSmile.description = this.cryptic.decrypt(raw[k].description, 'database');
            if (raw[k].targetDate) rawSmile.targetDate = this.cryptic.decrypt(raw[k].targetDate, 'database');
            if (raw[k].completionDate) rawSmile.completionDate = this.cryptic.decrypt(raw[k].completionDate, 'database');
            if (raw[k].createdAt) rawSmile.createdAt = this.cryptic.decrypt(raw[k].createdAt, 'database');
            if (raw[k].updatedAt) rawSmile.updatedAt = this.cryptic.decrypt(raw[k].updatedAt, 'database');

            // Decrypt buckets array
            if (raw[k].buckets && Array.isArray(raw[k].buckets)) {
              rawSmile.buckets = raw[k].buckets.map((bucket: any) => ({
                id: this.cryptic.decrypt(bucket.id, 'database'),
                title: this.cryptic.decrypt(bucket.title, 'database'),
                target: parseFloat(this.cryptic.decrypt(bucket.target, 'database')),
                amount: parseFloat(this.cryptic.decrypt(bucket.amount, 'database')),
                notes: bucket.notes ? this.cryptic.decrypt(bucket.notes, 'database') : '',
                links: bucket.links && Array.isArray(bucket.links) ? bucket.links.map((link: any) => ({
                  label: this.cryptic.decrypt(link.label, 'database'),
                  url: this.cryptic.decrypt(link.url, 'database')
                })) : [],
                targetDate: bucket.targetDate ? this.cryptic.decrypt(bucket.targetDate, 'database') : undefined,
                completionDate: bucket.completionDate ? this.cryptic.decrypt(bucket.completionDate, 'database') : undefined
              }));
            }

            // Decrypt links array
            if (raw[k].links && Array.isArray(raw[k].links)) {
              rawSmile.links = raw[k].links.map((link: any) => ({
                label: this.cryptic.decrypt(link.label, 'database'),
                url: this.cryptic.decrypt(link.url, 'database')
              }));
            }

            // Decrypt actionItems array
            if (raw[k].actionItems && Array.isArray(raw[k].actionItems)) {
              rawSmile.actionItems = raw[k].actionItems.map((item: any) => ({
                text: this.cryptic.decrypt(item.text, 'database'),
                done: this.cryptic.decrypt(item.done, 'database') === 'true',
                priority: this.cryptic.decrypt(item.priority, 'database') as 'low' | 'medium' | 'high',
                dueDate: item.dueDate ? this.cryptic.decrypt(item.dueDate, 'database') : undefined
              }));
            }

            // Decrypt notes array
            if (raw[k].notes && Array.isArray(raw[k].notes)) {
              rawSmile.notes = raw[k].notes.map((note: any) => ({
                text: this.cryptic.decrypt(note.text, 'database'),
                createdAt: this.cryptic.decrypt(note.createdAt, 'database')
              }));
            }

            // Decrypt plannedSubscriptions array - each field is individually encrypted
            if (raw[k].plannedSubscriptions && Array.isArray(raw[k].plannedSubscriptions)) {
              rawSmile.plannedSubscriptions = raw[k].plannedSubscriptions.map((plan: any) => ({
                id: this.cryptic.decrypt(plan.id, 'database'),
                title: this.cryptic.decrypt(plan.title, 'database'),
                status: this.cryptic.decrypt(plan.status, 'database'),
                projectType: this.cryptic.decrypt(plan.projectType, 'database'),
                projectTitle: this.cryptic.decrypt(plan.projectTitle, 'database'),
                account: this.cryptic.decrypt(plan.account, 'database'),
                amount: parseFloat(this.cryptic.decrypt(plan.amount, 'database')),
                startDate: this.cryptic.decrypt(plan.startDate, 'database'),
                endDate: this.cryptic.decrypt(plan.endDate, 'database'),
                category: this.cryptic.decrypt(plan.category, 'database'),
                comment: this.cryptic.decrypt(plan.comment, 'database'),
                frequency: this.cryptic.decrypt(plan.frequency, 'database'),
                targetDate: this.cryptic.decrypt(plan.targetDate, 'database'),
                targetBucketIds: plan.targetBucketIds && Array.isArray(plan.targetBucketIds) 
                  ? plan.targetBucketIds.map((id: any) => this.cryptic.decrypt(id, 'database'))
                  : [],
                originalCalculatedAmount: parseFloat(this.cryptic.decrypt(plan.originalCalculatedAmount, 'database')),
                manuallyAdjusted: this.cryptic.decrypt(plan.manuallyAdjusted, 'database') === 'true',
                createdAt: this.cryptic.decrypt(plan.createdAt, 'database'),
                updatedAt: this.cryptic.decrypt(plan.updatedAt, 'database'),
                activatedAt: plan.activatedAt ? this.cryptic.decrypt(plan.activatedAt, 'database') : undefined,
                deactivatedAt: plan.deactivatedAt ? this.cryptic.decrypt(plan.deactivatedAt, 'database') : undefined,
                activeSubscriptionId: plan.activeSubscriptionId ? this.cryptic.decrypt(plan.activeSubscriptionId, 'database') : undefined
              }));
            }

            mySmile.push(rawSmile);
          }
          // Apply migration to convert legacy format to new format
          const migrated = migrateSmileArray(mySmile);
          AppStateService.instance.allSmileProjects = migrated;
          this.localStorage.saveData("smile", JSON.stringify(migrated));
        }
        break;
      }
      case 'fire': {
        if (raw == null) {
          AppStateService.instance.allFireEmergencies = [];
          this.localStorage.saveData("fire", JSON.stringify([]));
        } else {
          let myFire: Fire[] = [];
          for (const k in raw) {
            // Decrypt and create raw object with all fields
            let rawFire: any = { 
              title: this.cryptic.decrypt(raw[k].title, 'database')
            };
            
            // Decrypt legacy fields if they exist (for migration)
            if (raw[k].target) {
              rawFire.target = parseFloat(this.cryptic.decrypt(raw[k].target, 'database'));
            }
            if (raw[k].amount) {
              rawFire.amount = parseFloat(this.cryptic.decrypt(raw[k].amount, 'database'));
            }
            
            // Decrypt buckets array - each field is individually encrypted
            if (raw[k].buckets && Array.isArray(raw[k].buckets)) {
              rawFire.buckets = raw[k].buckets.map((bucket: any) => ({
                id: this.cryptic.decrypt(bucket.id, 'database'),
                title: this.cryptic.decrypt(bucket.title, 'database'),
                target: parseFloat(this.cryptic.decrypt(bucket.target, 'database')),
                amount: parseFloat(this.cryptic.decrypt(bucket.amount, 'database')),
                notes: bucket.notes ? this.cryptic.decrypt(bucket.notes, 'database') : '',
                links: bucket.links && Array.isArray(bucket.links) ? bucket.links.map((link: any) => ({
                  label: this.cryptic.decrypt(link.label, 'database'),
                  url: this.cryptic.decrypt(link.url, 'database')
                })) : [],
                targetDate: bucket.targetDate ? this.cryptic.decrypt(bucket.targetDate, 'database') : undefined,
                completionDate: bucket.completionDate ? this.cryptic.decrypt(bucket.completionDate, 'database') : undefined
              }));
            }
            if (raw[k].sub) {
              rawFire.sub = this.cryptic.decrypt(raw[k].sub, 'database');
            }
            if (raw[k].phase) {
              rawFire.phase = this.cryptic.decrypt(raw[k].phase, 'database');
            }
            if (raw[k].description) {
              rawFire.description = this.cryptic.decrypt(raw[k].description, 'database');
            }
            if (raw[k].links && Array.isArray(raw[k].links)) {
              rawFire.links = raw[k].links.map((link: any) => ({
                label: this.cryptic.decrypt(link.label, 'database'),
                url: this.cryptic.decrypt(link.url, 'database')
              }));
            }
            if (raw[k].actionItems && Array.isArray(raw[k].actionItems)) {
              rawFire.actionItems = raw[k].actionItems.map((item: any) => ({
                text: this.cryptic.decrypt(item.text, 'database'),
                done: this.cryptic.decrypt(item.done, 'database') === 'true',
                priority: this.cryptic.decrypt(item.priority, 'database') as 'low' | 'medium' | 'high',
                dueDate: item.dueDate ? this.cryptic.decrypt(item.dueDate, 'database') : undefined
              }));
            }
            if (raw[k].notes && Array.isArray(raw[k].notes)) {
              rawFire.notes = raw[k].notes.map((note: any) => ({
                text: this.cryptic.decrypt(note.text, 'database'),
                createdAt: this.cryptic.decrypt(note.createdAt, 'database')
              }));
            }
            if (raw[k].createdAt) {
              rawFire.createdAt = this.cryptic.decrypt(raw[k].createdAt, 'database');
            }
            if (raw[k].updatedAt) {
              rawFire.updatedAt = this.cryptic.decrypt(raw[k].updatedAt, 'database');
            }
            if (raw[k].targetDate) {
              rawFire.targetDate = this.cryptic.decrypt(raw[k].targetDate, 'database');
            }
            if (raw[k].completionDate) {
              rawFire.completionDate = this.cryptic.decrypt(raw[k].completionDate, 'database');
            }
            
            // Decrypt plannedSubscriptions array - each field is individually encrypted
            if (raw[k].plannedSubscriptions && Array.isArray(raw[k].plannedSubscriptions)) {
              rawFire.plannedSubscriptions = raw[k].plannedSubscriptions.map((plan: any) => ({
                id: this.cryptic.decrypt(plan.id, 'database'),
                title: this.cryptic.decrypt(plan.title, 'database'),
                status: this.cryptic.decrypt(plan.status, 'database'),
                projectType: this.cryptic.decrypt(plan.projectType, 'database'),
                projectTitle: this.cryptic.decrypt(plan.projectTitle, 'database'),
                account: this.cryptic.decrypt(plan.account, 'database'),
                amount: parseFloat(this.cryptic.decrypt(plan.amount, 'database')),
                startDate: this.cryptic.decrypt(plan.startDate, 'database'),
                endDate: this.cryptic.decrypt(plan.endDate, 'database'),
                category: this.cryptic.decrypt(plan.category, 'database'),
                comment: this.cryptic.decrypt(plan.comment, 'database'),
                frequency: this.cryptic.decrypt(plan.frequency, 'database'),
                targetDate: this.cryptic.decrypt(plan.targetDate, 'database'),
                targetBucketIds: plan.targetBucketIds && Array.isArray(plan.targetBucketIds) 
                  ? plan.targetBucketIds.map((id: any) => this.cryptic.decrypt(id, 'database'))
                  : [],
                originalCalculatedAmount: parseFloat(this.cryptic.decrypt(plan.originalCalculatedAmount, 'database')),
                manuallyAdjusted: this.cryptic.decrypt(plan.manuallyAdjusted, 'database') === 'true',
                createdAt: this.cryptic.decrypt(plan.createdAt, 'database'),
                updatedAt: this.cryptic.decrypt(plan.updatedAt, 'database'),
                activatedAt: plan.activatedAt ? this.cryptic.decrypt(plan.activatedAt, 'database') : undefined,
                deactivatedAt: plan.deactivatedAt ? this.cryptic.decrypt(plan.deactivatedAt, 'database') : undefined,
                activeSubscriptionId: plan.activeSubscriptionId ? this.cryptic.decrypt(plan.activeSubscriptionId, 'database') : undefined
              }));
            }
            
            // Migrate to current schema
            const fire: Fire = migrateFire(rawFire);
            myFire.push(fire);
          }
          AppStateService.instance.allFireEmergencies = myFire;
          this.localStorage.saveData("fire", JSON.stringify(AppStateService.instance.allFireEmergencies));
        }
        break;
      }
      case 'mojo': {
        if (raw != null) {
          let newm: Mojo = { target: parseFloat(this.cryptic.decrypt(raw['target'], 'database')), amount: parseFloat(this.cryptic.decrypt(raw['amount'], 'database')) };
          AppStateService.instance.mojo = newm;
          this.localStorage.saveData("mojo", JSON.stringify(newm));
        }
        break;
      }
      case 'budget': {
        if (raw == null) {
          AppStateService.instance.allBudgets = [];
          this.localStorage.saveData("budget", JSON.stringify([]));
        } else {
          let myBudgets: Budget[] = [];
          for (const k in raw) {
            let newBudget: Budget = { date: this.cryptic.decrypt(raw[k].date, 'database'), tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myBudgets.push(newBudget);
          }
          AppStateService.instance.allBudgets = myBudgets;
          this.localStorage.saveData("budget", JSON.stringify(myBudgets));
        }
        break;
      }
      case 'grow': {
        if (raw == null) {
          AppStateService.instance.allGrowProjects = [];
          this.localStorage.saveData("grow", JSON.stringify([]));
        } else {
          let myGrowProjects = [];
          for (const k in raw) {
            let share = null;
            if (raw[k].share) {
              share = {
                tag: this.cryptic.decrypt(raw[k].share["tag"], 'database'),
                price: this.cryptic.decrypt(raw[k].share["price"], 'database'),
                quantity: this.cryptic.decrypt(raw[k].share["quantity"], 'database')
              };
            }
            let investment = null;
            if (raw[k].investment) {
              investment = {
                tag: this.cryptic.decrypt(raw[k].investment["tag"], 'database'),
                deposit: this.cryptic.decrypt(raw[k].investment["deposit"], 'database'),
                amount: this.cryptic.decrypt(raw[k].investment["amount"], 'database')
              };
            }
            let liabilitie = null;
            if (raw[k].liabilitie) {
              liabilitie = {
                tag: this.cryptic.decrypt(raw[k].liabilitie["tag"], 'database'),
                credit: this.cryptic.decrypt(raw[k].liabilitie["credit"], 'database'),
                amount: this.cryptic.decrypt(raw[k].liabilitie["amount"], 'database'),
                investment: this.cryptic.decrypt(raw[k].liabilitie["investment"], 'database')
              };
            }
            // Decrypt nested arrays
            let links = [];
            if (raw[k].links) {
              for (const li in raw[k].links) {
                links.push({
                  label: this.cryptic.decrypt(raw[k].links[li].label, 'database'),
                  url: this.cryptic.decrypt(raw[k].links[li].url, 'database')
                });
              }
            }
            let actionItems = [];
            if (raw[k].actionItems) {
              for (const ai in raw[k].actionItems) {
                const item: any = {
                  text: this.cryptic.decrypt(raw[k].actionItems[ai].text, 'database'),
                  done: this.cryptic.decrypt(raw[k].actionItems[ai].done, 'database') === 'true',
                  priority: this.cryptic.decrypt(raw[k].actionItems[ai].priority, 'database')
                };
                if (raw[k].actionItems[ai].dueDate) {
                  item.dueDate = this.cryptic.decrypt(raw[k].actionItems[ai].dueDate, 'database');
                }
                actionItems.push(item);
              }
            }
            let notes = [];
            if (raw[k].notes) {
              for (const ni in raw[k].notes) {
                notes.push({
                  text: this.cryptic.decrypt(raw[k].notes[ni].text, 'database'),
                  createdAt: this.cryptic.decrypt(raw[k].notes[ni].createdAt, 'database')
                });
              }
            }
            let newG = {
              title: this.cryptic.decrypt(raw[k].title, 'database'),
              sub: this.cryptic.decrypt(raw[k].sub, 'database'),
              status: this.cryptic.decrypt(raw[k].status, 'database'),
              phase: this.cryptic.decrypt(raw[k].phase, 'database'),
              description: this.cryptic.decrypt(raw[k].description, 'database'),
              strategy: this.cryptic.decrypt(raw[k].strategy, 'database'),
              risks: this.cryptic.decrypt(raw[k].risks, 'database'),
              riskScore: parseFloat(this.cryptic.decrypt(raw[k].riskScore, 'database')) || 0,
              amount: this.cryptic.decrypt(raw[k].amount, 'database'),
              cashflow: this.cryptic.decrypt(raw[k].cashflow, 'database'),
              isAsset: this.cryptic.decrypt(raw[k].isAsset, 'database') == "true",
              notes: notes,
              links: links,
              actionItems: actionItems,
              createdAt: raw[k].createdAt ? this.cryptic.decrypt(raw[k].createdAt, 'database') : '',
              updatedAt: raw[k].updatedAt ? this.cryptic.decrypt(raw[k].updatedAt, 'database') : '',
              share: share,
              investment: investment,
              liabilitie: liabilitie,
              // Phase 2 fields - decrypt expense optimization fields if present
              type: raw[k].type ? this.cryptic.decrypt(raw[k].type, 'database') : 'income-growth',
              category: raw[k].category ? (
                Array.isArray(raw[k].category)
                  ? raw[k].category.map((cat: string) => this.cryptic.decrypt(cat, 'database'))
                  : this.cryptic.decrypt(raw[k].category, 'database')
              ) : undefined,
              currentCost: raw[k].currentCost ? parseFloat(this.cryptic.decrypt(raw[k].currentCost, 'database')) : undefined,
              targetCost: raw[k].targetCost ? parseFloat(this.cryptic.decrypt(raw[k].targetCost, 'database')) : undefined,
              monthlySavings: raw[k].monthlySavings ? parseFloat(this.cryptic.decrypt(raw[k].monthlySavings, 'database')) : undefined,
              annualSavings: raw[k].annualSavings ? parseFloat(this.cryptic.decrypt(raw[k].annualSavings, 'database')) : undefined,
              reasoning: raw[k].reasoning ? this.cryptic.decrypt(raw[k].reasoning, 'database') : undefined,
              alternative: raw[k].alternative ? this.cryptic.decrypt(raw[k].alternative, 'database') : undefined,
              alternativeCost: raw[k].alternativeCost ? parseFloat(this.cryptic.decrypt(raw[k].alternativeCost, 'database')) : undefined,
              pattern: raw[k].pattern ? this.cryptic.decrypt(raw[k].pattern, 'database') : undefined,
              insights: raw[k].insights ? this.cryptic.decrypt(raw[k].insights, 'database') : undefined,

            };
            myGrowProjects.push(newG);
          }
          const migrated = migrateGrowArray(myGrowProjects);
          AppStateService.instance.allGrowProjects = migrated;
          this.localStorage.saveData("grow", JSON.stringify(migrated));
        }
        break;
      }
      case 'balance/asset/assets': {
        if (raw == null) {
          AppStateService.instance.allAssets = [];
          this.localStorage.saveData("assets", JSON.stringify([]));
        } else {
          let myAssets: Expense[] = [];
          for (const k in raw) {
            let newR: Expense = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myAssets.push(newR);
          }
          AppStateService.instance.allAssets = myAssets;
          this.localStorage.saveData("assets", JSON.stringify(myAssets));
        }
        break;
      }
      case 'balance/asset/shares': {
        if (raw == null) {
          AppStateService.instance.allShares = [];
          this.localStorage.saveData("shares", JSON.stringify([]));
        } else {
          let myShares: Share[] = [];
          for (const k in raw) {
            let newR: Share = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), quantity: parseFloat(this.cryptic.decrypt(raw[k].quantity, 'database')), price: parseFloat(this.cryptic.decrypt(raw[k].price, 'database')) };
            myShares.push(newR);
          }
          AppStateService.instance.allShares = myShares;
          this.localStorage.saveData("shares", JSON.stringify(myShares));
        }
        break;
      }
      case 'balance/asset/investments': {
        if (raw == null) {
          AppStateService.instance.allInvestments = [];
          this.localStorage.saveData("investments", JSON.stringify([]));
        } else {
          let myInvestments: Investment[] = [];
          for (const k in raw) {
            let newR: Investment = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), deposit: parseFloat(this.cryptic.decrypt(raw[k].deposit, 'database')), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')) };
            myInvestments.push(newR);
          }
          AppStateService.instance.allInvestments = myInvestments;
          this.localStorage.saveData("investments", JSON.stringify(myInvestments));
        }
        break;
      }
      case 'balance/liabilities': {
        if (raw == null) {
          AppStateService.instance.liabilities = [];
          this.localStorage.saveData("liabilities", JSON.stringify([]));
        } else {
          let myLiabilities: Liability[] = [];
          for (const k in raw) {
            let newR: Liability = { tag: this.cryptic.decrypt(raw[k].tag, 'database'), amount: parseFloat(this.cryptic.decrypt(raw[k].amount, 'database')), investment: this.cryptic.decrypt(raw[k].investment, 'database')=="true", credit: parseFloat(this.cryptic.decrypt(raw[k].credit, 'database')) };
            myLiabilities.push(newR);
          }
          AppStateService.instance.liabilities = myLiabilities;
          this.localStorage.saveData("liabilities", JSON.stringify(myLiabilities));
        }
        break;
      }
    }
  }

  /**
   * Decrypt change history array for subscriptions
   * @param encryptedHistory - Encrypted change history from database
   * @returns Decrypted change history array
   */
  private decryptChangeHistory(encryptedHistory: any): any[] {
    if (!Array.isArray(encryptedHistory)) {
      return [];
    }
    
    return encryptedHistory.map((change: any) => ({
      effectiveDate: this.cryptic.decrypt(change.effectiveDate, 'database'),
      field: this.cryptic.decrypt(change.field, 'database'),
      oldValue: this.decryptValue(change.oldValue),
      newValue: this.decryptValue(change.newValue),
      reason: change.reason ? this.cryptic.decrypt(change.reason, 'database') : undefined
    }));
  }

  /**
   * Decrypt a value that could be a string, number, or encrypted primitive
   */
  private decryptValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return this.cryptic.decrypt(value, 'database');
      } catch {
        return value;
      }
    }
    return value;
  }
}
