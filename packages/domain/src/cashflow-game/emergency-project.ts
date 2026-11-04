import type {
  EmergencyCard,
  EmergencyLang,
  EmergencyQuote,
  ResolvedBucket,
} from './emergency-deck';

/**
 * What a Fire project made from an Emergency card is filled in with (JFK, 2026-11): the description, the notes and links of every
 * bucket, the links, the action items and a few notes - as the project of a dream. One place for the solo game and a table, so both
 * make the same project. Amounts stay in minor units; the callers turn them into their own money.
 */
export interface EmergencyProjectParts {
  description: string;
  buckets: {
    id: string;
    title: string;
    amountMinor: number;
    dueInMonths: number;
    notes: string;
    links: { label: string; url: string }[];
  }[];
  links: { label: string; url: string }[];
  actionItems: { text: string; priority: 'low' | 'medium' | 'high' }[];
  /** The statistic, what the insurance does, a refund and the tip or fun fact: four at most. */
  notes: string[];
}

/** The most notes a Fire project of a card shows. */
export const EMERGENCY_NOTES_MAX = 4;

/**
 * The parts of the project of a card. With a `quote` the buckets are those the player pays (the option picked, the dice rolled, the
 * deductible when insured); without one (a table's plan) they are the card's own, and `insuranceOutcome` is the line about what the
 * insurance did.
 */
export function emergencyProjectParts(
  card: EmergencyCard,
  lang: EmergencyLang,
  quote?: Pick<EmergencyQuote, 'buckets'>,
  insuranceOutcome = '',
): EmergencyProjectParts {
  const own: ResolvedBucket[] =
    quote?.buckets ??
    (card.buckets ?? []).map((bucket) => ({
      id: bucket.id,
      title: bucket.title,
      amountMinor: bucket.amountMinor,
      dueInMonths: bucket.dueInMonths ?? 0,
      ...(bucket.notes ? { notes: bucket.notes } : {}),
      ...(bucket.links ? { links: bucket.links } : {}),
    }));
  const tip = card.notes?.[card.notes.length - 1];
  // the order is the order of reading; when there are too many, the tip and the statistic stay
  const lines: { text: string; keep: boolean }[] = [
    ...(card.stat ? [{ text: card.stat[lang], keep: true }] : []),
    ...(card.insuranceNote ? [{ text: card.insuranceNote[lang], keep: false }] : []),
    ...(insuranceOutcome ? [{ text: insuranceOutcome, keep: true }] : []),
    ...(card.refund ? [{ text: card.refund.note[lang], keep: false }] : []),
    ...(tip ? [{ text: tip[lang], keep: true }] : []),
  ];
  let surplus = lines.length - EMERGENCY_NOTES_MAX;
  const notes = lines
    .filter((line) => {
      if (surplus > 0 && !line.keep) {
        surplus -= 1;
        return false;
      }
      return true;
    })
    .slice(0, EMERGENCY_NOTES_MAX)
    .map((line) => line.text);
  return {
    description: (card.description ?? card.story)[lang],
    buckets: own.map((bucket) => ({
      id: bucket.id,
      title: bucket.title[lang],
      amountMinor: bucket.amountMinor,
      dueInMonths: bucket.dueInMonths,
      notes: bucket.notes?.[lang] ?? '',
      links: (bucket.links ?? []).map((link) => ({ label: link.label[lang], url: link.url })),
    })),
    links: card.links.map((link) => ({ label: link.label[lang], url: link.url })),
    actionItems: card.actions.map((action) => ({
      text: action.text[lang],
      priority: action.priority,
    })),
    notes,
  };
}
