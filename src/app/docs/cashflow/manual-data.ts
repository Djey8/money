import {
  type CashflowDealCard,
  type CashflowDoodadCard,
  type CashflowGameSet,
  type CashflowMarketCard,
  type CashflowProfession,
} from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../../shared/cashflow-content';

/**
 * The numbers in the Cashflow game manual are not typed in: they are read from the real card catalog
 * (professions, Small / Big Deal, Doodads, Market), so the manual can never drift from the game
 * (JFK, 2026-10-04). Every function here is pure - the page supplies the formatting and the
 * translated labels.
 */
export interface ManualTable {
  head: string[];
  rows: string[][];
  /** A line under the table, e.g. how a column is worked out. */
  note?: string;
}

export interface ManualContext {
  /** The table's own words (column heads, row names) in the manual's language. */
  labels: Record<string, string>;
  money(minor: number): string;
  percent(ratio: number): string;
  number(value: number): string;
  professionTitle(profession: CashflowProfession): string;
  groupName(group: string): string;
  familyName(family: string): string;
  /** What the strategy lab measured (assets/i18n/cashflow-manual/strategy-lab.json); null until it is loaded or when absent. */
  lab?: LabResults | null;
  /** What the card lab measured (assets/i18n/cashflow-manual/card-lab.json); null until it is loaded or when absent. */
  cardLab?: CardLab | null;
  /** A card's name in the manual's language (its title, and its ticker when that tells it apart). */
  cardName?(cardId: string): string;
}

// -- The card lab results (scripts/card-lab.js) -----------------------------------------------------

export interface CardLabCard {
  deck: 'dealSmall' | 'dealBig' | 'doodad' | 'market';
  applied: number;
  positions: number;
  /** The change in the chance to escape the rat race when the card is taken: 0.05 is five points. */
  escapeEffect: number | null;
  escapeError: number | null;
  bankruptEffect: number | null;
  rollsSaved: number | null;
  helps: number | null;
  hurts: number | null;
  early: number | null;
  late: number | null;
  fromCash: number | null;
  fromCashApplied: number;
  /** Median rolls to escape saved when the card is bought from cash (without the card minus with it). */
  fromCashRolls: number | null;
  withLoan: number | null;
  withLoanApplied: number;
  /** The same card in built-up games (the best strategy, deep into the game, rich in properties). */
  builders: {
    applied: number;
    positions: number;
    escapeEffect: number | null;
    bankruptEffect: number | null;
    rollsSaved: number | null;
    fromCash: number | null;
    fromCashApplied: number;
    fromCashRolls: number | null;
  } | null;
  /** A share card when the shares are traded afterwards (sold when the price is high). */
  traded: {
    applied: number;
    escapeEffect: number | null;
    bankruptEffect: number | null;
    rollsSaved: number | null;
  } | null;
}

export interface CardLabMilestone {
  professionId: string;
  policyId: string;
  games: number;
  escapeRate: number;
  marks: Record<
    string,
    {
      escapedP10: number | null;
      escapedP50: number | null;
      escapedP90: number | null;
      allP50: number | null;
      still: number;
    }
  >;
}

export interface CardLab {
  meta: {
    positions: number;
    rollouts: number;
    gamesPerProfession: number;
    stages: number[];
    milestones: number[];
    policy: string;
  };
  cards: Record<string, CardLabCard>;
  dice: {
    id: string;
    costMinor: number;
    winChance: number;
    payoutMinor: number | null;
    coins: number | null;
    recurring: boolean;
  }[];
  milestones: CardLabMilestone[];
  /** Per "policy|roll": four bands of progress (under 20%, 20-50%, 50-80%, 80% and more of the expenses covered). */
  progressBands: Record<string, { games: number; escaped: number; bankrupt: number }[]>;
  ruin: {
    games: number;
    bankrupt: number;
    /** "kind|card id" -> how many bankrupt games had it among their last three decisions. */
    lastCards: Record<string, number>;
    lastKinds: Record<string, number>;
    children: Record<string, number>;
    landings: Record<string, number>;
  };
}

// -- The strategy lab results (scripts/strategy-lab.js) -------------------------------------------

export interface LabSpread {
  min: number;
  p10: number;
  p25: number;
  median: number;
  mean: number;
  p75: number;
  p90: number;
  max: number;
}

export interface LabStats {
  games: number;
  escapeRate: number;
  bankruptRate: number;
  timeoutRate: number;
  turnsToEscape: LabSpread | null;
  monthsToEscape: LabSpread | null;
  passiveIncomeAtEscapeMinor: LabSpread | null;
  monthlyCashflowAtEscapeMinor: LabSpread | null;
  peakPassiveIncomeMinor: LabSpread | null;
}

export interface LabResults {
  meta: { rulesDigest: string; gamesPerGroup: number; maxTurns: number; generatedAt: string };
  policies: { id: string; label: string; description: string }[];
  professions: {
    setId: string;
    id: string;
    title: string;
    salaryMinor: number;
    expensesMinor: number;
  }[];
  results: Record<string, Record<string, LabStats>>;
}

export const MANUAL_DATA_IDS = [
  'professions',
  'escape',
  'smallProperties',
  'bigProperties',
  'loanProof',
  'shares',
  'doodads',
  'pileOdds',
  'marketKinds',
  'marketOdds',
  'labStrategies',
  'labMatrix',
  'labProfessions',
  'labCeiling',
  'cardLabSmall',
  'cardLabBig',
  'cardLabDoodads',
  'cardLabMarket',
  'cardLabDice',
  'cardLabMilestones',
  'cardLabBands',
  'cardLabRuin',
] as const;
export type ManualDataId = (typeof MANUAL_DATA_IDS)[number];

const classicSet = (): CashflowGameSet => CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
const playableSets = (): CashflowGameSet[] =>
  CASHFLOW_GAME_SETS.filter((set) => set.id === 'cashflow' || set.id === 'custom-jfk');

const familyOf = (symbol: string): string => symbol.replace(/\d+$/, '');
const investments = (deck: CashflowDealCard[] = []): CashflowDealCard[] =>
  deck.filter((card) => card.assetKind === 'investment');
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const average = (values: number[]): number => (values.length ? sum(values) / values.length : 0);

/** What a property pays every month per unit of deposit - 0.10 means 10% a month. */
const monthlyYield = (card: CashflowDealCard): number =>
  card.depositMinor ? (card.cashflowMinor ?? 0) / card.depositMinor : 0;

function rangeText(values: number[], format: (value: number) => string): string {
  if (!values.length) return '-';
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? format(low) : `${format(low)} – ${format(high)}`;
}

function totalExpenses(profession: CashflowProfession): number {
  return sum(profession.expenses.map((line) => line.amountMinor));
}

function groupByFamily(cards: CashflowDealCard[]): Map<string, CashflowDealCard[]> {
  const groups = new Map<string, CashflowDealCard[]>();
  for (const card of cards) {
    const family = familyOf(card.symbol ?? card.title);
    groups.set(family, [...(groups.get(family) ?? []), card]);
  }
  return groups;
}

function propertyRows(cards: CashflowDealCard[], ctx: ManualContext): string[][] {
  return [...groupByFamily(cards).entries()].map(([family, group]) => {
    const paying = group.filter((card) => (card.cashflowMinor ?? 0) > 0 && card.depositMinor);
    return [
      ctx.familyName(family),
      String(group.length),
      rangeText(
        group.map((card) => (card.depositMinor ?? 0) + (card.mortgageMinor ?? 0)),
        ctx.money,
      ),
      rangeText(
        group.map((card) => card.depositMinor ?? 0),
        ctx.money,
      ),
      rangeText(
        group.map((card) => card.cashflowMinor ?? 0),
        ctx.money,
      ),
      rangeText(
        paying.map((card) => monthlyYield(card) * 12),
        ctx.percent,
      ),
      String(group.length - paying.length),
    ];
  });
}

function propertyHead(ctx: ManualContext): string[] {
  const l = ctx.labels;
  return [
    l['colType'],
    l['colCards'],
    l['colPrice'],
    l['colDeposit'],
    l['colCashflow'],
    l['colReturn'],
    l['colNoCashflow'],
  ];
}

function professionsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const rows = playableSets().flatMap((set) =>
    set.professions.map((profession) => {
      const expenses = totalExpenses(profession);
      const debts = sum((profession.starterKit?.liabilities ?? []).map((item) => item.amountMinor));
      return {
        cashflow: profession.salaryMinor - expenses,
        cells: [
          set.id === 'custom-jfk'
            ? `${ctx.professionTitle(profession)} (${l['customMark']})`
            : ctx.professionTitle(profession),
          ctx.money(profession.salaryMinor),
          ctx.money(expenses),
          ctx.money(profession.salaryMinor - expenses),
          ctx.money(profession.savingsMinor ?? 0),
          ctx.money(debts),
          ctx.money(profession.perChildExpenseMinor ?? 0),
        ],
      };
    }),
  );
  return {
    head: [
      l['colProfession'],
      l['colSalary'],
      l['colExpenses'],
      l['colCashflow'],
      l['colSavings'],
      l['colDebts'],
      l['colChild'],
    ],
    rows: rows.sort((a, b) => b.cashflow - a.cashflow).map((row) => row.cells),
    note: l['noteProfessions'],
  };
}

function escapeTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const set = classicSet();
  const small = investments(set.decks?.dealSmall).filter((card) => (card.cashflowMinor ?? 0) > 0);
  const big = investments(set.decks?.dealBig);
  const averageSmall = average(small.map((card) => card.cashflowMinor ?? 0));
  const averageBig = average(big.map((card) => card.cashflowMinor ?? 0));
  const rows = playableSets().flatMap((s) =>
    s.professions.map((profession) => {
      const needed = totalExpenses(profession);
      return {
        needed,
        cells: [
          ctx.professionTitle(profession),
          ctx.money(needed),
          ctx.number(Math.ceil(needed / averageSmall)),
          ctx.number(Math.ceil(needed / averageBig)),
        ],
      };
    }),
  );
  return {
    head: [l['colProfession'], l['colNeeded'], l['colSmallDeals'], l['colBigDeals']],
    rows: rows.sort((a, b) => a.needed - b.needed).map((row) => row.cells),
    note: l['noteEscape']
      .replace('{small}', ctx.money(Math.round(averageSmall)))
      .replace('{big}', ctx.money(Math.round(averageBig))),
  };
}

function smallPropertiesTable(ctx: ManualContext): ManualTable {
  return {
    head: propertyHead(ctx),
    rows: propertyRows(investments(classicSet().decks?.dealSmall), ctx),
    note: ctx.labels['noteReturn'],
  };
}

function bigPropertiesTable(ctx: ManualContext): ManualTable {
  return {
    head: propertyHead(ctx),
    rows: propertyRows(investments(classicSet().decks?.dealBig), ctx),
    note: ctx.labels['noteReturn'],
  };
}

function loanProofTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const set = classicSet();
  const all = [...investments(set.decks?.dealSmall), ...investments(set.decks?.dealBig)];
  const rows = [...groupByFamily(all).entries()].map(([family, group]) => {
    const good = group.filter((card) => monthlyYield(card) >= 0.1);
    return {
      share: good.length / group.length,
      cells: [
        ctx.familyName(family),
        `${good.length} / ${group.length}`,
        ctx.percent(Math.max(...group.map(monthlyYield))),
      ],
    };
  });
  return {
    head: [l['colType'], l['colPaysLoan'], l['colBestMonthly']],
    rows: rows.sort((a, b) => b.share - a.share).map((row) => row.cells),
    note: l['noteLoanProof'],
  };
}

function sharesTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const cards = (classicSet().decks?.dealSmall ?? []).filter((card) => card.assetKind === 'share');
  const tickers = [...new Set(cards.map((card) => card.symbol ?? card.title))];
  return {
    head: [l['colTicker'], l['colKind'], l['colPrices'], l['colTradingRange']],
    rows: tickers.map((ticker) => {
      const own = cards.filter((card) => (card.symbol ?? card.title) === ticker);
      const prices = own.map((card) => card.priceMinor ?? 0).sort((a, b) => a - b);
      return [
        ticker,
        own[0].securityKind === 'fund' ? l['kindFund'] : l['kindStock'],
        prices.map((price) => ctx.number(price / 100)).join(' / '),
        rangeText([own[0].rangeMinMinor ?? 0, own[0].rangeMaxMinor ?? 0], ctx.money),
      ];
    }),
  };
}

function doodadsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const deck: CashflowDoodadCard[] = classicSet().decks?.doodad ?? [];
  const groups = [...new Set(deck.map((card) => card.group ?? ''))];
  const rows = groups.map((group) => {
    const own = deck.filter((card) => (card.group ?? '') === group);
    return {
      average: average(own.map((card) => card.costMinor)),
      cells: [
        ctx.groupName(group),
        String(own.length),
        String(own.filter((card) => card.account === 'Smile').length),
        String(own.filter((card) => card.account === 'Splurge').length),
        ctx.money(Math.round(average(own.map((card) => card.costMinor)))),
        ctx.money(Math.max(...own.map((card) => card.costMinor))),
      ],
    };
  });
  const everyCard = average(deck.map((card) => card.costMinor));
  return {
    head: [l['colCategory'], l['colCards'], 'Smile', 'Splurge', l['colAverage'], l['colMost']],
    rows: rows.sort((a, b) => b.average - a.average).map((row) => row.cells),
    note: l['noteDoodads']
      .replace('{count}', String(deck.length))
      .replace('{average}', ctx.money(Math.round(everyCard))),
  };
}

function smallPileCategory(card: CashflowDealCard): string {
  if (card.assetKind === 'share') return 'shares';
  if (card.assetKind === 'investment')
    return familyOf(card.symbol ?? '') === 'ETW' ? 'condos' : 'houses';
  if (card.recurring) return 'mlm';
  if (card.successOn) return 'dice';
  return 'gold';
}

function pileOddsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const set = classicSet();
  const small = set.decks?.dealSmall ?? [];
  const big = set.decks?.dealBig ?? [];
  const rows: string[][] = [];
  const add = (pile: string, name: string, count: number, total: number) =>
    rows.push([pile, name, String(count), ctx.percent(count / total)]);

  const smallCounts = new Map<string, number>();
  for (const card of small) {
    const category = smallPileCategory(card);
    smallCounts.set(category, (smallCounts.get(category) ?? 0) + 1);
  }
  for (const [category, count] of smallCounts)
    add(l['pileSmall'], l[`cat_${category}`], count, small.length);

  const bigCounts = new Map<string, number>();
  for (const card of big) {
    const family = familyOf(card.symbol ?? '');
    const category = ['GP', 'AU', 'AWA'].includes(family) ? 'businesses' : family;
    bigCounts.set(category, (bigCounts.get(category) ?? 0) + 1);
  }
  for (const [category, count] of bigCounts) {
    add(
      l['pileBig'],
      category === 'businesses' ? l['cat_businesses'] : ctx.familyName(category),
      count,
      big.length,
    );
  }
  return { head: [l['colPile'], l['colCategory'], l['colCards'], l['colChance']], rows };
}

type MarketKind =
  'buyerEFH' | 'buyerMFH' | 'buyerETW' | 'buyerAPH' | 'buyerGOLD' | 'cost' | 'split' | 'boost';

function marketKindOf(card: CashflowMarketCard): MarketKind {
  if (card.sells) return `buyer${card.sells.family}` as MarketKind;
  if (card.pays) return 'cost';
  if (card.splits) return 'split';
  return 'boost';
}

function marketKindsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const deck = classicSet().decks?.market ?? [];
  const kinds = [...new Set(deck.map(marketKindOf))];
  return {
    head: [l['colMarketCard'], l['colCards'], l['colChance']],
    rows: kinds.map((kind) => {
      const count = deck.filter((card) => marketKindOf(card) === kind).length;
      return [l[`market_${kind}`], String(count), ctx.percent(count / deck.length)];
    }),
  };
}

/** What you own, and which Market cards can touch it. */
const MARKET_PROFILES = ['EFH', 'MFH', 'ETW', 'APH', 'DH', 'GOLD', 'SHARE'] as const;

function marketOddsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const deck = classicSet().decks?.market ?? [];
  const isProperty = (profile: string) => ['EFH', 'MFH', 'ETW', 'APH', 'DH'].includes(profile);
  const affects = (card: CashflowMarketCard, profile: string): boolean => {
    if (card.sells) return card.sells.family === profile;
    if (card.pays) return isProperty(profile);
    if (card.boost) return isProperty(profile);
    // A stock split card is for one ticker: it touches you when you hold that share.
    if (card.splits) return profile === 'SHARE' && card.splits.symbol === 'OK4U';
    return false;
  };
  return {
    head: [l['colYouOwn'], l['colMarketCards'], l['colChance']],
    rows: MARKET_PROFILES.map((profile) => {
      const count = deck.filter((card) => affects(card, profile)).length;
      return [l[`profile_${profile}`], String(count), ctx.percent(count / deck.length)];
    }),
    note: l['noteMarketOdds'],
  };
}

// -- Tables from the strategy lab ------------------------------------------------------------------

/** The better strategy first: it escapes more often, and escapes sooner. */
function byEscape(a: LabStats, b: LabStats): number {
  return (
    b.escapeRate - a.escapeRate ||
    (a.turnsToEscape?.median ?? Number.MAX_SAFE_INTEGER) -
      (b.turnsToEscape?.median ?? Number.MAX_SAFE_INTEGER)
  );
}

function labMissing(head: string[], ctx: ManualContext): ManualTable {
  return { head, rows: [[ctx.labels['labMissing'] ?? '-', ...head.slice(1).map(() => '-')]] };
}

/** A strategy name in the language of the manual (the lab English label when the manual has none). */
function policyName(ctx: ManualContext, id: string, fallback: string): string {
  return ctx.labels[`policy_${id}`] ?? fallback;
}

const dash = (value: number | undefined | null, format: (v: number) => string): string =>
  value === undefined || value === null || Number.isNaN(value) ? '-' : format(value);

function labStrategiesTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [
    l['colStrategy'],
    l['colEscapes'],
    l['colBankrupt'],
    l['colMedianRolls'],
    l['colMedianMonths'],
    l['colPassiveAtEscape'],
  ];
  const lab = ctx.lab;
  if (!lab) return labMissing(head, ctx);
  const mean = (values: number[]) =>
    values.length ? values.reduce((total, value) => total + value, 0) / values.length : undefined;
  const rows = lab.policies.map((policy) => {
    const groups = lab.professions.map((profession) => lab.results[profession.id][policy.id]);
    return {
      policy,
      escape: mean(groups.map((g) => g.escapeRate)) ?? 0,
      bankrupt: mean(groups.map((g) => g.bankruptRate)) ?? 0,
      rolls: mean(groups.flatMap((g) => (g.turnsToEscape ? [g.turnsToEscape.median] : []))),
      months: mean(groups.flatMap((g) => (g.monthsToEscape ? [g.monthsToEscape.median] : []))),
      passive: mean(
        groups.flatMap((g) =>
          g.passiveIncomeAtEscapeMinor ? [g.passiveIncomeAtEscapeMinor.median] : [],
        ),
      ),
    };
  });
  rows.sort((a, b) => b.escape - a.escape || (a.rolls ?? 1e9) - (b.rolls ?? 1e9));
  return {
    head,
    rows: rows.map((row) => [
      policyName(ctx, row.policy.id, row.policy.label),
      ctx.percent(row.escape),
      ctx.percent(row.bankrupt),
      dash(row.rolls, ctx.number),
      dash(row.months, ctx.number),
      dash(row.passive, ctx.money),
    ]),
    note: l['noteLab'],
  };
}

function labMatrixTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const lab = ctx.lab;
  const head = [
    l['colProfession'],
    ...(lab ? lab.policies.map((p) => policyName(ctx, p.id, p.label)) : ['-']),
  ];
  if (!lab) return labMissing(head, ctx);
  return {
    head,
    rows: lab.professions.map((profession) => [
      profession.title,
      ...lab.policies.map((policy) =>
        ctx.percent(lab.results[profession.id][policy.id].escapeRate),
      ),
    ]),
    note: l['noteLabMatrix'],
  };
}

function labProfessionsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [
    l['colProfession'],
    l['colBestStrategy'],
    l['colEscapes'],
    l['colFastest'],
    l['colMedianRolls'],
    l['colSlowest'],
    l['colPassiveAtEscape'],
    l['colWorstStrategy'],
    l['colEscapes'],
  ];
  const lab = ctx.lab;
  if (!lab) return labMissing(head, ctx);
  return {
    head,
    rows: lab.professions.map((profession) => {
      const group = lab.results[profession.id];
      const ranked = lab.policies
        .map((policy) => ({ policy, stats: group[policy.id] }))
        .sort((a, b) => byEscape(a.stats, b.stats));
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      const t = best.stats.turnsToEscape;
      return [
        profession.title,
        policyName(ctx, best.policy.id, best.policy.label),
        ctx.percent(best.stats.escapeRate),
        dash(t?.p10, ctx.number),
        dash(t?.median, ctx.number),
        dash(t?.p90, ctx.number),
        dash(best.stats.passiveIncomeAtEscapeMinor?.median, ctx.money),
        policyName(ctx, worst.policy.id, worst.policy.label),
        ctx.percent(worst.stats.escapeRate),
      ];
    }),
    note: l['noteLabProfessions'],
  };
}

function labCeilingTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [
    l['colProfession'],
    l['colStrategy'],
    l['colTypicalPeak'],
    l['colGoodPeak'],
    l['colBestPeak'],
    l['colCashflowAtEscape'],
  ];
  const lab = ctx.lab;
  if (!lab) return labMissing(head, ctx);
  return {
    head,
    rows: lab.professions.map((profession) => {
      const group = lab.results[profession.id];
      // the strategy that gets the most passive income onto the table, on average
      const top = lab.policies
        .map((policy) => ({ policy, stats: group[policy.id] }))
        .sort(
          (a, b) =>
            (b.stats.peakPassiveIncomeMinor?.mean ?? 0) -
            (a.stats.peakPassiveIncomeMinor?.mean ?? 0),
        )[0];
      const peak = top.stats.peakPassiveIncomeMinor;
      return [
        profession.title,
        policyName(ctx, top.policy.id, top.policy.label),
        dash(peak?.median, ctx.money),
        dash(peak?.p90, ctx.money),
        dash(peak?.max, ctx.money),
        dash(top.stats.monthlyCashflowAtEscapeMinor?.median, ctx.money),
      ];
    }),
    note: l['noteLabCeiling'],
  };
}

// -- Tables from the card lab ----------------------------------------------------------------------

const points = (effect: number | null | undefined): string => {
  if (effect === null || effect === undefined) return '-';
  const value = Math.round(effect * 1000) / 10;
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
};

function cardNumbers(card: CashflowDealCard, ctx: ManualContext): string {
  const bits: string[] = [];
  if (card.priceMinor !== undefined) bits.push(ctx.money(card.priceMinor));
  if (card.depositMinor !== undefined) {
    bits.push(`${ctx.money(card.depositMinor)} → +${ctx.money(card.cashflowMinor ?? 0)}`);
  }
  if (card.assetKind === 'asset' && card.costMinor !== undefined)
    bits.push(ctx.money(card.costMinor));
  return bits.join(', ');
}

/** Rolls saved when the card is bought from cash: in a typical game / in a built-up one. */
function rollsPair(stats: CardLabCard): string {
  const one = (value: number | null | undefined, applied: number): string =>
    value === null || value === undefined || applied < 3 ? '-' : String(Math.round(value));
  return `${one(stats.fromCashRolls, stats.fromCashApplied)} / ${one(stats.builders?.fromCashRolls, stats.builders?.fromCashApplied ?? 0)}`;
}

function cardNameOf(ctx: ManualContext, id: string, fallback: string): string {
  return ctx.cardName ? ctx.cardName(id) : fallback;
}

/** Every Deal of a pile, the one that helped most when bought first. */
function cardLabDealsTable(deck: 'dealSmall' | 'dealBig', ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [
    l['colCard'],
    l['colCardNumbers'],
    l['colFromCash'],
    l['colWithLoan'],
    l['colRollsSaved'],
    l['colTraded'],
  ];
  const lab = ctx.cardLab;
  if (!lab) return labMissing(head, ctx);
  const rows = (classicSet().decks?.[deck] ?? [])
    .map((card) => ({ card, stats: lab.cards[card.id] }))
    .filter((row) => row.stats && row.stats.applied > 0)
    .sort(
      (a, b) =>
        (b.stats.fromCash ?? b.stats.escapeEffect ?? -9) -
          (a.stats.fromCash ?? a.stats.escapeEffect ?? -9) ||
        (b.stats.escapeEffect ?? -9) - (a.stats.escapeEffect ?? -9),
    );
  return {
    head,
    rows: rows.map(({ card, stats }) => [
      cardNameOf(ctx, card.id, card.title),
      cardNumbers(card, ctx),
      stats.fromCashApplied >= 3 ? points(stats.fromCash) : '-',
      stats.withLoanApplied >= 3 ? points(stats.withLoan) : '-',
      rollsPair(stats),
      stats.traded && stats.traded.applied >= 3 ? points(stats.traded.escapeEffect) : '-',
    ]),
    note: l['noteCardLabDeals'],
  };
}

function cardLabDoodadsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [
    l['colCard'],
    l['colCost'],
    l['colEscapeEffect'],
    l['colBankruptEffect'],
    l['colEarly'],
    l['colLate'],
  ];
  const lab = ctx.cardLab;
  if (!lab) return labMissing(head, ctx);
  const rows = (classicSet().decks?.doodad ?? [])
    .map((card) => ({ card, stats: lab.cards[card.id] }))
    .filter((row) => row.stats)
    .sort((a, b) => (a.stats.escapeEffect ?? 0) - (b.stats.escapeEffect ?? 0));
  return {
    head,
    rows: rows.map(({ card, stats }) => [
      cardNameOf(ctx, card.id, card.title),
      ctx.money(card.costMinor),
      points(stats.escapeEffect),
      points(stats.bankruptEffect),
      points(stats.early),
      points(stats.late),
    ]),
    note: l['noteCardLabDoodads'],
  };
}

function cardLabMarketTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [l['colCard'], l['colAppliedIn'], l['colEscapeEffect'], l['colBankruptEffect']];
  const lab = ctx.cardLab;
  if (!lab) return labMissing(head, ctx);
  const rows = (classicSet().decks?.market ?? [])
    .map((card) => ({ card, stats: lab.cards[card.id] }))
    .filter((row) => row.stats && row.stats.applied > 0)
    .sort((a, b) => (b.stats.escapeEffect ?? 0) - (a.stats.escapeEffect ?? 0));
  return {
    head,
    rows: rows.map(({ card, stats }) => [
      cardNameOf(ctx, card.id, card.title),
      ctx.percent(stats.applied / Math.max(1, stats.positions)),
      points(stats.escapeEffect),
      points(stats.bankruptEffect),
    ]),
    note: l['noteCardLabMarket'],
  };
}

function cardLabDiceTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [
    l['colCard'],
    l['colCost'],
    l['colChance'],
    l['colPays'],
    l['colEscapeEffect'],
    l['colBankruptEffect'],
  ];
  const lab = ctx.cardLab;
  if (!lab) return labMissing(head, ctx);
  const rows = lab.dice
    .map((dice) => ({ dice, stats: lab.cards[dice.id] }))
    .sort((a, b) => (b.stats?.escapeEffect ?? -9) - (a.stats?.escapeEffect ?? -9));
  return {
    head,
    rows: rows.map(({ dice, stats }) => [
      cardNameOf(ctx, dice.id, dice.id),
      ctx.money(dice.costMinor),
      ctx.percent(dice.winChance),
      dice.payoutMinor
        ? `${ctx.money(dice.payoutMinor)}${dice.recurring ? ` ${l['perMonth'] ?? 'a month'}` : ''}`
        : dice.coins
          ? `${dice.coins} ${l['coins'] ?? 'coins'}`
          : '-',
      points(stats?.escapeEffect),
      points(stats?.bankruptEffect),
    ]),
    note: l['noteCardLabDice'],
  };
}

function cardLabMilestonesTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const lab = ctx.cardLab;
  const rolls = lab?.meta.milestones ?? [10, 20, 30, 40, 60];
  const head = [
    l['colProfession'],
    l['colEscapes'],
    ...rolls.map((roll) => `${l['colAtRoll'] ?? 'Roll'} ${roll}`),
  ];
  if (!lab) return labMissing(head, ctx);
  const names = new Map(
    classicSet().professions.map((profession) => [profession.id, ctx.professionTitle(profession)]),
  );
  const rows = lab.milestones
    .filter((entry) => entry.policyId === 'best-found')
    .sort((a, b) => a.escapeRate - b.escapeRate);
  return {
    head,
    rows: rows.map((entry) => [
      names.get(entry.professionId) ?? entry.professionId,
      ctx.percent(entry.escapeRate),
      ...rolls.map((roll) => {
        const mark = entry.marks[String(roll)];
        return mark && mark.escapedP50 !== null
          ? `${ctx.percent(mark.escapedP50)} (${ctx.percent(mark.escapedP10 ?? 0)} – ${ctx.percent(mark.escapedP90 ?? 0)})`
          : '-';
      }),
    ]),
    note: l['noteCardLabMilestones'],
  };
}

function cardLabBandsTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const lab = ctx.cardLab;
  const rolls = lab?.meta.milestones ?? [10, 20, 30, 40, 60];
  const head = [l['colProgress'], ...rolls.map((roll) => `${l['colAtRoll'] ?? 'Roll'} ${roll}`)];
  if (!lab) return labMissing(head, ctx);
  const bands = [l['band0'], l['band1'], l['band2'], l['band3'], l['band4']];
  return {
    head,
    rows: bands.map((band, index) => [
      band,
      ...rolls.map((roll) => {
        const slot = lab.progressBands[`all-rounder|${roll}`]?.[index];
        return slot && slot.games >= 20
          ? `${ctx.percent(slot.escaped / slot.games)} / ${ctx.percent(slot.bankrupt / slot.games)}`
          : '-';
      }),
    ]),
    note: l['noteCardLabBands'],
  };
}

function cardLabRuinTable(ctx: ManualContext): ManualTable {
  const l = ctx.labels;
  const head = [l['colLastDecision'], l['colBankruptGames']];
  const lab = ctx.cardLab;
  if (!lab) return labMissing(head, ctx);
  const total = Math.max(1, lab.ruin.bankrupt);
  const kindName = (kind: string): string => l[`kind_${kind}`] ?? kind;
  const kinds = Object.entries(lab.ruin.lastKinds).sort((a, b) => b[1] - a[1]);
  const cards = Object.entries(lab.ruin.lastCards)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return {
    head,
    rows: [
      ...kinds.map(([kind, count]) => [kindName(kind), ctx.percent(count / total)]),
      ...cards.map(([key, count]) => {
        const [kind, id] = key.split('|');
        return [`${kindName(kind)}: ${cardNameOf(ctx, id, id)}`, ctx.percent(count / total)];
      }),
    ],
    note: l['noteCardLabRuin'],
  };
}

export function buildManualTable(id: ManualDataId, ctx: ManualContext): ManualTable {
  switch (id) {
    case 'cardLabSmall':
      return cardLabDealsTable('dealSmall', ctx);
    case 'cardLabBig':
      return cardLabDealsTable('dealBig', ctx);
    case 'cardLabDoodads':
      return cardLabDoodadsTable(ctx);
    case 'cardLabMarket':
      return cardLabMarketTable(ctx);
    case 'cardLabDice':
      return cardLabDiceTable(ctx);
    case 'cardLabMilestones':
      return cardLabMilestonesTable(ctx);
    case 'cardLabBands':
      return cardLabBandsTable(ctx);
    case 'cardLabRuin':
      return cardLabRuinTable(ctx);
    case 'labStrategies':
      return labStrategiesTable(ctx);
    case 'labMatrix':
      return labMatrixTable(ctx);
    case 'labProfessions':
      return labProfessionsTable(ctx);
    case 'labCeiling':
      return labCeilingTable(ctx);
    case 'professions':
      return professionsTable(ctx);
    case 'escape':
      return escapeTable(ctx);
    case 'smallProperties':
      return smallPropertiesTable(ctx);
    case 'bigProperties':
      return bigPropertiesTable(ctx);
    case 'loanProof':
      return loanProofTable(ctx);
    case 'shares':
      return sharesTable(ctx);
    case 'doodads':
      return doodadsTable(ctx);
    case 'pileOdds':
      return pileOddsTable(ctx);
    case 'marketKinds':
      return marketKindsTable(ctx);
    case 'marketOdds':
      return marketOddsTable(ctx);
  }
}
