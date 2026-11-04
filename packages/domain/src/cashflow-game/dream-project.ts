import type { DreamCard } from './dream-deck';

/**
 * What a Smile project made from a dream card is filled in with (JFK, 2026-11-04): the description, a note and links for every bucket,
 * the links, the action items and the notes. One place for the solo game and a table, so both make the same project. Amounts stay in
 * minor units; the caller turns them into the app's.
 */
export interface DreamProjectParts {
  description: string;
  buckets: {
    id: string;
    title: string;
    amountMinor: number;
    notes: string;
    links: { label: string; url: string }[];
  }[];
  links: { label: string; url: string }[];
  actionItems: { text: string; done: boolean; priority: 'low' | 'medium' | 'high' }[];
  /** Three at most. */
  notes: string[];
}

export function dreamProjectParts(card: DreamCard, lang: 'en' | 'de'): DreamProjectParts {
  return {
    description: (card.description ?? card.story)[lang],
    buckets: card.buckets.map((bucket) => ({
      id: bucket.id,
      title: bucket.title[lang],
      amountMinor: bucket.amountMinor,
      notes: bucket.notes?.[lang] ?? '',
      links: (bucket.links ?? []).map((link) => ({ label: link.label[lang], url: link.url })),
    })),
    links: card.links.map((link) => ({ label: link.label[lang], url: link.url })),
    actionItems: card.actions.map((action) => ({
      text: action.text[lang],
      done: false,
      priority: action.priority,
    })),
    notes: [...(card.stat ? [card.stat] : []), ...(card.notes ?? [])]
      .slice(0, 3)
      .map((note) => note[lang]),
  };
}
