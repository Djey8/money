import { TableGameDriver } from '../tables/table-game-driver';
import type { RemoteOutcome } from '../shared/services/remote-game';

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
