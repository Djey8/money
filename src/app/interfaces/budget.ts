import { TaggedAmount } from './tagged-amount';

export interface Budget extends TaggedAmount {
  date: string;
  /** Planned by the Cashflow game's Payday: it moves back a month with the game's transactions. */
  game?: boolean;
}
