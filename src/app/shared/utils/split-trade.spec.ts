import { splitTrade } from './split-trade';

describe('splitTrade', () => {
  it('keeps a title of several words as one', () => {
    expect(splitTrade('Buy Asset Digital Templates 1 x 150;', 'Buy Asset', 3)).toEqual([
      'Buy',
      'Asset',
      'Digital Templates',
      '1',
      'x',
      '150',
    ]);
    expect(
      splitTrade('Buy Investment Studio Flat in Chemnitz 20000 80000;', 'Buy Investment', 2),
    ).toEqual(['Buy', 'Investment', 'Studio Flat in Chemnitz', '20000', '80000']);
  });

  it('reads a single word title and the statement among several', () => {
    expect(
      splitTrade('Payback Liabilitie 1 2; Sell Share WORLD 3 x 100;', 'Sell Share', 3),
    ).toEqual(['Sell', 'Share', 'WORLD', '3', 'x', '100']);
  });
});
