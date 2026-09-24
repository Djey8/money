import {
  generateBuyAssetComment,
  generateSellAssetComment,
  generateBuyShareComment,
  generateSellShareComment,
  generateDividendComment,
  generateBuyInvestmentComment,
  generateSellInvestmentComment,
  generatePaybackComment,
  generateLiabilitieComment,
  generateCashflowComment,
  generateDepositComment,
  joinGrowStatements,
  parseGrowComment,
  splitGrowStatements,
  assertValidGrowTitle,
  formatAmountToken,
  renameGrowTitleInComment,
} from './dsl';

describe('Grow DSL — generation matches the existing UI-canonical formats', () => {
  it('Buy Asset: quantity is always the literal 1', () => {
    expect(generateBuyAssetComment('Car', 150000)).toBe('Buy Asset Car 1 x 1500;');
  });

  it('Sell Asset: quantity is always the literal 1', () => {
    expect(generateSellAssetComment('Car', 120000)).toBe('Sell Asset Car 1 x 1200;');
  });

  it('Buy Share', () => {
    expect(generateBuyShareComment('MSFT', 10, 25050)).toBe('Buy Share MSFT 10 x 250.5;');
  });

  it('Sell Share', () => {
    expect(generateSellShareComment('MSFT', 5, 26000)).toBe('Sell Share MSFT 5 x 260;');
  });

  it('Dividend', () => {
    expect(generateDividendComment('MSFT', 10, 5000)).toBe('Dividende Share MSFT 10 x 50;');
  });

  it('Buy Investment without an attached liability', () => {
    expect(generateBuyInvestmentComment('Rental Flat', 2000000, 30000000)).toBe(
      'Buy Investment Rental Flat 20000 300000;',
    );
  });

  it('a financing liability prepends a bare Liabilitie statement ahead of ANY buy kind, not just investment', () => {
    expect(
      joinGrowStatements(
        generateLiabilitieComment(2500000, 50000),
        generateBuyInvestmentComment('Rental Flat', 2000000, 30000000),
      ),
    ).toBe('Liabilitie 25000 500; Buy Investment Rental Flat 20000 300000;');
    expect(
      joinGrowStatements(
        generateLiabilitieComment(2500000, 50000),
        generateBuyShareComment('MSFT', 10, 25050),
      ),
    ).toBe('Liabilitie 25000 500; Buy Share MSFT 10 x 250.5;');
  });

  it('Sell Investment without a payback', () => {
    expect(generateSellInvestmentComment('Rental Flat', 500000, 2900000)).toBe(
      'Sell Investment Rental Flat 5000 29000;',
    );
  });

  it('a payback prepends a Payback Liabilitie statement ahead of an investment sell', () => {
    expect(
      joinGrowStatements(
        generatePaybackComment(2315000, 46300),
        generateSellInvestmentComment('Rental Flat', 500000, 2900000),
      ),
    ).toBe('Payback Liabilitie 23150 463; Sell Investment Rental Flat 5000 29000;');
  });

  it('Payback (standalone)', () => {
    expect(generatePaybackComment(50000, 10000)).toBe('Payback Liabilitie 500 100;');
  });

  it('Cashflow without a credit', () => {
    expect(generateCashflowComment(15000)).toBe('CASHFLOW 150;');
  });

  it('Cashflow with a credit', () => {
    expect(generateCashflowComment(15000, 2000)).toBe('CASHFLOW 150 - CREDIT 20;');
  });

  it('Deposit', () => {
    expect(generateDepositComment(30000)).toBe('Deposit 300;');
  });

  it('rejects a title containing the statement separator', () => {
    expect(() => assertValidGrowTitle('Rental; Flat')).toThrow();
    expect(() => generateBuyShareComment('A; B', 1, 100)).toThrow();
  });
});

describe('Grow DSL — parsing (round-trips + legacy edge cases)', () => {
  it('round-trips every generated format back to its typed fields', () => {
    expect(parseGrowComment(generateBuyAssetComment('Car', 150000))).toEqual([
      { kind: 'buyAsset', title: 'Car', quantity: 1, priceMinor: 150000 },
    ]);
    expect(parseGrowComment(generateSellAssetComment('Car', 120000))).toEqual([
      { kind: 'sellAsset', title: 'Car', quantity: 1, priceMinor: 120000 },
    ]);
    expect(parseGrowComment(generateBuyShareComment('MSFT', 10, 25050))).toEqual([
      { kind: 'buyShare', title: 'MSFT', quantity: 10, priceMinor: 25050 },
    ]);
    expect(parseGrowComment(generateSellShareComment('MSFT', 5, 26000))).toEqual([
      { kind: 'sellShare', title: 'MSFT', quantity: 5, priceMinor: 26000 },
    ]);
    expect(parseGrowComment(generateDividendComment('MSFT', 10, 5000))).toEqual([
      { kind: 'dividendShare', title: 'MSFT', quantity: 10, priceMinor: 5000 },
    ]);
    expect(
      parseGrowComment(generateBuyInvestmentComment('Rental Flat', 2000000, 30000000)),
    ).toEqual([
      {
        kind: 'buyInvestment',
        title: 'Rental Flat',
        depositMinor: 2000000,
        mortgageMinor: 30000000,
      },
    ]);
    expect(parseGrowComment(generateSellInvestmentComment('Rental Flat', 500000, 2900000))).toEqual(
      [
        {
          kind: 'sellInvestment',
          title: 'Rental Flat',
          depositMinor: 500000,
          mortgageMinor: 2900000,
        },
      ],
    );
    expect(parseGrowComment(generatePaybackComment(50000, 10000))).toEqual([
      {
        kind: 'paybackLiabilitie',
        amount: { kind: 'absolute', minor: 50000 },
        credit: { kind: 'absolute', minor: 10000 },
      },
    ]);
    expect(parseGrowComment(generateCashflowComment(15000))).toEqual([
      { kind: 'cashflow', cashflowMinor: 15000, creditMinor: null },
    ]);
    expect(parseGrowComment(generateCashflowComment(15000, 2000))).toEqual([
      { kind: 'cashflow', cashflowMinor: 15000, creditMinor: 2000 },
    ]);
    expect(parseGrowComment(generateDepositComment(30000))).toEqual([
      { kind: 'deposit', amountMinor: 30000 },
    ]);
  });

  it('parses a multi-word title without corrupting the trailing numeric fields (the confirmed bug this rewrite fixes)', () => {
    expect(parseGrowComment('Buy Share Global Tech Growth ETF 10 x 25;')).toEqual([
      { kind: 'buyShare', title: 'Global Tech Growth ETF', quantity: 10, priceMinor: 2500 },
    ]);
    expect(parseGrowComment('Buy Investment Rental Flat Berlin Mitte 2000 30000;')).toEqual([
      {
        kind: 'buyInvestment',
        title: 'Rental Flat Berlin Mitte',
        depositMinor: 200000,
        mortgageMinor: 3000000,
      },
    ]);
  });

  it('parses a two-statement Payback Liabilitie + Sell Investment comment', () => {
    expect(
      parseGrowComment('Payback Liabilitie 231.5 46.3; Sell Investment Rental Flat 5000 25000;'),
    ).toEqual([
      {
        kind: 'paybackLiabilitie',
        amount: { kind: 'absolute', minor: 23150 },
        credit: { kind: 'absolute', minor: 4630 },
      },
      {
        kind: 'sellInvestment',
        title: 'Rental Flat',
        depositMinor: 500000,
        mortgageMinor: 2500000,
      },
    ]);
  });

  it('parses a two-statement bare Liabilitie + Buy Investment comment', () => {
    expect(parseGrowComment('Liabilitie 500 100; Buy Investment Rental Flat 2000 30000;')).toEqual([
      {
        kind: 'liabilitie',
        amount: { kind: 'absolute', minor: 50000 },
        credit: { kind: 'absolute', minor: 10000 },
      },
      { kind: 'buyInvestment', title: 'Rental Flat', depositMinor: 200000, mortgageMinor: 3000000 },
    ]);
  });

  it('parses a legacy percentage-suffixed credit as an unresolved percentage token', () => {
    expect(parseGrowComment('Liabilitie 500 20%;')).toEqual([
      {
        kind: 'liabilitie',
        amount: { kind: 'absolute', minor: 50000 },
        credit: { kind: 'percentage', percentage: 20 },
      },
    ]);
  });

  it('parses a legacy percentage-suffixed amount too, not just credit', () => {
    expect(parseGrowComment('Liabilitie 50% 20%;')).toEqual([
      {
        kind: 'liabilitie',
        amount: { kind: 'percentage', percentage: 50 },
        credit: { kind: 'percentage', percentage: 20 },
      },
    ]);
  });

  it('Payback Liabilitie also supports percentage tokens on either field (add.component.ts:942,956)', () => {
    expect(parseGrowComment('Payback Liabilitie 50% 20%;')).toEqual([
      {
        kind: 'paybackLiabilitie',
        amount: { kind: 'percentage', percentage: 50 },
        credit: { kind: 'percentage', percentage: 20 },
      },
    ]);
  });

  it('formatAmountToken renders a token back to its original textual form', () => {
    expect(formatAmountToken({ kind: 'absolute', minor: 50000 })).toBe('500');
    expect(formatAmountToken({ kind: 'percentage', percentage: 20 })).toBe('20%');
  });

  it('handles empty/trivial input', () => {
    expect(parseGrowComment('')).toEqual([]);
    expect(splitGrowStatements('')).toEqual([]);
    expect(joinGrowStatements()).toBe('');
    expect(joinGrowStatements('Deposit 300;')).toBe('Deposit 300;');
  });

  it('recognizes the legacy colon CASHFLOW dialect (add.component.ts side effect) without regenerating it', () => {
    expect(parseGrowComment('CASHFLOW: 150;')).toEqual([
      { kind: 'cashflow', cashflowMinor: 15000, creditMinor: null },
    ]);
  });

  it('returns an unknown statement for text that matches no known Grow format', () => {
    expect(parseGrowComment('Groceries for the week')).toEqual([
      { kind: 'unknown', raw: 'Groceries for the week' },
    ]);
  });

  it('splits multi-statement comments on ";" and drops empty segments', () => {
    expect(splitGrowStatements('Deposit 300; ')).toEqual(['Deposit 300']);
    expect(splitGrowStatements('Deposit 300')).toEqual(['Deposit 300']);
  });
});

describe('renameGrowTitleInComment', () => {
  it('renames the title in every statement that names it, leaving the rest untouched', () => {
    expect(
      renameGrowTitleInComment('Liabilitie 1000 50; Buy Share SOL 1.77 x 88.33;', 'SOL', 'Solana'),
    ).toBe('Liabilitie 1000 50; Buy Share Solana 1.77 x 88.33;');
    expect(
      renameGrowTitleInComment(
        'Payback Liabilitie 100 5; Sell Investment Old Flat 50000 200000;',
        'Old Flat',
        'Flat',
      ),
    ).toBe('Payback Liabilitie 100 5; Sell Investment Flat 50000 200000;');
    expect(renameGrowTitleInComment('Dividende Share SOL 3 x 1;', 'SOL', 'X')).toBe(
      'Dividende Share X 3 x 1;',
    );
  });

  it('never touches a different project whose title merely starts with the old one', () => {
    expect(renameGrowTitleInComment('Buy Share SOL Cash 1 x 2;', 'SOL', 'X')).toBe(
      'Buy Share SOL Cash 1 x 2;',
    );
  });

  it('treats regex characters in the title literally and leaves unrelated comments alone', () => {
    expect(renameGrowTitleInComment('Buy Asset A+B (1) 1 x 5;', 'A+B (1)', 'AB')).toBe(
      'Buy Asset AB 1 x 5;',
    );
    expect(renameGrowTitleInComment('Lunch with SOL friends', 'SOL', 'X')).toBe(
      'Lunch with SOL friends',
    );
  });

  it('inserts a new title containing $ literally', () => {
    expect(renameGrowTitleInComment('Buy Share A 1 x 2;', 'A', 'US$ Fund')).toBe(
      'Buy Share US$ Fund 1 x 2;',
    );
  });
});
