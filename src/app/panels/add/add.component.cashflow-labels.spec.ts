import { assetSellComment } from '../../shared/asset-coins.utils';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AddComponent } from './add.component';
import { AppStateService } from '../../shared/services/app-state.service';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import { IncomeStatementService } from '../../shared/services/income-statement.service';
import { ToastService } from '../../shared/services/toast.service';
import { ProfileComponent } from '../profile/profile.component';

/**
 * The property labels differ per language (EFH, SFH, MAI, CUF, 独栋, منزل...) and the label is the
 * Grow project's title, the Investment's tag, the `M-` mortgage name and the `<label> Cashflow`
 * subscription. This drives the real Add dialog through plan -> buy -> sell for each of them, to
 * prove nothing downstream depends on the label being German or plain ASCII.
 */
const LABELS = [
  'EFH',
  'SFH',
  'MAI',
  'CUF',
  '独栋',
  'منزل',
  'عمارة4',
  'APT8',
  'DH',
  'SDH',
  'JUM',
  'PAR',
  '双拼',
  'مزدوج',
  'APH12',
  'CPX24',
  'RES60',
  'CPL12',
  '公寓楼60',
  'مجمع24',
];

const PROPERTY = {
  id: 'classic-small-efh',
  title: 'Einfamilienhaus',
  assetKind: 'investment' as const,
  symbol: 'EFH',
  depositMinor: 300000,
  mortgageMinor: 4700000,
  cashflowMinor: 10000,
};

function setUp() {
  (AppStateService as any)._instance = undefined;
  localStorage.clear();
  ProfileComponent.mail = 'player@cashflow.example';
  const state = AppStateService.instance;
  state.tier2Loaded = true;
  state.tier3BalanceLoaded = true;
  state.tier3GrowLoaded = true;
  Object.assign(state, {
    allRevenues: [],
    allIntrests: [],
    allProperties: [],
    dailyExpenses: [],
    splurgeExpenses: [],
    smileExpenses: [],
    fireExpenses: [],
    mojoExpenses: [],
    allSmileProjects: [],
    allFireEmergencies: [],
    allShares: [],
    allInvestments: [],
    allGrowProjects: [],
    allAssets: [],
    liabilities: [],
    allSubscriptions: [],
    allTransactions: [],
    mojo: { amount: 0, target: 0 },
    daily: 60,
    splurge: 10,
    smile: 10,
    fire: 20,
  });

  const persistence = {
    batchWriteAndSync: jest.fn((config) => config.onSuccess()),
    writeAndSync: jest.fn((config) => config.onSuccess()),
  };
  const translate = { instant: jest.fn((key: string) => key), currentLang: 'en' };
  const game = new CashflowGameService(
    persistence as any,
    new IncomeStatementService({ saveData: jest.fn() } as any),
    translate as any,
  );

  TestBed.configureTestingModule({
    providers: [{ provide: ToastService, useValue: { show: jest.fn() } }],
  });
  const local = { getData: jest.fn(() => ''), saveData: jest.fn() };
  const database = { writeObject: jest.fn(), batchWrite: jest.fn(() => of(null)) };
  const component = TestBed.runInInjectionContext(
    () =>
      new AddComponent(
        { navigate: jest.fn() } as any,
        local as any,
        database as any,
        {} as any,
        {} as any,
        { logDataOperation: jest.fn(), logActivity: jest.fn() } as any,
        {} as any,
        game,
      ),
  );
  return { state, game, component };
}

/** What pressing Buy/Sell in Grow pre-fills into the dialog, then Add. */
function submit(component: AddComponent, account: string, category: string, comment: string) {
  AddComponent.selectedOption = account;
  AddComponent.categoryTextField = category;
  AddComponent.commentTextField = comment;
  AddComponent.amountTextField = account === 'Income' ? '1' : '-1';
  AddComponent.isLiabilitie = false;
  AddComponent.loanTextField = '';
  AddComponent.creditTextField = '';
  component.addTransaction();
  jest.runAllTimers();
}

describe('Cashflow-game property labels through the Add dialog (plan -> buy -> sell)', () => {
  // The dialog lazily imports the pages it refreshes (Accounting, Daily...) a moment after start-up;
  // wait for that on real timers, before the tests switch to fake ones.
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });

  beforeEach(() => {
    jest.useFakeTimers();
    window.alert = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  for (const label of LABELS) {
    it(`"${label}": buying books the investment, mortgage and passive income; selling clears them all`, () => {
      const { state, game, component } = setUp();
      game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });

      // planned in the language that uses this label
      let title = '';
      game.applyDealCard(
        PROPERTY,
        { onSuccess: (t) => (title = t), onError: jest.fn() },
        { symbol: label },
      );
      expect(title).toBe(label);
      expect(state.allGrowProjects[0]).toMatchObject({ title: label, phase: 'plan' });

      // BUY - exactly what Grow's Buy button pre-fills
      submit(component, 'Fire', `@${label}`, `Buy Investment ${label} 3000 47000;`);

      expect(window.alert).not.toHaveBeenCalled();
      expect(state.allInvestments).toContainEqual({ tag: label, deposit: 3000, amount: 47000 });
      expect(state.liabilities.find((l) => l.tag === `M-${label}`)?.amount).toBe(47000);
      expect(state.allGrowProjects[0]).toMatchObject({ status: 'bought', phase: 'execute' });
      // the monthly income exists AND is registered with Payday
      expect(
        state.allSubscriptions.some((s) => s.title === `${label} Cashflow` && s.amount === 100),
      ).toBe(true);
      expect(state.cashflowGame.gameSubscriptionTitles).toContain(`${label} Cashflow`);
      // the deposit left the books under the label
      const payment = state.allTransactions.find((t) => t.category === `@${label}`);
      expect(payment?.amount).toBeLessThan(0);
      expect(payment?.comment).toContain('#cashflow');

      // it appears by name in the live passive income
      const passive = state.allSubscriptions.filter(
        (s) =>
          state.cashflowGame.gameSubscriptionTitles.includes(s.title) &&
          s.title.endsWith(' Cashflow'),
      );
      expect(passive.map((s) => s.title.replace(/ Cashflow$/, ''))).toContain(label);

      // SELL the whole position
      submit(component, 'Income', `@${label}`, `Sell Investment ${label} 3000 47000;`);

      expect(window.alert).not.toHaveBeenCalled();
      expect(state.allInvestments.some((i) => i.tag === label)).toBe(false);
      expect(state.liabilities.some((l) => l.tag === `M-${label}`)).toBe(false);
      expect(state.allSubscriptions.some((s) => s.title === `${label} Cashflow`)).toBe(false);
      expect(state.allGrowProjects[0]).toMatchObject({ status: 'sold', phase: 'completed' });

      // every step is on the History, with the right name
      const kinds = game.historySteps().map((step) => step.kind);
      expect(kinds).toContain('buyInvestment');
      expect(kinds).toContain('sellInvestment');
      expect(game.historySteps().find((s) => s.kind === 'sellInvestment')?.detail).toBe(label);
    });
  }

  it('a second copy is labelled "<label>-II" and both can be bought and sold independently', () => {
    const { state, game, component } = setUp();
    game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });
    const titles: string[] = [];
    for (let i = 0; i < 2; i++) {
      game.applyDealCard(
        PROPERTY,
        { onSuccess: (t) => titles.push(t), onError: jest.fn() },
        { symbol: 'منزل' },
      );
    }
    expect(titles).toEqual(['منزل', 'منزل-II']);

    for (const title of titles) {
      submit(component, 'Fire', `@${title}`, `Buy Investment ${title} 3000 47000;`);
    }
    expect(state.allInvestments.map((i) => i.tag).sort()).toEqual([...titles].sort());

    submit(component, 'Income', '@منزل-II', 'Sell Investment منزل-II 3000 47000;');
    expect(state.allInvestments.map((i) => i.tag)).toEqual(['منزل']);
    expect(state.allSubscriptions.some((s) => s.title === 'منزل Cashflow')).toBe(true); // the other keeps paying
    expect(state.allSubscriptions.some((s) => s.title === 'منزل-II Cashflow')).toBe(false);
  });

  it('Undo takes the whole buy back, whatever the label', () => {
    const { state, game, component } = setUp();
    game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });
    game.applyDealCard(PROPERTY, { onSuccess: jest.fn(), onError: jest.fn() }, { symbol: '独栋' });
    submit(component, 'Fire', '@独栋', 'Buy Investment 独栋 3000 47000;');
    expect(state.allInvestments).toHaveLength(1);

    // the buy may have needed a bank loan first: that is its own step, so undo twice at most
    game.undoSteps(
      game.historySteps().findIndex((s) => s.kind === 'planDeal'),
      {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      },
    );

    expect(state.allInvestments).toHaveLength(0);
    expect(state.liabilities.some((l) => l.tag === 'M-独栋')).toBe(false);
    expect(state.allSubscriptions.some((s) => s.title === '独栋 Cashflow')).toBe(false);
  });

  it('a business bought outright (Hypothek 0) leaves no empty mortgage liability, and sells cleanly', () => {
    const { state, game, component } = setUp();
    game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });
    game.applyDealCard(
      {
        id: 'classic-big-gp-25k-25k-1300',
        title: 'Geschäftspartner gesucht',
        assetKind: 'investment',
        symbol: 'GP',
        depositMinor: 2500000,
        mortgageMinor: 0,
        cashflowMinor: 130000,
      },
      { onSuccess: jest.fn(), onError: jest.fn() },
      { symbol: 'PTR' },
    );

    submit(component, 'Fire', '@PTR', 'Buy Investment PTR 25000 0;');

    expect(window.alert).not.toHaveBeenCalled();
    expect(state.allInvestments).toContainEqual({ tag: 'PTR', deposit: 25000, amount: 0 });
    expect(state.liabilities.some((l) => l.tag === 'M-PTR')).toBe(false);
    expect(
      state.allSubscriptions.some((s) => s.title === 'PTR Cashflow' && s.amount === 1300),
    ).toBe(true);

    submit(component, 'Income', '@PTR', 'Sell Investment PTR 25000 0;');

    expect(window.alert).not.toHaveBeenCalled();
    expect(state.allInvestments.some((i) => i.tag === 'PTR')).toBe(false);
    expect(state.allSubscriptions.some((s) => s.title === 'PTR Cashflow')).toBe(false);
    expect(state.allGrowProjects[0]).toMatchObject({ phase: 'completed' });
  });

  describe('gold coins (special assets) through the Add dialog', () => {
    const GOLD_PLAIN = {
      id: 'classic-small-gold-friend-3000',
      title: 'Freund braucht schnell Bargeld',
      assetKind: 'asset' as const,
      symbol: 'GOLD',
      costMinor: 300000,
      quantity: 10,
    };
    const GOLD_GAMBLE = {
      id: 'classic-small-gold-box-500',
      title: 'Was ist in der Box?!',
      assetKind: 'asset' as const,
      symbol: 'GOLD',
      costMinor: 50000,
      quantity: 10,
      successOn: 6,
    };

    it('a plain offer: Buy books the asset and its coins; Sell clears it', () => {
      const { state, game, component } = setUp();
      game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });
      game.applyDealCard(
        GOLD_PLAIN,
        { onSuccess: jest.fn(), onError: jest.fn() },
        { symbol: 'ORO' },
      );

      submit(component, 'Fire', '@ORO', 'Buy Asset ORO 1 x 3000;');

      expect(window.alert).not.toHaveBeenCalled();
      expect(state.allAssets).toEqual([{ tag: 'ORO', amount: 3000 }]);
      expect(state.cashflowGame.assetDeals![0]).toMatchObject({
        title: 'ORO',
        stage: 'owned',
        coins: 10,
      });
      expect(state.allGrowProjects[0]).toMatchObject({ status: 'bought', phase: 'execute' });
      expect(state.allTransactions.find((t) => t.category === '@ORO')?.amount).toBe(-3000);

      submit(component, 'Income', '@ORO', 'Sell Asset ORO 10 x 300;'); // all ten coins

      expect(window.alert).not.toHaveBeenCalled();
      expect(state.allAssets).toHaveLength(0);
      expect(state.cashflowGame.assetDeals![0].stage).toBe('sold');
      expect(state.allGrowProjects[0]).toMatchObject({ phase: 'completed' });
    });

    it('a gamble card: Buy takes the money but books NO asset; the roll decides', () => {
      const { state, game, component } = setUp();
      game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });
      game.applyDealCard(
        GOLD_GAMBLE,
        { onSuccess: jest.fn(), onError: jest.fn() },
        { symbol: 'GOLD', success: 'Ten coins!', failure: 'Nothing.' },
      );

      const opened = jest.fn();
      game.decisionNeeded$.subscribe(opened);

      submit(component, 'Fire', '@GOLD', 'Buy Asset GOLD 1 x 500;');

      expect(opened).toHaveBeenCalledTimes(1); // the game dashboard opens on the decision
      expect(window.alert).not.toHaveBeenCalled();
      expect(state.allTransactions.find((t) => t.category === '@GOLD')?.amount).toBe(-500); // paid
      expect(state.allAssets).toHaveLength(0); // ...but nothing owned yet
      expect(game.openDecisions.map((d) => d.title)).toEqual(['GOLD']);

      game.resolveGamble(
        'GOLD',
        { won: true, roll: 6 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );

      expect(state.allAssets).toEqual([{ tag: 'GOLD', amount: 500 }]);
      expect(game.openDecisions).toHaveLength(0);
    });

    it('a missed roll leaves the 500 spent and nothing to sell, with the Grow project completed', () => {
      const { state, game, component } = setUp();
      game.pickProfession('cashflow', 'hausmeister', { onSuccess: jest.fn(), onError: jest.fn() });
      game.applyDealCard(
        GOLD_GAMBLE,
        { onSuccess: jest.fn(), onError: jest.fn() },
        { symbol: 'GOLD', success: 'Ten coins!', failure: 'Nothing.' },
      );
      submit(component, 'Fire', '@GOLD', 'Buy Asset GOLD 1 x 500;');

      game.resolveGamble(
        'GOLD',
        { won: false, roll: 2 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );

      expect(state.allAssets).toHaveLength(0);
      expect(state.allTransactions.find((t) => t.category === '@GOLD')?.amount).toBe(-500); // still spent
      expect(state.allGrowProjects[0]).toMatchObject({ phase: 'completed', status: 'lost' });
    });

    describe('selling coins through the dialog', () => {
      const ownTenCoins = () => {
        const ctx = setUp();
        ctx.game.pickProfession('cashflow', 'hausmeister', {
          onSuccess: jest.fn(),
          onError: jest.fn(),
        });
        ctx.game.applyDealCard(
          GOLD_PLAIN,
          { onSuccess: jest.fn(), onError: jest.fn() },
          { symbol: 'GOLD' },
        );
        submit(ctx.component, 'Fire', '@GOLD', 'Buy Asset GOLD 1 x 3000;');
        expect(ctx.state.allAssets).toEqual([{ tag: 'GOLD', amount: 3000 }]);
        return ctx;
      };
      const incomeOf = (state: any) =>
        state.allTransactions.filter((t: any) => t.category === '@GOLD' && t.amount > 0);

      it('the Sell button names the coins you have: "Sell Asset GOLD 10 x 300;"', () => {
        const { state } = ownTenCoins();
        const asset = state.allAssets[0];
        expect(assetSellComment('GOLD', asset.amount)).toBe('Sell Asset GOLD 10 x 300;');
      });

      it('"5 x 1000" sells five coins for 5.000 and leaves five coins and half the cost', () => {
        const { state, game, component } = ownTenCoins();

        submit(component, 'Income', '@GOLD', 'Sell Asset GOLD 5 x 1000;');

        expect(window.alert).not.toHaveBeenCalled();
        expect(incomeOf(state).map((t: any) => t.amount)).toEqual([5000]); // quantity x price came in
        expect(game.coinsOwned('GOLD')).toBe(5);
        expect(state.allAssets).toEqual([{ tag: 'GOLD', amount: 1500 }]);
        expect(state.allGrowProjects[0]).toMatchObject({ status: 'bought', phase: 'execute' });
        expect(assetSellComment('GOLD', 1500)).toBe('Sell Asset GOLD 5 x 300;'); // the next sale starts from 5
      });

      it('selling the rest removes the gold from the balance and completes the Grow project', () => {
        const { state, game, component } = ownTenCoins();
        submit(component, 'Income', '@GOLD', 'Sell Asset GOLD 5 x 1000;');

        submit(component, 'Income', '@GOLD', 'Sell Asset GOLD 5 x 800;');

        expect(window.alert).not.toHaveBeenCalled();
        expect(incomeOf(state).map((t: any) => t.amount)).toEqual([5000, 4000]);
        expect(state.allAssets).toHaveLength(0);
        expect(game.coinsOwned('GOLD')).toBe(0);
        expect(state.allGrowProjects[0]).toMatchObject({ status: 'sold', phase: 'completed' });
        expect(game.historySteps().filter((s) => s.kind === 'sellAsset')).toHaveLength(2);
      });

      it('refuses to sell more coins than you have - nothing changes', () => {
        const { state, game, component } = ownTenCoins();
        const before = state.allTransactions.length;

        AddComponent.selectedOption = 'Income';
        AddComponent.categoryTextField = '@GOLD';
        AddComponent.commentTextField = 'Sell Asset GOLD 11 x 1000;';
        AddComponent.amountTextField = '1';
        component.addTransaction();
        jest.runAllTimers();

        expect(component.errorTextLable).toContain('sellTooManyCoins');
        expect(state.allTransactions).toHaveLength(before);
        expect(game.coinsOwned('GOLD')).toBe(10);
      });

      it('Undo takes a sale back: the coins and the asset return', () => {
        const { state, game, component } = ownTenCoins();
        submit(component, 'Income', '@GOLD', 'Sell Asset GOLD 5 x 1000;');

        game.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

        expect(game.coinsOwned('GOLD')).toBe(10);
        expect(state.allAssets).toEqual([{ tag: 'GOLD', amount: 3000 }]);
        expect(incomeOf(state)).toHaveLength(0);
      });

      it('an ordinary asset is sold exactly as before (quantity x price comes off its value)', () => {
        const ctx = setUp();
        ctx.state.allAssets.push({ tag: 'Car', amount: 1500 });
        submit(ctx.component, 'Income', '@Car', 'Sell Asset Car 1 x 1500;');
        expect(ctx.state.allAssets).toHaveLength(0);
      });
    });
  });
});
