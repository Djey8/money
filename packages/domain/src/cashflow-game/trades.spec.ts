import { parseGrowComment } from '../grow/dsl';
import { identityText, type GameText } from './game-text';
import {
  gameTradeStep,
  purchaseOfStatements,
  sellAssetProblem,
  sellAssetProblemOf,
  tradePurchase,
} from './trades';

describe('gameTradeStep', () => {
  it('names a Grow trade after its position, whatever else the comment says', () => {
    expect(gameTradeStep('Buy Share OK4U 250 x 10;\n#cashflow', '@OK4U')).toEqual({
      kind: 'buyShare',
      detail: 'OK4U',
    });
    expect(gameTradeStep('Sell Share OK4U 10 x 12;', '@OK4U')).toEqual({
      kind: 'sellShare',
      detail: 'OK4U',
    });
    expect(gameTradeStep('Buy Investment EFH 3000 47000;', '@EFH')).toEqual({
      kind: 'buyInvestment',
      detail: 'EFH',
    });
    expect(gameTradeStep('Sell Investment EFH 80000 60000;', '@EFH')).toEqual({
      kind: 'sellInvestment',
      detail: 'EFH',
    });
    expect(gameTradeStep('Buy Asset GOLD 1 x 5000;', '@GOLD')).toEqual({
      kind: 'buyAsset',
      detail: 'GOLD',
    });
    expect(gameTradeStep('Sell Asset GOLD 5 x 1000;', '@GOLD')).toEqual({
      kind: 'sellAsset',
      detail: 'GOLD',
    });
  });

  it('reads a title with a space correctly (the positional parsers it replaces could not)', () => {
    expect(gameTradeStep('Buy Share Big Oil 10 x 5;', '@Big Oil')).toEqual({
      kind: 'buyShare',
      detail: 'Big Oil',
    });
  });

  it('a Doodad and a Market cost are told apart by their tag, and take the category as the detail', () => {
    expect(gameTradeStep('Broken tooth\n\n#doodad', '@Health')).toEqual({
      kind: 'doodad',
      detail: 'Health',
    });
    expect(gameTradeStep('Tenant damage\n\n#market', '@EFH')).toEqual({
      kind: 'marketCost',
      detail: 'EFH',
    });
  });

  it('a Doodad tag wins over a trade statement in the same comment', () => {
    expect(gameTradeStep('Buy Share X 1 x 1;\n#doodad', '@X').kind).toBe('doodad');
  });

  it('a payback and a plain transaction use the category', () => {
    expect(gameTradeStep('Payback Liabilitie 500 0;', '@Car loan')).toEqual({
      kind: 'payoff',
      detail: 'Car loan',
    });
    expect(gameTradeStep('Lunch', '@Food')).toEqual({ kind: 'transaction', detail: 'Food' });
    expect(gameTradeStep('', '')).toEqual({ kind: 'transaction', detail: '' });
  });

  it('prefers a share over an investment when a comment holds both, as it always did', () => {
    expect(gameTradeStep('Buy Investment EFH 1 2; Buy Share X 1 x 1;', '@X').kind).toBe('buyShare');
  });
});

describe('tradePurchase', () => {
  it('shares cost quantity x price, to the cent', () => {
    expect(tradePurchase('Buy Share OK4U 250 x 10;')).toEqual({ title: 'OK4U', costMinor: 250000 });
    expect(tradePurchase('Buy Share OK4U 3 x 0.335;')?.costMinor).toBe(Math.round(3 * 34)); // 0.335 -> 34 minor
  });

  it('an investment costs its deposit up front, not the mortgage', () => {
    expect(tradePurchase('Buy Investment EFH 3000 47000;')).toEqual({
      title: 'EFH',
      costMinor: 300000,
    });
  });

  it('a single-unit special asset costs its price; a multi-unit one is deliberately not a purchase', () => {
    expect(tradePurchase('Buy Asset GOLD 1 x 5000;')).toEqual({ title: 'GOLD', costMinor: 500000 });
    expect(tradePurchase('Buy Asset GOLD 5 x 1000;')).toBeNull();
  });

  it('a Doodad, a Market cost and a Sell Investment fee are expenses paid like a purchase, at the dialog’s amount', () => {
    expect(tradePurchase('Tooth\n#doodad', 50000)).toEqual({ title: '', costMinor: 50000 });
    expect(tradePurchase('Pipe\n#market', 120000)).toEqual({ title: '', costMinor: 120000 });
    expect(tradePurchase('Sell Investment EFH 80000 60000;', 25000)).toEqual({
      title: '',
      costMinor: 25000,
    });
  });

  it('an expense with no amount is nothing to pay for; sells, dividends and plain entries are not purchases', () => {
    expect(tradePurchase('Tooth\n#doodad', 0)).toBeNull();
    expect(tradePurchase('Sell Share OK4U 10 x 12;')).toBeNull();
    expect(tradePurchase('Dividende Share OK4U 3 x 2;')).toBeNull();
    expect(tradePurchase('Lunch')).toBeNull();
  });

  it('the typed form takes already-parsed statements', () => {
    expect(purchaseOfStatements(parseGrowComment('Buy Share OK4U 2 x 5;'))).toEqual({
      title: 'OK4U',
      costMinor: 1000,
    });
    expect(purchaseOfStatements([])).toBeNull();
  });
});

describe('sellAssetProblem', () => {
  const text: GameText = (key, params) => (params ? `${key}:${params.coins}` : key);
  const coins = (title: string) => (title === 'GOLD' ? 5 : 0);

  it('lets a coin asset sell the coins it has, and no more', () => {
    expect(sellAssetProblem('Sell Asset GOLD 5 x 1000;', coins, text)).toBeNull();
    expect(sellAssetProblem('Sell Asset GOLD 2 x 1000;', coins, text)).toBeNull();
    expect(sellAssetProblem('Sell Asset GOLD 6 x 1000;', coins, text)).toBe(
      'CashflowGame.sellTooManyCoins:5',
    );
  });

  it('asks for a number of coins when there is none', () => {
    expect(sellAssetProblem('Sell Asset GOLD 0 x 1000;', coins, text)).toBe(
      'CashflowGame.sellNeedCoins',
    );
  });

  it('leaves an ordinary asset, and anything that is not a Sell Asset, alone', () => {
    expect(sellAssetProblem('Sell Asset CAR 1 x 5000;', coins, text)).toBeNull();
    expect(sellAssetProblem('Buy Asset GOLD 1 x 5000;', coins, text)).toBeNull();
    expect(sellAssetProblem('', coins, identityText)).toBeNull();
    expect(sellAssetProblemOf([], coins, identityText)).toBeNull();
  });
});
