import type { OpportunityCard } from './cashflow-game/opportunity-deck';

/**
 * The balance of the Opportunity cards on Medium (JFK, 2026-10-26): what the simulation found the numbers of the deck sketch need so
 * that a good strategy can reach financial independence. The cards in `cashflow-opportunity-cards.ts` stay as the sketch wrote them;
 * these knobs are applied on top, in one place, so the effect of every change can be read and measured again.
 */
export interface OpportunityTuning {
  /** Cards the sketch calls side hustles that are really businesses of their own: they do not take the player's evenings. */
  notHustles: string[];
  /** The monthly cash flow of a card, times this, by what kind of card it is. */
  cashflowFactor: { hustle: number; business: number; property: number };
  /** Rent of every property, more by this share (the cash flow rises by the same amount). */
  rentBoostPercent: number;
  /** What a unit of a share pays every month, times this. */
  dividendFactor: number;
  /** A card that pays every month pays at least this share of what it costs (a share: of its price) - in percent a month. */
  minMonthlyYieldPercent: number;
  /** Single cards, last: any field of the card replaced. */
  byId: Record<string, Partial<OpportunityCard>>;
}

export const OPPORTUNITY_TUNING: OpportunityTuning = {
  notHustles: ['P15', 'P19', 'P20', 'P21', 'P22', 'P23', 'P24', 'P26', 'P27', 'P29'],
  cashflowFactor: { hustle: 1.6, business: 2.6, property: 1.8 },
  rentBoostPercent: 300,
  dividendFactor: 13,
  minMonthlyYieldPercent: 1.5,
  // gold and wine are kept at home: what the sketch charged for the safe deposit box took more than they brought (JFK, 2026-10-26)
  byId: {
    P12: { monthlyCostMinor: 0, note: 'Kept in a safe at home: no monthly cost.' },
    P13: { monthlyCostMinor: 0 },
  },
};

const scale = (value: number | undefined, factor: number) =>
  value === undefined ? undefined : Math.round(value * factor);

/** The cards with the tuning applied (a copy: the cards of the sketch are never changed). */
export function tuneOpportunityCards(
  cards: readonly OpportunityCard[],
  tuning: OpportunityTuning = OPPORTUNITY_TUNING,
): OpportunityCard[] {
  return cards.map((source) => {
    const card: OpportunityCard = JSON.parse(JSON.stringify(source)) as OpportunityCard;
    if (tuning.notHustles.includes(card.id)) delete card.sideHustle;
    if (card.growType !== 'income-growth') return { ...card, ...tuning.byId[card.id] };
    const factor = card.property
      ? tuning.cashflowFactor.property
      : card.sideHustle
        ? tuning.cashflowFactor.hustle
        : tuning.cashflowFactor.business;
    if (card.share) {
      card.share.dividendMonthPerUnitMinor = Math.round(
        card.share.dividendMonthPerUnitMinor * tuning.dividendFactor,
      );
      card.share.yieldYearPercent =
        Math.round(card.share.yieldYearPercent * tuning.dividendFactor * 10) / 10;
    } else if (card.property) {
      const boost = Math.round((card.property.rentMonthMinor * tuning.rentBoostPercent) / 100);
      card.property.rentMonthMinor += boost;
      // a property that costs money every month costs less (the rent rose), one that pays pays more
      const base = card.cashflowMinor ?? 0;
      card.cashflowMinor = Math.round(base > 0 ? base * factor : base * 0.5) + boost;
    } else {
      card.cashflowMinor = scale(card.cashflowMinor, factor);
      for (const band of card.dice ?? []) {
        band.value.cashflowMinor = scale(band.value.cashflowMinor, factor);
      }
    }
    if (card.cashflowMinor === undefined) delete card.cashflowMinor;
    // whatever pays every month pays a fair share of what it costs
    const floor = tuning.minMonthlyYieldPercent / 100;
    if (card.share && card.share.dividendMonthPerUnitMinor > 0) {
      const least = Math.round(card.share.unitPriceMinor * floor);
      if (card.share.dividendMonthPerUnitMinor < least) {
        card.share.dividendMonthPerUnitMinor = least;
        card.share.yieldYearPercent = Math.round(tuning.minMonthlyYieldPercent * 12 * 10) / 10;
      }
    } else if (!card.share && !card.property && (card.cashflowMinor ?? 0) > 0 && card.costMinor) {
      card.cashflowMinor = Math.max(card.cashflowMinor!, Math.round(card.costMinor * floor));
    }
    return { ...card, ...tuning.byId[card.id] };
  });
}
