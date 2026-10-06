import { Injectable } from '@angular/core';
import { Grow } from 'src/app/interfaces/grow';
import { coinsOwned } from 'src/app/shared/asset-coins.utils';
import { AppStateService } from 'src/app/shared/services/app-state.service';
import { CashflowGameService } from 'src/app/shared/services/cashflow-game.service';
import { ToastService } from 'src/app/shared/services/toast.service';
import { buildBuyComment, buildSellComment, GrowBalancePositions } from './grow-prefill.utils';

/**
 * Opens the Add dialog pre-filled to buy or sell a Grow project's position. The Grow grid's Buy / Sell
 * buttons and the same two buttons inside a project's info panel both go through here, so the two can
 * never drift apart (JFK, 2026-10-03: the info panel had no Buy / Sell at all).
 *
 * The panels it drives, and the data service, are imported on use: they (directly or through the
 * pages the data service pulls in) import this module's callers, so a normal import would be circular
 * - and the Grow page would fail to load.
 */
@Injectable({ providedIn: 'root' })
export class GrowTradeService {
  constructor(
    private toastService: ToastService,
    private cashflowGame: CashflowGameService,
  ) {}

  /** What is currently owned, by title - the same view Grow's own pre-fill reads. */
  private positions(): GrowBalancePositions {
    const state = AppStateService.instance;
    return {
      assets: state.allAssets.map((asset) => ({
        ...asset,
        coins: coinsOwned(asset.tag) || undefined,
      })),
      shares: state.allShares,
      investments: state.allInvestments,
    };
  }

  /**
   * What the Add dialog adds to the entered amount when it books a Sell Investment: the deposit that comes back, less
   * the loan and credit the Grow project still carries (the "Payback" it adds to the comment) - the dialog's own rule.
   */
  private depositReturned(project: Grow): number {
    const owned = this.positions().investments.find((position) => position.tag === project.title);
    const deposit = owned?.deposit ?? 0;
    return project.liabilitie
      ? deposit - project.liabilitie.amount - project.liabilitie.credit
      : deposit;
  }

  /** Makes sure the balance sheet is loaded before anything is read from it. */
  private async ensureBalanceLoaded(): Promise<void> {
    const { AppDataService } = await import('src/app/shared/services/app-data.service');
    await AppDataService.instance?.loadBalanceData();
  }

  private async panels() {
    const [add, menu, info, infoGrow, app] = await Promise.all([
      import('src/app/panels/add/add.component'),
      import('src/app/panels/menu/menu.component'),
      import('src/app/panels/info/info.component'),
      import('src/app/panels/info/info-grow/info-grow.component'),
      import('src/app/app.component'),
    ]);
    return {
      AddComponent: add.AddComponent,
      MenuComponent: menu.MenuComponent,
      InfoComponent: info.InfoComponent,
      InfoGrowComponent: infoGrow.InfoGrowComponent,
      AppComponent: app.AppComponent,
    };
  }

  /** Whether Buy / Sell make sense for a project: it is (or becomes) a share, a property or an asset. */
  canTrade(project: Grow | undefined): boolean {
    if (!project) return false;
    if (project.type && project.type !== 'income-growth') return false;
    return Boolean(project.share?.tag || project.investment?.tag || project.isAsset);
  }

  async buy(project: Grow): Promise<void> {
    await this.ensureBalanceLoaded();
    const { AddComponent, MenuComponent, InfoComponent, InfoGrowComponent, AppComponent } =
      await this.panels();
    AppComponent.gotoTop();
    AddComponent.categoryTextField = `@${project.title}`;
    AddComponent.selectedOption = 'Fire';
    AddComponent.loanTextField = '';
    AddComponent.creditTextField = '';
    if (project.liabilitie) {
      AddComponent.isLiabilitie = true;
      AddComponent.creditTextField = String(project.liabilitie.credit);
      AddComponent.loanTextField = String(project.liabilitie.amount);
    }
    const comment = buildBuyComment(project, this.positions());
    if (comment !== null) {
      AddComponent.amountTextField = '-1';
      AddComponent.commentTextField = comment;
    }
    AddComponent.url = '/grow';
    InfoGrowComponent.isInfo = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }

  async sell(project: Grow): Promise<void> {
    await this.ensureBalanceLoaded();
    let comment = buildSellComment(project, this.positions());
    if (comment === null) {
      // Nothing tagged with this project's title to sell - say so instead of opening a `0 x 0`
      // transaction that would change nothing.
      this.toastService.show('Grow.noPosition', 'error');
      return;
    }
    const { AddComponent, MenuComponent, InfoComponent, InfoGrowComponent, AppComponent } =
      await this.panels();
    AppComponent.gotoTop();
    InfoGrowComponent.isInfo = false;
    AddComponent.categoryTextField = `@${project.title}`;
    AddComponent.selectedOption = 'Income';
    // A market buyer's offer (Cashflow game) fills in what the sale brings after the mortgage.
    const offer =
      project.investment || project.isAsset ? this.cashflowGame.marketSaleFor(project.title) : null;
    // A gold buyer pays a price for every coin: sell all you have at that price, or edit the count down.
    if (offer?.pricePerCoin !== undefined && project.isAsset) {
      comment = `Sell Asset ${project.title} ${offer.coins} x ${offer.pricePerCoin};`;
    }
    // The Add dialog books a Sell Investment as the amount entered PLUS what comes back of the deposit (JFK, 2026-10-06: a
    // sale that should have paid 12.000 paid 14.000 - the net cash already contained the 2.000 deposit and the dialog
    // added it again). So an investment's field holds the net cash less that returned deposit: the profit.
    AddComponent.amountTextField = !offer
      ? '1'
      : project.investment && !project.isAsset
        ? String(Math.round((offer.netCash - this.depositReturned(project)) * 100) / 100)
        : String(offer.netCash);
    // A sale that does not cover the mortgage is paid out of your own pocket, not booked as income.
    if (offer && offer.netCash < 0) AddComponent.selectedOption = 'Daily';
    AddComponent.commentTextField = comment;
    AddComponent.url = '/grow';
    AddComponent.isLiabilitie = false;
    AddComponent.isAdd = true;
    MenuComponent.isMenu = false;
    InfoComponent.isInfo = false;
  }
}
