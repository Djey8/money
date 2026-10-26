import type { OpportunityCard, OpportunityPile } from '../opportunity-deck';
import type { OpportunityChoice } from '../opportunity';
import type { DreamCard } from '../dream-deck';
import type { HarvestLadderOffer, HarvestSale } from '../harvest';
import type { Rng } from '../rng';

/**
 * How a bot plays the Dreamfund game (JFK, 2026-10-26): a small set of rules - what to take, what to keep in cash, when to sell, whether
 * to ride a hype - written as data, so strategies can be compared and one day become the bots of a table. The decisions are those a
 * player has: money goes to the reserve, the debts and the dream; the Opportunity and Harvest cards are taken or left.
 */

/** What a policy may look at when it decides. */
export interface DreamView {
  cashMinor: number;
  monthlyExpensesMinor: number;
  passiveMinor: number;
  reserveMinor: number;
  reserveTargetMinor: number;
  round: number;
  debtsMinor: number;
  dreamFundedMinor: number;
  dreamTargetMinor: number;
  /** Cash that may be spent on a card now: what is left over a buffer of some months of expenses. */
  spendableMinor: number;
  /** The index of every market now. */
  markets: Record<string, number>;
  holdingsCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface DreamPolicy {
  id: string;
  name: string;
  /** Months of expenses kept in cash before anything is invested. */
  bufferMonths: number;
  /** Of what the month has left, the share put into payment plans for the reserve and the dreams, and over how many Paydays they run. */
  planShare: number;
  planMonths: number;
  /** The dream is planned from the start, or only once the passive income pays for this share of the living costs (an investor builds first). */
  dreamAfterPassiveShare?: number;
  /** The order the free money of a Payday goes to. */
  priorities: ('reserve' | 'debt' | 'dream' | 'invest')[];
  /** Of the free money after the reserve and the debts, the share that goes to the dream each Payday. */
  dreamShare: number;
  /** Life cards that offer a choice are accepted with this chance. */
  lifeAcceptChance: number;
  /** The most a card may risk (its risk score, 0 to 5) for the policy to take it. */
  riskTolerance: number;
  pile(view: DreamView, rng: Rng): OpportunityPile | null;
  /** Which of the offered cards to take (or none), with the choice made on it. */
  take(
    offers: readonly OpportunityCard[],
    view: DreamView,
    held: ReadonlyMap<string, number>,
  ): { card: OpportunityCard; choice: OpportunityChoice } | null;
  /** A dream to take among the offered (or none). */
  dream(offers: readonly DreamCard[], view: DreamView, open: number): DreamCard | null;
  /** In an open market: sell this holding now? */
  sellWindow(view: DreamView, holding: { title: string; tag?: string }, index: number): boolean;
  acceptBuyer(view: DreamView, sale: HarvestSale): boolean;
  ladder(view: DreamView, offer: HarvestLadderOffer): 'ride' | 'cash' | 'skip';
}

const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/** What a card is expected to pay or save every month, in minor units (by its numbers, dice averaged). */
export function expectedMonthlyMinor(card: OpportunityCard): number {
  if (card.share) return card.share.dividendMonthPerUnitMinor;
  if (card.cashflowMinor !== undefined) return card.cashflowMinor;
  const band = (
    value: (r: NonNullable<OpportunityCard['dice']>[number]['value']) => number | undefined,
  ) =>
    avg(
      (card.dice ?? []).flatMap((entry) => {
        const v = value(entry.value);
        return v === undefined ? [] : Array.from({ length: entry.to - entry.from + 1 }, () => v);
      }),
    );
  const cash = band((r) => r.cashflowMinor);
  if (cash) return cash;
  const saving = band((r) => r.monthlySavingsMinor);
  if (saving) return saving;
  return card.savings?.monthlySavingsMinor ?? 0;
}

/** What a card costs now (a lot of a share: one unit). */
export function entryCostMinor(card: OpportunityCard): number {
  if (card.share) return card.share.unitPriceMinor;
  return card.costMinor ?? 0;
}

const isSaving = (card: OpportunityCard) => card.growType !== 'income-growth';

interface Taste {
  /** How much the card is wanted: yearly return on what it costs, plus a liking by kind. */
  /** How much a card is wanted, given what it pays a month and costs for the lot the player would take. */
  weight(card: OpportunityCard, monthlyMinor: number, costMinor: number): number;
}

/** A policy made of a taste: it takes the best affordable card that its risk tolerance allows. */
function makePolicy(
  base: Pick<
    DreamPolicy,
    | 'id'
    | 'name'
    | 'bufferMonths'
    | 'planShare'
    | 'planMonths'
    | 'dreamAfterPassiveShare'
    | 'priorities'
    | 'dreamShare'
    | 'lifeAcceptChance'
    | 'riskTolerance'
  >,
  taste: Taste,
  extra: {
    piles: OpportunityPile[];
    unitsShare?: number;
    /** A card scoring less than this is not taken, however affordable. */
    minScore?: number;
    sellProfit?: number;
    /** The cash from which the Tree pile is looked at (default 30,000). */
    treeFromMinor?: number;
    ride?: boolean;
    takeDreams?: boolean;
  },
): DreamPolicy {
  return {
    ...base,
    pile(view, rng) {
      // the pile the money allows: the biggest the player can pay for, now and then a smaller one to look around
      const allowed = (pile: OpportunityPile) =>
        extra.piles.includes(pile) &&
        (pile === 'seed' ||
          (pile === 'sapling' && view.spendableMinor > 500000) ||
          (pile === 'tree' && view.spendableMinor > (extra.treeFromMinor ?? 3000000)));
      const ladder: OpportunityPile[] = ['tree', 'sapling', 'seed'];
      const options = ladder.filter(allowed);
      if (options.length === 0) return 'seed';
      return rng() < 0.75 ? options[0] : options[Math.floor(rng() * options.length)];
    },
    take(offers, view, held) {
      let best: { card: OpportunityCard; choice: OpportunityChoice; score: number } | null = null;
      for (const card of offers) {
        if (card.riskScore > base.riskTolerance && !isSaving(card)) continue;
        let choice: OpportunityChoice = {};
        let cost = entryCostMinor(card);
        if (card.share) {
          const room = Number.POSITIVE_INFINITY - (held.get(card.id) ?? 0); // the card sets no limit: Grow decides
          const units = Math.max(
            1,
            Math.min(
              room,
              Math.floor(
                (view.spendableMinor * (extra.unitsShare ?? 0.5)) / card.share.unitPriceMinor,
              ),
            ),
          );
          if (room < 1 || units * card.share.unitPriceMinor > view.spendableMinor) continue;
          choice = { units };
          cost = units * card.share.unitPriceMinor;
        } else if (card.stepMinor) {
          const steps = Math.max(1, Math.min(10, Math.floor(view.spendableMinor / card.stepMinor)));
          if (steps * card.stepMinor > view.spendableMinor) continue;
          choice = { steps };
          cost = steps * card.stepMinor;
        } else if (cost > view.spendableMinor) {
          continue;
        }
        const monthly = card.share
          ? card.share.dividendMonthPerUnitMinor * (choice.units ?? 1)
          : expectedMonthlyMinor(card);
        const score = taste.weight(card, monthly, cost) + (cost === 0 ? 5 : 0);
        if (score > (extra.minScore ?? 0) && (!best || score > best.score)) {
          best = { card, choice, score };
        }
      }
      return best ? { card: best.card, choice: best.choice } : null;
    },
    dream(offers, view, open) {
      if (!extra.takeDreams || open >= 2) return null;
      // a dream the player can plausibly fund: the cheapest of the offered
      const sorted = [...offers].sort((a, b) => a.totalMinor - b.totalMinor);
      const pick = sorted[0];
      return pick && pick.totalMinor <= view.monthlyExpensesMinor * 12 ? pick : null;
    },
    sellWindow(_view, _holding, index) {
      return extra.sellProfit !== undefined && index >= 1 + extra.sellProfit;
    },
    acceptBuyer(_view, sale) {
      return sale.netMinor > 0 && sale.grossMinor > 0;
    },
    ladder(_view, offer) {
      if (!extra.ride) return 'skip';
      // ride while it is cheap to lose, cash out once the stake has multiplied enough
      if (offer.state === 'riding') return offer.multiplier >= 3 ? 'cash' : 'ride';
      return 'ride';
    },
  };
}

const roi = (card: OpportunityCard) => {
  const cost = Math.max(entryCostMinor(card), 100);
  return (expectedMonthlyMinor(card) * 12) / cost;
};

const isShare = (card: OpportunityCard, ...tags: string[]) =>
  !!card.share && tags.includes(card.market?.tag ?? '');

/** The five strategies the Dreamfund deck sketch names, plus a baseline that takes only what is free. */
export const DREAM_POLICIES: DreamPolicy[] = [
  makePolicy(
    {
      id: 'saver',
      planShare: 0.9,
      planMonths: 12,
      name: 'Cautious saver',
      bufferMonths: 2,
      priorities: ['reserve', 'debt', 'dream', 'invest'],
      dreamShare: 0.6,
      lifeAcceptChance: 0.5,
      riskTolerance: 1,
    },
    {
      weight: (card) =>
        isSaving(card)
          ? 10
          : card.lockedPaydays || card.id === 'S09'
            ? 6
            : isShare(card, 'BOND', 'WORLD')
              ? 3
              : card.riskScore <= 1
                ? roi(card) * 20
                : 0,
    },
    { piles: ['seed'], takeDreams: true, unitsShare: 0.3 },
  ),
  makePolicy(
    {
      id: 'etf',
      planShare: 0.6,
      planMonths: 18,
      name: 'ETF investor',
      bufferMonths: 1,
      priorities: ['reserve', 'debt', 'invest', 'dream'],
      dreamShare: 0.4,
      lifeAcceptChance: 0.6,
      riskTolerance: 2,
    },
    {
      weight: (card) =>
        isSaving(card)
          ? 10
          : isShare(card, 'WORLD', 'EMERG', 'DIVID', 'BOND', 'INSU')
            ? 8 + roi(card) * 5
            : card.riskScore <= 1
              ? 1
              : 0,
    },
    { piles: ['seed', 'sapling'], takeDreams: true, unitsShare: 0.7 },
  ),
  makePolicy(
    {
      id: 'property',
      planShare: 0.5,
      planMonths: 24,
      name: 'Property builder',
      bufferMonths: 1,
      priorities: ['reserve', 'debt', 'invest', 'dream'],
      dreamShare: 0.3,
      lifeAcceptChance: 0.6,
      riskTolerance: 4,
    },
    {
      weight: (card) =>
        isSaving(card)
          ? 10
          : card.property
            ? 12 + roi(card) * 30
            : card.loan && card.riskScore <= 3
              ? 6
              : 0,
    },
    { piles: ['seed', 'tree'], takeDreams: false, treeFromMinor: 1200000 },
  ),
  makePolicy(
    {
      id: 'hustler',
      planShare: 0.5,
      planMonths: 18,
      name: 'Side hustler',
      bufferMonths: 1,
      priorities: ['reserve', 'invest', 'debt', 'dream'],
      dreamShare: 0.4,
      lifeAcceptChance: 0.7,
      riskTolerance: 4,
    },
    {
      weight: (card) =>
        isSaving(card)
          ? 10
          : card.sideHustle || card.loan
            ? 8 + roi(card) * 10
            : card.cashflowMinor
              ? roi(card) * 10
              : 0,
    },
    { piles: ['seed', 'sapling'], takeDreams: true },
  ),
  makePolicy(
    {
      id: 'gambler',
      planShare: 0.3,
      planMonths: 24,
      name: 'Gambler',
      bufferMonths: 0.5,
      priorities: ['reserve', 'invest', 'debt', 'dream'],
      dreamShare: 0.2,
      lifeAcceptChance: 0.9,
      riskTolerance: 5,
    },
    {
      weight: (card) =>
        isSaving(card)
          ? 6
          : isShare(card, 'BTC', 'ETH', 'ALTS', 'MOON', 'LITHX', 'TECH') ||
              card.id === 'S20' ||
              card.id === 'S17'
            ? 12
            : card.id === 'P10' ||
                card.id === 'P31' ||
                card.id === 'S22' ||
                card.id === 'S23' ||
                card.riskScore >= 5
              ? 10
              : 0.5,
    },
    { piles: ['seed', 'sapling'], minScore: 5, ride: true, sellProfit: 0.3, takeDreams: false },
  ),
  // the strategy a careful, informed player follows: free savings first, then the cards that pay most for their price, the reserve
  // and the dream by plan, the big businesses as soon as the money is there - and nothing that claims to be a sure thing
  makePolicy(
    {
      id: 'expert',
      dreamAfterPassiveShare: 0.35,
      name: 'Informed investor',
      planShare: 0.45,
      planMonths: 18,
      bufferMonths: 0.5,
      priorities: ['reserve', 'debt', 'invest', 'dream'],
      dreamShare: 0.5,
      lifeAcceptChance: 0.5,
      riskTolerance: 4,
    },
    {
      weight: (card, monthly, cost) =>
        isSaving(card)
          ? 10
          : card.riskScore >= 5
            ? 0
            : Math.min(30, (monthly / 100) ** 0.6 + ((monthly * 12) / Math.max(cost, 100)) * 4),
    },
    { piles: ['seed', 'sapling', 'tree'], takeDreams: true, unitsShare: 0.5 },
  ),
  // more ways to play (JFK, 2026-10-26: "make more profiles and ideas to win this game")
  makePolicy(
    {
      id: 'dividend',
      dreamAfterPassiveShare: 0.3,
      name: 'Dividend snowball',
      planShare: 0.5,
      planMonths: 18,
      bufferMonths: 1,
      priorities: ['reserve', 'debt', 'invest', 'dream'],
      dreamShare: 0.4,
      lifeAcceptChance: 0.5,
      riskTolerance: 3,
    },
    {
      weight: (card, monthly, cost) =>
        isSaving(card)
          ? 10
          : card.share && card.share.dividendMonthPerUnitMinor > 0
            ? 6 + ((monthly * 12) / Math.max(cost, 100)) * 6
            : card.loan && card.riskScore <= 2
              ? 3
              : 0,
    },
    { piles: ['seed', 'sapling', 'tree'], takeDreams: true, unitsShare: 0.8 },
  ),
  makePolicy(
    {
      id: 'sapling',
      dreamAfterPassiveShare: 0.3,
      name: 'Sapling business builder',
      planShare: 0.45,
      planMonths: 18,
      bufferMonths: 0.5,
      priorities: ['reserve', 'invest', 'debt', 'dream'],
      dreamShare: 0.4,
      lifeAcceptChance: 0.5,
      riskTolerance: 4,
    },
    {
      weight: (card, monthly, cost) =>
        isSaving(card)
          ? 10
          : card.riskScore >= 5 || card.property
            ? 0
            : card.pile === 'sapling' || card.sideHustle
              ? Math.min(30, (monthly / 100) ** 0.6 + ((monthly * 12) / Math.max(cost, 100)) * 4)
              : 0,
    },
    { piles: ['seed', 'sapling'], takeDreams: true },
  ),
  makePolicy(
    {
      id: 'tree',
      dreamAfterPassiveShare: 0.5,
      name: 'Tree saver',
      planShare: 0.15,
      planMonths: 30,
      bufferMonths: 0.5,
      priorities: ['invest', 'reserve', 'debt', 'dream'],
      dreamShare: 0.3,
      lifeAcceptChance: 0.5,
      riskTolerance: 4,
    },
    {
      weight: (card, monthly, cost) =>
        isSaving(card)
          ? 10
          : card.pile === 'tree' && card.riskScore <= 4
            ? Math.min(30, (monthly / 100) ** 0.6 + ((monthly * 12) / Math.max(cost, 100)) * 4)
            : 0,
    },
    { piles: ['seed', 'tree'], takeDreams: true, treeFromMinor: 1200000 },
  ),
  makePolicy(
    {
      id: 'dreamer',
      name: 'Dream chaser',
      planShare: 0.8,
      planMonths: 12,
      bufferMonths: 2,
      priorities: ['reserve', 'dream', 'debt', 'invest'],
      dreamShare: 0.9,
      lifeAcceptChance: 0.8,
      riskTolerance: 2,
    },
    {
      weight: (card, monthly, cost) =>
        isSaving(card)
          ? 10
          : card.riskScore <= 2
            ? Math.min(12, (monthly / 100) ** 0.5 + ((monthly * 12) / Math.max(cost, 100)) * 2)
            : 0,
    },
    { piles: ['seed', 'sapling'], takeDreams: true },
  ),
  makePolicy(
    {
      id: 'steady',
      dreamAfterPassiveShare: 0.4,
      name: 'Steady builder',
      planShare: 0.5,
      planMonths: 18,
      bufferMonths: 3,
      priorities: ['reserve', 'debt', 'invest', 'dream'],
      dreamShare: 0.5,
      lifeAcceptChance: 0.4,
      riskTolerance: 3,
    },
    {
      weight: (card, monthly, cost) =>
        isSaving(card)
          ? 10
          : card.riskScore >= 4
            ? 0
            : Math.min(30, (monthly / 100) ** 0.6 + ((monthly * 12) / Math.max(cost, 100)) * 4),
    },
    { piles: ['seed', 'sapling', 'tree'], takeDreams: true, unitsShare: 0.4 },
  ),
  makePolicy(
    {
      id: 'passive',
      planShare: 0.9,
      planMonths: 12,
      name: 'Free cards only',
      bufferMonths: 3,
      priorities: ['reserve', 'debt', 'dream'],
      dreamShare: 0.7,
      lifeAcceptChance: 0.5,
      riskTolerance: 0,
    },
    { weight: (card) => (isSaving(card) ? 10 : 0) },
    { piles: ['seed'], takeDreams: true },
  ),
];

export const policyById = (id: string): DreamPolicy => {
  const found = DREAM_POLICIES.find((policy) => policy.id === id);
  if (!found) throw new Error(`Unknown policy ${id}`);
  return found;
};
