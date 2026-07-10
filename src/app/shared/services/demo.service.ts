import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from './app-state.service';
import { LocalService } from './local.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

@Injectable({ providedIn: 'root' })
export class DemoService {

  constructor(private router: Router, private localStorage: LocalService) {}

  /** Whether demo mode is currently active (session-scoped). */
  static isDemoMode(): boolean {
    return sessionStorage.getItem('demo_mode') === 'true';
  }

  /** Activate demo mode: seed sample data, set flag, navigate to home. */
  startDemo(): void {
    sessionStorage.setItem('demo_mode', 'true');

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const iso = (d: Date) => d.toISOString();
    const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };
    const daysFromNow = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // ── Transactions (relative to today) ──
    const sampleTransactions = [
      // Income
      { amount: 3500, account: 'Income', category: 'Salary', comment: 'Monthly salary', date: daysAgo(28) },
      { amount: 500, account: 'Income', category: 'Bonus', comment: 'Q1 performance bonus', date: daysAgo(10) },
      { amount: 120, account: 'Income', category: 'Dividends', comment: 'MSFT dividend payout', date: daysAgo(14) },
      { amount: 85, account: 'Income', category: 'Rental', comment: 'Parking spot rental', date: daysAgo(7) },
      // Daily expenses
      { amount: -45.50, account: 'Daily', category: 'Groceries', comment: 'Weekly groceries', date: daysAgo(25) },
      { amount: -12.99, account: 'Daily', category: 'Transport', comment: 'Bus pass', date: daysAgo(22) },
      { amount: -29.99, account: 'Daily', category: 'Utilities', comment: 'Phone bill', date: daysAgo(15) },
      { amount: -120.00, account: 'Daily', category: 'Groceries', comment: 'Big shop', date: daysAgo(12) },
      { amount: -85.00, account: 'Daily', category: 'Utilities', comment: 'Electricity', date: daysAgo(5) },
      { amount: -22.50, account: 'Daily', category: 'Groceries', comment: 'Midweek shop', date: daysAgo(1) },
      // Splurge
      { amount: -65.00, account: 'Splurge', category: 'Dining', comment: 'Birthday dinner', date: daysAgo(18) },
      { amount: -35.00, account: 'Splurge', category: 'Entertainment', comment: 'Concert tickets', date: daysAgo(3) },
      // Smile — holiday fund
      { amount: -200.00, account: 'Smile', category: '@Summer Holiday', comment: '#bucket:Flights:120 #bucket:Hotel:80', date: daysAgo(20) },
      { amount: -150.00, account: 'Smile', category: '@Summer Holiday', comment: '#bucket:Flights:80 #bucket:Hotel:70', date: daysAgo(7) },
      // Fire — emergency fund
      { amount: -100.00, account: 'Fire', category: '@Car Repair Fund', comment: '#bucket:Tyres:60 #bucket:Service:40', date: daysAgo(16) },
      { amount: -75.00, account: 'Fire', category: '@Car Repair Fund', comment: '#bucket:Tyres:40 #bucket:Service:35', date: daysAgo(4) },
      // Mojo
      { amount: -250.00, account: 'Fire', category: '@Mojo', comment: 'Building safety net', date: daysAgo(26) },
    ];

    // ── Income Statement ──
    const sampleRevenues = [
      { tag: 'Salary', amount: 3500 },
      { tag: 'Bonus', amount: 500 },
    ];
    const sampleInterests = [
      { tag: 'MSFT Dividends', amount: 120 },
    ];
    const sampleProperties = [
      { tag: 'Parking Spot Rental', amount: 85 },
    ];

    // ── Expenses (monthly breakdown for cashflow) ──
    const sampleDailyExpenses = [
      { tag: 'Groceries', amount: -188.00 },
      { tag: 'Transport', amount: -12.99 },
      { tag: 'Utilities', amount: -114.99 },
    ];
    const sampleSplurgeExpenses = [
      { tag: 'Dining', amount: -65.00 },
      { tag: 'Entertainment', amount: -35.00 },
    ];
    const sampleSmileExpenses = [
      { tag: 'Summer Holiday', amount: -350.00 },
    ];
    const sampleFireExpenses = [
      { tag: 'Car Repair Fund', amount: -175.00 },
    ];
    const sampleMojoExpenses = [
      { tag: 'Mojo', amount: -250.00 },
    ];

    // ── Balance Sheet: Assets, Shares, Investments, Liabilities ──
    const sampleAssets = [
      { tag: 'Emergency Savings Account', amount: 5200 },
      { tag: 'Car (2019 VW Golf)', amount: 12000 },
    ];
    const sampleShares = [
      { tag: 'MSFT', quantity: 15, price: 420.50 },
      { tag: 'AAPL', quantity: 10, price: 185.30 },
    ];
    const sampleInvestments = [
      { tag: 'Vanguard ETF Portfolio', deposit: 8000, amount: 9450 },
    ];
    const sampleLiabilities = [
      { tag: 'Car Loan', amount: 6500, investment: true, credit: 15000 },
      { tag: 'Credit Card', amount: 1200, investment: false, credit: 5000 },
      { tag: 'Student Loan', amount: 4800, investment: false, credit: 12000 },
    ];

    // ── Smile Projects ──
    const nowIso = iso(today);
    const sampleSmileProjects = [
      {
        title: 'Summer Holiday',
        sub: 'Beach trip with friends',
        phase: 'saving',
        description: 'Two-week beach holiday in Portugal. Flights, hotel, and spending money.',
        targetDate: daysFromNow(120),
        buckets: [
          { id: 'bucket_1', title: 'Flights', target: 600, amount: 200, notes: 'Looking at TAP or Ryanair' },
          { id: 'bucket_2', title: 'Hotel', target: 800, amount: 150, notes: 'Airbnb near the coast' },
          { id: 'bucket_3', title: 'Spending', target: 400, amount: 0 },
        ],
        links: [{ label: 'Skyscanner', url: 'https://skyscanner.com' }],
        actionItems: [
          { text: 'Compare flight prices', done: true, priority: 'high' },
          { text: 'Book accommodation', done: false, priority: 'medium', dueDate: daysFromNow(30) },
        ],
        notes: [{ text: 'Decided on Algarve region', createdAt: nowIso }],
        plannedSubscriptions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    // ── Fire Emergencies (linked to car loan liability) ──
    const sampleFireEmergencies = [
      {
        title: 'Car Repair Fund',
        sub: 'Maintenance for the Golf',
        phase: 'saving',
        description: 'Cover unexpected car repairs — tyres, service, brakes. Linked to car loan liability.',
        targetDate: daysFromNow(180),
        buckets: [
          { id: 'bucket_f1', title: 'Tyres', target: 400, amount: 100, notes: 'Winter + summer set' },
          { id: 'bucket_f2', title: 'Service', target: 300, amount: 75, notes: 'Annual service due in 3 months' },
        ],
        links: [],
        actionItems: [
          { text: 'Get tyre quotes from 3 shops', done: false, priority: 'medium' },
          { text: 'Book annual service', done: false, priority: 'high', dueDate: daysFromNow(60) },
        ],
        notes: [{ text: 'Last service was 11 months ago', createdAt: nowIso }],
        plannedSubscriptions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    // ── Grow Projects ──
    const sampleGrowProjects = [
      {
        title: 'Increase Dividend Income',
        sub: 'Passive income strategy',
        type: 'income-growth',
        phase: 'execute',
        description: 'Build a dividend portfolio targeting €500/month in passive income within 3 years.',
        strategy: 'Invest monthly into high-dividend ETFs and blue-chip stocks. Reinvest dividends.',
        riskScore: 35,
        risks: 'Market volatility, dividend cuts during recessions.',
        amount: 9450,
        cashflow: 120,
        isAsset: true,
        share: { tag: 'MSFT', quantity: 15, price: 420.50 },
        investment: { tag: 'Vanguard ETF Portfolio', deposit: 8000, amount: 9450 },
        liabilitie: null,
        actionItems: [
          { text: 'Set up monthly auto-invest', done: true, priority: 'high' },
          { text: 'Review portfolio allocation quarterly', done: false, priority: 'medium', dueDate: daysFromNow(90) },
        ],
        links: [{ label: 'Vanguard', url: 'https://vanguard.com' }],
        notes: [{ text: 'Started with €8000 initial investment', createdAt: nowIso }],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    // ── Budgets (for current month, matching transaction categories) ──
    const sampleBudgets = [
      { tag: 'Groceries', amount: 250, date: currentMonth },
      { tag: 'Transport', amount: 50, date: currentMonth },
      { tag: 'Utilities', amount: 150, date: currentMonth },
      { tag: 'Dining', amount: 100, date: currentMonth },
      { tag: 'Entertainment', amount: 80, date: currentMonth },
    ];

    // ── Mojo ──
    const sampleMojo = { amount: 1750, target: 5000 };

    // ── Subscriptions ──
    const sampleSubscriptions = [
      { title: 'Netflix', account: 'Splurge', amount: -13.99, startDate: daysAgo(90), endDate: '', category: 'Entertainment', comment: 'Standard plan', frequency: 'monthly' },
      { title: 'Gym Membership', account: 'Daily', amount: -29.90, startDate: daysAgo(180), endDate: '', category: 'Health', comment: 'FitX monthly', frequency: 'monthly' },
    ];

    // ── Save to localStorage ──
    this.localStorage.saveData('transactions', JSON.stringify(sampleTransactions));
    this.localStorage.saveData('subscriptions', JSON.stringify(sampleSubscriptions));
    this.localStorage.saveData('smile', JSON.stringify(sampleSmileProjects));
    this.localStorage.saveData('fire', JSON.stringify(sampleFireEmergencies));
    this.localStorage.saveData('mojo', JSON.stringify(sampleMojo));
    this.localStorage.saveData('revenues', JSON.stringify(sampleRevenues));
    this.localStorage.saveData('interests', JSON.stringify(sampleInterests));
    this.localStorage.saveData('properties', JSON.stringify(sampleProperties));
    this.localStorage.saveData('dailyEx', JSON.stringify(sampleDailyExpenses));
    this.localStorage.saveData('splurgeEx', JSON.stringify(sampleSplurgeExpenses));
    this.localStorage.saveData('smileEx', JSON.stringify(sampleSmileExpenses));
    this.localStorage.saveData('fireEx', JSON.stringify(sampleFireExpenses));
    this.localStorage.saveData('mojoEx', JSON.stringify(sampleMojoExpenses));
    this.localStorage.saveData('assets', JSON.stringify(sampleAssets));
    this.localStorage.saveData('shares', JSON.stringify(sampleShares));
    this.localStorage.saveData('investments', JSON.stringify(sampleInvestments));
    this.localStorage.saveData('liabilities', JSON.stringify(sampleLiabilities));
    this.localStorage.saveData('grow', JSON.stringify(sampleGrowProjects));
    this.localStorage.saveData('budget', JSON.stringify(sampleBudgets));
    this.localStorage.saveData('username', 'Demo User');
    this.localStorage.saveData('email', 'demo@moneyapp.local');
    this.localStorage.saveData('uid', 'demo-user');

    // ── Load into AppState ──
    AppStateService.instance.allTransactions = sampleTransactions as any;
    AppStateService.instance.allSubscriptions = sampleSubscriptions as any;
    AppStateService.instance.allSmileProjects = sampleSmileProjects as any;
    AppStateService.instance.allFireEmergencies = sampleFireEmergencies as any;
    AppStateService.instance.mojo = sampleMojo;
    AppStateService.instance.allRevenues = sampleRevenues;
    AppStateService.instance.allIntrests = sampleInterests;
    AppStateService.instance.allProperties = sampleProperties;
    AppStateService.instance.dailyExpenses = sampleDailyExpenses;
    AppStateService.instance.splurgeExpenses = sampleSplurgeExpenses;
    AppStateService.instance.smileExpenses = sampleSmileExpenses;
    AppStateService.instance.fireExpenses = sampleFireExpenses;
    AppStateService.instance.mojoExpenses = sampleMojoExpenses;
    AppStateService.instance.allAssets = sampleAssets;
    AppStateService.instance.allShares = sampleShares as any;
    AppStateService.instance.allInvestments = sampleInvestments as any;
    AppStateService.instance.liabilities = sampleLiabilities as any;
    AppStateService.instance.allGrowProjects = sampleGrowProjects as any;
    AppStateService.instance.allBudgets = sampleBudgets as any;
    AppStateService.instance.isLoading = false;
    AppStateService.instance.tier2Loaded = true;
    AppStateService.instance.tier3GrowLoaded = true;
    AppStateService.instance.tier3BalanceLoaded = true;
    AppStateService.instance.username = 'Demo User';
    AppStateService.instance.email = 'demo@moneyapp.local';
    ProfileComponent.username = 'Demo User';
    ProfileComponent.mail = 'demo@moneyapp.local';
    ProfileComponent.isUser = false;  // false = logged in

    this.router.navigate(['/home']);
  }

  /** End demo mode: clear flag and demo data. */
  endDemo(): void {
    sessionStorage.removeItem('demo_mode');
    this.router.navigate(['/']);
  }
}
