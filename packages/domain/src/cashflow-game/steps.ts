/**
 * Everything a player can do that is one step in the game - and one step to undo (JFK, 2026-10-03). The History
 * lists one line per step, and the Pro API reports and undoes the same ones, so the kinds live in the domain.
 */
export type GameStepKind =
  | 'start'
  | 'roll'
  | 'skipCard'
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
}
