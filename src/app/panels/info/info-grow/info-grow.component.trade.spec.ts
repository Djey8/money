import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { InfoGrowComponent } from './info-grow.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { ToastService } from '../../../shared/services/toast.service';

function makeComponent(growTrade: any) {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [{ provide: ToastService, useValue: { show: jest.fn() } }],
  });
  return TestBed.runInInjectionContext(
    () =>
      new InfoGrowComponent(
        { navigate: jest.fn() } as any,
        { writeAndSync: jest.fn() } as any,
        { recalculate: jest.fn(), getWrites: jest.fn(() => []) } as any,
        { cash: 0 } as any,
        growTrade,
      ),
  );
}

describe('InfoGrowComponent Buy / Sell buttons', () => {
  const share = { title: 'OK4U', share: { tag: 'OK4U', quantity: 1, price: 1 } } as any;

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allGrowProjects = [share];
    InfoGrowComponent.index = 0;
  });

  it('shows them only when the open project can be traded', () => {
    const growTrade = { canTrade: jest.fn(() => true), buy: jest.fn(), sell: jest.fn() };
    const component = makeComponent(growTrade);

    expect(component.canTrade).toBe(true);
    expect(growTrade.canTrade).toHaveBeenCalledWith(share);

    growTrade.canTrade.mockReturnValue(false);
    expect(component.canTrade).toBe(false);
  });

  it('Buy and Sell act on the project open in the panel', () => {
    const growTrade = { canTrade: jest.fn(), buy: jest.fn(), sell: jest.fn() };
    const component = makeComponent(growTrade);

    component.buyThisProject();
    component.sellThisProject();

    expect(growTrade.buy).toHaveBeenCalledWith(share);
    expect(growTrade.sell).toHaveBeenCalledWith(share);
  });

  it('does nothing when no project is open', () => {
    const growTrade = { canTrade: jest.fn(() => false), buy: jest.fn(), sell: jest.fn() };
    const component = makeComponent(growTrade);
    InfoGrowComponent.index = 5;

    component.buyThisProject();
    component.sellThisProject();

    expect(growTrade.buy).not.toHaveBeenCalled();
    expect(growTrade.sell).not.toHaveBeenCalled();
  });

  it('the buttons are on Overview and Financials only - hidden on Actions and Notes', () => {
    const growTrade = { canTrade: jest.fn(() => true), buy: jest.fn(), sell: jest.fn() };
    const component = makeComponent(growTrade);

    InfoGrowComponent.activeTab = 'overview';
    expect(component.showTradeButtons).toBe(true);
    InfoGrowComponent.activeTab = 'financials';
    expect(component.showTradeButtons).toBe(true);
    InfoGrowComponent.activeTab = 'actions';
    expect(component.showTradeButtons).toBe(false);
    InfoGrowComponent.activeTab = 'notes';
    expect(component.showTradeButtons).toBe(false);
  });

  it('and not at all for a project that cannot be traded, whatever the tab', () => {
    const growTrade = { canTrade: jest.fn(() => false), buy: jest.fn(), sell: jest.fn() };
    const component = makeComponent(growTrade);
    InfoGrowComponent.activeTab = 'overview';
    expect(component.showTradeButtons).toBe(false);
  });
});
