import { parseGrowComment, type ParsedGrowStatement } from '../grow/dsl';
import type { GameText } from './game-text';
import type { GameStep } from './steps';

/**
 * What a Grow trade on a Cashflow account is, and what it costs up front - read once, here, through the domain's
 * typed Grow parser (`grow/dsl.ts`) instead of the three separate regex helpers the Angular service used to carry
 * (todo/cashflow-game-pro-inventory.md, F3; PLAN.md D-16).
 *
 * The Add dialog still hands over the legacy comment string ("Buy Share OK4U 250 x 10;"), so the entry points take
 * one; but everything is decided from the parsed, typed statements, and the typed versions
 * (`purchaseOfStatements`, `sellAssetProblemOf`) are what the Pro API calls - it never writes or parses a comment.
 * Reading old data is allowed; writing the format is not.
 */

/** The tag a Doodad payment carries in its comment, so they can all be found again later. */
export const DOODAD_MARK = /#doodad\b/;
/** The tag a Market card's one-off cost (tenant damage, broken pipe) carries in its comment. */
export const MARKET_COST_MARK = /#market\b/;

const stripAt = (category: string) => category.replace(/^@/, '');

type StatementOf<K extends ParsedGrowStatement['kind']> = Extract<ParsedGrowStatement, { kind: K }>;

function firstOf<K extends ParsedGrowStatement['kind']>(
  statements: ParsedGrowStatement[],
  kind: K,
): StatementOf<K> | undefined {
  return statements.find((statement): statement is StatementOf<K> => statement.kind === kind);
}

/**
 * Which History step a transaction made through the Add dialog is, read from what it says: a Doodad or a Market
 * cost by its tag, a Grow trade by its statement (the title is the detail), a payback, or a plain transaction -
 * the category is the detail for the three that have no title.
 */
export function gameTradeStep(comment: string, category: string): GameStep {
  if (DOODAD_MARK.test(comment)) return { kind: 'doodad', detail: stripAt(category) };
  if (MARKET_COST_MARK.test(comment)) return { kind: 'marketCost', detail: stripAt(category) };
  const statements = parseGrowComment(comment);
  const named = [
    ['buyShare', 'buyShare'],
    ['sellShare', 'sellShare'],
    ['buyInvestment', 'buyInvestment'],
    ['sellInvestment', 'sellInvestment'],
    ['buyAsset', 'buyAsset'],
    ['sellAsset', 'sellAsset'],
  ] as const;
  for (const [statementKind, stepKind] of named) {
    const statement = firstOf(statements, statementKind);
    if (statement) return { kind: stepKind, detail: statement.title };
  }
  return comment.includes('Payback Liabilitie')
    ? { kind: 'payoff', detail: stripAt(category) }
    : { kind: 'transaction', detail: stripAt(category) };
}

export interface TradePurchase {
  /** The Grow project / position bought; empty for a plain expense (Doodad, Market cost, a Sell Investment's fee). */
  title: string;
  costMinor: number;
}

/**
 * What a purchase costs up front: shares = quantity x price, an investment = its deposit, a single-unit special asset
 * = its price. A Doodad, a Market cost and a Sell Investment's fee are plain expenses paid like a purchase (short of
 * cash, the game takes a Bank loan first) and cost what the dialog's amount says. Anything else - sells, dividends,
 * plain transactions - is not a purchase.
 *
 * Only a *single-unit* asset buy counts (`Buy Asset X 1 x price`): a special-asset card is always bought whole, and
 * this is what the game has always done, so a multi-unit buy is deliberately not treated as a purchase here.
 */
export function purchaseOfStatements(statements: ParsedGrowStatement[]): TradePurchase | null {
  const share = firstOf(statements, 'buyShare');
  if (share) {
    return { title: share.title, costMinor: Math.round(share.quantity * share.priceMinor) };
  }
  const investment = firstOf(statements, 'buyInvestment');
  if (investment) return { title: investment.title, costMinor: investment.depositMinor };
  const asset = firstOf(statements, 'buyAsset');
  if (asset && asset.quantity === 1) return { title: asset.title, costMinor: asset.priceMinor };
  return null;
}

/** The cost of whatever the comment says is being bought, or of the plain expense it pays (see `purchaseOfStatements`). */
export function tradePurchase(comment: string, expenseMinor = 0): TradePurchase | null {
  if (
    (DOODAD_MARK.test(comment) ||
      MARKET_COST_MARK.test(comment) ||
      comment.includes('Sell Investment')) &&
    expenseMinor > 0
  ) {
    return { title: '', costMinor: expenseMinor };
  }
  return purchaseOfStatements(parseGrowComment(comment));
}

/**
 * Checked before a Sell Asset goes through: a coin asset can only sell the coins it has (JFK, 2026-10-03). Returns
 * the message to show, or null when the sale is fine (or this is not a coin asset - one the player owns no coins of).
 */
export function sellAssetProblemOf(
  statements: ParsedGrowStatement[],
  coinsOwned: (title: string) => number,
  text: GameText,
): string | null {
  const sale = firstOf(statements, 'sellAsset');
  if (!sale) return null;
  const owned = coinsOwned(sale.title);
  if (owned <= 0) return null;
  if (!(sale.quantity > 0)) return text('CashflowGame.sellNeedCoins');
  if (sale.quantity > owned) return text('CashflowGame.sellTooManyCoins', { coins: owned });
  return null;
}

export function sellAssetProblem(
  comment: string,
  coinsOwned: (title: string) => number,
  text: GameText,
): string | null {
  return sellAssetProblemOf(parseGrowComment(comment), coinsOwned, text);
}
