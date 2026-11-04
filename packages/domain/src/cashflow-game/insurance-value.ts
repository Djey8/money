import { quoteEmergency, type EmergencyCard, type EmergencySelection } from './emergency-deck';
import { EMERGENCIES_PER_PAYDAY, insuranceInfo, premiumMinor } from './insurance';
import { meetsRequirement, type LifeState } from './life-deck';

/**
 * What an insurance is worth to a life (JFK, 2026-11): the average of what it saves on a card drawn at random, a month of cards, and
 * the premium it costs. A premium that is paid every month has to be worth it: above 1 the insurance pays for itself on average,
 * and the more so the more the cards of the stack hit a life like this one. Pure rules, the cards are given by the caller.
 */
export interface InsuranceValue {
  /** The share of the cards this life draws that the insurance works on. */
  coveredShare: number;
  /** What the insurance saves on a card drawn at random, in minor units. */
  savedPerCardMinor: number;
  /** What it saves in a month (a Payday's worth of cards). */
  savedPerMonthMinor: number;
  /** What it costs a month. */
  premiumMinor: number;
  /** Saved against paid: above 1 it is worth it. */
  ratio: number;
}

/** The cards a life can be hit by: the ones that need a car, a pet or a life like this one only count when the life has it. */
export function cardsOfLife(cards: readonly EmergencyCard[], life: LifeState): EmergencyCard[] {
  return cards.filter(
    (card) =>
      (!card.requires || (card.requires === 'car' ? life.car : life.pet !== 'none')) &&
      (!card.needs || meetsRequirement(card.needs, life)),
  );
}

/** What a card costs when the die falls on `face` (the choices averaged), with and without the insurance. */
function savedOn(
  card: EmergencyCard,
  kind: string,
  priceFactor: number,
): { saved: number; covered: boolean } {
  const variants: EmergencySelection[] =
    card.type === 'choice' ? (card.choices ?? []).map((choice) => ({ choiceId: choice.id })) : [{}];
  let saved = 0;
  let covered = false;
  for (const variant of variants) {
    for (let face = 1; face <= 6; face += 1) {
      const rolls = { main: face, extra: face, reroll: face } as Record<string, number>;
      for (const bucket of card.buckets ?? []) rolls[`bucket:${bucket.id}`] = face;
      const selection = { ...variant, rolls };
      const bare = quoteEmergency(card, selection, {
        insurances: [],
        traits: [],
        openEmergencies: 0,
        priceFactor,
      });
      const insured = quoteEmergency(card, selection, {
        insurances: [kind],
        traits: [],
        openEmergencies: 0,
        priceFactor,
      });
      covered = covered || insured.insured;
      saved += Math.max(0, bare.payMinor - insured.payMinor) / (variants.length * 6);
    }
  }
  return { saved, covered };
}

/** What an insurance is worth to a life that draws from `cards` at the price level `priceFactor`. */
export function insuranceValue(
  kind: string,
  cards: readonly EmergencyCard[],
  life: LifeState,
  priceFactor = 1,
): InsuranceValue {
  const fitting = cardsOfLife(cards, life);
  let saved = 0;
  let covered = 0;
  for (const card of fitting) {
    const result = savedOn(card, kind, priceFactor);
    saved += result.saved;
    if (result.covered) covered += 1;
  }
  const perCard = fitting.length > 0 ? saved / fitting.length : 0;
  const perMonth = perCard * EMERGENCIES_PER_PAYDAY;
  const info = insuranceInfo(kind);
  const premium = info?.baseMinor !== undefined ? premiumMinor(info.baseMinor, priceFactor) : 0;
  return {
    coveredShare: fitting.length > 0 ? covered / fitting.length : 0,
    savedPerCardMinor: Math.round(perCard),
    savedPerMonthMinor: Math.round(perMonth),
    premiumMinor: premium,
    ratio: premium > 0 ? perMonth / premium : Infinity,
  };
}
