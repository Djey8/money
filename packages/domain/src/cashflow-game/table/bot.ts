import { currentTurn } from '../turn';
import type { CashflowDealCard } from '../types';
import type { Policy } from '../simulation/policy';
import { canAnswerTrade } from './trade';
import { tableLegalActions } from './legal';
import { nextPassiveCommand } from './passive';
import { cardOf, decide, viewOf } from './simulate';
import type { Table, TableCommand } from './types';

/**
 * What a bot does next (todo/cashflow-tournament-and-bots.md B2): a pure function of the table, the bot's id and its strategy.
 * The server's driver calls it whenever the table changes and sends the command it returns through the same door as any player's
 * move - the bot has no private access and sees only what a player at the table sees. `null`: nothing to do right now.
 *
 * Order: sell into a buyer's offer that is open for it (on or off its turn); answer a trade offer; on its own turn, housekeeping
 * before the roll (sell, pay the bank back), then the move the strategy chooses.
 */
export function nextBotCommand(
  table: Table,
  botId: string,
  policy: Policy,
  coin: () => number,
): TableCommand | null {
  if (table.phase !== 'playing' || table.clock.pausedAt !== null) return null;
  const me = table.players.find((p) => p.id === botId);
  if (!me || me.status !== 'active' || !me.books) return null;
  if (currentTurn(me.books.state).phase === 'over') return null;
  const legal = new Set(tableLegalActions(table, botId).map((entry) => entry.action));
  const view = viewOf(me.books, table, botId);

  if (legal.has('sell_position')) {
    for (const move of policy.maintain(view)) {
      if (move.kind === 'sell') return { type: 'sell_position', input: move.input };
    }
  }

  if (canAnswerTrade(table, botId) && table.trade) {
    const card = cardOf(me.books, table.trade.deck, table.trade.cardId) as
      CashflowDealCard | undefined;
    const wants = !!card && card.assetKind !== 'share' && policy.deal(view, card).buy;
    return wants ? { type: 'accept_trade' } : { type: 'decline_trade' };
  }

  if (table.activePlayerId !== botId) return null;
  if (currentTurn(me.books.state).phase === 'roll') {
    for (const move of policy.maintain(view)) {
      if (move.kind === 'sell') {
        if (legal.has('sell_position')) return { type: 'sell_position', input: move.input };
      } else if (move.amountMinor > 0) {
        return { type: 'bank_loan', amountMinor: -move.amountMinor };
      }
    }
  }
  return decide(table, botId, policy, coin);
}

/** The move that always exists when a bot's chosen move is refused: the most passive legal turn. */
export function botFallbackCommand(table: Table, botId: string): TableCommand | null {
  return nextPassiveCommand(table, botId);
}
