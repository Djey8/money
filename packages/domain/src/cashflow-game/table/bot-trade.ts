import { currentTurn } from '../turn';
import type { CashflowDealCard } from '../types';
import type { Policy } from '../simulation/policy';
import { cardOf, viewOf } from './simulate';
import { maxTradePriceMinor, quoteTrade, whyCannotOfferTrade } from './trade';
import type { Table, TableCommand, TablePlayer, TradeOffer } from './types';

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
const PATIENCE_MS: Record<string, number> = { fast: 24_000, normal: 40_000, slow: 70_000 };

/** The skill level of a bot id (`champion-latest--casual`); a plain id is a master, an unknown level is a beginner. */
export function levelOfPolicy(policyId: string): string {
  const at = policyId.lastIndexOf('--');
  return at < 0 ? 'master' : policyId.slice(at + 2);
}

/**
 * How long a bot lets an offer be before it answers (JFK, 2026-10-24: an offer is a race and everybody must have the same chance).
 * A person has to read the card, so a bot never answers at once: the stronger it is the sooner it answers, and the delay is a fixed
 * pseudo-random point of its range for this offer (a bot has no private luck: the same offer, the same wait). The table's pace
 * stretches or shortens the range, like everything else the table paces.
 */
const ANSWER_RANGE_MS: Record<string, [number, number]> = {
  master: [4_000, 9_000],
  strong: [6_000, 12_000],
  casual: [9_000, 16_000],
  beginner: [12_000, 22_000],
};
const PACE_FACTOR: Record<string, number> = { fast: 0.6, normal: 1, slow: 1.6 };

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

export function answerDelayMs(
  table: Table,
  policyId: string,
  offer: TradeOffer,
  botId: string,
): number {
  const [low, high] = ANSWER_RANGE_MS[levelOfPolicy(policyId)] ?? ANSWER_RANGE_MS['beginner'];
  const point = hash01(`${offer.cardId}|${offer.at ?? 0}|${botId}`);
  return Math.round((low + (high - low) * point) * (PACE_FACTOR[table.settings.pace] ?? 1));
}

/**
 * How much of the card's up-front cost a bot is willing to pay ON TOP of it to the seller, by skill: a master only pays a small
 * premium - it has to still make its profit soon - and the lower the level the more it overpays.
 */
const PREMIUM: Record<string, number> = { master: 0.08, strong: 0.15, casual: 0.3, beginner: 0.55 };
/** The longest a bot waits to earn back everything the card costs it (the seller's price included), by skill, in months. */
const PAYBACK_MONTHS: Record<string, number> = {
  master: 36,
  strong: 48,
  casual: 72,
  beginner: 120,
};

/**
 * Whether a bot takes this card at this price: its strategy wants the card on its normal terms, the price is within what the bot
 * level pays over them, it earns the whole outlay back in time, and it can pay without going bankrupt (the cashflow stays 0 or more
 * after the Bank loan). A bad card never sells at a high price, whatever the seller asks.
 */
export function botTakesTrade(
  table: Table,
  me: TablePlayer,
  policy: Policy,
  offer: TradeOffer,
  priceMinor: number,
): boolean {
  if (!me.bot || !me.books) return false;
  const card = cardOf(me.books, offer.deck, offer.cardId) as CashflowDealCard | undefined;
  if (!card || card.assetKind === 'share') return false;
  if (!policy.deal(viewOf(me.books, table, me.id), card).buy) return false;
  const level = levelOfPolicy(me.bot.policyId);
  const outlay = outlayMinor(card);
  if (priceMinor > Math.round(outlay * (PREMIUM[level] ?? PREMIUM['beginner']))) return false;
  const cashflow = card.cashflowMinor ?? 0;
  if (cashflow > 0) {
    const months = (outlay + priceMinor) / cashflow;
    if (months > (PAYBACK_MONTHS[level] ?? PAYBACK_MONTHS['beginner'])) return false;
  }
  return quoteTrade(me.books, offer.deck, offer.cardId, priceMinor).ok;
}

/** The most this bot would pay for the offered card, or 0 (used to answer with a counter-offer instead of a plain no). */
export function botTradeLimitMinor(
  table: Table,
  me: TablePlayer,
  policy: Policy,
  offer: TradeOffer,
): number {
  if (!me.books) return 0;
  const card = cardOf(me.books, offer.deck, offer.cardId) as CashflowDealCard | undefined;
  if (!card) return 0;
  const cap = Math.round(
    outlayMinor(card) * (PREMIUM[levelOfPolicy(me.bot?.policyId ?? '')] ?? PREMIUM['beginner']),
  );
  const affordable = maxTradePriceMinor(me.books, offer.deck, offer.cardId);
  const limit = Math.floor(Math.min(cap, affordable) / 100) * 100;
  return limit > 0 && botTakesTrade(table, me, policy, offer, limit) ? limit : 0;
}

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

/**
 * The price a bot asks: a share of what the card costs up front that follows how good the card is (its yearly cashflow against that
 * cost) - a poor card goes cheap, a very good one is worth more to the buyer - in whole units of money, never less than 100.
 */
export function askingPriceMinor(card: CashflowDealCard, coin: () => number): number {
  const outlay = outlayMinor(card);
  const yearly = outlay > 0 ? ((card.cashflowMinor ?? 0) * 12) / outlay : 0;
  const base = yearly >= 0.6 ? 0.26 : yearly >= 0.3 ? 0.17 : yearly >= 0.15 ? 0.1 : 0.05;
  const share = base * (0.85 + 0.3 * coin());
  return Math.max(100, Math.round((outlay * share) / 100) * 100);
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
