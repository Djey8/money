import {
  HARVEST_GROUPS,
  MARKET_DRIFT_PERCENT,
  marketOfTag,
  type HarvestCard,
} from './harvest-deck';
import type { OpportunityCard } from './opportunity-deck';
import { groupsOf, matchesTarget } from './harvest';
import type { OpportunityHolding } from './opportunity';

/**
 * The words the cards of the Dreamfund game share (JFK, 2026-10-26): every Opportunity card is a share, an investment or an asset and
 * has keywords - its market, its group (business, side hustle, saving, property). A Harvest card names the same words, so a player sees
 * at once whether it is about something they own. Pure: cards and holdings in, words out.
 */

export type AssetKind = 'share' | 'investment' | 'asset' | 'saving';

/** What the card becomes in Grow: a share, an investment (property, loan), an asset - or a saving (a smaller expense). */
export function assetKindOf(card: OpportunityCard): AssetKind {
  if (card.growType !== 'income-growth') return 'saving';
  if (card.share || card.kind === 'share') return 'share';
  if (card.property || card.loan || card.kind === 'investment') return 'investment';
  return 'asset';
}

const KEYWORD_GROUPS = new Set([...Object.keys(HARVEST_GROUPS), 'PROPERTY']);

/** The keywords of an Opportunity card: its market, then its groups. */
export function keywordsOfCard(card: OpportunityCard): string[] {
  const market = marketOfTag(card.market?.tag);
  const out: string[] = [];
  if (market && market in MARKET_DRIFT_PERCENT) out.push(market);
  for (const group of groupsOf(card)) {
    if (group !== card.id && KEYWORD_GROUPS.has(group)) out.push(group);
  }
  return [...new Set(out)];
}

/** What a Harvest card is about: the markets, groups and cards it names, and the things it does to everybody. */
export interface HarvestTopics {
  /** Every market, group, ticker or card id the operations name. */
  targets: string[];
  /** The card is about all markets (a recovery, a window open for everything). */
  allMarkets: boolean;
  general: GeneralEffect[];
}

export type GeneralEffect =
  | { kind: 'expensesPercent'; percent: number }
  | { kind: 'expensesAdd'; minor: number; paydays: number }
  | { kind: 'mortgageRate'; pp: number }
  | { kind: 'rentPercent'; percent: number }
  | { kind: 'savingsRate'; factor: number }
  | { kind: 'recover' };

export function harvestTopics(card: HarvestCard): HarvestTopics {
  const targets = new Set<string>();
  const general: GeneralEffect[] = [];
  let allMarkets = false;
  for (const op of card.ops) {
    switch (op.op) {
      case 'index':
      case 'nextPaydayIndex':
      case 'payoutFactor':
        Object.keys(op.factors).forEach((tag) => targets.add(tag));
        break;
      case 'indexDice':
        op.markets.forEach((tag) => targets.add(tag));
        break;
      case 'recover':
        allMarkets = true;
        general.push({ kind: 'recover' });
        break;
      case 'sellWindow':
        if (op.markets === 'ALL') allMarkets = true;
        else op.markets.forEach((tag) => targets.add(tag));
        break;
      case 'buyer':
        op.buyer.targets.forEach((tag) => targets.add(tag));
        break;
      case 'cashflowFactor':
      case 'cashflowDice':
        op.groups.forEach((tag) => targets.add(tag));
        break;
      case 'specialPayout':
        Object.keys(op.perUnitMinor).forEach((tag) => targets.add(tag));
        break;
      case 'split':
        targets.add(op.tag);
        break;
      case 'expensesPercent':
        general.push({ kind: 'expensesPercent', percent: op.percent });
        break;
      case 'expensesAdd':
        general.push({ kind: 'expensesAdd', minor: op.minor, paydays: op.paydays });
        break;
      case 'rentPercent':
        targets.add('PROPERTY');
        general.push({ kind: 'rentPercent', percent: op.percent });
        break;
      case 'savingsRate':
        targets.add('SAVINGS');
        general.push({ kind: 'savingsRate', factor: op.factor });
        break;
      case 'mortgageRate':
        general.push({ kind: 'mortgageRate', pp: op.pp });
        break;
      case 'holderDice':
        op.targets.forEach((tag) => targets.add(tag));
        break;
      case 'ladder':
        op.ladder.targets.forEach((tag) => targets.add(tag));
        break;
      case 'penny':
        targets.add(op.ticker);
        break;
      case 'trapReveal':
        (op.tickers ?? []).forEach((tag) => targets.add(tag));
        (op.cardIds ?? []).forEach((tag) => targets.add(tag));
        break;
    }
  }
  return { targets: [...targets], allMarkets, general };
}

/** Whether the holding is one the card speaks of. */
export function isInvolved(
  topics: HarvestTopics,
  card: OpportunityCard,
  holding: OpportunityHolding,
): boolean {
  if (topics.allMarkets && holding.marketTag) return true;
  return topics.targets.some((target) => matchesTarget(card, holding, target));
}

/** What the player owns that a Harvest card speaks of: each holding with its kind, for the badges on the card. */
export function involvedHoldings(
  topics: HarvestTopics,
  holdings: readonly OpportunityHolding[],
  cards: readonly OpportunityCard[],
): { holding: OpportunityHolding; card: OpportunityCard; kind: AssetKind }[] {
  const out: { holding: OpportunityHolding; card: OpportunityCard; kind: AssetKind }[] = [];
  for (const holding of holdings) {
    if (holding.ended) continue;
    const card = cards.find((candidate) => candidate.id === holding.cardId);
    if (card && isInvolved(topics, card, holding)) {
      out.push({ holding, card, kind: assetKindOf(card) });
    }
  }
  return out;
}
