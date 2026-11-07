import type { DreamDetails } from './cashflow-dream-details';

/** A short way to write the detail of a dream: the pairs are English and German, the buckets follow the card's order (b1, b2 ...). */
type Pair = [string, string];
export type KitLink = { label: { en: string; de: string }; url: string };

export const kitLink = (en: string, de: string, url: string): KitLink => ({
  label: { en, de },
  url,
});

export function dreamDetail(
  description: Pair,
  buckets: ([...Pair] | [...Pair, KitLink[]])[],
  links: KitLink[],
  actions: ([...Pair] | [...Pair, 'low' | 'medium' | 'high'])[],
  notes: Pair[],
): DreamDetails {
  return {
    description: { en: description[0], de: description[1] },
    buckets: Object.fromEntries(
      buckets.map((entry, index) => [
        `b${index + 1}`,
        {
          notes: { en: entry[0], de: entry[1] },
          ...(entry[2] ? { links: entry[2] as KitLink[] } : {}),
        },
      ]),
    ),
    links,
    actions: actions.map((entry) => ({
      text: { en: entry[0], de: entry[1] },
      priority: (entry[2] as 'low' | 'medium' | 'high' | undefined) ?? 'medium',
    })),
    notes: notes.map((note) => ({ en: note[0], de: note[1] })),
  };
}
