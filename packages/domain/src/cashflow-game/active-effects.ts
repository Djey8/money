import type { EmergencyLang } from './emergency-deck';
import type { CashflowGameState } from './types';

/**
 * What is working on the account right now (JFK, 2026-10-26): the costs and gains that run for some more Paydays, what a Harvest card
 * did to a holding, what is on its way, and what has changed for good. One list for the dense strip on the game and the detail in the
 * character's info, so a player always knows why the cash flow moved and when it moves again. Pure: the state in, a list out.
 */

export type ActiveEffectKind =
  'life' | 'market' | 'holding' | 'pause' | 'ramp' | 'locked' | 'incoming' | 'job' | 'permanent';

export interface ActiveEffect {
  id: string;
  kind: ActiveEffectKind;
  title: string;
  /** What it does to the month, signed (a cost is negative); absent when it is not a monthly amount. */
  amountMinor?: number;
  /** Paydays it still lasts (or until it arrives); absent: it is for good. */
  paydaysLeft?: number;
  /** Good for the player, bad, or not either (something that is on its way). */
  tone: 'good' | 'bad' | 'neutral';
  /** A line of explanation for the detail view. */
  detail?: string;
  /** The Grow project it is about, to open it. */
  project?: string;
}

const text = (en: string, de: string, lang: EmergencyLang) => (lang === 'de' ? de : en);
const percent = (factor: number) =>
  `${factor >= 1 ? '+' : '−'}${Math.abs(Math.round((factor - 1) * 100))}%`;

/** The holdings need the cards to know what they are called; only the fields used here. */
export interface EffectHolding {
  title: string;
  cashflowMinor: number;
  ended?: boolean;
  rampLeft?: number;
  lockedLeft?: number;
  lockedReturnMinor?: number;
  rentCut?: { percent: number; paydaysLeft: number };
  rentMinor?: number;
  ponziLeft?: number;
  collapseLeft?: number;
  factor?: number;
  temp?: { factor: number; paydaysLeft: number }[];
  noCashflowLeft?: number;
}

export function activeEffects(
  state: Pick<
    CashflowGameState,
    | 'lifeLines'
    | 'lifeScheduled'
    | 'jobSearch'
    | 'marketEffects'
    | 'expensesPercentTotal'
    | 'mortgageRatePp'
    | 'nextPaydayIndex'
    | 'holdings'
  >,
  lang: EmergencyLang,
): ActiveEffect[] {
  const out: ActiveEffect[] = [];

  for (const line of state.lifeLines ?? []) {
    out.push({
      id: `life:${line.id}`,
      kind: line.paydaysLeft === undefined ? 'permanent' : 'life',
      title: line.title[lang],
      amountMinor: line.amountMinor,
      ...(line.paydaysLeft !== undefined ? { paydaysLeft: line.paydaysLeft } : {}),
      tone: line.amountMinor >= 0 ? 'good' : 'bad',
    });
  }
  for (const item of state.lifeScheduled ?? []) {
    out.push({
      id: `scheduled:${item.title.en}:${item.paydaysLeft}`,
      kind: 'incoming',
      title: item.title[lang],
      paydaysLeft: item.paydaysLeft,
      tone: 'neutral',
      detail: text('Arrives at a later Payday.', 'Kommt an einem späteren Zahltag.', lang),
    });
  }
  if (state.jobSearch) {
    out.push({
      id: 'job',
      kind: 'job',
      title: state.jobSearch.title[lang],
      paydaysLeft: state.jobSearch.paydaysLeft,
      tone: 'neutral',
      detail: text(
        'Every Payday a roll may bring a new job.',
        'Jeden Zahltag kann ein Wurf eine neue Stelle bringen.',
        lang,
      ),
    });
  }
  for (const effect of state.marketEffects ?? []) {
    out.push({
      id: `market:${effect.title}`,
      kind: 'market',
      title: effect.title,
      amountMinor: -effect.expensesMinor,
      paydaysLeft: effect.paydaysLeft,
      tone: effect.expensesMinor > 0 ? 'bad' : 'good',
    });
  }
  if (state.expensesPercentTotal) {
    out.push({
      id: 'living',
      kind: 'permanent',
      title: text('Living costs', 'Lebenshaltungskosten', lang),
      detail: `${state.expensesPercentTotal > 0 ? '+' : '−'}${Math.abs(state.expensesPercentTotal)}%`,
      tone: state.expensesPercentTotal > 0 ? 'bad' : 'good',
    });
  }
  if (state.mortgageRatePp) {
    out.push({
      id: 'mortgage',
      kind: 'permanent',
      title: text('Mortgage rates', 'Hypothekenzinsen', lang),
      detail: `${state.mortgageRatePp > 0 ? '+' : '−'}${Math.abs(state.mortgageRatePp)} ${text('points for new mortgages', 'Punkte für neue Hypotheken', lang)}`,
      tone: state.mortgageRatePp > 0 ? 'bad' : 'good',
    });
  }
  const next = Object.entries(state.nextPaydayIndex ?? {});
  if (next.length > 0) {
    out.push({
      id: 'next-index',
      kind: 'market',
      title: text('Markets move again', 'Märkte bewegen sich erneut', lang),
      paydaysLeft: 1,
      tone: 'neutral',
      detail: next.map(([tag, factor]) => `${tag} ${percent(factor)}`).join(', '),
    });
  }

  for (const holding of (state.holdings ?? []) as EffectHolding[]) {
    if (holding.ended) continue;
    const base = Math.round(holding.cashflowMinor * (holding.factor ?? 1));
    if (holding.noCashflowLeft && holding.noCashflowLeft > 0) {
      out.push({
        id: `pause:${holding.title}`,
        kind: 'pause',
        title: holding.title,
        amountMinor: -base,
        paydaysLeft: holding.noCashflowLeft,
        tone: base > 0 ? 'bad' : 'good',
        detail: text('Pays nothing for now.', 'Zahlt vorerst nichts.', lang),
        project: holding.title,
      });
    }
    if (holding.rampLeft && holding.rampLeft > 0) {
      out.push({
        id: `ramp:${holding.title}`,
        kind: 'ramp',
        title: holding.title,
        amountMinor: holding.cashflowMinor,
        paydaysLeft: holding.rampLeft,
        tone: 'neutral',
        detail: text('Starts to pay.', 'Beginnt zu zahlen.', lang),
        project: holding.title,
      });
    }
    if (holding.lockedLeft && holding.lockedLeft > 0) {
      out.push({
        id: `locked:${holding.title}`,
        kind: 'locked',
        title: holding.title,
        paydaysLeft: holding.lockedLeft,
        tone: 'neutral',
        detail: text('Money locked until then.', 'Geld bis dahin gebunden.', lang),
        project: holding.title,
        ...(holding.lockedReturnMinor ? { amountMinor: holding.lockedReturnMinor } : {}),
      });
    }
    for (const entry of holding.temp ?? []) {
      out.push({
        id: `temp:${holding.title}:${entry.factor}:${entry.paydaysLeft}`,
        kind: 'holding',
        title: holding.title,
        amountMinor: Math.round(base * (entry.factor - 1)),
        paydaysLeft: entry.paydaysLeft,
        tone: entry.factor >= 1 ? 'good' : 'bad',
        detail: `${text('Cash flow', 'Cashflow', lang)} ${percent(entry.factor)}`,
        project: holding.title,
      });
    }
    if (holding.rentCut && holding.rentCut.paydaysLeft > 0) {
      const cut = Math.round(((holding.rentMinor ?? 0) * holding.rentCut.percent) / 100);
      out.push({
        id: `rent:${holding.title}`,
        kind: 'holding',
        title: holding.title,
        amountMinor: -cut,
        paydaysLeft: holding.rentCut.paydaysLeft,
        tone: 'bad',
        detail: text(
          `Rent cut by ${holding.rentCut.percent}%.`,
          `Miete um ${holding.rentCut.percent} % gekürzt.`,
          lang,
        ),
        project: holding.title,
      });
    }
    if (holding.factor !== undefined && Math.abs(holding.factor - 1) > 0.001) {
      out.push({
        id: `factor:${holding.title}`,
        kind: 'permanent',
        title: holding.title,
        amountMinor: base - holding.cashflowMinor,
        tone: holding.factor >= 1 ? 'good' : 'bad',
        detail: `${text('Cash flow', 'Cashflow', lang)} ${percent(holding.factor)} ${text('for good', 'dauerhaft', lang)}`,
        project: holding.title,
      });
    }
    if (holding.ponziLeft !== undefined && holding.ponziLeft > 0) {
      out.push({
        id: `ponzi:${holding.title}`,
        kind: 'holding',
        title: holding.title,
        paydaysLeft: holding.ponziLeft,
        tone: 'bad',
        detail: text('The payouts stop then.', 'Dann bleiben die Auszahlungen aus.', lang),
        project: holding.title,
      });
    }
    if (holding.collapseLeft !== undefined && holding.collapseLeft > 0) {
      out.push({
        id: `collapse:${holding.title}`,
        kind: 'holding',
        title: holding.title,
        paydaysLeft: holding.collapseLeft,
        tone: 'bad',
        detail: text('It will collapse.', 'Es wird zusammenbrechen.', lang),
        project: holding.title,
      });
    }
  }

  // what ends soonest first, what is for good last
  return out.sort(
    (a, b) =>
      (a.paydaysLeft ?? Number.MAX_SAFE_INTEGER) - (b.paydaysLeft ?? Number.MAX_SAFE_INTEGER) ||
      (a.amountMinor ?? 0) - (b.amountMinor ?? 0),
  );
}

/** What the temporary effects add up to for a month: the cost and the gain, apart. */
export function effectsMonthlyMinor(effects: readonly ActiveEffect[]): {
  gainMinor: number;
  costMinor: number;
} {
  let gainMinor = 0;
  let costMinor = 0;
  for (const effect of effects) {
    if (effect.kind === 'incoming' || effect.kind === 'ramp' || effect.kind === 'locked') continue;
    if (effect.amountMinor === undefined) continue;
    if (effect.amountMinor >= 0) gainMinor += effect.amountMinor;
    else costMinor += effect.amountMinor;
  }
  return { gainMinor, costMinor };
}
