import { buildBuyComment, buildSellComment, GrowBalancePositions } from './grow-prefill.utils';

const noPositions: GrowBalancePositions = { assets: [], shares: [], investments: [] };

function project(overrides: Record<string, unknown>): any {
  return {
    title: 'SOL',
    amount: 0,
    isAsset: false,
    share: null,
    investment: null,
    liabilitie: null,
    ...overrides,
  };
}

describe('buildSellComment', () => {
  it('pre-fills the full balance-sheet share position', () => {
    const positions = { ...noPositions, shares: [{ tag: 'SOL', quantity: 3.54, price: 88.33 }] };
    expect(buildSellComment(project({ share: { tag: 'SOL' } }), positions)).toBe(
      'Sell Share SOL 3.54 x 88.33;',
    );
  });

  it('returns null instead of 0 x 0 when no position is tagged with the title', () => {
    const positions = { ...noPositions, shares: [{ tag: 'SLO', quantity: 3.54, price: 88.33 }] };
    expect(buildSellComment(project({ share: { tag: 'SOL' } }), positions)).toBeNull();
  });

  it('pre-fills the full asset amount, or null without one', () => {
    const asset = project({ title: 'Car', isAsset: true });
    expect(
      buildSellComment(asset, { ...noPositions, assets: [{ tag: 'Car', amount: 1500 }] }),
    ).toBe('Sell Asset Car 1 x 1500;');
    expect(buildSellComment(asset, noPositions)).toBeNull();
  });

  it('pre-fills an investment sale with the attached loan payback', () => {
    const flat = project({
      title: 'Flat',
      investment: { tag: 'Flat' },
      liabilitie: { amount: 10000, credit: 500 },
    });
    const positions = {
      ...noPositions,
      investments: [{ tag: 'Flat', deposit: 50000, amount: 200000 }],
    };
    expect(buildSellComment(flat, positions)).toBe(
      'Payback Liabilitie 10000 500; Sell Investment Flat 50000 200000;',
    );
  });
});

describe('buildBuyComment', () => {
  it('pre-fills the planned share quantity and price', () => {
    expect(buildBuyComment(project({ share: { quantity: 2, price: 90 } }), noPositions)).toBe(
      'Buy Share SOL 2 x 90;',
    );
  });

  it('falls back to one unit at the balance-sheet price when the plan is empty', () => {
    const positions = { ...noPositions, shares: [{ tag: 'SOL', quantity: 3.54, price: 88.33 }] };
    expect(buildBuyComment(project({ share: { quantity: 0, price: 0 } }), positions)).toBe(
      'Buy Share SOL 1 x 88.33;',
    );
  });

  it('pre-fills an asset buy with the planned amount plus loan', () => {
    expect(
      buildBuyComment(
        project({ title: 'Car', isAsset: true, amount: 500, liabilitie: { amount: 1000 } }),
        noPositions,
      ),
    ).toBe('Buy Asset Car 1 x 1500;');
  });

  it('returns null for a project without a kind', () => {
    expect(buildBuyComment(project({}), noPositions)).toBeNull();
  });
});
