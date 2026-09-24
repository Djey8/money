import { fromMinorUnits, toMinorUnits } from '../money/minor-units';

/**
 * Regex-based parser/generator for the Grow investment tracker's legacy
 * `Transaction.comment` DSL (`"Buy Share X 10 x 25;"`), replacing the
 * `split(' ')` positional parsing scattered across
 * `src/app/panels/add/add.component.ts` and
 * `src/app/panels/info/info.component.ts` (PLAN.md D-16). This module only
 * changes how the API reads/writes these comments — the Angular UI's own
 * parsers are untouched and keep working against whatever this module
 * generates, since every generator here reproduces the UI's existing
 * canonical format exactly.
 *
 * The one deliberate behavioral fix (per D-9): every existing parser uses
 * fixed positional array indices, so a Grow project title containing a
 * space silently corrupts every field after it. Each regex below anchors a
 * greedy `(.+)` title capture against a *fixed* trailing token pattern —
 * backtracking makes the title capture consume exactly up to that fixed
 * suffix, so multi-word titles parse correctly with no special-casing.
 *
 * Two formats are intentionally NOT reproduced by the generators (existing
 * historical comments in those shapes are still parsed, just never
 * (re)written by the new typed actions):
 * - `CASHFLOW: <amount>;` (colon form) — an `add.component.ts`-only display
 *   side effect when manually executing a Sell Investment via the Add
 *   panel, not part of `grow.component.ts`'s own canonical generation.
 * - Percentage-suffixed `Liabilitie <amount> <credit%>;` — an edit-flow-only
 *   convenience; the typed payback action always takes pre-resolved
 *   integers, like every other typed action's inputs.
 *
 * Multi-statement comments (a financing liability attached to a buy, or a
 * payback attached to an investment sell) are composed by generating each
 * statement separately and joining with `joinGrowStatements` — mirroring
 * `grow.component.ts`/`add.component.ts`'s own `'; '`-joined convention,
 * where a generic `isLiabilitie` flag prepends a bare `Liabilitie ...;`
 * ahead of ANY buy statement (not investment-specific), while an investment
 * sell's `Payback Liabilitie ...;` prefix is built inline only for that one
 * case.
 */

/**
 * A `Liabilitie`/`Payback Liabilitie` amount or credit token: either an
 * absolute value or an unresolved legacy percentage (resolving one requires
 * the referenced liability's value at the time, which isn't in the
 * string). Both statement kinds can carry a `%` on either token —
 * `add.component.ts:942,956` resolves `Payback Liabilitie`'s amount AND
 * credit against a live liability lookup, not just `Liabilitie`'s credit —
 * so don't assume `paybackLiabilitie.amount`/`.credit` are always
 * `{kind:'absolute'}` in practice.
 */
export type GrowAmountToken =
  { kind: 'absolute'; minor: number } | { kind: 'percentage'; percentage: number };

export type ParsedGrowStatement =
  | { kind: 'buyAsset'; title: string; quantity: number; priceMinor: number }
  | { kind: 'sellAsset'; title: string; quantity: number; priceMinor: number }
  | { kind: 'buyShare'; title: string; quantity: number; priceMinor: number }
  | { kind: 'sellShare'; title: string; quantity: number; priceMinor: number }
  | { kind: 'dividendShare'; title: string; quantity: number; priceMinor: number }
  | { kind: 'buyInvestment'; title: string; depositMinor: number; mortgageMinor: number }
  | { kind: 'sellInvestment'; title: string; depositMinor: number; mortgageMinor: number }
  | { kind: 'paybackLiabilitie'; amount: GrowAmountToken; credit: GrowAmountToken }
  | { kind: 'liabilitie'; amount: GrowAmountToken; credit: GrowAmountToken }
  | { kind: 'cashflow'; cashflowMinor: number; creditMinor: number | null }
  | { kind: 'deposit'; amountMinor: number }
  | { kind: 'unknown'; raw: string };

// Every regex's trailing `;?` is defensive/dead in practice: `parseGrowComment`
// always runs statements through `splitGrowStatements` first, which strips
// every `;` before any of these ever run. Kept so a statement matched
// directly (bypassing the split) still parses, and so future regexes copied
// from these don't have to relearn that split-then-match invariant.
const QTY_PRICE_RE = (verb: string, kind: string) =>
  new RegExp(`^${verb} ${kind} (.+) (\\S+) x (\\S+);?$`);

const BUY_ASSET_RE = QTY_PRICE_RE('Buy', 'Asset');
const SELL_ASSET_RE = QTY_PRICE_RE('Sell', 'Asset');
const BUY_SHARE_RE = QTY_PRICE_RE('Buy', 'Share');
const SELL_SHARE_RE = QTY_PRICE_RE('Sell', 'Share');
const DIVIDEND_SHARE_RE = QTY_PRICE_RE('Dividende', 'Share');

const BUY_INVESTMENT_RE = /^Buy Investment (.+) (\S+) (\S+);?$/;
const SELL_INVESTMENT_RE = /^Sell Investment (.+) (\S+) (\S+);?$/;

const PAYBACK_LIABILITIE_RE = /^Payback Liabilitie (\S+) (\S+);?$/;
const LIABILITIE_RE = /^Liabilitie (\S+) (\S+);?$/;

const CASHFLOW_RE = /^CASHFLOW:?\s?(\S+?);?(?:\s-\sCREDIT\s(\S+?);?)?$/;
const DEPOSIT_RE = /^Deposit (\S+);?$/;

function parseAmountToken(token: string): GrowAmountToken {
  if (token.endsWith('%')) {
    return { kind: 'percentage', percentage: Number(token.slice(0, -1)) };
  }
  return { kind: 'absolute', minor: toMinorUnits(Number(token)) };
}

/** Renders a parsed token back to its original textual form — `"20%"` for a percentage, the plain decimal otherwise. */
export function formatAmountToken(token: GrowAmountToken): string {
  return token.kind === 'percentage' ? `${token.percentage}%` : `${fromMinorUnits(token.minor)}`;
}

/** Splits a `'; '`-joined multi-statement comment into its trimmed clauses. */
export function splitGrowStatements(comment: string): string[] {
  return comment
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function parseGrowStatement(statement: string): ParsedGrowStatement {
  let match = statement.match(BUY_ASSET_RE);
  if (match) {
    return {
      kind: 'buyAsset',
      title: match[1],
      quantity: Number(match[2]),
      priceMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(SELL_ASSET_RE);
  if (match) {
    return {
      kind: 'sellAsset',
      title: match[1],
      quantity: Number(match[2]),
      priceMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(BUY_SHARE_RE);
  if (match) {
    return {
      kind: 'buyShare',
      title: match[1],
      quantity: Number(match[2]),
      priceMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(SELL_SHARE_RE);
  if (match) {
    return {
      kind: 'sellShare',
      title: match[1],
      quantity: Number(match[2]),
      priceMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(DIVIDEND_SHARE_RE);
  if (match) {
    return {
      kind: 'dividendShare',
      title: match[1],
      quantity: Number(match[2]),
      priceMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(BUY_INVESTMENT_RE);
  if (match) {
    return {
      kind: 'buyInvestment',
      title: match[1],
      depositMinor: toMinorUnits(Number(match[2])),
      mortgageMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(SELL_INVESTMENT_RE);
  if (match) {
    return {
      kind: 'sellInvestment',
      title: match[1],
      depositMinor: toMinorUnits(Number(match[2])),
      mortgageMinor: toMinorUnits(Number(match[3])),
    };
  }
  match = statement.match(PAYBACK_LIABILITIE_RE);
  if (match) {
    return {
      kind: 'paybackLiabilitie',
      amount: parseAmountToken(match[1]),
      credit: parseAmountToken(match[2]),
    };
  }
  match = statement.match(LIABILITIE_RE);
  if (match) {
    return {
      kind: 'liabilitie',
      amount: parseAmountToken(match[1]),
      credit: parseAmountToken(match[2]),
    };
  }
  match = statement.match(CASHFLOW_RE);
  if (match) {
    return {
      kind: 'cashflow',
      cashflowMinor: toMinorUnits(Number(match[1])),
      creditMinor: match[2] !== undefined ? toMinorUnits(Number(match[2])) : null,
    };
  }
  match = statement.match(DEPOSIT_RE);
  if (match) {
    return { kind: 'deposit', amountMinor: toMinorUnits(Number(match[1])) };
  }
  return { kind: 'unknown', raw: statement };
}

/** Parses a full `Transaction.comment`, which may contain one or more `'; '`-joined statements. */
export function parseGrowComment(comment: string): ParsedGrowStatement[] {
  return splitGrowStatements(comment).map(parseGrowStatement);
}

/** A title must never contain `;` — the statement separator — or it would corrupt the DSL irrecoverably. */
export function assertValidGrowTitle(title: string): void {
  if (title.includes(';')) {
    throw new Error('Grow title must not contain ";"');
  }
}

/** An asset trade expressed as units x unit price instead of one lump sum (the DSL's `<qty> x <price>` form). */
export interface GrowAssetUnits {
  quantity: number;
  priceMinor: number;
}

function assetTradeTerms(totalAmountMinor: number, units?: GrowAssetUnits): string {
  return units
    ? `${units.quantity} x ${fromMinorUnits(units.priceMinor)}`
    : `1 x ${fromMinorUnits(totalAmountMinor)}`;
}

export function generateBuyAssetComment(
  title: string,
  totalAmountMinor: number,
  units?: GrowAssetUnits,
): string {
  assertValidGrowTitle(title);
  return `Buy Asset ${title} ${assetTradeTerms(totalAmountMinor, units)};`;
}

export function generateSellAssetComment(
  title: string,
  totalAmountMinor: number,
  units?: GrowAssetUnits,
): string {
  assertValidGrowTitle(title);
  return `Sell Asset ${title} ${assetTradeTerms(totalAmountMinor, units)};`;
}

export function generateBuyShareComment(
  title: string,
  quantity: number,
  priceMinor: number,
): string {
  assertValidGrowTitle(title);
  return `Buy Share ${title} ${quantity} x ${fromMinorUnits(priceMinor)};`;
}

export function generateSellShareComment(
  title: string,
  quantity: number,
  priceMinor: number,
): string {
  assertValidGrowTitle(title);
  return `Sell Share ${title} ${quantity} x ${fromMinorUnits(priceMinor)};`;
}

export function generateDividendComment(
  title: string,
  quantity: number,
  priceMinor: number,
): string {
  assertValidGrowTitle(title);
  return `Dividende Share ${title} ${quantity} x ${fromMinorUnits(priceMinor)};`;
}

export function generateBuyInvestmentComment(
  title: string,
  depositMinor: number,
  mortgageMinor: number,
): string {
  assertValidGrowTitle(title);
  return `Buy Investment ${title} ${fromMinorUnits(depositMinor)} ${fromMinorUnits(mortgageMinor)};`;
}

export function generateSellInvestmentComment(
  title: string,
  depositMinor: number,
  mortgageMinor: number,
): string {
  assertValidGrowTitle(title);
  return `Sell Investment ${title} ${fromMinorUnits(depositMinor)} ${fromMinorUnits(mortgageMinor)};`;
}

export function generatePaybackComment(amountMinor: number, creditMinor: number): string {
  return `Payback Liabilitie ${fromMinorUnits(amountMinor)} ${fromMinorUnits(creditMinor)};`;
}

/**
 * Bare `Liabilitie <loan> <credit>;` — prepended (space-joined, see
 * `joinGrowStatements`) ahead of ANY buy statement (asset/share/investment
 * alike) when that Grow project has an attached financing liability, per
 * `add.component.ts`'s generic `isLiabilitie`-triggered prefixing
 * (`grow.component.ts`'s `buyProject` sets this for every kind, not just
 * investments). Always absolute — the typed action never emits a
 * percentage credit; that's an edit-flow-only convenience for hand-editing
 * a comment, still recognized by the parser (`'liabilitie'` kind) but never
 * (re)generated here.
 */
export function generateLiabilitieComment(loanMinor: number, creditMinor: number): string {
  return `Liabilitie ${fromMinorUnits(loanMinor)} ${fromMinorUnits(creditMinor)};`;
}

/**
 * Joins already-generated statements (each already ending in its own `;`)
 * into one multi-statement comment, matching the codebase's `'; '`-joined
 * convention (a single space between statements, since each already
 * supplies its trailing `;`).
 */
export function joinGrowStatements(...statements: string[]): string {
  return statements.join(' ');
}

export function generateCashflowComment(cashflowMinor: number, creditMinor?: number): string {
  return creditMinor !== undefined
    ? `CASHFLOW ${fromMinorUnits(cashflowMinor)} - CREDIT ${fromMinorUnits(creditMinor)};`
    : `CASHFLOW ${fromMinorUnits(cashflowMinor)};`;
}

export function generateDepositComment(amountMinor: number): string {
  return `Deposit ${fromMinorUnits(amountMinor)};`;
}
