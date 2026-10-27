import { germanPay, incomeTaxYear } from './german-pay';

describe('germanPay', () => {
  // the Dual Student's career (temp_cards/dreamfund-career-dual-student.md): gross a month -> tax, social insurance
  it.each([
    [4667, 709, 1006],
    [6250, 1183, 1299],
    [7917, 1823, 1476],
    [9583, 2583, 1532],
  ])('is close to the Dual Student ladder at %i a month', (gross, tax, social) => {
    const pay = germanPay(gross);
    expect(Math.abs(pay.taxMonth - tax) / tax).toBeLessThan(0.06);
    expect(Math.abs(pay.socialMonth - social) / social).toBeLessThan(0.01);
    expect(pay.netMonth).toBeCloseTo(gross - pay.taxMonth - pay.socialMonth, 6);
  });

  it('pays no tax below the basic allowance and caps the contributions', () => {
    expect(incomeTaxYear(12000)).toBe(0);
    expect(germanPay(20000).socialMonth).toBeCloseTo(germanPay(30000).socialMonth, 6);
  });

  it('taxes a married single earner less than a single one, and a civil servant pays no pension', () => {
    expect(germanPay(7600, { splitting: true }).taxMonth).toBeLessThan(germanPay(7600).taxMonth);
    expect(germanPay(4350, { civilServant: true }).pensionMonth).toBe(0);
    expect(germanPay(3900, { selfEmployed: true }).socialMonth).toBeGreaterThan(
      germanPay(3900).socialMonth,
    );
  });
});
