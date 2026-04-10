import { InfoGrowComponent } from './info-grow.component';
import { InfoComponent } from '../info.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { Grow } from '../../../interfaces/grow';

function makeGrow(overrides: Partial<Grow> = {}): Grow {
  return {
    title: '', sub: '', phase: 'idea', description: '', strategy: '', riskScore: 0, risks: '',
    cashflow: 0, amount: 0, isAsset: false, share: null, investment: null, liabilitie: null,
    actionItems: [], links: [], notes: [], createdAt: '', updatedAt: '',
    ...overrides
  };
}

describe('InfoGrowComponent', () => {

  // Allow the deferred setTimeout(() => import(...)) in info-grow.component.ts to resolve
  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    InfoGrowComponent.index = 1;
    InfoGrowComponent.title = '';
    InfoGrowComponent.sub = '';
    InfoGrowComponent.phase = 'idea';
    InfoGrowComponent.description = '';
    InfoGrowComponent.strategy = '';
    InfoGrowComponent.risks = '';
    InfoGrowComponent.amount = 0;
    InfoGrowComponent.cashflow = 0;
    InfoGrowComponent.isAsset = false;
    InfoGrowComponent.share = null;
    InfoGrowComponent.investment = null;
    InfoGrowComponent.liabilitie = null;
    InfoGrowComponent.isLoan = false;
    InfoGrowComponent.isShare = false;
    InfoGrowComponent.isInvestment = false;
    InfoGrowComponent.isEdit = false;
    InfoGrowComponent.isInfo = false;
    InfoComponent.isInfo = false;
  });

  it('setInfoGrowComponent should set all static fields', () => {
    const share = { tag: 'AAPL', quantity: 10, price: 150 } as any;
    const project = makeGrow({
      title: 'Project A', sub: 'sub1', phase: 'execute', description: 'desc',
      strategy: 'strat', risks: 'risk', amount: 1000, cashflow: 50,
      isAsset: true, share
    });
    InfoGrowComponent.setInfoGrowComponent(2, project);

    expect(InfoGrowComponent.index).toBe(2);
    expect(InfoGrowComponent.title).toBe('Project A');
    expect(InfoGrowComponent.sub).toBe('sub1');
    expect(InfoGrowComponent.phase).toBe('execute');
    expect(InfoGrowComponent.description).toBe('desc');
    expect(InfoGrowComponent.strategy).toBe('strat');
    expect(InfoGrowComponent.risks).toBe('risk');
    expect(InfoGrowComponent.amount).toBe(1000);
    expect(InfoGrowComponent.cashflow).toBe(50);
    expect(InfoGrowComponent.isAsset).toBe(true);
    expect(InfoGrowComponent.share).toBe(share);
    expect(InfoGrowComponent.isShare).toBe(true);
    expect(InfoGrowComponent.isInvestment).toBe(false);
    expect(InfoGrowComponent.isLoan).toBe(false);
    expect(InfoGrowComponent.isEdit).toBe(false);
    expect(InfoGrowComponent.isInfo).toBe(true);
  });

  it('setInfoGrowComponent should derive isLoan from liabilitie != null', () => {
    const liab = { tag: 'loan', amount: 500, credit: 50 } as any;
    InfoGrowComponent.setInfoGrowComponent(0, makeGrow({ title: 'L', liabilitie: liab }));
    expect(InfoGrowComponent.isLoan).toBe(true);
    expect(InfoGrowComponent.isShare).toBe(false);
    expect(InfoGrowComponent.isInvestment).toBe(false);
  });

  it('setInfoGrowComponent should derive isInvestment from investment != null', () => {
    const inv = { tag: 'fund', deposit: 100, amount: 200 } as any;
    InfoGrowComponent.setInfoGrowComponent(0, makeGrow({ title: 'I', investment: inv }));
    expect(InfoGrowComponent.isInvestment).toBe(true);
    expect(InfoGrowComponent.isShare).toBe(false);
    expect(InfoGrowComponent.isLoan).toBe(false);
  });

  it('toggleAsset should flip isAsset and reset isInvestment/isShare', () => {
    const proto = Object.create(InfoGrowComponent.prototype);
    InfoGrowComponent.isAsset = false;
    InfoGrowComponent.isInvestment = true;
    InfoGrowComponent.isShare = true;

    proto.toggleAsset();

    expect(InfoGrowComponent.isAsset).toBe(true);
    expect(InfoGrowComponent.isInvestment).toBe(false);
    expect(InfoGrowComponent.isShare).toBe(false);
  });
});
