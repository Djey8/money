import type {
  EmergencyAfterEffect,
  EmergencyBucket,
  EmergencyCard,
  EmergencyCardType,
  EmergencyChoice,
  EmergencyDiceBand,
  EmergencyLink,
  EmergencyPayment,
  EmergencyTier,
  InsuranceKind,
  Localized,
} from './cashflow-game/emergency-deck';
import type { LifeRequirement } from './cashflow-game/life-deck';
import { DREAM_TIP_LABEL, type DreamTipKind } from './cashflow-dream-tips';

/**
 * A short way to write the content of an Emergency card (JFK, 2026-11): the pairs are English and German. A card is written once
 * (`emergencyCard`) or an existing one is enriched (`emergencyDetail` + `withEmergencyDetails`): description, notes and links of every
 * bucket, links, action items, a tip or a fun fact. Amounts are whole game money at the level of the Dual Student; the character's
 * price level scales them.
 */
export type Pair = [string, string];
export const pair = (value: Pair): Localized => ({ en: value[0], de: value[1] });

export const elink = (en: string, de: string, url: string): EmergencyLink => ({
  label: { en, de },
  url,
});

type Action = [string, string, ('low' | 'medium' | 'high')?];
type Tip = [DreamTipKind, string, string];

const actionsOf = (actions: Action[]): EmergencyCard['actions'] =>
  actions.map((action) => ({
    text: pair([action[0], action[1]]),
    priority: action[2] ?? 'medium',
  }));

const tipOf = (tip: Tip): Localized => ({
  en: DREAM_TIP_LABEL[tip[0]].en + tip[1],
  de: DREAM_TIP_LABEL[tip[0]].de + tip[2],
});

/** What of a card is written by hand: the rest of it stays. */
export interface EmergencyDetails {
  description?: Localized;
  /** In the order of the card's buckets (or, for a card of choices, its choices): the note and the links of each. */
  buckets?: { notes: Localized; links?: EmergencyLink[] }[];
  links?: EmergencyLink[];
  actions?: EmergencyCard['actions'];
  insuranceNote?: Localized;
  /** The tip or fun fact: the last note of the card. */
  notes?: Localized[];
  /** Fields of the card that are corrected (the insurance that limits it, its deductible, a cost without the insurance). */
  patch?: Partial<EmergencyCard>;
}

export function emergencyDetail(spec: {
  description: Pair;
  buckets: ([string, string] | [string, string, EmergencyLink[]])[];
  links?: EmergencyLink[];
  actions: Action[];
  tip: Tip;
  insuranceNote?: Pair;
  patch?: Partial<EmergencyCard>;
}): EmergencyDetails {
  return {
    description: pair(spec.description),
    buckets: spec.buckets.map((bucket) => ({
      notes: pair([bucket[0], bucket[1]]),
      ...(bucket[2] ? { links: bucket[2] } : {}),
    })),
    ...(spec.links ? { links: spec.links } : {}),
    actions: actionsOf(spec.actions),
    ...(spec.insuranceNote ? { insuranceNote: pair(spec.insuranceNote) } : {}),
    notes: [tipOf(spec.tip)],
    ...(spec.patch ? { patch: spec.patch } : {}),
  };
}

/** The cards with their detail: links are added, action items, the insurance note and the notes are those of the detail where it has them. */
export function withEmergencyDetails(
  cards: EmergencyCard[],
  details: Record<string, EmergencyDetails>,
): EmergencyCard[] {
  return cards.map((card) => {
    const detail = details[card.id];
    if (!detail) return card;
    const own = (list: { notes?: Localized; links?: EmergencyLink[] }[] | undefined) =>
      list?.map((item, index) => ({
        ...item,
        ...(detail.buckets?.[index]?.notes ? { notes: detail.buckets[index].notes } : {}),
        ...(detail.buckets?.[index]?.links ? { links: detail.buckets[index].links } : {}),
      }));
    return {
      ...card,
      ...(detail.patch ?? {}),
      ...(detail.description ? { description: detail.description } : {}),
      ...(card.type === 'choice'
        ? { choices: own(card.choices) as EmergencyChoice[] }
        : card.buckets
          ? { buckets: own(card.buckets) as EmergencyBucket[] }
          : {}),
      links: [...card.links, ...(detail.links ?? [])],
      actions: detail.actions ?? card.actions,
      ...(detail.insuranceNote ? { insuranceNote: detail.insuranceNote } : {}),
      ...(detail.notes ? { notes: detail.notes } : {}),
    };
  });
}

// ── a new card, written once ──

/** A bucket: title (en, de), amount in whole game money, what it is (en, de), links, the month it falls due. */
export type BucketSpec = [string, string, number, string, string, EmergencyLink[]?, number?];
/** A choice: id, label (en, de), amount, what it is (en, de), the amount with a trait, a cost every month after. */
export type ChoiceSpec = {
  id: string;
  label: Pair;
  amount: number;
  notes: Pair;
  links?: EmergencyLink[];
  trait?: { trait: string; amount: number };
  after?: { monthly: number; months?: number; line: Pair };
};

export interface EmergencySpec {
  id: string;
  tier: EmergencyTier;
  category: string;
  type: EmergencyCardType;
  payment: EmergencyPayment;
  title: Pair;
  story: Pair;
  description: Pair;
  stat?: Pair;
  insuranceNote?: Pair;
  /** The insurance that limits the card, and what an insured player pays of it at most. */
  insurance?: InsuranceKind;
  deductible?: number;
  /** What an uninsured player pays on top (a lawsuit, a replacement). */
  uninsuredExtra?: { label: Pair; amount: number; notes?: Pair };
  requires?: 'car' | 'pet';
  needs?: LifeRequirement;
  fixedPrice?: boolean;
  estimate?: boolean;
  unique?: boolean;
  buckets?: BucketSpec[];
  choices?: ChoiceSpec[];
  /** The die of a card with a single cost: from, to, amount. */
  dice?: [number, number, number][];
  /** The die of one bucket of a card of several (the vet's treatment). */
  bucketDice?: { bucket: number; bands: [number, number, number][] };
  insuredExtra?: { label: Pair; bands: [number, number, number][] };
  afterEffect?: { monthly: number; months?: number; line: Pair };
  modifier?: { when: 'openEmergency' | 'sideGig'; add: number };
  refund?: { amount: number; inMonths: number; note: Pair };
  links: EmergencyLink[];
  actions: Action[];
  tip: Tip;
}

const bands = (list: [number, number, number][]): EmergencyDiceBand[] =>
  list.map(([from, to, amount]) => ({ from, to, amountMinor: amount * 100 }));

const effectOf = (after: {
  monthly: number;
  months?: number;
  line: Pair;
}): EmergencyAfterEffect => ({
  monthlyMinor: after.monthly * 100,
  ...(after.months ? { months: after.months } : {}),
  line: pair(after.line),
});

export function emergencyCard(spec: EmergencySpec): EmergencyCard {
  return {
    id: spec.id,
    tier: spec.tier,
    category: spec.category,
    type: spec.type,
    payment: spec.payment,
    ...(spec.requires ? { requires: spec.requires } : {}),
    ...(spec.needs ? { needs: spec.needs } : {}),
    ...(spec.insurance ? { insurance: spec.insurance } : {}),
    ...(spec.deductible !== undefined ? { deductibleMinor: spec.deductible * 100 } : {}),
    ...(spec.fixedPrice ? { fixedPrice: true } : {}),
    ...(spec.unique ? { unique: true } : {}),
    ...(spec.estimate ? { estimate: true } : {}),
    title: pair(spec.title),
    story: pair(spec.story),
    description: pair(spec.description),
    ...(spec.stat ? { stat: pair(spec.stat) } : {}),
    ...(spec.insuranceNote ? { insuranceNote: pair(spec.insuranceNote) } : {}),
    notes: [tipOf(spec.tip)],
    ...(spec.uninsuredExtra
      ? {
          uninsuredExtra: {
            label: pair(spec.uninsuredExtra.label),
            amountMinor: spec.uninsuredExtra.amount * 100,
            ...(spec.uninsuredExtra.notes ? { notes: pair(spec.uninsuredExtra.notes) } : {}),
          },
        }
      : {}),
    ...(spec.dice ? { dice: bands(spec.dice) } : {}),
    ...(spec.buckets
      ? {
          buckets: spec.buckets.map((bucket, index) => ({
            id: `b${index + 1}`,
            title: pair([bucket[0], bucket[1]]),
            amountMinor: bucket[2] * 100,
            notes: pair([bucket[3], bucket[4]]),
            ...(bucket[5] ? { links: bucket[5] } : {}),
            ...(bucket[6] ? { dueInMonths: bucket[6] } : {}),
            ...(spec.bucketDice && spec.bucketDice.bucket === index
              ? { dice: bands(spec.bucketDice.bands) }
              : {}),
          })),
        }
      : {}),
    ...(spec.choices
      ? {
          choices: spec.choices.map((choice) => ({
            id: choice.id,
            label: pair(choice.label),
            amountMinor: choice.amount * 100,
            notes: pair(choice.notes),
            ...(choice.links ? { links: choice.links } : {}),
            ...(choice.trait
              ? {
                  traitAmount: {
                    trait: choice.trait.trait,
                    amountMinor: choice.trait.amount * 100,
                  },
                }
              : {}),
            ...(choice.after ? { afterEffect: effectOf(choice.after) } : {}),
          })),
        }
      : {}),
    ...(spec.insuredExtra
      ? {
          insuredExtra: {
            dice: bands(spec.insuredExtra.bands),
            label: pair(spec.insuredExtra.label),
          },
        }
      : {}),
    ...(spec.afterEffect ? { afterEffect: effectOf(spec.afterEffect) } : {}),
    ...(spec.modifier
      ? { modifier: { when: spec.modifier.when, addMinor: spec.modifier.add * 100 } }
      : {}),
    ...(spec.refund
      ? {
          refund: {
            amountMinor: spec.refund.amount * 100,
            inMonths: spec.refund.inMonths,
            note: pair(spec.refund.note),
          },
        }
      : {}),
    actions: actionsOf(spec.actions),
    links: spec.links,
  };
}
