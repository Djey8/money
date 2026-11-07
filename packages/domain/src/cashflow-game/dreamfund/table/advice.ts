import { DREAM_POLICIES } from '../../dreamfund-sim/policies';
import { DreamPlayer } from '../player';
import { dreamPolicyCommands } from './bot';
import { reviewDreamTable, type PlayerReview } from './review';
import type { DreamCommand, DreamTable } from './types';

/**
 * Advice for one seat of a Dreamfund table (JFK, 2026-11-06): what the person - or the agent that plays for them - should know and do
 * now. The goals in percent, what the table waits for, the moves a strategy of the simulation would send right now with a sentence
 * for each (the very moves a bot plays), and the things to keep in mind (an offer that closes, a plan that is paid into, the tax on a
 * sale, a payment due). Small on purpose: an agent reads this instead of the books. Nothing is changed. Pure.
 */

export interface DreamAdviceMove {
  command: DreamCommand;
  says: string;
}

export interface DreamAdvice {
  seat: number;
  name: string;
  strategy: string;
  /** Whether the table waits for this seat to move now. */
  yourTurn: boolean;
  /** What is open on the seat: a card to decide, a payment to settle, nothing. */
  open: string;
  goals: PlayerReview['goals'];
  goalsMet: number;
  dreamPoints: { have: number; goal: number };
  money: Pick<
    PlayerReview,
    | 'cash'
    | 'reserve'
    | 'passiveIncome'
    | 'costOfLiving'
    | 'monthlyCashflow'
    | 'netWorth'
    | 'bankLoan'
  >;
  /** What the strategy would send now, in order: send the first, read the table, ask again. */
  next: DreamAdviceMove[];
  /** What to keep in mind now. */
  attention: string[];
  /** What it takes to win, in one place. */
  toWin: string[];
  strategies: { id: string; about: string }[];
}

const unit = (minor: number) => Math.round(minor / 100);

/** A sentence for a move: what it does and why a strategy sends it. */
export function sayMove(command: DreamCommand): string {
  const c = command as unknown as Record<string, unknown>;
  switch (command.type) {
    case 'roll':
      return 'Roll the dice and walk the map: every landing is a card or a chance.';
    case 'end_turn':
      return 'Nothing more to do this turn: end it so the next player can move.';
    case 'skip':
      return 'Leave the card: nobody has to take an offer, and a dream may be refused.';
    case 'choose_pile':
      return `Look at the ${String(c['pile'])} pile (Seed is small and cheap, Sapling needs a few thousand, Tree is for big money).`;
    case 'take_opportunity':
      return 'Take the offered card it likes best: it fits the strategy and the cash.';
    case 'plan_opportunity':
      return 'Plan the card in Grow first; buy it from there when the numbers are right.';
    case 'buy_planned':
      return `Buy the planned project ${String(c['title'] ?? '')} now.`;
    case 'roll_opportunity':
      return 'Throw the die of the card you bought: it decides the money it brings.';
    case 'pay_emergency':
      return `Settle the emergency: ${String(c['pay'])} (a plan spreads it over Paydays for a surcharge).`;
    case 'emergency_choose':
    case 'emergency_roll':
    case 'emergency_reroll':
      return 'Deal with the emergency card step by step.';
    case 'answer_life':
      return `Answer the life card: ${String(c['decision'])}.`;
    case 'roll_career':
      return 'Throw the career die: it decides the promotion.';
    case 'choose_career_branch':
      return 'Choose the career branch.';
    case 'take_dream':
      return 'Take the dream: it is worth points and has to be saved for.';
    case 'set_plan':
      return `Put ${unit(Number(c['perMinor'] ?? 0))} a Payday into the plan of ${String(c['kind'])} ${String(c['id'])}.`;
    case 'fund_reserve':
      return `Put ${unit(Number(c['amountMinor'] ?? 0))} into the reserve (three months of costs is the first goal).`;
    case 'fund_dream':
      return `Put ${unit(Number(c['amountMinor'] ?? 0))} into the dream.`;
    case 'fund_emergency':
      return `Pay ${unit(Number(c['amountMinor'] ?? 0))} on the emergency project.`;
    case 'repay_debt':
      return `Pay off the debt ${String(c['tag'])}.`;
    case 'repay_bank_loan':
      return 'Repay the Bank loan: it costs 10% a month.';
    case 'settle_payday':
      return 'Settle the month: the Payday brings the pay and the bills.';
    case 'harvest_sell':
      return `Sell ${String(c['holding'])} into the open market: the price is the best in a while.`;
    case 'harvest_accept':
      return `Take the buyer's offer for ${String(c['holding'])}.`;
    case 'harvest_ladder':
      return `${String(c['action']) === 'ride' ? 'Ride' : 'Cash out'} the hype on ${String(c['holding'])}.`;
    case 'harvest_continue':
      return 'Read what the Harvest card did and go on.';
    case 'sell_holding':
      return `Sell ${String(c['holding'])} at its standing price (a discount to what a Harvest card pays).`;
    case 'offer_trade':
      return `Offer ${String(c['holding'])} to the others at ${unit(Number(c['priceMinor'] ?? 0))}.`;
    case 'accept_trade':
      return 'Buy the card on offer at its price.';
    case 'decline_trade':
      return 'Decline the card on offer.';
    case 'throw_job_search':
      return 'Throw the die of the job search.';
    default:
      return `Send ${command.type}.`;
  }
}

const ABOUT: Record<string, string> = {
  saver:
    'Keeps cash, takes only the safest cards (savings, bonds, a world ETF); fills the reserve and the dream first.',
  etf: 'Puts everything into broad index funds and waits.',
  property: 'Buys rented properties with the bank, and lives on the rents.',
  hustler: 'Starts side hustles and small businesses for income.',
  gambler: 'Takes risk: crypto, collectibles, hype; sells when it pays.',
  expert:
    'The best of the simulation: reserve first, then the cards that pay every month, sells into good windows.',
  dividend: 'Dividend shares and funds for monthly income.',
  sapling: 'Builds from the Sapling pile: first businesses and funds, then bigger.',
  tree: 'Goes for the Tree pile: properties and big positions.',
  dreamer: 'Funds the dreams and the dream points first.',
  steady: 'A mix of everything, patient.',
  passive: 'Only what pays without work.',
};

/** The strategies one can ask for, with what each does. */
export const DREAM_STRATEGIES = DREAM_POLICIES.map((policy) => ({
  id: policy.id,
  about: ABOUT[policy.id] ?? 'A strategy of the simulation.',
}));

export function adviseDreamSeat(
  table: DreamTable,
  playerId: string,
  policyId = 'expert',
): DreamAdvice {
  const index = table.players.findIndex((seat) => seat.id === playerId);
  const seat = table.players[index];
  if (!seat?.life) throw new Error('This seat has no life to advise on.');
  const review = reviewDreamTable(table).players.find((player) => player.seat === index);
  if (!review) throw new Error('This seat is not in play.');
  const p = DreamPlayer.restore(seat.life, () => 0.5, { sharedMarkets: true });
  const next = dreamPolicyCommands(table, playerId, policyId).map((command) => ({
    command,
    says: sayMove(command),
  }));
  const open = seat.pending
    ? `a ${seat.pending.kind.replace(/_/g, ' ')} to decide`
    : seat.paydayDue
      ? 'the month to settle'
      : table.activePlayerId === playerId
        ? table.turnRolled
          ? 'the turn is played: end it'
          : 'your roll'
        : 'nothing: wait for your turn';
  const attention: string[] = [...review.watch];
  const rules = table.settings.customRules;
  const turn = p.state.turn;
  for (const offer of p.state.marketOffers ?? []) {
    const left =
      offer.validRolls !== undefined && offer.offeredAtRoll !== undefined && turn
        ? offer.validRolls - (turn.count - offer.offeredAtRoll)
        : null;
    if (left !== null && left <= 0) continue;
    attention.push(
      `An offer to buy ${offer.title} is open at ${unit(offer.pricePerShareMinor ?? offer.salePriceMinor)}${offer.pricePerShareMinor ? ' a unit' : ''}${left !== null ? ` for ${left} more of your turns` : ''}: sell it from Grow or with sell_holding / harvest_sell if you want to.`,
    );
  }
  for (const holding of p.state.holdings ?? []) {
    if (holding.ended || holding.contributionLeft === undefined) continue;
    attention.push(
      `${holding.title} is a plan you pay into: ${holding.contributionLeft} Paydays to go, ${unit(holding.contributedMinor ?? 0)} paid in; it pays out with a bonus at the end.`,
    );
  }
  if (rules.capitalGainsTaxPercent > 0) {
    attention.push(
      `A sale at a profit pays ${rules.capitalGainsTaxPercent}% tax on the profit: count it before you sell.`,
    );
  }
  if ((p.state.paymentsDue ?? []).length > 0) {
    attention.push(
      'A payment is due: it is paid from the cash, or by the Bank loan if the cash is short.',
    );
  }
  const goalPoints = table.settings.dreamPoints ?? 0;
  return {
    seat: index,
    name: seat.name,
    strategy: policyId,
    yourTurn: table.activePlayerId === playerId,
    open,
    goals: review.goals,
    goalsMet: review.goalsMet,
    dreamPoints: { have: review.dreamPoints, goal: goalPoints },
    money: {
      cash: review.cash,
      reserve: review.reserve,
      passiveIncome: review.passiveIncome,
      costOfLiving: review.costOfLiving,
      monthlyCashflow: review.monthlyCashflow,
      netWorth: review.netWorth,
      bankLoan: review.bankLoan,
    },
    next,
    attention,
    toWin: [
      'Reserve: three months of costs saved (reserve goal 100%).',
      'Debts: the starting debts repaid (debts goal 100%).',
      'Dream: the life dream funded and lived (dream goal 100%).',
      'Independence: the monthly passive income at least the costs of living (independence goal 100%).',
      goalPoints > 0
        ? `Dream points: ${goalPoints} points from the dreams you take (you have ${review.dreamPoints}).`
        : 'No dream points to collect at this table: the life dream alone.',
      'Income grows with the cards that pay every month; sell into good offers to step up to bigger ones.',
    ],
    strategies: DREAM_STRATEGIES,
  };
}
