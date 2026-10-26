import { pickOne, type Rng, systemRng } from './rng';

/**
 * The Dreamfund Emergency stack (JFK, 2026-10-25, temp_cards/dreamfund-emergency-deck.md v0.2): what a card is, how one is drawn,
 * what it costs a player who is insured or not, and what a payment plan costs on top. Pure rules: the cards themselves live in the
 * game set (`decks.emergency`), the app turns a paid card into a Fire project.
 */

export type EmergencyLang = 'en' | 'de';
export type Localized = Record<EmergencyLang, string>;

export type EmergencyTier = 'spark' | 'flame' | 'blaze' | 'wildfire' | 'inferno';
export type EmergencyCardType = 'fixed' | 'dice' | 'choice' | 'multi';
/** `pay_now`: fines and fees that cannot be spread; `plan_ok`: pay now or on a plan. */
export type EmergencyPayment = 'pay_now' | 'plan_ok';
export type InsuranceKind =
  'liability' | 'liability_keyloss' | 'household' | 'household_bike' | 'car_partial' | 'car_full';

/** One roll band of a die: 1-3, 4-5, 6. */
export interface EmergencyDiceBand {
  from: number;
  to: number;
  amountMinor: number;
}

export interface EmergencyBucket {
  id: string;
  title: Localized;
  amountMinor: number;
  /** The bucket falls due this many months after the card (its target date). */
  dueInMonths?: number;
  /** The amount is rolled instead (a vet's treatment). */
  dice?: EmergencyDiceBand[];
}

/** A monthly cost the card leaves behind: a higher rent, a car insurance. */
export interface EmergencyAfterEffect {
  monthlyMinor: number;
  /** Absent: for good. */
  months?: number;
  line: Localized;
}

export interface EmergencyChoice {
  id: string;
  label: Localized;
  amountMinor: number;
  /** The price when the character has this trait (a complete bonus booklet makes the dentist cheaper). */
  traitAmount?: { trait: string; amountMinor: number };
  afterEffect?: EmergencyAfterEffect;
  /** What the choice does besides costing money. */
  sideEffect?: 'skipNextCareer';
  /** The cost is rolled at the next Payday instead (wait and see). */
  deferredDice?: EmergencyDiceBand[];
}

export interface EmergencyCard {
  id: string;
  tier: EmergencyTier;
  category: string;
  type: EmergencyCardType;
  payment: EmergencyPayment;
  /** The card only applies to a player who owns this: otherwise it is shuffled back. */
  requires?: 'car' | 'pet';
  /** The insurance that limits the cost to the deductible. */
  insurance?: InsuranceKind;
  /** The amounts are fixed by law or fees (an ID card, a fine): they do not grow with the character's price level. */
  fixedPrice?: boolean;
  /** Removed from the game after its first draw. */
  unique?: boolean;
  /** The amounts are estimates, not published prices. */
  estimate?: boolean;
  title: Localized;
  story: Localized;
  stat?: Localized;
  insuranceNote?: Localized;
  /** The card's cost is rolled: one die, the band it falls in sets the amount of the card's single bucket. */
  dice?: EmergencyDiceBand[];
  /** Costs more under a condition: another emergency is still open, or the player has a side gig. */
  modifier?: { when: 'openEmergency' | 'sideGig'; addMinor: number };
  buckets?: EmergencyBucket[];
  choices?: EmergencyChoice[];
  /** What an insured player still rolls on top of the deductible (the hotel beyond the policy's limit). */
  insuredExtra?: { dice: EmergencyDiceBand[]; label: Localized };
  afterEffect?: EmergencyAfterEffect;
  refund?: { amountMinor: number; inMonths: number; note: Localized };
  upside?: { amountMinor: number; condition: string };
  /** An offer to roll again and keep the lower: it costs a little (joining a tenants' association). */
  reroll?: { costMinor: number; label: Localized };
  actions: { text: Localized; priority: 'low' | 'medium' | 'high' }[];
  links: { label: Localized; url: string }[];
}

/** The most an insured player pays of an insured card, unless the profession sets a lower one. */
export const INSURANCE_DEDUCTIBLE_CAP_MINOR = 50000;

/** The payment plans: months and the flat surcharge on the whole amount (Option A of the card notes). */
export const EMERGENCY_PLANS: readonly { months: number; percent: number }[] = [
  { months: 3, percent: 10 },
  { months: 6, percent: 20 },
  { months: 12, percent: 35 },
];

/** The amount of the band a roll falls in; 0 when no band has it. */
export function bandAmount(bands: EmergencyDiceBand[], roll: number): number {
  return bands.find((band) => roll >= band.from && roll <= band.to)?.amountMinor ?? 0;
}

/** Which of the player's insurances covers a card's insurance (the plain liability also carries the key-loss clause of the stack). */
export function isInsuredAgainst(card: EmergencyCard, insurances: readonly string[]): boolean {
  if (!card.insurance) return false;
  if (insurances.includes(card.insurance)) return true;
  return card.insurance === 'liability_keyloss' && insurances.includes('liability');
}

/** What the player has picked and rolled on the card so far. */
export interface EmergencySelection {
  choiceId?: string;
  /** `main` (the card's die), `bucket:<id>` (a bucket's die), `extra` (the insured extra), `reroll` (the second roll). */
  rolls?: Record<string, number>;
  /** The offer to roll again was taken. */
  rerolled?: boolean;
}

/** What a card needs to know of the player. */
export interface EmergencyContext {
  insurances: readonly string[];
  traits: readonly string[];
  /** Emergencies that are still being paid off. */
  openEmergencies: number;
  /** The profession's deductible cap; the default (scaled by the price factor) when absent. */
  deductibleCapMinor?: number;
  /** What things cost this character compared with the Dual Student (1): a richer life, dearer emergencies. Amounts set by law do not change. */
  priceFactor?: number;
}

export interface ResolvedBucket {
  id: string;
  title: Localized;
  amountMinor: number;
  dueInMonths: number;
}

export interface EmergencyQuote {
  /** The player still has to choose an option. */
  needsChoice: boolean;
  /** The dice that still have to be rolled, by key. */
  needsRolls: string[];
  /** Everything is picked and rolled: the cost is known. */
  ready: boolean;
  /** What the buckets of the Fire project are (the deductible alone when insured). */
  buckets: ResolvedBucket[];
  /** The cost without any insurance. */
  fullMinor: number;
  /** What the player pays. */
  payMinor: number;
  /** An insurance of the player's covers this card. */
  insured: boolean;
  /** What the insurance pays. */
  savedMinor: number;
  afterEffect?: EmergencyAfterEffect;
  sideEffect?: 'skipNextCareer';
  /** The offer to roll again can be made (rolled, not rerolled yet). */
  canReroll: boolean;
}

const DEDUCTIBLE_TITLE: Localized = {
  en: 'Your share (the insurance pays the rest)',
  de: 'Dein Anteil (die Versicherung zahlt den Rest)',
};

/**
 * What a card costs this player, as far as it is known: the option picked, the dice rolled, the insurance held. A die that has not
 * been rolled is listed in `needsRolls`; the quote is `ready` when nothing is missing.
 */
export function quoteEmergency(
  card: EmergencyCard,
  selection: EmergencySelection,
  context: EmergencyContext,
): EmergencyQuote {
  const rolls = selection.rolls ?? {};
  const needsRolls: string[] = [];
  const need = (key: string, bands: EmergencyDiceBand[]): number | null => {
    const roll = rolls[key];
    if (roll === undefined) {
      needsRolls.push(key);
      return null;
    }
    return bandAmount(bands, roll);
  };

  let buckets: ResolvedBucket[] = [];
  let needsChoice = false;
  let afterEffect = card.afterEffect;
  let sideEffect: EmergencyChoice['sideEffect'];
  if (card.type === 'choice') {
    const choice = card.choices?.find((candidate) => candidate.id === selection.choiceId);
    if (!choice) {
      needsChoice = true;
    } else {
      const amount =
        choice.traitAmount && context.traits.includes(choice.traitAmount.trait)
          ? choice.traitAmount.amountMinor
          : choice.amountMinor;
      buckets = [{ id: 'choice', title: choice.label, amountMinor: amount, dueInMonths: 0 }];
      afterEffect = choice.afterEffect ?? afterEffect;
      sideEffect = choice.sideEffect;
    }
  } else {
    const only = (card.buckets ?? []).length === 1;
    for (const bucket of card.buckets ?? []) {
      let amount: number | null = bucket.amountMinor;
      if (card.dice && only) {
        amount = need('main', card.dice);
        // the offer to roll again keeps the lower of the two
        if (amount !== null && selection.rerolled) {
          const second = need('reroll', card.dice);
          amount = second === null ? null : Math.min(amount, second);
        }
      } else if (bucket.dice) {
        amount = need(`bucket:${bucket.id}`, bucket.dice);
      }
      if (amount !== null) {
        buckets.push({
          id: bucket.id,
          title: bucket.title,
          amountMinor: amount,
          dueInMonths: bucket.dueInMonths ?? 0,
        });
      }
    }
  }

  const modified =
    card.modifier &&
    ((card.modifier.when === 'openEmergency' && context.openEmergencies > 0) ||
      (card.modifier.when === 'sideGig' && context.traits.includes('sideGig')));
  if (modified && buckets.length > 0) {
    buckets = buckets.map((bucket, index) =>
      index === 0
        ? { ...bucket, amountMinor: bucket.amountMinor + card.modifier!.addMinor }
        : bucket,
    );
  }
  if (selection.rerolled && card.reroll) {
    buckets = [
      ...buckets,
      {
        id: 'reroll',
        title: card.reroll.label,
        amountMinor: card.reroll.costMinor,
        dueInMonths: 0,
      },
    ];
  }

  const factor = card.fixedPrice ? 1 : (context.priceFactor ?? 1);
  if (factor !== 1) {
    // whole units of the money, so the amounts stay readable
    buckets = buckets.map((bucket) => ({
      ...bucket,
      amountMinor: Math.round((bucket.amountMinor * factor) / 100) * 100,
    }));
  }
  const fullMinor = buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0);
  const insured = isInsuredAgainst(card, context.insurances);
  const cap =
    context.deductibleCapMinor ??
    Math.round((INSURANCE_DEDUCTIBLE_CAP_MINOR * (context.priceFactor ?? 1)) / 100) * 100;
  let payMinor = fullMinor;
  if (insured && fullMinor > cap && needsRolls.length === 0 && !needsChoice) {
    let extra = 0;
    if (card.insuredExtra) {
      const rolled = need('extra', card.insuredExtra.dice);
      extra = rolled ?? 0;
    }
    if (needsRolls.length === 0) {
      payMinor = cap + extra;
      buckets = [
        { id: 'deductible', title: DEDUCTIBLE_TITLE, amountMinor: payMinor, dueInMonths: 0 },
      ];
    }
  }

  const ready = !needsChoice && needsRolls.length === 0;
  return {
    needsChoice,
    needsRolls,
    ready,
    buckets,
    fullMinor,
    payMinor: ready ? payMinor : fullMinor,
    insured,
    savedMinor: ready ? Math.max(0, fullMinor - payMinor) : 0,
    ...(afterEffect ? { afterEffect } : {}),
    ...(sideEffect ? { sideEffect } : {}),
    canReroll: !!card.reroll && !!card.dice && rolls['main'] !== undefined && !selection.rerolled,
  };
}

export interface EmergencyPlanQuote {
  months: number;
  percent: number;
  /** The flat surcharge on the whole amount. */
  surchargeMinor: number;
  /** What every Payday takes. */
  perMonthMinor: number;
  /** All that is paid in the end. */
  totalMinor: number;
}

/**
 * What spreading an amount over `months` Paydays costs: a flat surcharge on the whole amount, the rest in equal parts (the last
 * cents are rounded up, so the plan never pays less than it owes).
 */
export function planQuote(totalMinor: number, months: number): EmergencyPlanQuote {
  const plan = EMERGENCY_PLANS.find((candidate) => candidate.months === months);
  if (!plan) throw new Error(`There is no ${months}-month plan.`);
  const surchargeMinor = Math.round((totalMinor * plan.percent) / 100);
  const perMonthMinor = Math.ceil((totalMinor + surchargeMinor) / months);
  return {
    months,
    percent: plan.percent,
    surchargeMinor: perMonthMinor * months - totalMinor,
    perMonthMinor,
    totalMinor: perMonthMinor * months,
  };
}

/** The cards drawn since the last reshuffle, and the ones taken out of the game for good. */
export interface EmergencyDeckState {
  seen: string[];
  gone: string[];
}

export function emptyEmergencyDeck(): EmergencyDeckState {
  return { seen: [], gone: [] };
}

export interface EmergencyDraw {
  card: EmergencyCard;
  deck: EmergencyDeckState;
  /** Cards that did not apply (a car the player does not own): lucky, they went back into the pile. */
  skipped: string[];
}

/**
 * Draws the next card of the stack at random. A card the player cannot be hit by (no car, no pet) is lucky: nothing happens, it goes
 * back and the next one is drawn. When the pile is used up the discards are shuffled in again; a unique card never comes back.
 */
export function drawEmergencyCard(
  cards: readonly EmergencyCard[],
  deck: EmergencyDeckState,
  possessions: readonly string[],
  rng: Rng = systemRng,
): EmergencyDraw {
  const skipped: string[] = [];
  let seen = deck.seen;
  const open = () =>
    cards.filter((card) => !seen.includes(card.id) && !deck.gone.includes(card.id));
  let pile = open();
  if (pile.length === 0) {
    seen = [];
    pile = open();
  }
  const fits = (card: EmergencyCard) => !card.requires || possessions.includes(card.requires);
  // a card that does not apply is lucky: told, put back, and the next one is drawn
  const rest = [...pile];
  let card: EmergencyCard | undefined;
  while (rest.length > 0 && !card) {
    const drawn = rest.splice(Math.floor(rng() * rest.length), 1)[0];
    if (fits(drawn)) card = drawn;
    else skipped.push(drawn.id);
  }
  if (!card) {
    // every card left needs something the player does not own: the discards come back
    seen = [];
    const all = cards.filter((candidate) => !deck.gone.includes(candidate.id) && fits(candidate));
    if (all.length === 0) throw new Error('The Emergency stack has no card that applies.');
    card = pickOne(all, rng);
  }
  return {
    card,
    deck: {
      seen: [...seen, card.id],
      gone: card.unique ? [...deck.gone, card.id] : deck.gone,
    },
    skipped,
  };
}
