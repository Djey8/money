import {
  calculateBuyShare,
  calculateBuyInvestment,
  calculateSellInvestment,
  calculatePayback,
} from './actions';
import {
  GrowPositionSnapshot,
  GrowReversalError,
  growTitleOfStatements,
  reverseGrowStatements,
  stateChangingGrowStatements,
} from './reverse';

const empty: GrowPositionSnapshot = {
  growAmountMinor: 0,
  growShare: null,
  growInvestment: null,
  growLiabilitie: null,
  asset: null,
  share: null,
  investment: null,
  liability: null,
  mortgage: null,
};

function undo(comment: string, state: GrowPositionSnapshot) {
  return reverseGrowStatements(stateChangingGrowStatements(comment), state);
}

describe('stateChangingGrowStatements', () => {
  it('finds only the statements that change state, and nothing in an ordinary comment', () => {
    expect(
      stateChangingGrowStatements('Liabilitie 10 1; Buy Share SOL 1 x 2;').map((s) => s.kind),
    ).toEqual(['liabilitie', 'buyShare']);
    expect(stateChangingGrowStatements('Dividende Share SOL 1 x 2;')).toEqual([]);
    expect(stateChangingGrowStatements('CASHFLOW 150 - CREDIT 20;')).toEqual([]);
    expect(stateChangingGrowStatements('Lunch; #bucket:abc:10')).toEqual([]);
    expect(stateChangingGrowStatements(undefined)).toEqual([]);
  });

  it('names the project a trade acts on', () => {
    expect(growTitleOfStatements(stateChangingGrowStatements('Buy Share Solana Fund 1 x 2;'))).toBe(
      'Solana Fund',
    );
    expect(growTitleOfStatements(stateChangingGrowStatements('Payback Liabilitie 1 1;'))).toBe(
      null,
    );
  });
});

describe('reverseGrowStatements — each undo restores the state before the action', () => {
  it('a financed share buy, including its loan (the original never undid the loan)', () => {
    const before: GrowPositionSnapshot = {
      ...empty,
      growAmountMinor: 10000,
      growShare: { quantity: 1, priceMinor: 10000 },
      share: { quantity: 1, priceMinor: 10000 },
    };
    const calc = calculateBuyShare({
      title: 'SOL',
      quantity: 1.77,
      priceMinor: 8833,
      existingShareQuantity: 1,
      existingGrowAmountMinor: 10000,
      liabilitie: {
        existingAmountMinor: null,
        existingCreditMinor: null,
        loanMinor: 5000,
        creditMinor: 100,
      },
    });
    const after: GrowPositionSnapshot = {
      ...before,
      growAmountMinor: calc.newGrowAmountMinor,
      growShare: { quantity: calc.newShareQuantity, priceMinor: calc.newSharePriceMinor },
      share: { quantity: calc.newShareQuantity, priceMinor: calc.newSharePriceMinor },
      liability: { amountMinor: 5000, creditMinor: 100 },
      growLiabilitie: { amountMinor: 5000, creditMinor: 100 },
    };

    const restored = undo(calc.comment, after);

    expect(restored.growAmountMinor).toBe(10000);
    expect(restored.share?.quantity).toBe(1);
    expect(restored.growShare?.quantity).toBe(1);
    expect(restored.liability).toBeNull();
    expect(restored.growLiabilitie).toBeNull();
  });

  it("a project's only buy is fully undone (the original kept it when amounts matched)", () => {
    const restored = undo('Buy Share SOL 2 x 10;', {
      ...empty,
      growAmountMinor: 2000,
      growShare: { quantity: 2, priceMinor: 1000 },
      share: { quantity: 2, priceMinor: 1000 },
    });
    expect(restored.growAmountMinor).toBe(0);
    expect(restored.share).toBeNull();
    expect(restored.growShare?.quantity).toBe(0);
  });

  it('a share sale gives the units back, recreating a sold-out position', () => {
    const restored = undo('Sell Share SOL 3.54 x 88.33;', {
      ...empty,
      growShare: { quantity: 0, priceMinor: 8833 },
    });
    expect(restored.share).toEqual({ quantity: 3.54, priceMinor: 8833 });
    expect(restored.growShare?.quantity).toBe(3.54);
  });

  it('asset buy and sale, including units x unit price', () => {
    expect(
      undo('Buy Asset Gold 2.5 x 60;', {
        ...empty,
        asset: { amountMinor: 20000 },
        growAmountMinor: 15000,
      }),
    ).toMatchObject({
      asset: { amountMinor: 5000 },
      growAmountMinor: 0,
    });
    expect(undo('Sell Asset Gold 1 x 70;', { ...empty, asset: null }).asset).toEqual({
      amountMinor: 7000,
    });
  });

  it('an investment buy removes its deposit, mortgage and M-<title> liability', () => {
    const calc = calculateBuyInvestment({
      title: 'Flat',
      depositMinor: 5000000,
      mortgageMinor: 20000000,
      existingInvestmentDepositMinor: null,
      existingInvestmentAmountMinor: null,
      existingMortgageLiabilityAmountMinor: null,
      existingGrowAmountMinor: 0,
    });
    const restored = undo(calc.comment, {
      ...empty,
      growAmountMinor: calc.newGrowAmountMinor,
      growInvestment: { depositMinor: 5000000, amountMinor: 20000000 },
      investment: { depositMinor: 5000000, amountMinor: 20000000 },
      mortgage: { amountMinor: 20000000 },
    });
    expect(restored).toMatchObject({
      growAmountMinor: 0,
      investment: null,
      mortgage: null,
      growInvestment: { depositMinor: 0, amountMinor: 0 },
    });
  });

  it('an investment sale with a loan payback restores the position and the loan', () => {
    const calc = calculateSellInvestment({
      title: 'Flat',
      depositMinor: 5000000,
      mortgageMinor: 20000000,
      existingInvestmentDepositMinor: 5000000,
      existingInvestmentAmountMinor: 20000000,
      existingMortgageLiabilityAmountMinor: 20000000,
      existingGrowAmountMinor: 5000000,
      payback: { amountMinor: 1000000, creditMinor: 50000 },
    });
    const restored = undo(calc.comment, {
      ...empty,
      growAmountMinor: calc.newGrowAmountMinor,
      growInvestment: { depositMinor: 0, amountMinor: 0 },
    });
    expect(restored).toMatchObject({
      growAmountMinor: 5000000,
      investment: { depositMinor: 5000000, amountMinor: 20000000 },
      mortgage: { amountMinor: 20000000 },
      liability: { amountMinor: 1000000, creditMinor: 50000 },
      growLiabilitie: { amountMinor: 1000000, creditMinor: 50000 },
    });
  });

  it('a standalone payback restores the loan and lowers Grow.amount again', () => {
    const calc = calculatePayback(1000, 50, 5000, 100, 2000);
    const restored = undo(calc.comment, {
      ...empty,
      growAmountMinor: calc.newGrowAmountMinor,
      liability: { amountMinor: 4000, creditMinor: 50 },
      growLiabilitie: { amountMinor: 4000, creditMinor: 50 },
    });
    expect(restored.growAmountMinor).toBe(2000);
    expect(restored.liability).toEqual({ amountMinor: 5000, creditMinor: 100 });
  });

  it('refuses to undo a buy whose units were already sold (it would leave a negative position)', () => {
    expect(() =>
      undo('Buy Share SOL 2 x 10;', {
        ...empty,
        growAmountMinor: 2000,
        growShare: { quantity: 0, priceMinor: 1200 },
      }),
    ).toThrow(GrowReversalError);
  });

  it('refuses a legacy percentage loan it cannot undo exactly', () => {
    expect(() => undo('Liabilitie 1000 5%; Buy Share X 1 x 2;', empty)).toThrow(GrowReversalError);
  });
});
