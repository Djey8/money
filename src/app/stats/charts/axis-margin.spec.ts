import { estimateLabelWidth, leftMarginForLabels } from './axis-margin';

describe('leftMarginForLabels', () => {
  const fontSize = 12;

  it('keeps the minimum margin for short labels', () => {
    expect(leftMarginForLabels(['0', '500', '1,000'], fontSize, 40)).toBeGreaterThanOrEqual(40);
    expect(leftMarginForLabels(['0', '50', '100'], fontSize, 40)).toBe(40);
  });

  it('stays slim when the highest number is 9,000 - no space reserved for millions', () => {
    const margin = leftMarginForLabels(['0', '3,000', '6,000', '9,000'], fontSize, 40);
    expect(margin).toBeLessThan(60);
  });

  it('grows with the number of digits to read', () => {
    const thousands = leftMarginForLabels(['9,000'], fontSize, 40);
    const hundredThousands = leftMarginForLabels(['900,000'], fontSize, 40);
    const millions = leftMarginForLabels(['1,250,000'], fontSize, 40);
    expect(hundredThousands).toBeGreaterThan(thousands);
    expect(millions).toBeGreaterThan(hundredThousands);
    // a 1,250,000 label really does not fit in the old fixed 40 px
    expect(estimateLabelWidth('1,250,000', fontSize)).toBeGreaterThan(40);
    expect(millions).toBeGreaterThan(estimateLabelWidth('1,250,000', fontSize));
  });

  it('accounts for the minus sign of negative values', () => {
    expect(leftMarginForLabels(['-1,000,000'], fontSize, 40)).toBeGreaterThan(
      leftMarginForLabels(['1,000,000'], fontSize, 40),
    );
  });

  it('scales with the font size', () => {
    expect(leftMarginForLabels(['1,250,000'], 12, 40)).toBeGreaterThan(
      leftMarginForLabels(['1,250,000'], 8, 40),
    );
  });
});
