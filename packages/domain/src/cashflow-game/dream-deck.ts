import { pickOne, systemRng, type Rng } from './rng';
import type { EmergencyDeckState, Localized } from './emergency-deck';
import type { LifeState } from './life-deck';

/**
 * The Dreamfund Dream stack (JFK, 2026-10-26, temp_cards/dreamfund-dream-deck.md v0.2): what a dream is, how the Dream tile offers
 * them, what living one is worth in points, and what the eight dream moments do. A dream is generic - it belongs to no character -
 * and becomes a Smile project when it is taken; it is never financed with debt.
 */

export type DreamTier = 'little' | 'big' | 'grand' | 'life' | 'legendary';
export type DreamCategory =
  'wonders' | 'travel' | 'adventure' | 'learn' | 'vehicles' | 'home' | 'people' | 'create' | 'give';

export interface DreamCard {
  id: string;
  category: DreamCategory;
  tier: DreamTier;
  totalMinor: number;
  points: number;
  /** The seven wonders form a set that earns extra points. */
  set?: 'wonders';
  /** Helping others: its points already count a quarter more. */
  giving?: boolean;
  title: Localized;
  story: Localized;
  buckets: { id: string; title: Localized; amountMinor: number }[];
  stat?: Localized;
  actions: { text: Localized; priority: 'low' | 'medium' | 'high' }[];
  links: { label: Localized; url: string }[];
  /** What the dream costs every month once it is lived (a motorbike, a campervan, a farm). */
  monthlyAfterMinor?: number;
  /** Living it gives the character a car (the vehicle dreams): the car Emergencies then apply. */
  carAfter?: boolean;
  requiresPartner?: boolean;
  requiresKids?: boolean;
}

export type DreamMomentId = 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06' | 'M07' | 'M08';

export interface DreamMoment {
  id: DreamMomentId;
  title: Localized;
  story: Localized;
}

/** What the player can set when starting a game (JFK, 2026-10-26). */
export interface DreamSettings {
  /** How many dreams a Dream tile offers (1 to 3). */
  offersPerLanding: number;
  /** How many dreams can be open at once (planning, saving or ready; lived ones do not count). */
  maxOpenDreams: number;
  /** Whether a Life card that offers a choice may be declined (and an optional one left): off, the player has to accept what life brings. */
  lifeCanDecline?: boolean;
}

export const DEFAULT_DREAM_SETTINGS: DreamSettings = {
  offersPerLanding: 2,
  maxOpenDreams: 3,
  lifeCanDecline: true,
};

/** A dream the character has taken: the Smile project it became, and since when. */
export interface OpenDream {
  cardId: string;
  projectTitle: string;
  /** The round (Payday count) it was taken in. */
  round: number;
}

export interface LivedDream {
  cardId: string;
  points: number;
  round: number;
}

/** The dreams of a game: open, lived, and the points that did not come from a lived dream. */
export interface DreamLog {
  open: OpenDream[];
  lived: LivedDream[];
  /** Points for patience (a dream moment): kept even if a dream is never lived. */
  bonusPoints: number;
}

export const EMPTY_DREAM_LOG: DreamLog = { open: [], lived: [], bonusPoints: 0 };

/** The points of a dream by its cost: 2 x the square root of the cost in thousands, rounded. */
export function dreamPoints(totalMinor: number): number {
  return Math.round(2 * Math.sqrt(totalMinor / 100000));
}

/** What a dream is worth when it is lived: its points (a giving dream's already count a quarter more). */
export function livedPoints(card: DreamCard): number {
  return card.points;
}

/** The seven wonders, all lived: +15 points. */
export const WONDERS_SET_BONUS = 15;
export const WONDER_IDS = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07'];

/**
 * The points of a game's dreams: every lived dream, the set bonus for all seven wonders, the points for patience, and - for dreams not
 * yet lived - half the dream's points in proportion to the buckets that are completely funded.
 */
export function totalDreamPoints(
  log: DreamLog,
  cards: readonly DreamCard[],
  funded: (projectTitle: string) => { fundedBucketsMinor: number },
): { lived: number; partial: number; bonus: number; total: number } {
  const livedIds = log.lived.map((dream) => dream.cardId);
  let lived = log.lived.reduce((sum, dream) => sum + dream.points, 0);
  if (WONDER_IDS.every((id) => livedIds.includes(id))) lived += WONDERS_SET_BONUS;
  let partial = 0;
  for (const open of log.open) {
    const card = cards.find((candidate) => candidate.id === open.cardId);
    if (!card) continue;
    const share = funded(open.projectTitle).fundedBucketsMinor / card.totalMinor;
    partial += livedPoints(card) * 0.5 * share;
  }
  partial = Math.round(partial);
  return { lived, partial, bonus: log.bonusPoints, total: lived + partial + log.bonusPoints };
}

// ── the tile ──

export function dreamAllowed(card: DreamCard, life: LifeState | undefined): boolean {
  if (card.requiresPartner && (!life || life.relationship === 'single')) return false;
  if (card.requiresKids && (!life || life.kids < 1)) return false;
  return true;
}

export type DreamLanding =
  | { kind: 'offers'; offers: DreamCard[]; deck: EmergencyDeckState }
  | { kind: 'moment'; moment: DreamMoment; deck: EmergencyDeckState };

/**
 * Landing on a Dream tile: a card is drawn. A moment is applied; a dream is an offer - and so many dreams are offered together
 * (the setting). Dreams the character has open or has lived are not offered again; ones whose requirement is not met (a wedding
 * needs a partner) are left out. When the stack is used up it is shuffled again.
 */
export function drawDreamLanding(
  cards: readonly DreamCard[],
  moments: readonly DreamMoment[],
  deck: EmergencyDeckState,
  context: {
    log: DreamLog;
    life: LifeState | undefined;
    settings: DreamSettings;
    forceOffers?: number;
  },
  rng: Rng = systemRng,
): DreamLanding {
  let seen = deck.seen;
  const taken = new Set([
    ...context.log.open.map((d) => d.cardId),
    ...context.log.lived.map((d) => d.cardId),
  ]);
  const eligibleCards = () =>
    cards.filter(
      (card) => !seen.includes(card.id) && !taken.has(card.id) && dreamAllowed(card, context.life),
    );
  const eligibleMoments = () => moments.filter((moment) => !seen.includes(moment.id));
  if (eligibleCards().length === 0 && eligibleMoments().length === 0) seen = [];
  const pool: ({ card: DreamCard } | { moment: DreamMoment })[] = [
    ...eligibleCards().map((card) => ({ card })),
    ...eligibleMoments().map((moment) => ({ moment })),
  ];
  const first = context.forceOffers ? undefined : pickOne(pool, rng);
  if (first && 'moment' in first) {
    return {
      kind: 'moment',
      moment: first.moment,
      deck: { seen: [...seen, first.moment.id], gone: deck.gone },
    };
  }
  const wanted = context.forceOffers ?? context.settings.offersPerLanding;
  const offers: DreamCard[] = [];
  const left = eligibleCards();
  if (first && 'card' in first) {
    offers.push(first.card);
    left.splice(left.indexOf(first.card), 1);
  }
  while (offers.length < wanted && left.length > 0) {
    offers.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  }
  if (offers.length === 0) {
    // every dream is taken or lived: the stack comes round again
    const again = cards.filter((card) => !taken.has(card.id) && dreamAllowed(card, context.life));
    if (again.length > 0) offers.push(pickOne(again, rng));
  }
  return {
    kind: 'offers',
    offers,
    deck: { seen: [...seen, ...offers.map((offer) => offer.id)], gone: deck.gone },
  };
}

/** The offers are to be kept as they are: whether another dream can be taken now (the open dreams are fewer than the limit). */
export function canTakeDream(log: DreamLog, settings: DreamSettings): boolean {
  return log.open.length < settings.maxOpenDreams;
}

// ── the moments ──

export const DREAM_MOMENTS: DreamMoment[] = [
  {
    id: 'M01',
    title: { en: 'Early-Bird Offer', de: 'Frühbucher' },
    story: {
      en: 'One of your dreams that is at least half funded gets cheaper: what is still missing costs 15% less.',
      de: 'Einer deiner Träume, der schon mindestens zur Hälfte finanziert ist, wird billiger: was noch fehlt, kostet 15 % weniger.',
    },
  },
  {
    id: 'M02',
    title: { en: 'Gift From Family', de: 'Geschenk der Familie' },
    story: {
      en: 'A gift: 300 go straight into a bucket of one of your dreams. Without an open dream they go to your Smile account.',
      de: 'Ein Geschenk: 300 gehen direkt in einen Topf eines deiner Träume. Ohne offenen Traum landen sie auf deinem Smile-Konto.',
    },
  },
  {
    id: 'M03',
    title: { en: 'Last-Minute Deal', de: 'Last-Minute-Angebot' },
    story: {
      en: 'A last-minute deal: if you can fund a travel or wonder dream completely right now, it costs 20% less.',
      de: 'Ein Last-Minute-Angebot: wenn du einen Reise- oder Weltwunder-Traum jetzt ganz finanzieren kannst, kostet er 20 % weniger.',
    },
  },
  {
    id: 'M04',
    title: { en: 'Travel Buddy', de: 'Reisebuddy' },
    story: {
      en: 'A travel buddy shares the costs: one travel, wonder or adventure dream costs 25% less. You need a partner to go with.',
      de: 'Ein Reisebuddy teilt die Kosten: ein Reise-, Weltwunder- oder Abenteuer-Traum kostet 25 % weniger. Du brauchst jemanden an deiner Seite.',
    },
  },
  {
    id: 'M05',
    title: { en: 'Inspiration', de: 'Inspiration' },
    story: {
      en: 'A flash of inspiration: three dream offers - keep at most one.',
      de: 'Ein Geistesblitz: drei Traum-Angebote - behalte höchstens eines.',
    },
  },
  {
    id: 'M06',
    title: { en: 'Side Project Money', de: 'Geld vom Nebenprojekt' },
    story: {
      en: 'Your side project paid off: 5% of your monthly net income goes into a bucket of one of your dreams.',
      de: 'Dein Nebenprojekt hat sich gelohnt: 5 % deines monatlichen Nettoeinkommens gehen in einen Topf eines deiner Träume.',
    },
  },
  {
    id: 'M07',
    title: { en: 'Points for Patience', de: 'Geduld zahlt sich aus' },
    story: {
      en: 'Patience pays: every dream that has been saved for over 6 Paydays earns 1 point - kept even if the dream is never lived.',
      de: 'Geduld zahlt sich aus: jeder Traum, für den du seit mindestens 6 Zahltagen sparst, bringt 1 Punkt - auch wenn du ihn nie lebst.',
    },
  },
  {
    id: 'M08',
    title: { en: 'Dream Swap', de: 'Traumtausch' },
    story: {
      en: 'Swap one of your open dreams, with the money saved for it, for a new offer of the same tier.',
      de: 'Tausche einen deiner offenen Träume samt dem gesparten Geld gegen ein neues Angebot derselben Stufe.',
    },
  },
];

export interface BucketLike {
  target: number;
  amount: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** Early-bird: what is still missing of each bucket costs `percent` less. */
export function discountRemaining<T extends BucketLike>(buckets: T[], percent: number): T[] {
  return buckets.map((bucket) => ({
    ...bucket,
    target: cents(bucket.target - Math.max(0, bucket.target - bucket.amount) * (percent / 100)),
  }));
}

/** A deal on the whole price: every bucket costs `percent` less, never below what is saved for it. */
export function discountTotal<T extends BucketLike>(buckets: T[], percent: number): T[] {
  return buckets.map((bucket) => ({
    ...bucket,
    target: Math.max(bucket.amount, cents(bucket.target * (1 - percent / 100))),
  }));
}

/** At least half of the dream is funded (the early-bird condition). */
export function halfFunded(buckets: BucketLike[]): boolean {
  const total = buckets.reduce((sum, bucket) => sum + bucket.target, 0);
  const saved = buckets.reduce((sum, bucket) => sum + Math.min(bucket.amount, bucket.target), 0);
  return total > 0 && saved * 2 >= total;
}

/** Every bucket is full: the dream can be lived. */
export function dreamReady(buckets: BucketLike[]): boolean {
  return buckets.length > 0 && buckets.every((bucket) => bucket.amount + 0.005 >= bucket.target);
}

/** The moments that need the player to pick one of the open dreams. */
export function dreamsForMoment(
  moment: DreamMomentId,
  open: readonly { card: DreamCard; buckets: BucketLike[] }[],
): number[] {
  const indices = open.map((_, index) => index);
  switch (moment) {
    case 'M01':
      return indices.filter((i) => halfFunded(open[i].buckets) && !dreamReady(open[i].buckets));
    case 'M03':
      return indices.filter(
        (i) =>
          ['travel', 'wonders'].includes(open[i].card.category) && !dreamReady(open[i].buckets),
      );
    case 'M04':
      return indices.filter(
        (i) =>
          ['travel', 'wonders', 'adventure'].includes(open[i].card.category) &&
          !dreamReady(open[i].buckets),
      );
    case 'M02':
    case 'M06':
      return indices.filter((i) => !dreamReady(open[i].buckets));
    case 'M08':
      return indices;
    default:
      return [];
  }
}
