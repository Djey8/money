import type { DreamCard, DreamCategory, DreamTier } from './cashflow-game/dream-deck';
import type { DreamDetails } from './cashflow-dream-details';
import { dreamDetail, kitLink, type KitLink } from './cashflow-dream-kit';
import { dreamPoints } from './cashflow-game/dream-deck';

type Pair = [string, string];
/** A bucket: title (en, de), the amount in whole game money, what it is and what is realistic (en, de), links. */
export type BucketSpec = [string, string, number, string, string, KitLink[]?];
type Action = [string, string, ('low' | 'medium' | 'high')?];

export interface DreamSpec {
  id: string;
  category: DreamCategory;
  tier: DreamTier;
  title: Pair;
  story: Pair;
  description: Pair;
  buckets: BucketSpec[];
  links: KitLink[];
  actions: Action[];
  notes: Pair[];
  giving?: boolean;
  requiresPartner?: boolean;
  requiresKids?: boolean;
  monthlyAfter?: number;
  carAfter?: boolean;
}

export const link = kitLink;

/** One dream written once: the card (price = the sum of its buckets, points from the price) and its detail. */
export function dream(spec: DreamSpec): { card: DreamCard; detail: DreamDetails } {
  const totalMinor = spec.buckets.reduce((sum, bucket) => sum + bucket[2] * 100, 0);
  const base = dreamPoints(totalMinor);
  const card: DreamCard = {
    id: spec.id,
    category: spec.category,
    tier: spec.tier,
    totalMinor,
    points: spec.giving ? Math.round(base * 1.25) : base,
    title: { en: spec.title[0], de: spec.title[1] },
    story: { en: spec.story[0], de: spec.story[1] },
    buckets: spec.buckets.map((bucket, index) => ({
      id: `b${index + 1}`,
      title: { en: bucket[0], de: bucket[1] },
      amountMinor: bucket[2] * 100,
    })),
    actions: [],
    links: [],
    ...(spec.giving ? { giving: true } : {}),
    ...(spec.requiresPartner ? { requiresPartner: true } : {}),
    ...(spec.requiresKids ? { requiresKids: true } : {}),
    ...(spec.monthlyAfter ? { monthlyAfterMinor: spec.monthlyAfter * 100 } : {}),
    ...(spec.carAfter ? { carAfter: true } : {}),
  };
  const detail = dreamDetail(
    spec.description,
    spec.buckets.map((bucket) => [
      bucket[3],
      bucket[4],
      ...(bucket[5] ? [bucket[5]] : []),
    ]) as never,
    spec.links,
    spec.actions as never,
    spec.notes,
  );
  return { card, detail };
}

export function dreamSet(specs: DreamSpec[]): {
  cards: DreamCard[];
  details: Record<string, DreamDetails>;
} {
  const built = specs.map(dream);
  return {
    cards: built.map((entry) => entry.card),
    details: Object.fromEntries(built.map((entry) => [entry.card.id, entry.detail])),
  };
}
