import { currentTurn } from '../turn';
import type { Policy } from '../simulation/policy';
import { canAnswerTrade } from './trade';
import { tableLegalActions } from './legal';
import { nextPassiveCommand } from './passive';
import { answerDelayMs, botTakesTrade, botTradeLimitMinor, botTradeMove } from './bot-trade';
import { decide, viewOf } from './simulate';
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
  now: number = Date.now(),
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
    const offer = table.trade;
    // an offer is a race: a bot waits a while first (the stronger the bot, the shorter), so a person can be quicker
    if (now - (offer.at ?? now) < answerDelayMs(table, me.bot?.policyId ?? '', offer, botId))
      return null;
    if (botTakesTrade(table, me, policy, offer, offer.priceMinor)) return { type: 'accept_trade' };
    // not at that price: a counter-offer with what the card is worth to it, when it is worth anything
    const limit = botTradeLimitMinor(table, me, policy, offer);
    const countered = offer.counters.some((c) => c.playerId === botId);
    if (limit > 0 && limit < offer.priceMinor && !countered) {
      return { type: 'counter_trade', priceMinor: limit };
    }
    return countered ? null : { type: 'decline_trade' };
  }

  if (table.activePlayerId !== botId || table.hold) return null;
  if (currentTurn(me.books.state).phase === 'roll') {
    for (const move of policy.maintain(view)) {
      if (move.kind === 'sell') {
        if (legal.has('sell_position')) return { type: 'sell_position', input: move.input };
      } else if (move.kind === 'payoff') {
        if (legal.has('pay_liability')) return { type: 'pay_liability', tag: move.tag };
      } else if (move.amountMinor > 0) {
        return { type: 'bank_loan', amountMinor: -move.amountMinor };
      }
    }
  }
  // before a Deal card is turned down, the bot may try to sell it to the table (bot-trade.ts)
  const trade = botTradeMove(table, me, policy, coin, now);
  if (trade !== undefined) return trade;
  return decide(table, botId, policy, coin);
}

/** The move that always exists when a bot's chosen move is refused: the most passive legal turn. */
export function botFallbackCommand(table: Table, botId: string): TableCommand | null {
  return nextPassiveCommand(table, botId);
}
