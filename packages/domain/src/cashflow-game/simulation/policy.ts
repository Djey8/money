import type { GameBooks } from '../books';
import type { CashflowFinanceSummary } from '../saved-games';
import type { CashflowDealCard } from '../types';
import type { SellInput } from '../positions';

/**
 * A strategy for the strategy lab (todo/cashflow-game-analysis.md, E1): the few decisions a solo game leaves a player - on
 * a Deals space which pile to draw from, whether to buy the card that came, what to do between rolls (sell to a buyer, pay
 * back the bank) and how many dice Charity allows. Everything else (moving, paying a Doodad, playing a Market card, a
 * dice decision) is forced by the rules and played the same way by every strategy.
 */

/** What a strategy may look at: the books, and the figures the dashboard shows. Read-only. */
export interface PolicyView {
  readonly books: GameBooks;
  readonly cashMinor: number;
  readonly finances: CashflowFinanceSummary;
  readonly bankLoanMinor: number;
  /** One loan step of the game set, and its monthly interest in percent of the principal. */
  readonly loanStepMinor: number;
  readonly loanInterestPercent: number;
  readonly round: number;
  readonly turn: number;
  readonly children: number;
  readonly charityRoundsLeft: number;
}

export type DealChoice = { buy: false } | { buy: true; quantity?: number };

export type HouseMove = { kind: 'sell'; input: SellInput } | { kind: 'repay'; amountMinor: number };

export type Pile = 'dealSmall' | 'dealBig';

export interface Policy {
  id: string;
  label: string;
  description: string;
  /** The knobs this strategy was built from, for the report. */
  params?: Record<string, unknown>;
  /** One die or two while Charity runs. */
  dice(view: PolicyView): 1 | 2;
  /** Small or Big Deal pile on a Deals space. `random` is a coin the game's own dice stream supplies. */
  pile(view: PolicyView, random: () => number): Pile;
  /** Buy the drawn Deal card, or leave it. */
  deal(view: PolicyView, card: CashflowDealCard): DealChoice;
  /** Housekeeping between rolls; called again until it returns nothing. */
  maintain(view: PolicyView): HouseMove[];
}

/** The knobs of the parametrised strategy family the lab searches over. */
export interface PolicyParams {
  /** Buy properties and businesses at all. */
  buyProperties: boolean;
  /** Smallest monthly cashflow per deposit (0.05 = 5% a month) a property must reach to be bought. */
  minMonthlyReturn: number;
  /** Cash that must remain after a purchase paid from cash. */
  reserveMinor: number;
  /** `never`: only cards the cash pays for. `bridge`: borrow when the card pays well above the interest. */
  loans: 'never' | 'bridge';
  /** A borrowed purchase must pay this many times the loan's monthly interest. */
  loanCoverage: number;
  /** Draw from the Big Deal pile once cash reaches this; below it, from the Small Deal pile. 0 = always Big, null = always Small. */
  bigDealFromCashMinor: number | null;
  /** Buy Multi-Level-Marketing cards (a kept card rolled for at every Payday). */
  buyMlm: boolean;
  /** Buy gold and the loan to a relative (dice gambles). */
  buyGambles: boolean;
  /** Trade stocks: buy at or below, sell at or above. `null` ignores the stock cards. */
  shares: { buyBelowMinor: number; sellAboveMinor: number; maxLotShare: number } | null;
  /** Sell a property to a market buyer when the profit is at least this many months of its cashflow. `null` never sells. */
  sellWhenProfitMonths: number | null;
  /** Pay the bank back as soon as cash allows (keeping the reserve). */
  repayLoans: boolean;
  /** Two dice while Charity runs. */
  charityTwoDice: boolean;
}
