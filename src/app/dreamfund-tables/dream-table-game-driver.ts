import { TableGameDriver } from '../tables/table-game-driver';
import type { RemoteOutcome } from '../shared/services/remote-game';

type Rest = Record<string, unknown>;

/** What the tile cards of the solo screen decide, and the command of the table each one is. */
const DECISIONS: Record<string, (d: Rest) => Record<string, unknown>> = {
  pay: (d) => ({ type: 'pay_emergency', pay: d['pay'] }),
  choose: (d) => ({ type: 'emergency_choose', choiceId: d['choiceId'] }),
  rollDie: (d) => ({ type: 'emergency_roll', key: d['key'] }),
  rollAgain: () => ({ type: 'emergency_reroll' }),
  answer: (d) => ({
    type: 'answer_life',
    decision: d['answer'],
    ...(d['option'] ? { option: d['option'] } : {}),
  }),
  branch: (d) => ({ type: 'choose_career_branch', index: d['index'] }),
  takeDream: (d) => ({ type: 'take_dream', cardId: d['cardId'] }),
  pile: (d) => ({ type: 'choose_pile', pile: d['pile'] }),
  takeCard: (d) => ({ type: 'take_opportunity', ...d }),
  leave: () => ({ type: 'skip' }),
  sellInWindow: (d) => ({ type: 'harvest_sell', holding: d['holding'] }),
  acceptBuyer: (d) => ({ type: 'harvest_accept', holding: d['holding'] }),
  ladder: (d) => ({ type: 'harvest_ladder', holding: d['holding'], action: d['action'] }),
};

/**
 * The solo screen's moves at a Dreamfund table (todo/dreamfund-tables-solo-ui.md, R4): the same driver as the classic table's, with the
 * Dreamfund's commands. The server rolls the dice, draws the cards and books them; this sends what the player decided. Moves the
 * Dreamfund has no use for (the classic deals) are answered with a refusal, so a stale button costs nothing.
 */
export class DreamTableGameDriver extends TableGameDriver {
  override readonly dreamfund = true;

  private static readonly NOT_HERE = 'This move is not part of the Dreamfund.';
  private notHere = (..._args: unknown[]): Promise<RemoteOutcome> =>
    Promise.resolve({ ok: false, message: DreamTableGameDriver.NOT_HERE, events: [] });

  /** A decision of a tile card, turned into the table's own command. */
  dreamMove(decision: { decision: string } & Record<string, unknown>): Promise<RemoteOutcome> {
    const { decision: name, ...rest } = decision;
    const command = DECISIONS[name]?.(rest);
    if (!command) return this.notHere();
    return this.move(command);
  }

  override roll(): Promise<RemoteOutcome> {
    return this.move({ type: 'roll' });
  }

  /** The turn is over: the card's decisions are made, or the tile had none. */
  override finish(): Promise<RemoteOutcome> {
    return this.move({ type: 'end_turn' });
  }

  override done(): Promise<RemoteOutcome> {
    return this.move({ type: 'end_turn' }, false);
  }

  /** Leaves the decision open as it is (no dream taken, no card bought); the turn can then be ended. */
  override pass(): Promise<RemoteOutcome> {
    return this.move({ type: 'skip' });
  }

  override draw = this.notHere;
  override buy = this.notHere;
  override plan = this.notHere;
  override buyPlanned = this.notHere;
  override payDoodad = this.notHere;
  override payMarket = this.notHere;
  override rollDecision = this.notHere;
  override askUndo = this.notHere;
}
