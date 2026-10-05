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

export function buildManualTable(id: ManualDataId, ctx: ManualContext): ManualTable {
  switch (id) {
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
