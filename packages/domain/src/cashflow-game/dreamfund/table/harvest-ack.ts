import type { DreamSeat, DreamTable } from './types';

/**
 * A Harvest card is the one thing at a Dreamfund table that is only valid for one turn (JFK, 2026-11-03): the markets are open to sell
 * into, a buyer's offer is made, a hype can be ridden - until the player whose card it is ends the turn. A player it affects is told
 * and says Continue; the turn of the one who drew it does not end before everybody it affected has. A bot, a player who is away or one
 * who has left is not waited for, and nobody is when the card brought them nothing.
 */
export function needsHarvestAck(seat: DreamSeat): boolean {
  const open = seat.harvest;
  if (!open || open.acknowledged) return false;
  return open.sellable.length + open.sales.length + open.ladders.length > 0;
}

/** The ids of the players the table waits for before the turn of the player on the move can end. */
export function harvestWaiting(table: DreamTable): string[] {
  return table.players
    .filter(
      (seat) =>
        seat.id !== table.activePlayerId &&
        seat.status === 'active' &&
        !seat.bot &&
        !seat.away &&
        seat.life !== null &&
        needsHarvestAck(seat),
    )
    .map((seat) => seat.id);
}
