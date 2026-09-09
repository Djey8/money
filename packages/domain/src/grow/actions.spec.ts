import {
  calculateBuyAsset,
  calculateBuyShare,
  calculateBuyInvestment,
  calculateSellAsset,
  calculateSellShare,
  calculateSellInvestment,
  calculateDividend,
  calculatePayback,
  calculateCashflow,
  calculateDeposit,
} from './actions';

describe('Grow typed actions', () => {
  describe('buy', () => {
    it('Buy Asset without financing: full amount goes to both the asset and Grow.amount', () => {
      const result = calculateBuyAsset({
        title: 'Car',
        totalAmountMinor: 150000,
        existingAssetAmountMinor: null,
        existingGrowAmountMinor: 0,
      });
      expect(result.comment).toBe('Buy Asset Car 1 x 1500;');
      expect(result.transactionAmountMinor).toBe(-150000);
      expect(result.newAssetAmountMinor).toBe(150000);
      expect(result.newGrowAmountMinor).toBe(150000);
      expect(result.growStatus).toBe('bought');
      expect(result.liabilityPatch).toBeUndefined();
    });

    it('Buy Asset with financing: the asset records the full price, Grow.amount and the transaction record only the cash portion', () => {
      const result = calculateBuyAsset({
        title: 'Car',
        totalAmountMinor: 150000,
        existingAssetAmountMinor: null,
        existingGrowAmountMinor: 0,
        liabilitie: {
          existingAmountMinor: null,
          existingCreditMinor: null,
          loanMinor: 100000,
          creditMinor: 5000,
        },
      });
      expect(result.comment).toBe('Liabilitie 1000 50; Buy Asset Car 1 x 1500;');
      expect(result.transactionAmountMinor).toBe(-50000);
      expect(result.newAssetAmountMinor).toBe(150000);
      expect(result.newGrowAmountMinor).toBe(50000);
      expect(result.liabilityPatch).toEqual({
        tag: 'Car',
        amountMinor: 100000,
        creditMinor: 5000,
        investment: true,
      });
    });

    it('Buy Share accumulates onto an existing share position', () => {
      const result = calculateBuyShare({
        title: 'MSFT',
        quantity: 10,
        priceMinor: 25000,
        existingShareQuantity: 5,
        existingGrowAmountMinor: 100000,
      });
      expect(result.comment).toBe('Buy Share MSFT 10 x 250;');
      expect(result.transactionAmountMinor).toBe(-250000);
      expect(result.newShareQuantity).toBe(15);
      expect(result.newSharePriceMinor).toBe(25000);
      expect(result.newGrowAmountMinor).toBe(350000);
    });

    it('Buy Share with no existing position still nets out the financed portion from Grow.amount (the corrected bug — the source used the un-reduced amount here)', () => {
      const result = calculateBuyShare({
        title: 'MSFT',
        quantity: 10,
        priceMinor: 25000,
        existingShareQuantity: null,
        existingGrowAmountMinor: 0,
        liabilitie: {
          existingAmountMinor: null,
          existingCreditMinor: null,
          loanMinor: 100000,
          creditMinor: 0,
        },
      });
      expect(result.transactionAmountMinor).toBe(-150000);
      expect(result.newGrowAmountMinor).toBe(150000);
    });

    it('Buy Investment creates the companion M-<title> mortgage liability unconditionally', () => {
      const result = calculateBuyInvestment({
        title: 'Rental Flat',
        depositMinor: 2000000,
        mortgageMinor: 30000000,
        existingInvestmentDepositMinor: null,
        existingInvestmentAmountMinor: null,
        existingMortgageLiabilityAmountMinor: null,
        existingGrowAmountMinor: 0,
      });
      expect(result.comment).toBe('Buy Investment Rental Flat 20000 300000;');
      expect(result.transactionAmountMinor).toBe(-2000000);
      expect(result.newInvestmentDepositMinor).toBe(2000000);
      expect(result.newInvestmentAmountMinor).toBe(30000000);
      expect(result.mortgageLiabilityPatch).toEqual({
        tag: 'M-Rental Flat',
        amountMinor: 30000000,
      });
      expect(result.newGrowAmountMinor).toBe(2000000);
    });

    it('Buy Investment with an attached personal-loan financing the deposit is distinct from the mortgage liability', () => {
      const result = calculateBuyInvestment({
        title: 'Rental Flat',
        depositMinor: 2000000,
        mortgageMinor: 30000000,
        existingInvestmentDepositMinor: null,
        existingInvestmentAmountMinor: null,
        existingMortgageLiabilityAmountMinor: null,
        existingGrowAmountMinor: 0,
        liabilitie: {
          existingAmountMinor: null,
          existingCreditMinor: null,
          loanMinor: 500000,
          creditMinor: 10000,
        },
      });
      expect(result.comment).toBe('Liabilitie 5000 100; Buy Investment Rental Flat 20000 300000;');
      expect(result.transactionAmountMinor).toBe(-1500000);
      expect(result.newGrowAmountMinor).toBe(1500000);
      expect(result.liabilityPatch).toEqual({
        tag: 'Rental Flat',
        amountMinor: 500000,
        creditMinor: 10000,
        investment: true,
      });
      expect(result.mortgageLiabilityPatch).toEqual({
        tag: 'M-Rental Flat',
        amountMinor: 30000000,
      });
    });
  });

  describe('sell', () => {
    it('Sell Asset', () => {
      const result = calculateSellAsset('Car', 120000, 150000);
      expect(result.comment).toBe('Sell Asset Car 1 x 1200;');
      expect(result.transactionAmountMinor).toBe(120000);
      expect(result.newAssetAmountMinor).toBe(30000);
      expect(result.growStatus).toBe('sold');
    });

    it('Sell Share', () => {
      const result = calculateSellShare('MSFT', 5, 26000, 15);
      expect(result.comment).toBe('Sell Share MSFT 5 x 260;');
      expect(result.transactionAmountMinor).toBe(130000);
      expect(result.newShareQuantity).toBe(10);
      expect(result.newSharePriceMinor).toBe(26000);
    });

    it('Sell Investment without a payback: the transaction amount is the sale proceeds (deposit returned)', () => {
      const result = calculateSellInvestment({
        title: 'Rental Flat',
        depositMinor: 500000,
        mortgageMinor: 2900000,
        existingInvestmentDepositMinor: 2000000,
        existingInvestmentAmountMinor: 30000000,
        existingMortgageLiabilityAmountMinor: 30000000,
        existingGrowAmountMinor: 2000000,
      });
      expect(result.comment).toBe('Sell Investment Rental Flat 5000 29000;');
      expect(result.transactionAmountMinor).toBe(500000);
      expect(result.profitMinor).toBe(500000);
      expect(result.newInvestmentDepositMinor).toBe(1500000);
      expect(result.newInvestmentAmountMinor).toBe(27100000);
      expect(result.newMortgageLiabilityAmountMinor).toBe(27100000);
      expect(result.newGrowAmountMinor).toBe(1500000);
      expect(result.growStatus).toBe('sold');
    });

    it('Sell Investment with a payback: profit nets out the payback (the corrected bug — the source built this transaction amount from a stray leftover value, not the actual proceeds)', () => {
      const result = calculateSellInvestment({
        title: 'Rental Flat',
        depositMinor: 500000,
        mortgageMinor: 2900000,
        existingInvestmentDepositMinor: 2000000,
        existingInvestmentAmountMinor: 30000000,
        existingMortgageLiabilityAmountMinor: 30000000,
        existingGrowAmountMinor: 2000000,
        payback: { amountMinor: 231500, creditMinor: 46300 },
      });
      expect(result.comment).toBe(
        'Payback Liabilitie 2315 463; Sell Investment Rental Flat 5000 29000;',
      );
      expect(result.profitMinor).toBe(500000 - 231500 - 46300);
      expect(result.transactionAmountMinor).toBe(result.profitMinor);
    });

    it('Sell Investment floors Grow.amount at zero rather than going negative', () => {
      const result = calculateSellInvestment({
        title: 'Rental Flat',
        depositMinor: 500000,
        mortgageMinor: 2900000,
        existingInvestmentDepositMinor: 2000000,
        existingInvestmentAmountMinor: 30000000,
        existingMortgageLiabilityAmountMinor: 30000000,
        existingGrowAmountMinor: 100000,
      });
      expect(result.newGrowAmountMinor).toBe(0);
    });
  });

  it('Dividend produces only a transaction, no Share/Grow mutation', () => {
    const result = calculateDividend('MSFT', 10, 5000);
    expect(result.comment).toBe('Dividende Share MSFT 10 x 50;');
    expect(result.transactionAmountMinor).toBe(50000);
    expect(Object.keys(result)).toEqual(['comment', 'transactionAmountMinor']);
  });

  describe('payback', () => {
    it('partial payback', () => {
      const result = calculatePayback(50000, 10000, 500000, 20000, 0);
      expect(result.comment).toBe('Payback Liabilitie 500 100;');
      expect(result.transactionAmountMinor).toBe(-60000);
      expect(result.newLiabilityAmountMinor).toBe(450000);
      expect(result.newLiabilityCreditMinor).toBe(10000);
      expect(result.newGrowAmountMinor).toBe(50000);
      expect(result.growStatus).toBe('paid back');
    });

    it('final payback that zeroes both amount and credit marks the liability paid off', () => {
      const result = calculatePayback(500000, 20000, 500000, 20000, 100000);
      expect(result.newLiabilityAmountMinor).toBe(0);
      expect(result.newLiabilityCreditMinor).toBe(0);
      expect(result.growStatus).toBe('paid off');
    });
  });

  it('Cashflow nets out an attached liability credit and produces no Grow mutation', () => {
    const withoutCredit = calculateCashflow(15000);
    expect(withoutCredit.comment).toBe('CASHFLOW 150;');
    expect(withoutCredit.transactionAmountMinor).toBe(15000);

    const withCredit = calculateCashflow(15000, 2000);
    expect(withCredit.comment).toBe('CASHFLOW 150 - CREDIT 20;');
    expect(withCredit.transactionAmountMinor).toBe(13000);
  });

  it('Deposit is a cash outflow with no Grow mutation', () => {
    const result = calculateDeposit(30000);
    expect(result.comment).toBe('Deposit 300;');
    expect(result.transactionAmountMinor).toBe(-30000);
  });
});
