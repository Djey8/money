import type { CashflowDealCard } from '../types';
import type { DealChoice, HouseMove, Pile, Policy, PolicyParams, PolicyView } from './policy';

/**
 * The strategies the lab plays (todo/cashflow-game-analysis.md, E1/E2): one parametrised family - how picky to be about
 * a property's return, how much cash to keep, whether to borrow, whether to trade stocks, when to sell to a buyer - and a
 * handful of named presets that tell a story. The lab's search varies the knobs; the presets are the readable reference
 * points the knowledge base talks about.
 */

const DEFAULTS: PolicyParams = {
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
};

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
  const params: PolicyParams = { ...DEFAULTS, ...overrides };

  function dealInvestment(view: PolicyView, card: CashflowDealCard): DealChoice {
    if (!params.buyProperties) return { buy: false };
    const deposit = card.depositMinor ?? 0;
    const cashflow = card.cashflowMinor ?? 0;
    if (cashflow <= 0 || deposit <= 0) {
      // a business bought outright (no deposit asked) or a card that pays nothing
      return cashflow > 0 && deposit === 0 ? { buy: true } : { buy: false };
    }
    if (cashflow / deposit < params.minMonthlyReturn) return { buy: false };
    if (view.cashMinor - deposit >= params.reserveMinor) return { buy: true };
    if (params.loans === 'never') return { buy: false };
    // borrow the shortfall (rounded up to the loan step): worth it when the card pays well above the interest
    const shortfall = deposit + params.reserveMinor - view.cashMinor;
    const loan = ceil(shortfall, view.loanStepMinor);
    const interest = ((view.bankLoanMinor + loan) * view.loanInterestPercent) / 100;
    const interestAlready = (view.bankLoanMinor * view.loanInterestPercent) / 100;
    const addedInterest = interest - interestAlready;
    return cashflow >= params.loanCoverage * addedInterest ? { buy: true } : { buy: false };
  }

  function dealShare(view: PolicyView, card: CashflowDealCard): DealChoice {
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

  return {
    id,
    label,
    description,
    params: params as unknown as Record<string, unknown>,
    dice: () => (params.charityTwoDice ? 2 : 1),
    pile(view: PolicyView, random: () => number): Pile {
      if (params.bigDealFromCashMinor === null) return 'dealSmall';
      if (params.bigDealFromCashMinor <= 0) return 'dealBig';
      // a little randomness would hide the rule; the pile follows the cash
      void random;
      return view.cashMinor >= params.bigDealFromCashMinor ? 'dealBig' : 'dealSmall';
    },
    deal(view, card) {
      if (card.assetKind === 'investment') return dealInvestment(view, card);
      if (card.assetKind === 'share') return dealShare(view, card);
      return dealAsset(view, card);
    },
    maintain(view): HouseMove[] {
      const moves: HouseMove[] = [];
      const { books } = view;

      // stocks: sell what stands at or above the target
      if (params.shares) {
        for (const share of books.shares) {
          if (share.quantity > 0 && share.priceMinor >= params.shares.sellAboveMinor) {
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
