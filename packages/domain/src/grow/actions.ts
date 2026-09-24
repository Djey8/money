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
} from './dsl';
import { toMinorUnits } from '../money/minor-units';

/**
 * Pure calculators for Grow's six typed actions (PLAN.md D-16), one per
 * `POST /grow/{id}/{buy,sell,dividend,payback,cashflow,deposit}`. Each
 * mirrors the mutation logic confirmed by reading `add.component.ts`'s
 * comment-parsing blocks (which is where all of this state actually
 * mutates today — `grow.component.ts`'s own `buyProject`/`sellProject`/etc.
 * only pre-fill the Add-Transaction panel; they never touch Grow/Asset/
 * Share/Investment/Liability state themselves), given typed, pre-resolved
 * inputs instead of a hand-typed comment string.
 *
 * Every entity this package doesn't otherwise own (Asset/Share/Investment/
 * Liability upserts) is modeled the same way: the caller passes the
 * existing amount (or `null`/`undefined` if no record exists yet) and gets
 * back the new total — the repository layer applies it, it isn't mutated
 * here.
 *
 * Three deliberate corrections vs. the source, each because the original
 * behavior is plainly inconsistent with itself (not a redesign — D-9):
 * 1. Buy Share's "no existing share" branch used the FULL (pre-loan)
 *    amount for `Grow.amount`, while its "existing share" branch and both
 *    of Buy Asset/Buy Investment's branches use the loan-reduced amount.
 *    This module always uses the reduced amount, matching every other
 *    branch.
 * 2. Sell Investment's final transaction amount was built from whatever
 *    the Add panel's amount field happened to already contain (the string
 *    `'1'`, left over from `sellProject`'s initial value) plus profit,
 *    rather than from the actual sale proceeds. This module returns the
 *    economically correct `profit` (deposit minus any attached payback)
 *    as the transaction amount.
 * 3. The `CASHFLOW: <amount>;` colon-suffix that `add.component.ts`
 *    appends after a Sell Investment (a display artifact recomputing
 *    profit for that one workflow) is not reproduced — see `dsl.ts`'s
 *    header comment.
 *
 * Money fields are integer minor units, per this package's convention.
 * `quantity` is a plain decimal count (fractional for crypto/ETF units),
 * so a `quantity * priceMinor` product is rounded back to whole minor
 * units (`multiplyQuantityPrice`) and every resulting quantity is
 * normalized (`normalizeQuantity`) — otherwise `1.77 * 8833` yields a
 * non-integer amount the transaction layer rejects, and `0.1 + 0.2`-style
 * float residue leaves a sold-out position at `5e-17` instead of 0.
 */

/** Decimal places kept on a share quantity — enough for any crypto unit in practice, few enough to absorb float residue. */
export const QUANTITY_DECIMALS = 8;

export function normalizeQuantity(quantity: number): number {
  return toMinorUnits(quantity, QUANTITY_DECIMALS) / 10 ** QUANTITY_DECIMALS;
}

/** `quantity * priceMinor` rounded half-away-from-zero to whole minor units. */
export function multiplyQuantityPrice(quantity: number, priceMinor: number): number {
  return toMinorUnits(quantity * priceMinor, 0);
}

export interface GrowLiabilitieAttachment {
  /** Existing standalone Liability amount (tagged with the Grow project's own title) before this action, or `null` if none exists yet. */
  existingAmountMinor: number | null;
  existingCreditMinor: number | null;
  loanMinor: number;
  creditMinor: number;
}

export interface LiabilityPatch {
  tag: string;
  amountMinor: number;
  creditMinor: number;
  investment: true;
}

function applyLiabilitieAttachment(
  liabilitie: GrowLiabilitieAttachment | undefined,
): LiabilityPatch | undefined {
  if (!liabilitie) return undefined;
  return {
    tag: '',
    amountMinor: (liabilitie.existingAmountMinor ?? 0) + liabilitie.loanMinor,
    creditMinor: (liabilitie.existingCreditMinor ?? 0) + liabilitie.creditMinor,
    investment: true,
  };
}

// --- Buy ---

export interface BuyAssetInput {
  title: string;
  totalAmountMinor: number;
  existingAssetAmountMinor: number | null;
  existingGrowAmountMinor: number;
  liabilitie?: GrowLiabilitieAttachment;
}

export interface BuyResult {
  comment: string;
  transactionAmountMinor: number;
  newGrowAmountMinor: number;
  growStatus: 'bought';
  liabilityPatch?: LiabilityPatch;
}

export interface AssetPatchResult extends BuyResult {
  newAssetAmountMinor: number;
}

export function calculateBuyAsset(input: BuyAssetInput): AssetPatchResult {
  const reducedAmountMinor = input.totalAmountMinor - (input.liabilitie?.loanMinor ?? 0);
  const statement = generateBuyAssetComment(input.title, input.totalAmountMinor);
  const liabilityPatch = applyLiabilitieAttachment(input.liabilitie);
  if (liabilityPatch) liabilityPatch.tag = input.title;
  return {
    comment: input.liabilitie
      ? joinGrowStatements(
          generateLiabilitieComment(input.liabilitie.loanMinor, input.liabilitie.creditMinor),
          statement,
        )
      : statement,
    transactionAmountMinor: -reducedAmountMinor,
    newAssetAmountMinor: (input.existingAssetAmountMinor ?? 0) + input.totalAmountMinor,
    newGrowAmountMinor: input.existingGrowAmountMinor + reducedAmountMinor,
    growStatus: 'bought',
    liabilityPatch,
  };
}

export interface BuyShareInput {
  title: string;
  quantity: number;
  priceMinor: number;
  existingShareQuantity: number | null;
  existingGrowAmountMinor: number;
  liabilitie?: GrowLiabilitieAttachment;
}

export interface SharePatchResult extends BuyResult {
  newShareQuantity: number;
  newSharePriceMinor: number;
}

export function calculateBuyShare(input: BuyShareInput): SharePatchResult {
  const fullAmountMinor = multiplyQuantityPrice(input.quantity, input.priceMinor);
  const reducedAmountMinor = fullAmountMinor - (input.liabilitie?.loanMinor ?? 0);
  const statement = generateBuyShareComment(input.title, input.quantity, input.priceMinor);
  const liabilityPatch = applyLiabilitieAttachment(input.liabilitie);
  if (liabilityPatch) liabilityPatch.tag = input.title;
  return {
    comment: input.liabilitie
      ? joinGrowStatements(
          generateLiabilitieComment(input.liabilitie.loanMinor, input.liabilitie.creditMinor),
          statement,
        )
      : statement,
    transactionAmountMinor: -reducedAmountMinor,
    newShareQuantity: normalizeQuantity((input.existingShareQuantity ?? 0) + input.quantity),
    newSharePriceMinor: input.priceMinor,
    newGrowAmountMinor: input.existingGrowAmountMinor + reducedAmountMinor,
    growStatus: 'bought',
    liabilityPatch,
  };
}

export interface BuyInvestmentInput {
  title: string;
  depositMinor: number;
  mortgageMinor: number;
  existingInvestmentDepositMinor: number | null;
  existingInvestmentAmountMinor: number | null;
  existingMortgageLiabilityAmountMinor: number | null;
  existingGrowAmountMinor: number;
  liabilitie?: GrowLiabilitieAttachment;
}

export interface InvestmentPatchResult extends BuyResult {
  newInvestmentDepositMinor: number;
  newInvestmentAmountMinor: number;
  /** The companion `M-<title>` mortgage liability, always present (unconditional on every Investment buy, distinct from the optional `liabilityPatch` attachment). */
  mortgageLiabilityPatch: { tag: string; amountMinor: number };
}

export function calculateBuyInvestment(input: BuyInvestmentInput): InvestmentPatchResult {
  const reducedAmountMinor = input.depositMinor - (input.liabilitie?.loanMinor ?? 0);
  const statement = generateBuyInvestmentComment(
    input.title,
    input.depositMinor,
    input.mortgageMinor,
  );
  const liabilityPatch = applyLiabilitieAttachment(input.liabilitie);
  if (liabilityPatch) liabilityPatch.tag = input.title;
  return {
    comment: input.liabilitie
      ? joinGrowStatements(
          generateLiabilitieComment(input.liabilitie.loanMinor, input.liabilitie.creditMinor),
          statement,
        )
      : statement,
    transactionAmountMinor: -reducedAmountMinor,
    newInvestmentDepositMinor: (input.existingInvestmentDepositMinor ?? 0) + input.depositMinor,
    newInvestmentAmountMinor: (input.existingInvestmentAmountMinor ?? 0) + input.mortgageMinor,
    mortgageLiabilityPatch: {
      tag: `M-${input.title}`,
      amountMinor: (input.existingMortgageLiabilityAmountMinor ?? 0) + input.mortgageMinor,
    },
    newGrowAmountMinor: input.existingGrowAmountMinor + reducedAmountMinor,
    growStatus: 'bought',
    liabilityPatch,
  };
}

// --- Sell ---

export interface SellResult {
  comment: string;
  transactionAmountMinor: number;
  growStatus: 'sold';
}

export function calculateSellAsset(
  title: string,
  totalAmountMinor: number,
  existingAssetAmountMinor: number,
): SellResult & { newAssetAmountMinor: number } {
  return {
    comment: generateSellAssetComment(title, totalAmountMinor),
    transactionAmountMinor: totalAmountMinor,
    newAssetAmountMinor: existingAssetAmountMinor - totalAmountMinor,
    growStatus: 'sold',
  };
}

export function calculateSellShare(
  title: string,
  quantity: number,
  priceMinor: number,
  existingShareQuantity: number,
): SellResult & { newShareQuantity: number; newSharePriceMinor: number } {
  return {
    comment: generateSellShareComment(title, quantity, priceMinor),
    transactionAmountMinor: multiplyQuantityPrice(quantity, priceMinor),
    newShareQuantity: normalizeQuantity(existingShareQuantity - quantity),
    newSharePriceMinor: priceMinor,
    growStatus: 'sold',
  };
}

export interface SellInvestmentInput {
  title: string;
  depositMinor: number;
  mortgageMinor: number;
  existingInvestmentDepositMinor: number;
  existingInvestmentAmountMinor: number;
  existingMortgageLiabilityAmountMinor: number;
  existingGrowAmountMinor: number;
  /** An attached liability payback, settled atomically with the sale (distinct from the mortgage, matched by the Grow project's own `.liabilitie` link). */
  payback?: { amountMinor: number; creditMinor: number };
}

export interface SellInvestmentResult extends SellResult {
  newInvestmentDepositMinor: number;
  newInvestmentAmountMinor: number;
  newMortgageLiabilityAmountMinor: number;
  newGrowAmountMinor: number;
  /** Sale proceeds net of any attached payback — the economically correct transaction amount (see module header, correction 2). */
  profitMinor: number;
}

export function calculateSellInvestment(input: SellInvestmentInput): SellInvestmentResult {
  const statement = generateSellInvestmentComment(
    input.title,
    input.depositMinor,
    input.mortgageMinor,
  );
  const comment = input.payback
    ? joinGrowStatements(
        generatePaybackComment(input.payback.amountMinor, input.payback.creditMinor),
        statement,
      )
    : statement;
  const profitMinor =
    input.depositMinor -
    (input.payback ? input.payback.amountMinor + input.payback.creditMinor : 0);
  return {
    comment,
    transactionAmountMinor: profitMinor,
    profitMinor,
    newInvestmentDepositMinor: input.existingInvestmentDepositMinor - input.depositMinor,
    newInvestmentAmountMinor: input.existingInvestmentAmountMinor - input.mortgageMinor,
    newMortgageLiabilityAmountMinor:
      input.existingMortgageLiabilityAmountMinor - input.mortgageMinor,
    newGrowAmountMinor: Math.max(0, input.existingGrowAmountMinor - input.depositMinor),
    growStatus: 'sold',
  };
}

// --- Dividend ---

/** No Share/Grow state mutation — a dividend only produces a transaction (confirmed: `add.component.ts`'s `Dividende Share` branch parses `title` but never uses it to mutate anything). */
export function calculateDividend(
  title: string,
  quantity: number,
  priceMinor: number,
): { comment: string; transactionAmountMinor: number } {
  return {
    comment: generateDividendComment(title, quantity, priceMinor),
    transactionAmountMinor: multiplyQuantityPrice(quantity, priceMinor),
  };
}

// --- Payback (standalone, for a Grow project whose `.liabilitie` IS the tracked goal) ---

export interface PaybackResult {
  comment: string;
  transactionAmountMinor: number;
  newLiabilityAmountMinor: number;
  newLiabilityCreditMinor: number;
  newGrowAmountMinor: number;
  newGrowLiabilitieAmountMinor: number;
  newGrowLiabilitieCreditMinor: number;
  growStatus: 'paid back' | 'paid off';
}

export function calculatePayback(
  amountMinor: number,
  creditMinor: number,
  existingLiabilityAmountMinor: number,
  existingLiabilityCreditMinor: number,
  existingGrowAmountMinor: number,
): PaybackResult {
  const newLiabilityAmountMinor = existingLiabilityAmountMinor - amountMinor;
  const newLiabilityCreditMinor = existingLiabilityCreditMinor - creditMinor;
  const paidOff = newLiabilityAmountMinor === 0 && newLiabilityCreditMinor === 0;
  return {
    comment: generatePaybackComment(amountMinor, creditMinor),
    transactionAmountMinor: -(amountMinor + creditMinor),
    newLiabilityAmountMinor,
    newLiabilityCreditMinor,
    newGrowAmountMinor: existingGrowAmountMinor + amountMinor,
    newGrowLiabilitieAmountMinor: newLiabilityAmountMinor,
    newGrowLiabilitieCreditMinor: newLiabilityCreditMinor,
    growStatus: paidOff ? 'paid off' : 'paid back',
  };
}

// --- Cashflow ---

/** No Grow document mutation — confirmed neither `grow.component.ts` nor any parser touches `Grow.cashflow`; this only produces a transaction. */
export function calculateCashflow(
  cashflowMinor: number,
  liabilitieCreditMinor?: number,
): { comment: string; transactionAmountMinor: number } {
  const netCashflowMinor = cashflowMinor - (liabilitieCreditMinor ?? 0);
  return {
    comment: generateCashflowComment(cashflowMinor, liabilitieCreditMinor),
    transactionAmountMinor: netCashflowMinor,
  };
}

// --- Deposit ---

/** No Grow document mutation — confirmed neither `grow.component.ts` nor any parser touches `Grow.amount` for a deposit; this only produces a transaction. */
export function calculateDeposit(amountMinor: number): {
  comment: string;
  transactionAmountMinor: number;
} {
  return {
    comment: generateDepositComment(amountMinor),
    transactionAmountMinor: -amountMinor,
  };
}
