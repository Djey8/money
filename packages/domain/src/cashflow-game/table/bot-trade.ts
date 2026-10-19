import { currentTurn } from '../turn';
import type { CashflowDealCard } from '../types';
import type { Policy } from '../simulation/policy';
import { cardOf, viewOf } from './simulate';
import { whyCannotOfferTrade } from './trade';
import type { Table, TableCommand, TablePlayer } from './types';

/**
 * A bot that is about to turn a Deal card down may first try to sell it to the table (JFK, 2026-10-19), so the others have a chance
 * to take it. It is a thought the bot has on top of its strategy, not part of what the strategy search measured: nothing here is
 * used by the simulations that calibrated the bots, and no profile has to be searched again. How often a bot thinks of it depends
 * on its skill level (a beginner never does) and its style; the price it asks is a modest part of what the card costs.
 */

/** How likely a bot of this skill level is to think of it, as a factor of its style's own likelihood. */
const LEVEL_FACTOR: Record<string, number> = { master: 1, strong: 0.8, casual: 0.4, beginner: 0 };

/** How likely a style is to try it: a bot that rarely buys has the most cards to sell; a careful one keeps to its plan. */
const STYLE_CHANCE: Record<string, number> = {
  'never-buy': 0.7,
  'picky-properties': 0.5,
  'cash-properties': 0.5,
  'big-deals-when-rich': 0.45,
  'character-trader': 0.5,
  'mlm-then-properties': 0.4,
  'bridge-loans': 0.4,
  'character-gambler': 0.4,
  'all-rounder': 0.4,
  'character-marketer': 0.4,
  'stocks-for-deposits': 0.35,
  'best-found': 0.35,
  champion: 0.35,
  'champion-v1': 0.35,
  'champion-latest': 0.35,
  'character-banker': 0.35,
  'character-chaser': 0.3,
  'character-investor': 0.3,
  'leveraged-big': 0.3,
  'character-cautious': 0.25,
};
const DEFAULT_CHANCE = 0.35;

/** How long a bot waits for an answer to its offer, by the table's pace (people have to read the card and decide). */
const PATIENCE_MS: Record<string, number> = { fast: 12_000, normal: 25_000, slow: 45_000 };

/** A counter-offer at or above this share of the asking price is taken. */
const ACCEPT_COUNTER_AT = 0.6;

/** The chance that this bot thinks of selling a card it is about to decline (0 for a bot without skill, or an unknown one). */
export function sellChance(policyId: string): number {
  // `<style>` or `<style>--<level>`; bot-catalog itself is kept out of the package barrel (this file is in it), so no import of it
  const at = policyId.lastIndexOf('--');
  const split =
    at < 0
      ? { base: policyId, level: 'master' }
      : { base: policyId.slice(0, at), level: policyId.slice(at + 2) };
  if (!(split.level in LEVEL_FACTOR)) return 0;
  return (STYLE_CHANCE[split.base] ?? DEFAULT_CHANCE) * (LEVEL_FACTOR[split.level] ?? 0);
}

/** What the card costs the buyer up front: the deposit of a property, the price of an asset. */
function outlayMinor(card: CashflowDealCard): number {
  return card.depositMinor ?? card.costMinor ?? 0;
}

/** The price a bot asks: 8-20% of what the card costs up front, in whole units of money (multiples of 100 minor units), never less than 100. */
export function askingPriceMinor(card: CashflowDealCard, coin: () => number): number {
  const share = 0.08 + 0.12 * coin();
  return Math.max(100, Math.round((outlayMinor(card) * share) / 100) * 100);
}

/**
 * The bot's own trade move, or `undefined` when it has none and the strategy goes on:
 *  - its offer is open: take a good counter-offer, withdraw it when everybody said no or it has waited long enough (then the card is
 *    declined as before), otherwise wait (`null`);
 *  - on its space with a Deal card it is going to decline, and it has not offered that card yet: sometimes offer it to the table.
 */
export function botTradeMove(
  table: Table,
  me: TablePlayer,
  policy: Policy,
  coin: () => number,
  now: number,
): TableCommand | null | undefined {
  if (!me.bot || !me.books) return undefined;
  const offer = table.trade;
  if (offer && offer.sellerId === me.id) {
    const best = [...offer.counters].sort((a, b) => b.priceMinor - a.priceMinor)[0];
    if (best && best.priceMinor >= offer.priceMinor * ACCEPT_COUNTER_AT) {
      return { type: 'accept_trade', from: best.playerId };
    }
    const others = table.players.filter(
      (p) =>
        p.id !== me.id &&
        p.status === 'active' &&
        p.books &&
        currentTurn(p.books.state).phase !== 'over',
    );
    const allSaidNo = others.every((p) => offer.declined.includes(p.id));
    const patience = PATIENCE_MS[table.settings.pace] ?? PATIENCE_MS['normal'];
    if (allSaidNo || offer.at === undefined || now - offer.at > patience) {
      return { type: 'withdraw_trade' };
    }
    return null;
  }
  if (offer) return undefined;

  const turn = currentTurn(me.books.state);
  const pending = turn.pending;
  if (table.activePlayerId !== me.id || table.hold || turn.phase !== 'decide') return undefined;
  if (
    !pending ||
    pending.kind !== 'deal' ||
    !pending.offered ||
    pending.played ||
    pending.tradeTried
  ) {
    return undefined;
  }
  if (whyCannotOfferTrade(table, me.id) !== null) return undefined;
  const card = cardOf(me.books, pending.offered.deck, pending.offered.cardId) as
    CashflowDealCard | undefined;
  if (!card || card.assetKind === 'share') return undefined;
  const view = viewOf(me.books, table, me.id);
  if (policy.deal(view, card).buy) return undefined;
  if (coin() >= sellChance(me.bot.policyId)) return undefined;
  return { type: 'offer_trade', priceMinor: askingPriceMinor(card, coin) };
}
