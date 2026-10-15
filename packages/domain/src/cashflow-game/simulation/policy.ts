import type { GameBooks } from '../books';
import type { CashflowFinanceSummary } from '../saved-games';
import type { CashflowDealCard, CashflowDoodadCard } from '../types';
import type { SellInput } from '../positions';

/**
 * A strategy for the strategy lab (todo/cashflow-game-analysis.md, E1): the few decisions a solo game leaves a player - on
 * a Deals space which pile to draw from, whether to buy the card that came, what to do between rolls (sell to a buyer, pay
 * back the bank) and how many dice Charity allows. Everything else (moving, paying a Doodad, playing a Market card, a
 * dice decision) is forced by the rules and played the same way by every strategy.
 */

/** One rival as everyone at the table can see them: their public books, boiled down to the race. */
export interface RivalView {
  /** Passive income as a share of expenses: 1 or more is out of the rat race. */
  coverage: number;
  escaped: boolean;
  bankrupt: boolean;
}

/**
 * What a strategy at a **table** may also know (todo/cashflow-tournament-and-bots.md A4): how far each rival is from escaping.
 * All of it is public at a table - every player's books are open - so using it is fair play. Absent when playing alone.
 */
export interface TableAwareness {
  rivals: RivalView[];
  /** The best coverage among the rivals still in the game (0 when none are). */
  leaderCoverage: number;
  /** This player's own coverage. */
  myCoverage: number;
  seats: number;
}

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
  /** At a table: the race. Absent in a solo game. */
  readonly table?: TableAwareness;
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
  /**
   * Pay a Doodad or pass it. Only asked where the rules let a Doodad be passed (`passDoodads: 'allowed'`, the guided preset); under
   * the strict rules every Doodad is paid. Absent: always pay.
   */
  doodad?(view: PolicyView, card: CashflowDoodadCard): 'pay' | 'pass';
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
  /**
   * Where the rules allow passing a Doodad: pass every Doodad that costs more than this (minor units); 0 passes all of them, null
   * pays all of them. A Doodad is a forced cost in the board game - passing it for free is a freedom of the guided rules, not of the
   * game, which is why this is a knob a table's host can take away (strict rules).
   */
  skipDoodadsAboveMinor: number | null;
  /**
   * Race-aware play at a table: when a rival leads by `behindBy` (in coverage, 0.2 = 20 points), multiply the property return
   * asked, the loan coverage asked and the reserve kept by these factors (below 1 = take more risk to catch up).
   */
  catchUp: RaceAdjust | null;
  /** The mirror: when this player leads by `aheadBy`, factors above 1 = protect the lead. */
  protectLead: RaceAdjust | null;
}

export interface RaceAdjust {
  /** How far behind (catchUp) or ahead (protectLead) the player must be, in coverage points (0.2 = 20%). */
  gap: number;
  minMonthlyReturnFactor: number;
  loanCoverageFactor: number;
  reserveFactor: number;
}
