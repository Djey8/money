import { AddComponent } from 'src/app/panels/add/add.component';
import { AppComponent } from 'src/app/app.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { Grow } from 'src/app/interfaces/grow';
import { GrowTradeService } from './grow-trade.service';

const project = (overrides: Partial<Grow>): Grow =>
  ({
    title: 'X',
    sub: '',
    phase: 'plan',
    description: '',
    strategy: '',
    riskScore: 0,
    risks: '',
    links: [],
    actionItems: [],
    notes: [],
    cashflow: 0,
    amount: 0,
    isAsset: false,
    share: null,
    investment: null,
    liabilitie: null,
    createdAt: '',
    updatedAt: '',
    type: 'income-growth',
    ...overrides,
  }) as Grow;

function makeService() {
  const toast = { show: jest.fn() };
  const cashflowGame = { marketSaleFor: jest.fn((): any => null) };
  return { service: new GrowTradeService(toast as any, cashflowGame as any), toast, cashflowGame };
}

describe('GrowTradeService', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    jest.spyOn(AppComponent, 'gotoTop').mockImplementation(() => undefined);
    AddComponent.isAdd = false;
    AddComponent.commentTextField = '';
    AddComponent.categoryTextField = '@';
    AddComponent.selectedOption = 'Daily';
    AddComponent.isLiabilitie = false;
  });
  afterEach(() => jest.restoreAllMocks());

  describe('canTrade', () => {
    const { service } = makeService();
    it('is true for shares, properties and assets', () => {
      expect(service.canTrade(project({ share: { tag: 'S', quantity: 1, price: 1 } }))).toBe(true);
      expect(service.canTrade(project({ investment: { tag: 'P', deposit: 1, amount: 1 } }))).toBe(
        true,
      );
      expect(service.canTrade(project({ isAsset: true }))).toBe(true);
    });

    it('is false for an idea with nothing to buy, for expense projects, and for nothing open', () => {
      expect(service.canTrade(project({}))).toBe(false);
      expect(service.canTrade(project({ isAsset: true, type: 'budget-optimization' }))).toBe(false);
      expect(service.canTrade(undefined)).toBe(false);
    });
  });

  it('Buy opens the Add dialog on the Fire account with the planned purchase filled in', async () => {
    const { service } = makeService();

    await service.buy(project({ title: 'OK4U', share: { tag: 'OK4U', quantity: 50, price: 10 } }));

    expect(AddComponent.isAdd).toBe(true);
    expect(AddComponent.selectedOption).toBe('Fire');
    expect(AddComponent.categoryTextField).toBe('@OK4U');
    expect(AddComponent.commentTextField).toBe('Buy Share OK4U 50 x 10;');
    expect(AddComponent.url).toBe('/grow');
  });

  it('Buy carries a planned loan into the dialog', async () => {
    const { service } = makeService();

    await service.buy(
      project({
        title: 'OK4U',
        share: { tag: 'OK4U', quantity: 50, price: 10 },
        liabilitie: { tag: 'OK4U', amount: 300, credit: 0, investment: true } as any,
      }),
    );

    expect(AddComponent.isLiabilitie).toBe(true);
    expect(AddComponent.loanTextField).toBe('300');
  });

  it('Sell opens the dialog on Income with the position to sell', async () => {
    const { service } = makeService();
    AppStateService.instance.allShares = [{ tag: 'OK4U', quantity: 40, price: 12 }];

    await service.sell(project({ title: 'OK4U', share: { tag: 'OK4U', quantity: 0, price: 12 } }));

    expect(AddComponent.isAdd).toBe(true);
    expect(AddComponent.selectedOption).toBe('Income');
    expect(AddComponent.commentTextField).toBe('Sell Share OK4U 40 x 12;');
  });

  it("Sell fills in a market buyer's offer: what the sale brings after the mortgage", async () => {
    const { service, cashflowGame } = makeService();
    AppStateService.instance.allInvestments = [{ tag: 'EFH', deposit: 3000, amount: 47000 }] as any;
    cashflowGame.marketSaleFor.mockReturnValue({ salePrice: 60000, netCash: 13000, label: '+20%' });

    await service.sell(
      project({ title: 'EFH', investment: { tag: 'EFH', deposit: 3000, amount: 47000 } }),
    );

    expect(AddComponent.selectedOption).toBe('Income');
    // 13.000 is what the player ends up with; the Add dialog adds the 3.000 deposit that comes back to the amount
    // entered, so the field holds the profit - otherwise the sale books 16.000 (JFK, 2026-10-06: 14.000 for 12.000).
    expect(AddComponent.amountTextField).toBe('10000');
    expect(Number(AddComponent.amountTextField) + 3000).toBe(13000);
    expect(AddComponent.commentTextField).toBe('Sell Investment EFH 3000 47000;');
  });

  it('Sell books exactly the net cash: a 2.000 deposit and a 10.000 profit is 12.000, not 14.000', async () => {
    const { service, cashflowGame } = makeService();
    AppStateService.instance.allInvestments = [{ tag: 'SFH', deposit: 2000, amount: 48000 }] as any;
    cashflowGame.marketSaleFor.mockReturnValue({
      salePrice: 60000,
      netCash: 12000,
      label: '+10.000',
    });

    await service.sell(
      project({ title: 'SFH', investment: { tag: 'SFH', deposit: 2000, amount: 48000 } }),
    );

    expect(AddComponent.commentTextField).toBe('Sell Investment SFH 2000 48000;');
    expect(AddComponent.amountTextField).toBe('10000');
    // the Add dialog: amount entered + the deposit coming back
    expect(Number(AddComponent.amountTextField) + 2000).toBe(12000);
  });

  it('Sell books a loss as a Daily expense (the mortgage is more than the buyer pays)', async () => {
    const { service, cashflowGame } = makeService();
    AppStateService.instance.allInvestments = [{ tag: 'ETW', deposit: 5000, amount: 50000 }] as any;
    cashflowGame.marketSaleFor.mockReturnValue({
      salePrice: 45000,
      netCash: -5000,
      label: '45.000 €',
    });

    await service.sell(
      project({ title: 'ETW', investment: { tag: 'ETW', deposit: 5000, amount: 50000 } }),
    );

    expect(AddComponent.selectedOption).toBe('Daily');
    // the dialog adds the 5.000 deposit back: -10.000 entered books the -5.000 the player really pays
    expect(AddComponent.amountTextField).toBe('-10000');
    expect(Number(AddComponent.amountTextField) + 5000).toBe(-5000);
  });

  it("Sell on gold with a buyer's offer names all your coins at the buyer's price", async () => {
    const { service, cashflowGame } = makeService();
    const state = AppStateService.instance;
    state.allAssets = [{ tag: 'GOLD', amount: 3000 }];
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: [{ title: 'GOLD', coins: 10, costMinor: 300000, stage: 'owned' }],
    };
    cashflowGame.marketSaleFor.mockReturnValue({
      salePrice: 20000,
      netCash: 20000,
      label: '2.000 € × 10',
      pricePerCoin: 2000,
      coins: 10,
    });

    await service.sell(project({ title: 'GOLD', isAsset: true }));

    expect(AddComponent.commentTextField).toBe('Sell Asset GOLD 10 x 2000;');
  });

  it('Sell with nothing owned says so instead of opening an empty dialog', async () => {
    const { service, toast } = makeService();
    AppStateService.instance.allShares = [];

    await service.sell(project({ title: 'OK4U', share: { tag: 'OK4U', quantity: 1, price: 1 } }));

    expect(toast.show).toHaveBeenCalledWith('Grow.noPosition', 'error');
    expect(AddComponent.isAdd).toBe(false);
  });

  it('Sell on gold names the coins you have', async () => {
    const { service } = makeService();
    const state = AppStateService.instance;
    state.allAssets = [{ tag: 'GOLD', amount: 3000 }];
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: [{ title: 'GOLD', coins: 10, costMinor: 300000, stage: 'owned' }],
    };

    await service.sell(project({ title: 'GOLD', isAsset: true }));

    expect(AddComponent.commentTextField).toBe('Sell Asset GOLD 10 x 300;');
  });
});
