import { PromptGeneratorService, PromptOptions } from './prompt-generator.service';
import { AppStateService } from './app-state.service';

// Minimal mock for TranslateService
const mockTranslate = { currentLang: 'en' } as any;

// Helper to create transaction test data
function makeTransactions(months: string[], monthlyIncome: number, monthlyExpenses: Record<string, number>): any[] {
  const txns: any[] = [];
  months.forEach(month => {
    if (monthlyIncome > 0) {
      txns.push({ account: 'Income', amount: monthlyIncome, date: `${month}-15`, time: '12:00', category: 'Salary', comment: '' });
    }
    Object.entries(monthlyExpenses).forEach(([category, amount]) => {
      txns.push({ account: 'Daily', amount: -amount, date: `${month}-10`, time: '12:00', category, comment: '' });
    });
  });
  return txns;
}

describe('PromptGeneratorService', () => {
  let service: PromptGeneratorService;

  beforeEach(() => {
    service = new PromptGeneratorService(mockTranslate);
    mockTranslate.currentLang = 'en';
    const state = AppStateService.instance;
    state.allRevenues = [];
    state.allIntrests = [];
    state.allProperties = [];
    state.dailyExpenses = [];
    state.splurgeExpenses = [];
    state.smileExpenses = [];
    state.fireExpenses = [];
    state.mojoExpenses = [];
    state.allSubscriptions = [];
    state.allAssets = [];
    state.allShares = [];
    state.allInvestments = [];
    state.liabilities = [];
    state.allGrowProjects = [];
    state.allTransactions = [];
    state.mojo = { amount: 0, target: 0 };
    state.daily = 60;
    state.splurge = 10;
    state.smile = 10;
    state.fire = 20;
  });

  describe('toRange()', () => {
    it('should handle zero', () => {
      expect(service.toRange(0)).toContain('0');
    });

    it('should return range for amounts 100-500', () => {
      expect(service.toRange(250)).toMatch(/201.*300/);
    });

    it('should return range for amounts 500-5000', () => {
      const result = service.toRange(1750);
      expect(result).toMatch(/1.*500.*2.*000/);
    });

    it('should return range for amounts 5000-50000', () => {
      const result = service.toRange(12000);
      expect(result).toMatch(/10.*000.*15.*000/);
    });

    it('should return range for amounts over 50000', () => {
      const result = service.toRange(75000);
      expect(result).toMatch(/70.*000.*80.*000/);
    });

    it('should return range of absolute value for negative amounts', () => {
      expect(service.toRange(-100)).toMatch(/100.*150/);
    });
  });

  describe('getDefaultOptions()', () => {
    it('should return anonymized by default', () => {
      const opts = service.getDefaultOptions();
      expect(opts.anonymized).toBe(true);
    });

    it('should include all tracks', () => {
      const opts = service.getDefaultOptions();
      expect(opts.includeAssets).toBe(true);
      expect(opts.includeShares).toBe(true);
      expect(opts.includeInvestments).toBe(true);
    });

    it('should default to moderate risk', () => {
      const opts = service.getDefaultOptions();
      expect(opts.riskTolerance).toBe('moderate');
    });

    it('should default new profile fields to empty/zero', () => {
      const opts = service.getDefaultOptions();
      expect(opts.primaryGoal).toBe('');
      expect(opts.targetAmount).toBe(0);
      expect(opts.maxDrawdown).toBe('');
      expect(opts.riskPreference).toBe('');
      expect(opts.taxSituation).toBe('');
      expect(opts.churchTax).toBe(false);
      expect(opts.monthlyBudget).toBe(0);
      expect(opts.willingToCutExpenses).toBe(false);
      expect(opts.weeklyHours).toBe(0);
      expect(opts.skills).toBe('');
      expect(opts.creditScore).toBe('');
      expect(opts.maxLoanPayment).toBe(0);
      expect(opts.availableCapital).toBe(0);
      expect(opts.cashBuffer).toBe(0);
      expect(opts.leveragePreference).toBe('');
      expect(opts.geoFocus).toBe('');
      expect(opts.complexityTolerance).toBe('');
      expect(opts.exitStrategy).toBe('');
    });
  });

  describe('generateGrowPrompt()', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should contain context, instructions, and output format sections', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('FINANCIAL CONTEXT');
      expect(prompt).toContain('INSTRUCTIONS');
      expect(prompt).toContain('OUTPUT FORMAT');
    });

    it('should not contain disclaimer (moved to app UI)', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('not financial advice');
    });

    it('should request research-first analysis', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('MARKET RESEARCH');
      expect(prompt).toContain('COMMUNITY INSIGHTS');
      expect(prompt).toContain('SOURCES & LINKS');
      expect(prompt).toContain('DEEP DIVE');
      expect(prompt).toContain('ACTIONABLE NEXT STEPS');
    });

    it('should request JSON per suggestion and combined array at end', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('code block');
      expect(prompt).toContain('DECISION MATRIX');
      expect(prompt).toContain('combined JSON array');
    });

    it('should include budget allocation', () => {
      // With no transactions, falls back to static view with budget allocation
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Daily 60%');
      expect(prompt).toContain('Fire 20%');
    });

    it('should compute monthly averages from transactions', () => {
      AppStateService.instance.allTransactions = makeTransactions(
        ['2025-01', '2025-02', '2025-03', '2025-04'],
        3000, { Groceries: 400, Rent: 800 }
      );
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Monthly Averages');
      expect(prompt).toContain('Avg monthly income');
      expect(prompt).toContain('Avg monthly expenses');
      expect(prompt).toContain('Savings rate');
      expect(prompt).toContain('Data history: 4 months');
    });

    it('should anonymize monthly averages by default', () => {
      AppStateService.instance.allTransactions = makeTransactions(
        ['2025-01', '2025-02', '2025-03'],
        3777, { Groceries: 412 }
      );
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('3777');
      expect(prompt).not.toContain('412');
      expect(prompt).toContain('Avg monthly income');
    });

    it('should show exact monthly averages when anonymized=false', () => {
      options.anonymized = false;
      AppStateService.instance.allTransactions = makeTransactions(
        ['2025-01', '2025-02'],
        4000, { Groceries: 500 }
      );
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('4000');
      expect(prompt).toContain('500');
    });

    it('should show top expense categories', () => {
      AppStateService.instance.allTransactions = makeTransactions(
        ['2025-01', '2025-02', '2025-03'],
        3000, { Groceries: 400, Rent: 800, Transport: 150, Dining: 200, Entertainment: 100 }
      );
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Top Expense Categories');
      expect(prompt).toContain('Rent');
      expect(prompt).toContain('Groceries');
    });

    it('should show spending distribution by account', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -500, date: '2025-01-10', time: '12:00', category: 'Food', comment: '' },
        { account: 'Splurge', amount: -200, date: '2025-01-10', time: '12:00', category: 'Shopping', comment: '' },
        { account: 'Income', amount: 3000, date: '2025-01-15', time: '12:00', category: 'Salary', comment: '' },
      ] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Spending Distribution');
      expect(prompt).toContain('Daily:');
      expect(prompt).toContain('Splurge:');
      expect(prompt).toContain('Target allocation');
    });

    it('should show trends and outliers with enough data', () => {
      // 6 months of normal spending + 1 outlier month
      const txns: any[] = [];
      ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'].forEach(m => {
        txns.push({ account: 'Income', amount: 3000, date: `${m}-15`, time: '12:00', category: 'Salary', comment: '' });
        txns.push({ account: 'Daily', amount: -800, date: `${m}-10`, time: '12:00', category: 'Rent', comment: '' });
      });
      // Outlier: huge spending in March
      txns.push({ account: 'Daily', amount: -3000, date: '2025-03-20', time: '12:00', category: 'Emergency', comment: '' });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Trends & Notable Months');
      expect(prompt).toContain('Income');
      expect(prompt).toContain('trend');
    });

    it('should detect variable income', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 1000, date: '2025-01-15', time: '12:00', category: 'Freelance', comment: '' },
        { account: 'Income', amount: 5000, date: '2025-02-15', time: '12:00', category: 'Freelance', comment: '' },
        { account: 'Income', amount: 800, date: '2025-03-15', time: '12:00', category: 'Freelance', comment: '' },
        { account: 'Income', amount: 4200, date: '2025-04-15', time: '12:00', category: 'Freelance', comment: '' },
        { account: 'Daily', amount: -500, date: '2025-01-10', time: '12:00', category: 'Food', comment: '' },
        { account: 'Daily', amount: -500, date: '2025-02-10', time: '12:00', category: 'Food', comment: '' },
        { account: 'Daily', amount: -500, date: '2025-03-10', time: '12:00', category: 'Food', comment: '' },
        { account: 'Daily', amount: -500, date: '2025-04-10', time: '12:00', category: 'Food', comment: '' },
      ] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('variable');
    });

    it('should skip current month to avoid partial data', () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 9999, date: `${currentMonth}-05`, time: '12:00', category: 'Salary', comment: '' },
        { account: 'Income', amount: 3000, date: '2025-01-15', time: '12:00', category: 'Salary', comment: '' },
        { account: 'Daily', amount: -800, date: '2025-01-10', time: '12:00', category: 'Food', comment: '' },
      ] as any;
      options.anonymized = false;
      const prompt = service.generateGrowPrompt(options);
      // Current month's 9999 should not appear in the averages
      expect(prompt).not.toContain('9999');
      expect(prompt).toContain('Data history: 1 months');
    });

    it('should include subscriptions', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' },
        { title: 'Gym', account: 'Daily', amount: 40, startDate: '', endDate: '', category: 'Health', comment: '' },
      ] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('subscriptions');
      expect(prompt).toContain('2 active');
    });

    it('should fallback to static data when no transactions', () => {
      AppStateService.instance.allRevenues = [{ tag: 'Salary', amount: 2847 }] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Monthly income (static)');
    });

    it('should include risk tolerance in instructions', () => {
      options.riskTolerance = 'aggressive';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('aggressive');
    });

    it('should include investment horizon', () => {
      options.investmentHorizon = '3-5';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('3-5 years');
    });

    it('should include only selected tracks', () => {
      options.includeAssets = false;
      options.includeShares = true;
      options.includeInvestments = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('Asset Trading');
      expect(prompt).toContain('Shares & Dividends');
      expect(prompt).not.toContain('Leveraged Investments');
    });

    it('should include loan analysis when enabled', () => {
      options.considerLoans = true;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('loan');
    });

    it('should skip loan analysis when disabled', () => {
      options.considerLoans = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('evaluate loan');
    });

    it('should include existing grow projects count', () => {
      AppStateService.instance.allGrowProjects = [
        { title: 'Test', sub: '', phase: 'idea', description: '', strategy: '', riskScore: 0, risks: '', cashflow: 0, amount: 1000, isAsset: false, share: null, investment: null, liabilitie: null, actionItems: [], links: [], notes: [], createdAt: '', updatedAt: '' }
      ];
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('EXISTING GROW PROJECTS (1)');
    });

    it('should describe existing grow projects in detail', () => {
      AppStateService.instance.allGrowProjects = [
        { title: 'VWCE ETF', sub: 'Global ETF', phase: 'execute', description: 'Monthly DCA into world ETF', strategy: 'Dollar cost averaging', riskScore: 2, risks: '2/5', cashflow: 0, amount: 5000, isAsset: false, share: { tag: 'VWCE', quantity: 45, price: 111 }, investment: null, liabilitie: null, actionItems: [], links: [], notes: [], createdAt: '', updatedAt: '' }
      ];
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('"VWCE ETF"');
      expect(prompt).toContain('(Global ETF)');
      expect(prompt).toContain('[execute]');
      expect(prompt).toContain('Monthly DCA into world ETF');
      expect(prompt).toContain('Dollar cost averaging');
      expect(prompt).toContain('Type: Share');
      expect(prompt).toContain('complement (not duplicate)');
    });

    it('should anonymize grow project amounts when anonymized=true', () => {
      AppStateService.instance.allGrowProjects = [
        { title: 'TestGrow', sub: '', phase: 'idea', description: '', strategy: '', riskScore: 0, risks: '', cashflow: 823, amount: 12345, isAsset: false, share: null, investment: null, liabilitie: null, actionItems: [], links: [], notes: [], createdAt: '', updatedAt: '' }
      ];
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('"TestGrow"');
      // Exact values should NOT appear — anonymized to ranges
      expect(prompt).not.toContain('12345');
      expect(prompt).not.toContain('823');
    });

    it('should include field explanations with examples', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('FIELD EXPLANATIONS & EXAMPLES');
      expect(prompt).toContain('ASSET type');
      expect(prompt).toContain('SHARE type');
      expect(prompt).toContain('INVESTMENT type');
      expect(prompt).toContain('"isAsset": true');
      expect(prompt).toContain('"share":');
      expect(prompt).toContain('"investment":');
      expect(prompt).toContain('"liabilitie":');
    });

    it('should include net worth and DTI when data is available', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01', '2025-02'], 4000, { Rent: 800 });
      AppStateService.instance.allShares = [{ tag: 'VWCE', quantity: 10, price: 100 }] as any;
      AppStateService.instance.liabilities = [{ tag: 'Car Loan', amount: 15000, credit: 400, investment: false }] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Net worth');
      expect(prompt).toContain('Debt-to-income ratio');
    });

    it('should show asset details when not anonymized', () => {
      options.anonymized = false;
      AppStateService.instance.allAssets = [{ tag: 'Gold', amount: 3000 }] as any;
      AppStateService.instance.allShares = [{ tag: 'AAPL', quantity: 10, price: 150 }] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Gold:');
      expect(prompt).toContain('3000');
      expect(prompt).toContain('AAPL: 10 units');
    });

    it('should include emergency fund with target and progress', () => {
      AppStateService.instance.mojo = { amount: 3000, target: 6000 };
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Emergency Fund');
      expect(prompt).toContain('Progress: 50%');
    });

    it('should show emergency fund coverage in months', () => {
      AppStateService.instance.mojo = { amount: 4000, target: 8000 };
      AppStateService.instance.allTransactions = makeTransactions(
        ['2025-01', '2025-02', '2025-03'],
        3000, { Rent: 800, Food: 400 }
      );
      options.anonymized = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Coverage');
      expect(prompt).toContain('months of expenses');
    });

    it('should indicate no emergency fund when not configured', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Emergency Fund');
      expect(prompt).toContain('No emergency fund configured');
    });

    it('should include broker when specified', () => {
      options.broker = 'Trade Republic';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Trade Republic');
      expect(prompt).toContain('instruments available');
    });

    it('should include country/tax residency when specified', () => {
      options.country = 'Germany';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Germany');
      expect(prompt).toContain('tax');
    });

    it('should not include broker/country when empty', () => {
      options.broker = '';
      options.country = '';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('My broker/platform');
      expect(prompt).not.toContain('Tax residency');
    });

    it('should show subscription details when not anonymized', () => {
      options.anonymized = false;
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' },
      ] as any;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Netflix');
    });

    it('should include country market context in instructions', () => {
      options.country = 'Germany';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Germany / European market context');
    });

    it('should include quality requirements section', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('QUALITY REQUIREMENTS');
      expect(prompt).toContain('Rank all suggestions');
      expect(prompt).toContain('coherent portfolio');
      expect(prompt).toContain('market timing');
    });

    it('should include scenario analysis in risk assessment', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('best-case, base-case, and worst-case');
    });

    it('should include asymmetric opportunities directive', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('asymmetric opportunities');
    });

    it('should include complexity instruction when specified', () => {
      options.complexityTolerance = 'low';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Only suggest simple, passive strategies');
    });

    it('should include exit instruction when sell', () => {
      options.exitStrategy = 'sell';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('exit costs');
    });

    it('should include geo instruction when local', () => {
      options.geoFocus = 'local';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('local/domestic market');
    });

    it('should include leverage instruction when avoid', () => {
      options.leveragePreference = 'avoid';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('avoid debt');
    });
  });

  describe('Investor Profile', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should include primary goal when specified', () => {
      options.primaryGoal = 'build-capital';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Build capital / grow net worth');
    });

    it('should include goal-specific instructions', () => {
      options.primaryGoal = 'monthly-income';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('generating monthly passive income');
    });

    it('should include target amount when specified', () => {
      options.primaryGoal = 'build-capital';
      options.targetAmount = 50000;
      options.anonymized = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('50000');
    });

    it('should anonymize target amount', () => {
      options.primaryGoal = 'build-capital';
      options.targetAmount = 50000;
      options.anonymized = true;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Target in');
      expect(prompt).not.toContain('€50000');
    });

    it('should include max drawdown when specified', () => {
      options.maxDrawdown = '20';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Max acceptable portfolio drawdown: 20%');
    });

    it('should include risk preference as percentage weights', () => {
      options.riskPreference = 'cashflow';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Growth 20% / Cashflow 80%');
    });

    it('should show balanced weights', () => {
      options.riskPreference = 'balanced';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Growth 50% / Cashflow 50%');
    });

    it('should include tax situation', () => {
      options.taxSituation = 'employed';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Employment / tax type: employed');
    });

    it('should include church tax when enabled', () => {
      options.taxSituation = 'employed';
      options.churchTax = true;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Church tax: yes');
    });

    it('should not show church tax when disabled', () => {
      options.taxSituation = 'employed';
      options.churchTax = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('Church tax');
    });

    it('should include weekly hours', () => {
      options.weeklyHours = 10;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('10 hours');
    });

    it('should include skills', () => {
      options.skills = 'coding, finance';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('coding, finance');
    });

    it('should include credit score when specified', () => {
      options.creditScore = 'good';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Credit score (Schufa): good');
    });

    it('should include max loan payment', () => {
      options.maxLoanPayment = 500;
      options.anonymized = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('500');
    });

    it('should include available capital', () => {
      options.availableCapital = 5000;
      options.anonymized = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Available capital to invest immediately');
      expect(prompt).toContain('5000');
    });

    it('should anonymize available capital', () => {
      options.availableCapital = 5000;
      options.anonymized = true;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Available capital to invest immediately');
      expect(prompt).not.toContain('€5000');
    });

    it('should include cash buffer', () => {
      options.cashBuffer = 2000;
      options.anonymized = false;
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Minimum cash buffer to keep');
      expect(prompt).toContain('2000');
    });

    it('should include leverage preference', () => {
      options.leveragePreference = 'active';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Actively seeking leverage');
    });

    it('should include geographic focus', () => {
      options.geoFocus = 'eu';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('EU / European markets');
    });

    it('should include complexity tolerance', () => {
      options.complexityTolerance = 'low';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('simple, passive strategies only');
    });

    it('should include exit strategy sell', () => {
      options.exitStrategy = 'sell';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Sell / exit after');
    });

    it('should include exit strategy hold', () => {
      options.exitStrategy = 'hold';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Hold long-term');
    });

    it('should not show investor profile when all fields empty', () => {
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('Investor Profile');
    });
  });

  describe('Available Capital', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should use user-specified monthly budget over calculated surplus', () => {
      options.monthlyBudget = 500;
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 1000 });
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('user-specified');
    });

    it('should show estimated investable surplus when no budget specified', () => {
      options.monthlyBudget = 0;
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 1000 });
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Estimated investable surplus');
    });

    it('should include willing-to-cut flag', () => {
      options.willingToCutExpenses = true;
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 1000 });
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Willing to reduce expenses');
    });
  });

  describe('Language support', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should not add language line when English', () => {
      mockTranslate.currentLang = 'en';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('Please write your entire response in');
    });

    it('should add German language line when lang is de', () => {
      mockTranslate.currentLang = 'de';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Please write your entire response in German');
    });

    it('should add Spanish language line when lang is es', () => {
      mockTranslate.currentLang = 'es';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).toContain('Please write your entire response in Spanish');
    });

    it('should handle unknown language codes gracefully', () => {
      mockTranslate.currentLang = 'jp';
      const prompt = service.generateGrowPrompt(options);
      expect(prompt).not.toContain('Please write your entire response in');
    });
  });

  // =========================================================================
  // PHASE 2: BUDGET OPTIMIZER
  // =========================================================================
  describe('generateBudgetOptimizerPrompt()', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should generate a prompt with budget context', () => {
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('BUDGET CONTEXT');
      expect(prompt).toContain('Current Budget Allocation');
      expect(prompt).toContain('Daily');
      expect(prompt).toContain('Splurge');
      expect(prompt).toContain('Smile');
      expect(prompt).toContain('Fire');
    });

    it('should show actual vs target allocation when transactions exist', () => {
      AppStateService.instance.allTransactions = makeTransactions(
        ['2025-01', '2025-02'],
        3000,
        { Food: 500 }
      );
      AppStateService.instance.allTransactions.push(
        { account: 'Daily', amount: -1200, date: '2025-01-05', time: '12:00', category: 'Rent', comment: '' },
        { account: 'Splurge', amount: -300, date: '2025-01-15', time: '12:00', category: 'Shopping', comment: '' },
        { account: 'Smile', amount: -200, date: '2025-01-20', time: '12:00', category: 'Hobby', comment: '' }
      );
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('Actual Spending Distribution');
      expect(prompt).toContain('actual vs');
      expect(prompt).toContain('target');
    });

    it('should show top expense categories', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -800, date: '2025-01-05', time: '12:00', category: 'Rent', comment: '' },
        { account: 'Daily', amount: -400, date: '2025-01-10', time: '12:00', category: 'Groceries', comment: '' },
        { account: 'Splurge', amount: -200, date: '2025-01-15', time: '12:00', category: 'Dining', comment: '' },
        { account: 'Income', amount: 3000, date: '2025-01-15', time: '12:00', category: 'Salary', comment: '' }
      ];
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('Top 10 Expense Categories');
      expect(prompt).toContain('Rent');
      expect(prompt).toContain('Groceries');
    });

    it('should include subscriptions in budget context', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' },
        { title: 'Spotify', account: 'Daily', amount: 10, startDate: '', endDate: '', category: 'Music', comment: '' }
      ] as any;
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('Recurring Subscriptions');
      expect(prompt).toContain('2 active');
    });

    it('should show spending trends', () => {
      const txns: any[] = [];
      ['2025-01', '2025-02', '2025-03'].forEach(m => {
        txns.push({ account: 'Income', amount: 3000, date: `${m}-15`, time: '12:00', category: 'Salary', comment: '' });
        txns.push({ account: 'Daily', amount: -1000, date: `${m}-10`, time: '12:00', category: 'Rent', comment: '' });
      });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('Recent Trends');
      expect(prompt).toContain('trend');
    });

    it('should respect anonymization', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      options.anonymized = true;
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).not.toContain('€3000');
      // Check for em dash (–) or "under" which indicate range-based anonymization
      expect(prompt).toMatch(/–|under/i);
    });

    it('should include exact values when not anonymized', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      options.anonymized = false;
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('3000');
    });

    it('should contain output format instructions with JSON', () => {
      const prompt = service.generateBudgetOptimizerPrompt(options);
      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('recommendedAllocation');
      expect(prompt).toContain('daily');
      expect(prompt).toContain('actionItems');
    });
  });

  // =========================================================================
  // PHASE 2: SUBSCRIPTION AUDIT
  // =========================================================================
  describe('generateSubscriptionAuditPrompt()', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should generate a prompt with subscription context', () => {
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('SUBSCRIPTIONS');
      expect(prompt).toContain('audit');
    });

    it('should list all subscriptions when not anonymized', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' },
        { title: 'Spotify', account: 'Daily', amount: 10, startDate: '', endDate: '', category: 'Music', comment: '' },
        { title: 'Gym', account: 'Daily', amount: 40, startDate: '', endDate: '', category: 'Health', comment: '' }
      ] as any;
      options.anonymized = false;
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('Netflix');
      expect(prompt).toContain('Spotify');
      expect(prompt).toContain('Gym');
      expect(prompt).toContain('15');
      expect(prompt).toContain('10');
      expect(prompt).toContain('40');
    });

    it('should group subscriptions by category', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' },
        { title: 'Disney+', account: 'Daily', amount: 10, startDate: '', endDate: '', category: 'Streaming', comment: '' },
        { title: 'Spotify', account: 'Daily', amount: 10, startDate: '', endDate: '', category: 'Music', comment: '' }
      ] as any;
      options.anonymized = false;
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('Streaming');
      expect(prompt).toContain('(2 subscriptions');
      expect(prompt).toContain('Music');
    });

    it('should show total monthly and annual costs', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' },
        { title: 'Gym', account: 'Daily', amount: 40, startDate: '', endDate: '', category: 'Health', comment: '' }
      ] as any;
      options.anonymized = false;
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('Total monthly cost');
      expect(prompt).toContain('Total annual cost');
      expect(prompt).toContain('55'); // 15 + 40
      expect(prompt).toContain('660'); // 55 * 12
    });

    it('should calculate subscriptions as % of income when transactions exist', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' }
      ] as any;
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('Financial Context');
      expect(prompt).toContain('% of income');
      expect(prompt).toContain('% of total expenses');
    });

    it('should handle no subscriptions gracefully', () => {
      AppStateService.instance.allSubscriptions = [];
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('No subscriptions currently tracked');
    });

    it('should respect anonymization', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Daily', amount: 15, startDate: '', endDate: '', category: 'Streaming', comment: '' }
      ] as any;
      options.anonymized = true;
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).not.toContain('Netflix');
      expect(prompt).toMatch(/–|under|total/i);
    });

    it('should contain output format with recommendations', () => {
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('recommendations');
      expect(prompt).toContain('action');
      expect(prompt).toContain('monthlySavings');
      expect(prompt).toContain('annualSavings');
    });

    it('should include evaluation criteria', () => {
      const prompt = service.generateSubscriptionAuditPrompt(options);
      expect(prompt).toContain('VALUE');
      expect(prompt).toContain('USAGE');
      expect(prompt).toContain('ALTERNATIVES');
      expect(prompt).toContain('OVERLAP');
      expect(prompt).toContain('NEGOTIATION');
    });
  });

  // =========================================================================
  // PHASE 2: EXPENSE PATTERN ANALYSIS
  // =========================================================================
  describe('generateExpensePatternAnalysisPrompt()', () => {
    let options: PromptOptions;

    beforeEach(() => {
      options = service.getDefaultOptions();
    });

    it('should generate a prompt with expense pattern context', () => {
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('EXPENSE PATTERNS');
      expect(prompt).toContain('pattern');
      expect(prompt).toContain('blind spots');
    });

    it('should show month-by-month breakdown', () => {
      const txns: any[] = [];
      ['2025-01', '2025-02', '2025-03'].forEach(m => {
        txns.push({ account: 'Income', amount: 3000, date: `${m}-15`, time: '12:00', category: 'Salary', comment: '' });
        txns.push({ account: 'Daily', amount: -1000, date: `${m}-10`, time: '12:00', category: 'Rent', comment: '' });
      });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('Month-by-Month Breakdown');
      expect(prompt).toContain('2025-01:');
      expect(prompt).toContain('2025-02:');
      expect(prompt).toContain('2025-03:');
    });

    it('should show top 15 categories', () => {
      const txns: any[] = [];
      txns.push({ account: 'Income', amount: 3000, date: '2025-01-15', time: '12:00', category: 'Salary', comment: '' });
      ['Rent', 'Groceries', 'Transport', 'Dining', 'Entertainment', 'Shopping', 'Health', 'Education'].forEach(cat => {
        txns.push({ account: 'Daily', amount: -Math.floor(Math.random() * 300 + 100), date: '2025-01-10', time: '12:00', category: cat, comment: '' });
      });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('Top 15 Expense Categories');
      expect(prompt).toContain('Rent');
      expect(prompt).toContain('Groceries');
    });

    it('should detect spending volatility', () => {
      const txns: any[] = [];
      // High volatility months
      ['2025-01', '2025-02', '2025-03', '2025-04'].forEach((m, i) => {
        const expense = [500, 2000, 600, 2500][i]; // Very volatile
        txns.push({ account: 'Income', amount: 3000, date: `${m}-15`, time: '12:00', category: 'Salary', comment: '' });
        txns.push({ account: 'Daily', amount: -expense, date: `${m}-10`, time: '12:00', category: 'Various', comment: '' });
      });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('Spending Volatility');
      expect(prompt).toContain('HIGH');
    });

    it('should show highest and lowest expense months', () => {
      const txns: any[] = [];
      ['2025-01', '2025-02', '2025-03'].forEach((m, i) => {
        const expense = [1000, 2500, 800][i];
        txns.push({ account: 'Income', amount: 3000, date: `${m}-15`, time: '12:00', category: 'Salary', comment: '' });
        txns.push({ account: 'Daily', amount: -expense, date: `${m}-10`, time: '12:00', category: 'Expenses', comment: '' });
      });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('Highest expense month');
      expect(prompt).toContain('Lowest expense month');
      expect(prompt).toContain('2025-02'); // highest
      expect(prompt).toContain('2025-03'); // lowest
    });

    it('should show long-term trends with enough data', () => {
      const txns: any[] = [];
      ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'].forEach((m, i) => {
        const expense = 1000 + (i * 100); // Increasing trend
        txns.push({ account: 'Income', amount: 3000, date: `${m}-15`, time: '12:00', category: 'Salary', comment: '' });
        txns.push({ account: 'Daily', amount: -expense, date: `${m}-10`, time: '12:00', category: 'Expenses', comment: '' });
      });
      AppStateService.instance.allTransactions = txns;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('Long-term Trend');
      expect(prompt).toContain('INCREASING');
    });

    it('should handle no transaction history', () => {
      AppStateService.instance.allTransactions = [];
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('No transaction history available');
    });

    it('should respect anonymization', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      options.anonymized = true;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).not.toContain('€3000');
      expect(prompt).not.toContain('€500');
      expect(prompt).toMatch(/–|under/i);
    });

    it('should show exact amounts when not anonymized', () => {
      AppStateService.instance.allTransactions = makeTransactions(['2025-01'], 3000, { Food: 500 });
      options.anonymized = false;
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('3000');
      expect(prompt).toContain('500');
    });

    it('should contain output format with patterns and insights', () => {
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('keyInsights');
      expect(prompt).toContain('patterns');
      expect(prompt).toContain('moneyLeaks');
      expect(prompt).toContain('recommendations');
      expect(prompt).toContain('recurring-waste');
      expect(prompt).toContain('seasonal-spike');
    });

    it('should include focus areas in instructions', () => {
      const prompt = service.generateExpensePatternAnalysisPrompt(options);
      expect(prompt).toContain('PATTERNS');
      expect(prompt).toContain('ANOMALIES');
      expect(prompt).toContain('CATEGORIES');
      expect(prompt).toContain('HIDDEN WASTE');
      expect(prompt).toContain('OPPORTUNITIES');
    });
  });
});
