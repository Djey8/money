import { dealPlanText, doodadPaymentCategory, type CardTextDeps } from './card-plan-text';
import type { CashflowDealCard, CashflowDoodadCard } from './types';

const deps: CardTextDeps = {
  text: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  cards: {
    textFor: (id) => (id === 'efh' ? { title: 'Single-family home', description: 'Nice.' } : {}),
    symbolFor: (symbol) => (symbol === 'EFH' ? 'SFH' : symbol),
    sharedText: (key) => `[${key}]`,
    groupName: (group) => `group:${group}`,
  },
  money: (minor) => `${minor / 100} €`,
};

describe('dealPlanText', () => {
  it('words an investment card: heading, flavor, rule line and the numbers', () => {
    const card = {
      id: 'efh',
      title: 'EFH',
      symbol: 'EFH',
      assetKind: 'investment',
      depositMinor: 500000,
      mortgageMinor: 4500000,
      cashflowMinor: 20000,
    } as CashflowDealCard;
    const plan = dealPlanText(card, deps);
    expect(plan.symbol).toBe('SFH');
    expect(plan.title).toBe('Single-family home');
    expect(plan.description).toContain('Single-family home\n\nNice.\n\n[investmentRule]');
    expect(plan.description).toContain('CashflowGame.dealCost: 50000 €');
    expect(plan.description).toContain('CashflowGame.dealCashflow: +200 €');
  });

  it('words a share card with its price and trading range as strategy', () => {
    const card = {
      id: 'ok4u',
      title: 'OK4U Co',
      symbol: 'OK4U',
      assetKind: 'share',
      quantity: 1000,
      priceMinor: 500,
      rangeMinMinor: 100,
      rangeMaxMinor: 3000,
    } as CashflowDealCard;
    const plan = dealPlanText(card, deps);
    expect(plan.description).toContain('OK4U Co (OK4U)');
    expect(plan.description).toContain('[shareRule]');
    expect(plan.strategy).toBe('CashflowGame.cardTradingRange: 1 € - 30 €');
  });

  it('words a dice card with its win condition as strategy', () => {
    const card = {
      id: 'gold',
      title: 'Gold',
      symbol: 'GOLD',
      assetKind: 'asset',
      costMinor: 500000,
      quantity: 2,
      successOn: 4,
    } as CashflowDealCard;
    const plan = dealPlanText(card, deps);
    expect(plan.strategy).toBe('CashflowGame.cardDiceWinRange:{"n":4}');
    expect(plan.description).not.toContain('[investmentRule]');
  });
});

describe('doodadPaymentCategory', () => {
  it('is the spending group in the game language, else the card name', () => {
    const base = { id: 'd1', title: 'Coffee', costMinor: 500 } as CashflowDoodadCard;
    expect(doodadPaymentCategory({ ...base, group: 'leisure' }, deps)).toBe('group:leisure');
    expect(doodadPaymentCategory(base, deps)).toBe('Coffee');
  });
});
