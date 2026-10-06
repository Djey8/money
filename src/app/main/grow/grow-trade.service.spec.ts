import { AddComponent } from 'src/app/panels/add/add.component';
import { AppComponent } from 'src/app/app.component';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { Grow } from 'src/app/interfaces/grow';
import {
  fixedClock,
  identityText,
  initialCashflowGameState,
  marketSaleFor,
  playMarketBuyerCard,
} from '@money/domain';
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

  it('a percent offer books what the buyer pays less the mortgage - the deposit is not paid back twice', async () => {
    const { service, cashflowGame } = makeService();
    // a "+20 %" buyer on a property that cost 70.000 (10.000 deposit, 60.000 mortgage) offers 84.000
    const state = {
      ...initialCashflowGameState(),
      marketOffers: [{ title: 'EFH', salePriceMinor: 8400000, cardId: 'm1', label: '+20%' }],
    };
    const investment = { tag: 'EFH', depositMinor: 1000000, amountMinor: 6000000 };
    cashflowGame.marketSaleFor.mockImplementation(((title: string) => {
      const sale = marketSaleFor(state, [investment], title);
      return (
        sale && {
          salePrice: sale.salePriceMinor / 100,
          netCash: sale.netCashMinor / 100,
          label: sale.label,
        }
      );
    }) as any);
    AppStateService.instance.allInvestments = [
      { tag: 'EFH', deposit: 10000, amount: 60000 },
    ] as any;

    await service.sell(
      project({ title: 'EFH', investment: { tag: 'EFH', deposit: 10000, amount: 60000 } }),
    );

    // 84.000 - 60.000 mortgage = 24.000 for the player: the 10.000 deposit and the 14.000 profit
    expect(AddComponent.amountTextField).toBe('14000');
    expect(Number(AddComponent.amountTextField) + 10000).toBe(24000); // what the Add dialog books
  });

  // Every kind of property buyer, through the real offer calculation and the Sell pre-fill (JFK, 2026-10-06: not only
  // the single-family house - the condo, the apartment complex, the percent and the fixed-profit buyers too).
  describe.each([
    {
      kind: 'a percent on the original price (house)',
      tag: 'EFH',
      deposit: 10000,
      mortgage: 60000,
      units: undefined,
      sells: { family: 'EFH', plusPercent: 20 },
      cash: 24000, // 70.000 + 14.000 = 84.000 - 60.000 mortgage
    },
    {
      kind: 'a fixed profit on the original price',
      tag: 'EFH',
      deposit: 2000,
      mortgage: 48000,
      units: undefined,
      sells: { family: 'EFH', plusMinor: 1000000 },
      cash: 12000, // 50.000 + 10.000 = 60.000 - 48.000 (the SFH of the bug report)
    },
    {
      kind: 'a fixed price for the whole condo (Wohnung)',
      tag: 'ETW',
      deposit: 5000,
      mortgage: 40000,
      units: undefined,
      sells: { family: 'ETW', priceMinor: 6000000 },
      cash: 20000, // 60.000 - 40.000
    },
    {
      kind: 'a price for every unit of an apartment complex',
      tag: 'APH24',
      deposit: 20000,
      mortgage: 50000,
      units: 24,
      sells: { family: 'APH', pricePerUnitMinor: 300000 },
      cash: 22000, // 24 x 3.000 = 72.000 - 50.000
    },
    {
      kind: 'a price that only just covers the deposit (no profit)',
      tag: 'ETW',
      deposit: 5000,
      mortgage: 40000,
      units: undefined,
      sells: { family: 'ETW', priceMinor: 4500000 },
      cash: 5000, // 45.000 - 40.000: the deposit back, nothing more
    },
    {
      kind: 'a price below the mortgage (a loss)',
      tag: 'ETW',
      deposit: 5000,
      mortgage: 40000,
      units: undefined,
      sells: { family: 'ETW', priceMinor: 3500000 },
      cash: -5000, // 35.000 - 40.000
    },
  ])('$kind', ({ tag, deposit, mortgage, units, sells, cash }) => {
    it('books the cash the buyer leaves you with - the deposit comes back once', async () => {
      const { service, cashflowGame } = makeService();
      const investment = { tag, depositMinor: deposit * 100, amountMinor: mortgage * 100 };
      const played = playMarketBuyerCard(
        {
          state: {
            ...initialCashflowGameState(),
            gameSetId: 'cashflow',
            professionId: 'hausmeister',
            virtualDate: '2026-10-15',
          },
          subscriptions: [],
          investments: [investment],
          shares: [],
          assets: [],
          growProjects: [],
        },
        { id: 'm1', title: 'Buyer', description: '', sells } as any,
        { types: [{ labels: [tag], units }] },
        { clock: fixedClock('2026-10-15'), text: identityText, money: (m) => String(m / 100) },
      );
      cashflowGame.marketSaleFor.mockImplementation(((title: string) => {
        const sale = marketSaleFor(played.effects.state, [investment], title);
        return (
          sale && {
            salePrice: sale.salePriceMinor / 100,
            netCash: sale.netCashMinor / 100,
            label: sale.label,
          }
        );
      }) as any);
      AppStateService.instance.allInvestments = [{ tag, deposit, amount: mortgage }] as any;

      await service.sell(project({ title: tag, investment: { tag, deposit, amount: mortgage } }));

      // what the Add dialog books: the amount entered plus the deposit that comes back
      expect(Number(AddComponent.amountTextField) + deposit).toBe(cash);
      expect(AddComponent.selectedOption).toBe(cash < 0 ? 'Daily' : 'Income');
    });
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
