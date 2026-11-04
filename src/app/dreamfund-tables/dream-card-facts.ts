import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import { dreamMoney } from './dream-texts';

/**
 * What a card of a Dreamfund pile is, in a few lines (JFK, 2026-11-04): the small popup that tells what another player drew and the
 * card that opens from it say the same things - the numbers that matter, not the whole text. Pure; amounts are the card's own (a
 * player's price level changes what they pay - the full card says so).
 */

export type DreamPile = 'emergency' | 'life' | 'dream' | 'opportunity' | 'harvest';

export interface RawCard {
  id: string;
  title: { en: string; de: string };
  story: { en: string; de: string };
  tier?: string;
  type?: string;
  category?: string;
  group?: string;
  pile?: string;
  growType?: string;
  riskScore?: number;
  costMinor?: number;
  stepMinor?: number;
  totalMinor?: number;
  points?: number;
  insurance?: string;
  payment?: string;
  dice?: { from: number; to: number; amountMinor?: number; value?: Record<string, unknown> }[];
  buckets?: { id: string; title: { en: string; de: string }; amountMinor: number }[];
  choices?: { id: string; label: { en: string; de: string }; amountMinor: number }[];
  share?: { ticker: string; unitPriceMinor: number; dividendMonthPerUnitMinor?: number };
  effects?: Effect;
  accept?: Effect;
  options?: { id: string; label: { en: string; de: string }; effect: Effect }[];
  optional?: boolean;
  realWorld?: string;
  strategy?: string;
  risks?: string;
  reasoning?: string;
  insights?: string;
}

export interface Effect {
  oneTimeMinor?: number;
  oneTimePercentOfNet?: number;
  monthlyMinor?: number;
  incomeMonthlyMinor?: number;
  incomePercentOfNet?: number;
  expensesPercent?: number;
  durationPaydays?: number;
  schedule?: { cardId: string; afterPaydays: number };
}

const WORDS = {
  en: {
    piles: {
      emergency: 'Fire (Emergency)',
      life: 'Life',
      dream: 'Smile (Dream)',
      opportunity: 'Opportunity',
      harvest: 'Harvest',
    },
    cost: 'Cost',
    total: 'Total',
    points: 'points',
    dice: 'Dice',
    risk: 'Risk',
    fixed: 'Fixed price',
    choice: 'A choice',
    optional: 'Optional',
    month: 'a month',
    once: 'once',
    paydays: 'Paydays',
    income: 'Income',
    expenses: 'Expenses',
    ofNet: 'of the net income',
    next: 'then',
    perUnit: 'a unit',
    dividend: 'Dividend',
    insuredBy: 'Insurance',
    fate: 'Happens to you',
  },
  de: {
    piles: {
      emergency: 'Fire (Notfall)',
      life: 'Leben',
      dream: 'Smile (Traum)',
      opportunity: 'Chance',
      harvest: 'Ernte',
    },
    cost: 'Kosten',
    total: 'Summe',
    points: 'Punkte',
    dice: 'Würfel',
    risk: 'Risiko',
    fixed: 'Fester Preis',
    choice: 'Eine Wahl',
    optional: 'Freiwillig',
    month: 'im Monat',
    once: 'einmalig',
    paydays: 'Zahltage',
    income: 'Einkommen',
    expenses: 'Ausgaben',
    ofNet: 'des Nettoeinkommens',
    next: 'danach',
    perUnit: 'je Stück',
    dividend: 'Dividende',
    insuredBy: 'Versicherung',
    fate: 'Passiert dir',
  },
};

export const dreamCardWords = (lang: string) => WORDS[lang === 'de' ? 'de' : 'en'];

const set = () => CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');

/** The pile a history line is about, from its event type. */
export function pileOfEvent(type: string): DreamPile | undefined {
  if (type === 'emergency' || type.startsWith('emergency_')) return 'emergency';
  if (type === 'life' || type.startsWith('life_')) return 'life';
  if (type === 'dream' || type.startsWith('dream_')) return 'dream';
  if (type.startsWith('opportunity')) return 'opportunity';
  if (type === 'harvest' || type.startsWith('harvest')) return 'harvest';
  return undefined;
}

/** The card of an id, from whichever pile has it. */
export function findDreamCard(id: string): { pile: DreamPile; card: RawCard } | null {
  const decks = set()?.decks as unknown as Record<string, RawCard[]> | undefined;
  for (const pile of ['emergency', 'life', 'dream', 'opportunity', 'harvest'] as DreamPile[]) {
    const card = decks?.[pile]?.find((candidate) => candidate.id === id);
    if (card) return { pile, card };
  }
  return null;
}

/** The lines of what an effect does, as the cards print them. */
export function effectLines(effect: Effect | undefined, lang: string): string[] {
  if (!effect) return [];
  const w = dreamCardWords(lang);
  const m = (minor: number) => dreamMoney(Math.abs(minor), lang);
  const sign = (minor: number) => (minor < 0 ? '−' : '+');
  const lines: string[] = [];
  if (effect.oneTimeMinor) {
    lines.push(`${sign(effect.oneTimeMinor)}${m(effect.oneTimeMinor)} ${w.once}`);
  }
  if (effect.oneTimePercentOfNet) {
    lines.push(
      `${sign(effect.oneTimePercentOfNet)}${Math.abs(effect.oneTimePercentOfNet)} % ${w.ofNet}`,
    );
  }
  // a monthly cost is printed positive on the cards
  if (effect.monthlyMinor) {
    lines.push(`${effect.monthlyMinor > 0 ? '−' : '+'}${m(effect.monthlyMinor)} ${w.month}`);
  }
  if (effect.incomeMonthlyMinor) {
    lines.push(
      `${w.income} ${sign(effect.incomeMonthlyMinor)}${m(effect.incomeMonthlyMinor)} ${w.month}`,
    );
  }
  if (effect.incomePercentOfNet) {
    lines.push(
      `${w.income} ${sign(effect.incomePercentOfNet)}${Math.abs(effect.incomePercentOfNet)} %`,
    );
  }
  if (effect.expensesPercent) {
    lines.push(
      `${w.expenses} ${sign(effect.expensesPercent)}${Math.abs(effect.expensesPercent)} %`,
    );
  }
  if (effect.durationPaydays) lines.push(`${effect.durationPaydays} ${w.paydays}`);
  return lines;
}

/** The few lines that say what a card is: the pile's word, then the numbers that matter. */
export function cardFacts(
  pile: DreamPile,
  card: RawCard,
  lang: string,
): { deck: string; lines: string[]; text: string } {
  const w = dreamCardWords(lang);
  const l = lang === 'de' ? 'de' : 'en';
  const m = (minor: number) => dreamMoney(minor, lang);
  const lines: string[] = [];
  const rolls = (card.dice ?? []).length > 0;
  if (pile === 'emergency') {
    if (card.tier) lines.push(card.tier);
    if (card.type === 'fixed' || (card.type === 'multi' && !rolls)) {
      const sum = (card.buckets ?? []).reduce((acc, bucket) => acc + bucket.amountMinor, 0);
      if (sum) lines.push(`${w.cost}: ${m(sum)}`);
    } else if (card.type === 'dice' && card.dice) {
      const amounts = card.dice.map((band) => band.amountMinor ?? 0);
      lines.push(`🎲 ${m(Math.min(...amounts))} – ${m(Math.max(...amounts))}`);
    } else if (card.type === 'choice' && card.choices) {
      const amounts = card.choices.map((choice) => choice.amountMinor);
      lines.push(`${w.choice}: ${m(Math.min(...amounts))} – ${m(Math.max(...amounts))}`);
    }
    if (card.payment === 'pay_now') lines.push(w.fixed);
  } else if (pile === 'life') {
    if (card.type) lines.push(card.type);
    if (card.optional) lines.push(w.optional);
    lines.push(...effectLines(card.effects ?? card.accept, lang));
    if (rolls) lines.push(`🎲 ${w.dice}`);
  } else if (pile === 'dream') {
    if (card.tier) lines.push(card.tier);
    const total =
      card.totalMinor ?? (card.buckets ?? []).reduce((acc, bucket) => acc + bucket.amountMinor, 0);
    if (total) lines.push(`${w.total}: ${m(total)}`);
    if (card.points) lines.push(`${card.points} ${w.points}`);
  } else if (pile === 'opportunity') {
    if (card.pile) lines.push(card.pile);
    if (card.share) lines.push(`${m(card.share.unitPriceMinor)} ${w.perUnit}`);
    else if (card.costMinor) lines.push(`${w.cost}: ${m(card.costMinor)}`);
    else if (card.stepMinor) lines.push(`${w.cost}: ${m(card.stepMinor)}`);
    if (rolls) lines.push(`🎲 ${w.dice}`);
    if (card.riskScore !== undefined) lines.push(`${w.risk} ${card.riskScore}`);
    if (card.growType) lines.push(card.growType);
  } else if (card.group) {
    lines.push(card.group);
  }
  return { deck: w.piles[pile], lines, text: card.story[l] };
}
