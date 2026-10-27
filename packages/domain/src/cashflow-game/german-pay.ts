/**
 * What a German salary comes to after tax and social insurance (JFK, 2026-10-27): the numbers of the characters' careers are worked out
 * from the gross salary, so every character's month is built the same way. An approximation for a single employee (tax class I) with
 * the 2026 rates, checked against the Dual Student's career (56,000 a year: 709 tax, 1,006 social insurance a month) - good enough for a
 * game, not a tax return.
 */

/** The income tax of a year for a taxable income (the 2026 tariff of §32a EStG, single). */
export function incomeTaxYear(taxableYear: number): number {
  const zve = Math.floor(Math.max(0, taxableYear));
  if (zve <= 12348) return 0;
  if (zve <= 17799) {
    const y = (zve - 12348) / 10000;
    return Math.floor((914.51 * y + 1400) * y);
  }
  if (zve <= 69878) {
    const z = (zve - 17799) / 10000;
    return Math.floor((173.1 * z + 2397) * z + 1034.87);
  }
  if (zve <= 277825) return Math.floor(0.42 * zve - 11135.63);
  return Math.floor(0.45 * zve - 19470.38);
}

const PENSION_RATE = 0.093;
const UNEMPLOYMENT_RATE = 0.013;
const HEALTH_RATE = 0.0855; // 7.3 % + half of the average extra contribution
const CARE_RATE_CHILDLESS = 0.024;
const CARE_RATE_PARENT = 0.018;
/** Monthly ceilings of the contributions (2026). */
const PENSION_CEILING = 8450;
const HEALTH_CEILING = 5812.5;

export interface GermanPay {
  grossMonth: number;
  taxMonth: number;
  pensionMonth: number;
  healthMonth: number;
  careMonth: number;
  unemploymentMonth: number;
  socialMonth: number;
  netMonth: number;
}

export interface GermanPayOptions {
  /** A civil servant pays no pension, unemployment or (here) statutory health insurance; the private cover is a flat line instead. */
  civilServant?: boolean;
  /** Parents pay a lower care insurance rate. */
  children?: boolean;
  /** Married and filing jointly: the tax of half the income, twice (the other half is the partner's, who earns nothing here). */
  splitting?: boolean;
  /** Self-employed: no employer share - the contributions are the full rates, as a flat sum. */
  selfEmployed?: boolean;
}

/** All amounts in whole euros per month. */
export function germanPay(grossMonth: number, options: GermanPayOptions = {}): GermanPay {
  const pensionBase = Math.min(grossMonth, PENSION_CEILING);
  const healthBase = Math.min(grossMonth, HEALTH_CEILING);
  let pension = options.civilServant ? 0 : pensionBase * PENSION_RATE;
  let unemployment = options.civilServant ? 0 : pensionBase * UNEMPLOYMENT_RATE;
  let health = options.civilServant ? healthBase * 0.07 : healthBase * HEALTH_RATE; // the private cover, after the state's aid
  let care = options.civilServant
    ? 0
    : healthBase * (options.children ? CARE_RATE_PARENT : CARE_RATE_CHILDLESS);
  if (options.selfEmployed) {
    // the employer's half is paid by oneself
    pension = pensionBase * PENSION_RATE * 1.0;
    unemployment = 0;
    health = healthBase * (HEALTH_RATE + 0.0715);
    care = healthBase * ((options.children ? CARE_RATE_PARENT : CARE_RATE_CHILDLESS) + 0.018);
  }
  const socialYear = (pension + unemployment + health + care) * 12;
  const taxable = grossMonth * 12 - socialYear;
  const taxYear = options.splitting ? 2 * incomeTaxYear(taxable / 2) : incomeTaxYear(taxable);
  const taxMonth = taxYear / 12;
  const socialMonth = pension + unemployment + health + care;
  return {
    grossMonth,
    taxMonth,
    pensionMonth: pension,
    healthMonth: health,
    careMonth: care,
    unemploymentMonth: unemployment,
    socialMonth,
    netMonth: grossMonth - taxMonth - socialMonth,
  };
}
