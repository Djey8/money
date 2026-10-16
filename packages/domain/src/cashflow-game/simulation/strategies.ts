import type { CashflowDealCard, CashflowDoodadCard, CashflowMarketCard } from '../types';
import type { DealChoice, HouseMove, Pile, Policy, PolicyParams, PolicyView } from './policy';

/**
 * The strategies the lab plays (todo/cashflow-game-analysis.md, E1/E2): one parametrised family - how picky to be about
 * a property's return, how much cash to keep, whether to borrow, whether to trade stocks, when to sell to a buyer - and a
 * handful of named presets that tell a story. The lab's search varies the knobs; the presets are the readable reference
 * points the knowledge base talks about.
 */

export const POLICY_DEFAULTS: PolicyParams = {
  buyProperties: true,
  minMonthlyReturn: 0,
  reserveMinor: 0,
  loans: 'never',
  loanCoverage: 1.5,
  bigDealFromCashMinor: null,
  buyMlm: false,
  buyGambles: false,
  shares: null,
  sellWhenProfitMonths: null,
  repayLoans: false,
  charityTwoDice: true,
  skipDoodadsAboveMinor: null,
  catchUp: null,
  protectLead: null,
  countShares: null,
  pileByCount: false,
  countReturnFactor: 0,
  speculate: null,
};

/** The units of an apartment complex from its deck symbol (APH24 = 24 units). */
const unitsOf = (symbol: string | undefined): number =>
  Number((symbol ?? '').match(/(\d+)$/)?.[1] ?? 0);

/** What a Market buyer card pays for a property above what it cost (price = deposit + mortgage); 0 when it is not for that property. */
export function buyerGainMinor(buyer: CashflowMarketCard, card: CashflowDealCard): number {
  const sells = buyer.sells;
  if (!sells || !card.symbol) return 0;
  if (!(sells.symbols ?? [sells.family]).includes(card.symbol)) return 0;
  const price = (card.depositMinor ?? 0) + (card.mortgageMinor ?? 0);
  if (sells.plusPercent !== undefined) return Math.round((price * sells.plusPercent) / 100);
  if (sells.plusMinor !== undefined) return sells.plusMinor;
  if (sells.priceMinor !== undefined) return sells.priceMinor - price;
  if (sells.pricePerUnitMinor !== undefined)
    return sells.pricePerUnitMinor * unitsOf(card.symbol) - price;
  return 0;
}

/** The return on the deposit of a property card (monthly cashflow per deposit); null for a card that is not one. */
const returnOf = (card: CashflowDealCard): number | null =>
  card.assetKind === 'investment' && (card.depositMinor ?? 0) > 0
    ? (card.cashflowMinor ?? 0) / (card.depositMinor as number)
    : null;

const meanOf = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Rounds `value` up to a whole number of `step`s. */
function ceil(value: number, step: number): number {
  return step > 0 ? Math.ceil(value / step) * step : value;
}

export function paramPolicy(
  id: string,
  label: string,
  description: string,
  overrides: Partial<PolicyParams> = {},
): Policy {
  const params: PolicyParams = { ...POLICY_DEFAULTS, ...overrides };

  /** The knobs as they apply right now: loosened when a rival leads, tightened when this player does (a table only). */
  function effective(view: PolicyView): {
    minMonthlyReturn: number;
    loanCoverage: number;
    reserveMinor: number;
  } {
    let { minMonthlyReturn, loanCoverage, reserveMinor } = params;
    // counting cards: pickier while the good cards are still to come, easier once they are gone
    if (params.countReturnFactor !== 0 && view.deck?.offeredDeck) {
      const deck = view.deck.offeredDeck;
      if (deck === 'dealSmall' || deck === 'dealBig') {
        const all = (view.books.gameSet?.decks?.[deck] ?? []) as CashflowDealCard[];
        const rest = view.deck.remaining[deck];
        const meanAll = meanOf(all.flatMap((c) => returnOf(c) ?? []));
        const meanRest = meanOf(rest.flatMap((c) => returnOf(c) ?? []));
        if (meanAll && meanRest) {
          const richness = Math.min(1.5, Math.max(0.5, meanRest / meanAll));
          minMonthlyReturn *= Math.pow(richness, params.countReturnFactor);
        }
      }
    }
    const table = view.table;
    if (table) {
      const behind = table.leaderCoverage - table.myCoverage;
      const adjust =
        params.catchUp && behind >= params.catchUp.gap
          ? params.catchUp
          : params.protectLead && -behind >= params.protectLead.gap
            ? params.protectLead
            : null;
      if (adjust) {
        minMonthlyReturn *= adjust.minMonthlyReturnFactor;
        loanCoverage *= adjust.loanCoverageFactor;
        reserveMinor = Math.round(reserveMinor * adjust.reserveFactor);
      }
    }
    return { minMonthlyReturn, loanCoverage, reserveMinor };
  }

  function dealInvestment(view: PolicyView, card: CashflowDealCard): DealChoice {
    if (!params.buyProperties) return { buy: false };
    const { minMonthlyReturn, loanCoverage, reserveMinor } = effective(view);
    const deposit = card.depositMinor ?? 0;
    if (params.speculate && view.deck && deposit > 0 && view.cashMinor - deposit >= reserveMinor) {
      const buyers = view.deck.remaining.market.filter((m) => buyerGainMinor(m, card) > 0);
      if (buyers.length > 0) {
        const wait = view.deck.remaining.market.length / (buyers.length + 1);
        const gain = buyers.reduce((sum, m) => sum + buyerGainMinor(m, card), 0) / buyers.length;
        if (
          wait <= params.speculate.maxWaitDraws &&
          gain / deposit >= params.speculate.minEvRatio
        ) {
          return { buy: true };
        }
      }
    }
    const cashflow = card.cashflowMinor ?? 0;
    if (cashflow <= 0 || deposit <= 0) {
      // a business bought outright (no deposit asked) or a card that pays nothing
      return cashflow > 0 && deposit === 0 ? { buy: true } : { buy: false };
    }
    if (cashflow / deposit < minMonthlyReturn) return { buy: false };
    if (view.cashMinor - deposit >= reserveMinor) return { buy: true };
    if (params.loans === 'never') return { buy: false };
    // borrow the shortfall (rounded up to the loan step): worth it when the card pays well above the interest
    const shortfall = deposit + reserveMinor - view.cashMinor;
    const loan = ceil(shortfall, view.loanStepMinor);
    const interest = ((view.bankLoanMinor + loan) * view.loanInterestPercent) / 100;
    const interestAlready = (view.bankLoanMinor * view.loanInterestPercent) / 100;
    const addedInterest = interest - interestAlready;
    return cashflow >= loanCoverage * addedInterest ? { buy: true } : { buy: false };
  }

  function doodad(_view: PolicyView, card: CashflowDoodadCard): 'pay' | 'pass' {
    return params.skipDoodadsAboveMinor !== null && card.costMinor > params.skipDoodadsAboveMinor
      ? 'pass'
      : 'pay';
  }

  function dealShare(view: PolicyView, card: CashflowDealCard): DealChoice {
    // counting cards: a share is bought for a sale that is already in the pile - a card of the same ticker at a much higher price
    if (params.countShares && view.deck) {
      const count = params.countShares;
      const price = card.priceMinor ?? 0;
      if (price <= 0) return { buy: false };
      const pile = view.deck.remaining.dealSmall;
      const better = pile.filter(
        (c) =>
          c.assetKind === 'share' &&
          c.symbol === card.symbol &&
          (c.priceMinor ?? 0) >= price * count.minGain,
      );
      if (better.length === 0) return { buy: false };
      if (pile.length / (better.length + 1) > count.maxWaitDraws) return { buy: false };
      const budget = Math.max(0, view.cashMinor - params.reserveMinor) * count.maxLotShare;
      const quantity = Math.min(card.quantity ?? Infinity, Math.floor(budget / price));
      return quantity >= 1 ? { buy: true, quantity } : { buy: false };
    }
    if (!params.shares) return { buy: false };
    const price = card.priceMinor ?? 0;
    if (price <= 0 || price > params.shares.buyBelowMinor) return { buy: false };
    const budget = Math.max(0, view.cashMinor - params.reserveMinor) * params.shares.maxLotShare;
    const quantity = Math.min(card.quantity ?? Infinity, Math.floor(budget / price));
    return quantity >= 1 ? { buy: true, quantity } : { buy: false };
  }

  function dealAsset(view: PolicyView, card: CashflowDealCard): DealChoice {
    const cost = card.costMinor ?? 0;
    const affordable = view.cashMinor - cost >= params.reserveMinor;
    if (card.recurring) return params.buyMlm && affordable ? { buy: true } : { buy: false };
    return params.buyGambles && affordable ? { buy: true } : { buy: false };
  }

  function deal(view: PolicyView, card: CashflowDealCard): DealChoice {
    if (card.assetKind === 'investment') return dealInvestment(view, card);
    if (card.assetKind === 'share') return dealShare(view, card);
    return dealAsset(view, card);
  }

  return {
    id,
    label,
    description,
    params: params as unknown as Record<string, unknown>,
    dice: () => (params.charityTwoDice ? 2 : 1),
    doodad,
    pile(view: PolicyView, random: () => number): Pile {
      // counting cards: the pile whose remaining cards this strategy would buy most often (and can afford)
      if (params.pileByCount && view.deck) {
        const share = (pile: 'dealSmall' | 'dealBig'): number => {
          const rest = view.deck!.remaining[pile];
          if (rest.length === 0) return 0;
          let good = 0;
          for (const card of rest) {
            const asked: PolicyView = { ...view, deck: { ...view.deck!, offeredDeck: pile } };
            if (deal(asked, card).buy) good += 1;
          }
          return good / rest.length;
        };
        const small = share('dealSmall');
        const big = share('dealBig');
        if (Math.abs(big - small) >= 0.03) return big > small ? 'dealBig' : 'dealSmall';
      }
      if (params.bigDealFromCashMinor === null) return 'dealSmall';
      if (params.bigDealFromCashMinor <= 0) return 'dealBig';
      // a little randomness would hide the rule; the pile follows the cash
      void random;
      return view.cashMinor >= params.bigDealFromCashMinor ? 'dealBig' : 'dealSmall';
    },
    deal,
    maintain(view): HouseMove[] {
      const moves: HouseMove[] = [];
      const { books } = view;

      // stocks: sell what stands at or above the target
      const sellAbove = params.countShares?.sellAboveMinor ?? params.shares?.sellAboveMinor;
      if (sellAbove !== undefined) {
        for (const share of books.shares) {
          if (share.quantity > 0 && share.priceMinor >= sellAbove) {
            moves.push({ kind: 'sell', input: { title: share.tag } });
          }
        }
      }

      // a market buyer's offer for a property or for gold
      if (params.sellWhenProfitMonths !== null) {
        for (const offer of books.state.marketOffers ?? []) {
          const position = books.investments.find((investment) => investment.tag === offer.title);
          if (position) {
            const project = books.growProjects.find((candidate) => candidate.title === offer.title);
            const cashflow = project?.cashflowMinor ?? 0;
            const profit = offer.salePriceMinor - position.amountMinor - position.depositMinor;
            if (profit > 0 && profit >= params.sellWhenProfitMonths * Math.max(cashflow, 1)) {
              moves.push({ kind: 'sell', input: { title: offer.title } });
            }
          } else if (offer.pricePerCoinMinor !== undefined) {
            const asset = books.assets.find((candidate) => candidate.tag === offer.title);
            const deal = (books.state.assetDeals ?? []).find(
              (candidate) => candidate.title === offer.title && candidate.stage === 'owned',
            );
            if (
              asset &&
              deal &&
              deal.coins > 0 &&
              offer.pricePerCoinMinor * deal.coins > asset.amountMinor
            ) {
              moves.push({ kind: 'sell', input: { title: offer.title } });
            }
          }
        }
      }

      // the bank, paid back in whole steps while the cash allows
      if (params.repayLoans && view.bankLoanMinor > 0 && view.loanStepMinor > 0) {
        const spare = view.cashMinor - params.reserveMinor;
        const steps = Math.min(
          Math.floor(spare / view.loanStepMinor),
          Math.floor(view.bankLoanMinor / view.loanStepMinor),
        );
        if (steps > 0) moves.push({ kind: 'repay', amountMinor: steps * view.loanStepMinor });
      }
      return moves;
    },
  };
}

/** A strategy as plain data - what the lab hands to its workers and writes into its report. */
export interface PolicySpec {
  id: string;
  label: string;
  description: string;
  overrides: Partial<PolicyParams>;
}

export function policyFromSpec(spec: PolicySpec): Policy {
  return paramPolicy(spec.id, spec.label, spec.description, spec.overrides);
}

/** The reference strategies. Their order is the order of the report. */
export const PRESET_SPECS: PolicySpec[] = [
  {
    id: 'never-buy',
    label: 'Never invests',
    description:
      'Pays every Doodad, passes every deal. The salary alone: what the rat race is without investing.',
    overrides: { buyProperties: false, charityTwoDice: false },
  },
  {
    id: 'cash-properties',
    label: 'Properties from cash',
    description:
      'Buys any property it can pay the deposit for out of cash - no loans, no reserve, small deals only.',
    overrides: {},
  },
  {
    id: 'picky-properties',
    label: 'Picky properties',
    description:
      'Only properties returning at least 3% a month on the deposit, with a 2.000 reserve kept; small deals.',
    overrides: { minMonthlyReturn: 0.03, reserveMinor: 200000 },
  },
  {
    id: 'big-deals-when-rich',
    label: 'Small first, Big when rich',
    description:
      'Draws Small Deals until cash reaches 20.000, then Big Deals; buys any property the cash pays for, keeps 1.000.',
    overrides: { reserveMinor: 100000, bigDealFromCashMinor: 2000000 },
  },
  {
    id: 'bridge-loans',
    label: 'Borrow when it pays',
    description:
      'Borrows the shortfall when a property pays at least 1,5 times the loan interest it adds; repays when it can.',
    overrides: { minMonthlyReturn: 0.02, reserveMinor: 100000, loans: 'bridge', repayLoans: true },
  },
  {
    id: 'leveraged-big',
    label: 'Leveraged, Big Deals',
    description:
      'Aims at Big Deals from the start and borrows whenever the property pays at least the interest.',
    overrides: {
      minMonthlyReturn: 0.02,
      reserveMinor: 50000,
      loans: 'bridge',
      loanCoverage: 1,
      bigDealFromCashMinor: 0,
    },
  },
  {
    id: 'mlm-then-properties',
    label: 'Marketing first, then properties',
    description:
      'Buys every Multi-Level-Marketing card it can afford (the best card on average), then properties from cash.',
    overrides: { buyMlm: true, reserveMinor: 100000, minMonthlyReturn: 0.01 },
  },
  {
    id: 'stocks-for-deposits',
    label: 'Trade stocks for deposits',
    description:
      'Buys stocks at 10 or less and sells at 25 or more to raise deposit money, then buys properties.',
    overrides: {
      reserveMinor: 100000,
      shares: { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.5 },
    },
  },
  {
    id: 'all-rounder',
    label: 'All-rounder',
    description:
      'Properties above 2% a month with a reserve, loans only when well covered, Multi-Level-Marketing, stock trading, selling to generous buyers, Big Deals once cash allows.',
    overrides: {
      minMonthlyReturn: 0.02,
      reserveMinor: 150000,
      loans: 'bridge',
      loanCoverage: 2,
      bigDealFromCashMinor: 3000000,
      buyMlm: true,
      shares: { buyBelowMinor: 1000, sellAboveMinor: 2500, maxLotShare: 0.4 },
      sellWhenProfitMonths: 24,
      repayLoans: true,
    },
  },
];

export const PRESET_POLICIES: Policy[] = PRESET_SPECS.map(policyFromSpec);
