import { GrowAmountToken, ParsedGrowStatement, parseGrowComment } from './dsl';
import { multiplyQuantityPrice, normalizeQuantity } from './actions';

/**
 * Undoing a Grow transaction (deleting it through the API). This is the
 * exact inverse of the typed actions in `actions.ts` / the backend's
 * `grow-action-repository.js`, applied to a snapshot of everything one
 * Grow project's transactions touch. It replaces `info.component.ts`'s
 * `deleteTransaction()` comment-parsing blocks for API callers, with these
 * deliberate corrections (D-9) — each because the original is inconsistent
 * with the action it undoes:
 *
 * 1. The original only reduced `Grow.amount`/`share.quantity`/
 *    `investment.*` when the current value differed from the trade's own
 *    value (`if (grow.amount != amount)`), so undoing a project's only buy
 *    silently left the bought amount in place. Here every value is reversed.
 * 2. The original never undid a buy's attached financing loan
 *    (`Liabilitie <loan> <credit>;` prefix) when the buy was deleted, leaving
 *    the debt on the balance sheet. Here the loan is reversed with the buy.
 * 3. The original's Sell Asset/Share undo edited the income-statement
 *    `revenues`/`interests` entries by hand; here the income statement is
 *    rebuilt from the remaining transactions by the caller, like every
 *    other transaction write.
 *
 * Money is integer minor units; `quantity` a plain decimal count.
 */

export interface GrowAmountPair {
  amountMinor: number;
  creditMinor: number;
}

export interface GrowPositionSnapshot {
  /** `Grow.amount` — the project's own invested total. */
  growAmountMinor: number;
  growShare: { quantity: number; priceMinor: number } | null;
  growInvestment: { depositMinor: number; amountMinor: number } | null;
  growLiabilitie: GrowAmountPair | null;
  /** The balance-sheet entries tagged with the project's title (`null` = none). */
  asset: { amountMinor: number } | null;
  share: { quantity: number; priceMinor: number } | null;
  investment: { depositMinor: number; amountMinor: number } | null;
  liability: GrowAmountPair | null;
  /** An Investment's `M-<title>` mortgage liability. */
  mortgage: { amountMinor: number } | null;
}

/** The statement kinds that change Grow/balance-sheet state (cashflow, deposit and dividend only produce a transaction). */
const STATE_CHANGING_KINDS = new Set<ParsedGrowStatement['kind']>([
  'buyAsset',
  'sellAsset',
  'buyShare',
  'sellShare',
  'buyInvestment',
  'sellInvestment',
  'paybackLiabilitie',
  'liabilitie',
]);

/** The statements in a comment that change Grow/balance-sheet state — empty for an ordinary comment. */
export function stateChangingGrowStatements(comment: string | undefined): ParsedGrowStatement[] {
  return parseGrowComment(comment || '').filter((statement) =>
    STATE_CHANGING_KINDS.has(statement.kind),
  );
}

/** The project title a comment's state-changing statements act on, or `null` when only a category can tell (a standalone payback). */
export function growTitleOfStatements(statements: ParsedGrowStatement[]): string | null {
  for (const statement of statements) {
    if ('title' in statement) return statement.title;
  }
  return null;
}

export class GrowReversalError extends Error {
  readonly code = 'GROW_NOT_REVERSIBLE';
}

function absolute(token: GrowAmountToken, field: string): number {
  if (token.kind !== 'absolute') {
    throw new GrowReversalError(
      `This transaction's ${field} is a percentage from an older app version and can't be undone exactly — delete or edit it in the app instead.`,
    );
  }
  return token.minor;
}

/** Adds `delta` to a pair; `null` in, `null` out when the pair would be all zero. */
function addPair(pair: GrowAmountPair | null, delta: GrowAmountPair): GrowAmountPair | null {
  const next = {
    amountMinor: (pair?.amountMinor ?? 0) + delta.amountMinor,
    creditMinor: (pair?.creditMinor ?? 0) + delta.creditMinor,
  };
  return next.amountMinor === 0 && next.creditMinor === 0 ? null : next;
}

function negate(pair: GrowAmountPair): GrowAmountPair {
  return { amountMinor: -pair.amountMinor, creditMinor: -pair.creditMinor };
}

function addAmount(entry: { amountMinor: number } | null, delta: number) {
  const amountMinor = (entry?.amountMinor ?? 0) + delta;
  return amountMinor === 0 ? null : { amountMinor };
}

function addShares<T extends { quantity: number; priceMinor: number }>(
  entry: T | null,
  quantity: number,
  priceMinor: number,
): T | null {
  const nextQuantity = normalizeQuantity((entry?.quantity ?? 0) + quantity);
  if (nextQuantity === 0) return null;
  return { ...(entry as T), quantity: nextQuantity, priceMinor: entry?.priceMinor ?? priceMinor };
}

function addInvestment<T extends { depositMinor: number; amountMinor: number }>(
  entry: T | null,
  depositMinor: number,
  amountMinor: number,
): T | null {
  const next = {
    ...(entry as T),
    depositMinor: (entry?.depositMinor ?? 0) + depositMinor,
    amountMinor: (entry?.amountMinor ?? 0) + amountMinor,
  };
  return next.depositMinor === 0 && next.amountMinor === 0 ? null : next;
}

/**
 * Undoes every state-changing statement of one transaction's comment
 * against `state`. A `Liabilitie` statement is the financing loan attached
 * to the buy it precedes; a `Payback Liabilitie` statement settles the
 * project's loan (standalone, or together with an investment sale).
 */
export function reverseGrowStatements(
  statements: ParsedGrowStatement[],
  state: GrowPositionSnapshot,
): GrowPositionSnapshot {
  const next = { ...state };
  const loan = statements.find((statement) => statement.kind === 'liabilitie');
  const loanPair =
    loan && loan.kind === 'liabilitie'
      ? {
          amountMinor: absolute(loan.amount, 'loan amount'),
          creditMinor: absolute(loan.credit, 'loan credit'),
        }
      : null;
  const loanMinor = loanPair?.amountMinor ?? 0;

  for (const statement of statements) {
    switch (statement.kind) {
      case 'buyAsset': {
        const total = multiplyQuantityPrice(statement.quantity, statement.priceMinor);
        next.asset = addAmount(next.asset, -total);
        next.growAmountMinor -= total - loanMinor;
        break;
      }
      case 'sellAsset': {
        const total = multiplyQuantityPrice(statement.quantity, statement.priceMinor);
        next.asset = addAmount(next.asset, total);
        break;
      }
      case 'buyShare': {
        const total = multiplyQuantityPrice(statement.quantity, statement.priceMinor);
        next.share = addShares(next.share, -statement.quantity, statement.priceMinor);
        if (next.growShare) {
          next.growShare = {
            ...next.growShare,
            quantity: normalizeQuantity(next.growShare.quantity - statement.quantity),
          };
        }
        next.growAmountMinor -= total - loanMinor;
        break;
      }
      case 'sellShare': {
        next.share = addShares(next.share, statement.quantity, statement.priceMinor);
        if (next.growShare) {
          next.growShare = {
            ...next.growShare,
            quantity: normalizeQuantity(next.growShare.quantity + statement.quantity),
          };
        }
        break;
      }
      case 'buyInvestment': {
        next.investment = addInvestment(
          next.investment,
          -statement.depositMinor,
          -statement.mortgageMinor,
        );
        next.mortgage = addAmount(next.mortgage, -statement.mortgageMinor);
        if (next.growInvestment) {
          next.growInvestment = {
            depositMinor: next.growInvestment.depositMinor - statement.depositMinor,
            amountMinor: next.growInvestment.amountMinor - statement.mortgageMinor,
          };
        }
        next.growAmountMinor -= statement.depositMinor - loanMinor;
        break;
      }
      case 'sellInvestment': {
        next.investment = addInvestment(
          next.investment,
          statement.depositMinor,
          statement.mortgageMinor,
        );
        next.mortgage = addAmount(next.mortgage, statement.mortgageMinor);
        if (next.growInvestment) {
          next.growInvestment = {
            depositMinor: next.growInvestment.depositMinor + statement.depositMinor,
            amountMinor: next.growInvestment.amountMinor + statement.mortgageMinor,
          };
        }
        next.growAmountMinor += statement.depositMinor;
        break;
      }
      case 'paybackLiabilitie': {
        const paid = {
          amountMinor: absolute(statement.amount, 'payback amount'),
          creditMinor: absolute(statement.credit, 'payback credit'),
        };
        next.liability = addPair(next.liability, paid);
        next.growLiabilitie = addPair(next.growLiabilitie, paid);
        // A standalone payback raised Grow.amount by the principal; one
        // attached to an investment sale didn't (the sale's own statement
        // handles Grow.amount).
        if (!statements.some((s) => s.kind === 'sellInvestment')) {
          next.growAmountMinor -= paid.amountMinor;
        }
        break;
      }
      case 'liabilitie':
        next.liability = addPair(next.liability, negate(loanPair as GrowAmountPair));
        next.growLiabilitie = addPair(next.growLiabilitie, negate(loanPair as GrowAmountPair));
        break;
      default:
        break;
    }
  }
  assertNothingNegative(next);
  return next;
}

/**
 * Undoing a trade that later trades built on (units already sold, a loan
 * already paid back) would leave a negative position. That can't be
 * resolved by this one transaction, so it's refused: undo the later
 * trades first.
 */
function assertNothingNegative(state: GrowPositionSnapshot): void {
  const values: [string, number | undefined][] = [
    ['share quantity', state.share?.quantity],
    ['project share quantity', state.growShare?.quantity],
    ['asset amount', state.asset?.amountMinor],
    ['investment deposit', state.investment?.depositMinor],
    ['investment mortgage', state.investment?.amountMinor],
    ['project investment deposit', state.growInvestment?.depositMinor],
    ['project investment mortgage', state.growInvestment?.amountMinor],
    ['mortgage liability', state.mortgage?.amountMinor],
    ['loan amount', state.liability?.amountMinor],
    ['loan credit', state.liability?.creditMinor],
    ['project loan amount', state.growLiabilitie?.amountMinor],
    ['project loan credit', state.growLiabilitie?.creditMinor],
  ];
  const negative = values.find(([, value]) => value !== undefined && value < 0);
  if (negative) {
    throw new GrowReversalError(
      `Undoing this trade would make the ${negative[0]} negative, because later trades depend on it (e.g. the units were already sold or the loan paid back). Undo those later trades first.`,
    );
  }
}
