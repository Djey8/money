/**
 * Everything a player can do that is one step in the game - and one step to undo (JFK, 2026-10-03). The History
 * lists one line per step, and the Pro API reports and undoes the same ones, so the kinds live in the domain.
 */
export type GameStepKind =
  | 'start'
  | 'roll'
  | 'skipCard'
  | 'cardPicked'
  | 'payday'
  | 'baby'
  | 'charity'
  | 'downsized'
  | 'loanTaken'
  | 'loanRepaid'
  | 'loanAuto'
  | 'planDeal'
  | 'buyDeal'
  | 'doodad'
  | 'marketCard'
  | 'marketCost'
  | 'priceUpdate'
  | 'shareSplit'
  | 'shareReverseSplit'
  | 'cardSale'
  | 'reset'
  | 'buyShare'
  | 'sellShare'
  | 'buyInvestment'
  | 'sellInvestment'
  | 'payoff'
  | 'buyAsset'
  | 'sellAsset'
  | 'diceWon'
  | 'diceLost'
  | 'transaction';

/** One step: what kind it was and what it was about ("Round 3", a title, an amount...). */
export interface GameStep {
  kind: GameStepKind;
  detail?: string;
  /** For `cardPicked`: the exact card (its id in the game set's deck), so a game can be analysed card by card. */
  cardId?: string;
  /** For `cardPicked`: the deck it came from. */
  deck?: 'dealSmall' | 'dealBig' | 'market' | 'doodad';
}

/**
 * The step for picking a card - drawn at random or found among the physical cards (JFK, 2026-10-07: "each action, even
 * picking a card, is saved in the history with the exact card id"). Without it a card that is passed on leaves no trace
 * of what was passed on.
 */
export function cardPickedStep(
  deck: NonNullable<GameStep['deck']>,
  card: { id: string; title: string },
  label?: string,
): GameStep {
  return { kind: 'cardPicked', detail: label || card.title, cardId: card.id, deck };
}
