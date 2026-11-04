import type { BookSubscription } from './effects';
import type { CashflowExpenseLine, CashflowGameState } from './types';

/**
 * The insurances of a character (JFK, 2026-10-25): each is an expense line that is the premium. While the insurance is held the
 * premium is paid at every Payday and an insured card costs only the deductible; dropped, neither. A change - hop out or hop in - is
 * only made at the next Payday: the premium and the cover change together there, so nobody can insure just before the fire.
 */

export type InsuranceState = NonNullable<CashflowGameState['insurance']>;

/** The insurances a profession's expense lines carry, all held at the start. */
export function initialInsurance(expenses: CashflowExpenseLine[]): InsuranceState | undefined {
  const premiums: Record<string, string> = {};
  for (const line of expenses) {
    if (line.insurance && line.amountMinor !== 0) premiums[line.insurance] = line.title;
  }
  const active = Object.keys(premiums);
  return active.length > 0 ? { active, premiums, pending: [] } : undefined;
}

/** The kinds of insurance that count as held (an empty list for a game without insurance). */
export function activeInsurances(state: Pick<CashflowGameState, 'insurance'>): string[] {
  return state.insurance?.active ?? [];
}

/** The titles of the premium lines of insurances that are not held: they are not paid. */
export function droppedPremiumTitles(state: Pick<CashflowGameState, 'insurance'>): Set<string> {
  const insurance = state.insurance;
  if (!insurance) return new Set();
  return new Set(
    Object.entries(insurance.premiums)
      .filter(([kind]) => !insurance.active.includes(kind))
      .map(([, title]) => title),
  );
}

/** Hop in or hop out: it is written down and takes effect at the next Payday. Choosing what is already so withdraws a change. */
export function queueInsuranceChange(
  state: CashflowGameState,
  kind: string,
  on: boolean,
): CashflowGameState {
  const insurance = state.insurance;
  if (!insurance || !(kind in insurance.premiums)) return state;
  const held = insurance.active.includes(kind);
  const others = insurance.pending.filter((change) => change.kind !== kind);
  return {
    ...state,
    insurance: {
      ...insurance,
      pending: on === held ? others : [...others, { kind, on }],
    },
  };
}

/** The changes made since the last Payday take effect: called when a Payday starts, before it posts anything. */
export function applyInsuranceChanges(state: CashflowGameState): CashflowGameState {
  const insurance = state.insurance;
  if (!insurance || insurance.pending.length === 0) return state;
  let active = insurance.active;
  for (const change of insurance.pending) {
    active = change.on
      ? active.includes(change.kind)
        ? active
        : [...active, change.kind]
      : active.filter((kind) => kind !== change.kind);
  }
  return { ...state, insurance: { ...insurance, active, pending: [] } };
}

export interface InsuranceOffer {
  kind: string;
  /** The premium line's title. */
  premiumTitle: string;
  held: boolean;
  /** Held after the next Payday (a change is waiting). */
  heldNext: boolean;
  /** Newly on offer (a car was bought) and not answered yet. */
  fresh: boolean;
}

/** Everything the player can switch, with what is waiting for the next Payday. */
export function insuranceOffers(state: Pick<CashflowGameState, 'insurance'>): InsuranceOffer[] {
  const insurance = state.insurance;
  if (!insurance) return [];
  return Object.entries(insurance.premiums).map(([kind, premiumTitle]) => {
    const held = insurance.active.includes(kind);
    const change = insurance.pending.find((candidate) => candidate.kind === kind);
    return {
      kind,
      premiumTitle,
      held,
      heldNext: change ? change.on : held,
      fresh: insurance.fresh?.includes(kind) ?? false,
    };
  });
}

// ── the catalogue of insurances (JFK, 2026-11-03) ──

export type CarInsuranceKind = 'car_partial' | 'car_full';
export const CAR_INSURANCES: readonly CarInsuranceKind[] = ['car_partial', 'car_full'];

interface Words {
  en: string;
  de: string;
}

export interface InsuranceInfo {
  kind: string;
  /** 1 is listed first: the most important first. */
  priority: number;
  /** Of a group only one is held: the player cannot have both car insurances. */
  exclusiveGroup?: 'car';
  /**
   * The monthly premium for the Dual Student in minor units; the character's price level and insurance factor change it. Absent: the
   * profession carries its own premium line.
   */
  baseMinor?: number;
  /** The premium line: the key of its translation and the German title it is booked under. */
  lineKey: string;
  lineTitle: string;
  /** What it protects against, in the player's words. What it does to the cards and whether it pays are for the player to find out. */
  covers: Words;
}

/**
 * The insurances of the game, most important first (JFK, 2026-11-03: only these to begin with; the others are ideas for later, see
 * todo/dreamfund-insurances.md). An insurance only ever works on the cards that name it (`EmergencyCard.insurance`). Every character
 * is offered all of them - also the car insurances without a car.
 */
export const INSURANCE_CATALOG: readonly InsuranceInfo[] = [
  {
    kind: 'liability',
    priority: 1,
    lineKey: 'liabilityInsurance',
    lineTitle: 'Haftpflichtversicherung',
    covers: {
      en: "Damage you cause to other people or their things: the neighbour's window, a bike you knock over, a borrowed phone you drop. Also a lost key of somebody else's.",
      de: 'Schäden, die du anderen oder ihren Sachen zufügst: das Fenster des Nachbarn, ein umgestoßenes Fahrrad, ein heruntergefallenes geliehenes Handy. Auch ein verlorener fremder Schlüssel.',
    },
  },
  {
    kind: 'household',
    priority: 2,
    lineKey: 'householdInsurance',
    lineTitle: 'Hausratversicherung',
    covers: {
      en: 'Your things at home: a burglary, a fire, a burst pipe, a storm - everything you own that is not nailed down.',
      de: 'Deine Sachen zu Hause: Einbruch, Feuer, Leitungswasser, Sturm - alles, was nicht niet- und nagelfest ist.',
    },
  },
  {
    kind: 'legal',
    priority: 3,
    baseMinor: 1800,
    lineKey: 'legalInsurance',
    lineTitle: 'Rechtsschutzversicherung',
    covers: {
      en: 'The costs of a lawsuit or a lawyer: a dispute with the landlord, the employer, a seller or after a traffic accident.',
      de: 'Die Kosten für Anwalt und Gericht: Streit mit Vermieter, Arbeitgeber, Verkäufer oder nach einem Verkehrsunfall.',
    },
  },
  {
    kind: 'car_partial',
    priority: 4,
    exclusiveGroup: 'car',
    baseMinor: 3000,
    lineKey: 'carPartialInsurance',
    lineTitle: 'Teilkaskoversicherung',
    covers: {
      en: 'Your car against theft, glass breakage, fire, storm, hail and a collision with game.',
      de: 'Dein Auto gegen Diebstahl, Glasbruch, Brand, Sturm, Hagel und Wildunfall.',
    },
  },
  {
    kind: 'car_full',
    priority: 4,
    exclusiveGroup: 'car',
    baseMinor: 6000,
    lineKey: 'carFullInsurance',
    lineTitle: 'Vollkaskoversicherung',
    covers: {
      en: 'Everything the partial cover pays, and your own car after a crash you caused or vandalism.',
      de: 'Alles, was die Teilkasko zahlt, und dein eigenes Auto nach einem selbst verschuldeten Unfall oder Vandalismus.',
    },
  },
  {
    kind: 'dental',
    priority: 5,
    baseMinor: 900,
    lineKey: 'dentalInsurance',
    lineTitle: 'Zahnzusatzversicherung',
    covers: {
      en: 'What the health insurance does not pay at the dentist: crowns, implants, a professional cleaning.',
      de: 'Was die Krankenkasse beim Zahnarzt nicht zahlt: Kronen, Implantate, professionelle Zahnreinigung.',
    },
  },
  {
    kind: 'disability',
    // after the household insurance: the cover that decides whether an illness or an injury that ends the job ends the plan too
    priority: 2.5,
    baseMinor: 4000,
    lineKey: 'disabilityInsurance',
    lineTitle: 'Berufsunfähigkeitsversicherung',
    covers: {
      en: 'Your income when an illness or an injury keeps you from doing your job for months or for good: a back that gives out, a burnout, a hand that cannot do the work any more. The longest and the most expensive cards of the stack.',
      de: 'Dein Einkommen, wenn eine Krankheit oder Verletzung dich monatelang oder für immer an deinem Beruf hindert: ein Rücken, der nicht mehr will, ein Burnout, eine Hand, die die Arbeit nicht mehr schafft. Die längsten und teuersten Karten des Stapels.',
    },
  },
  {
    kind: 'travel',
    priority: 6,
    baseMinor: 800,
    lineKey: 'travelInsurance',
    lineTitle: 'Reiseversicherung',
    covers: {
      en: 'Trips and time abroad: a doctor or a hospital, the flight home, a trip you have to cancel, lost luggage, a rescue in the mountains, a breakdown far from home.',
      de: 'Reisen und Zeit im Ausland: Arzt oder Krankenhaus, der Rückflug, eine Reise, die du absagen musst, verlorenes Gepäck, eine Bergung im Gebirge, eine Panne weit weg von zu Hause.',
    },
  },
];

/**
 * How many Emergency cards a player draws in a month of the game (JFK, 2026-11): a medium board has 3 Emergency tiles in 36 spaces and a
 * Payday every 9, a token moves about 3.5 spaces a roll. It is what `insurance-value.ts` and its spec weigh a premium against.
 */
export const EMERGENCIES_PER_PAYDAY = 0.22;

export const insuranceInfo = (kind: string): InsuranceInfo | undefined =>
  INSURANCE_CATALOG.find((entry) => entry.kind === kind);

/** What the premium of an insurance is a month for a character, in minor units, whole euros: dearer lives and insurances cost more. */
export function premiumMinor(baseMinor: number, priceFactor = 1, insuranceFactor = 1): number {
  const euros = (baseMinor / 100) * Math.sqrt(priceFactor) * insuranceFactor;
  return Math.max(100, Math.round(euros) * 100);
}

/** What a car insurance costs a month. */
export function carPremiumMinor(
  kind: CarInsuranceKind,
  priceFactor = 1,
  insuranceFactor = 1,
): number {
  return premiumMinor(insuranceInfo(kind)!.baseMinor!, priceFactor, insuranceFactor);
}

interface BooksWithInsurance {
  state: CashflowGameState;
  subscriptions: BookSubscription[];
}

interface PremiumOptions {
  priceFactor?: number;
  insuranceFactor?: number;
  date?: string;
}

/** What a character can be offered: every insurance that has a premium of its own (liability and household are the profession's). */
function offerable(): InsuranceInfo[] {
  return INSURANCE_CATALOG.filter((info) => info.baseMinor !== undefined);
}

function offerLines<T extends BooksWithInsurance>(
  books: T,
  wanted: (info: InsuranceInfo) => boolean,
  options: PremiumOptions,
): T {
  const { state } = books;
  const known = state.insurance?.premiums ?? {};
  const missing = offerable().filter((info) => wanted(info) && !(info.kind in known));
  if (missing.length === 0) return books;
  const premiums = { ...known };
  const titles = [...state.gameSubscriptionTitles];
  const lineTitles = { ...(state.lineTitles ?? {}) };
  const added: BookSubscription[] = [];
  for (const info of missing) {
    premiums[info.kind] = info.lineTitle;
    lineTitles[info.lineKey] = info.lineTitle;
    if (!titles.includes(info.lineTitle)) titles.push(info.lineTitle);
    added.push({
      title: info.lineTitle,
      account: 'Fire',
      amountMinor: -premiumMinor(info.baseMinor!, options.priceFactor, options.insuranceFactor),
      startDate: options.date ?? '',
      endDate: '',
      category: `@${info.lineTitle}`,
      comment: '#dreamfund',
      frequency: 'monthly',
    });
  }
  return {
    ...books,
    subscriptions: [
      ...books.subscriptions.filter((sub) => !added.some((line) => line.title === sub.title)),
      ...added,
    ],
    state: {
      ...state,
      gameSubscriptionTitles: titles,
      lineTitles,
      insurance: {
        active: state.insurance?.active ?? [],
        premiums,
        pending: state.insurance?.pending ?? [],
        ...(state.insurance?.fresh ? { fresh: state.insurance.fresh } : {}),
      },
    },
  };
}

/**
 * Every insurance of the catalogue is on offer (JFK, 2026-11-03): a premium line for each, not held until the
 * player hops in. The ones the profession carries (liability, household) keep their own line. Done again it changes nothing.
 */
export function offerInsurances<T extends BooksWithInsurance>(
  books: T,
  options: PremiumOptions,
): T {
  return offerLines(books, () => true, options);
}

/**
 * The subscriptions as the next Payday will post them (JFK, 2026-11-03): the premium of an insurance that is not held after it is not on
 * the bill, so it is not listed. The cover itself changes with the Payday, as `queueInsuranceChange` says.
 */
export function withoutDroppedPremiums<T extends BooksWithInsurance>(books: T): T {
  const offers = insuranceOffers(books.state);
  const off = new Set(offers.filter((offer) => !offer.heldNext).map((offer) => offer.premiumTitle));
  if (off.size === 0) return books;
  return { ...books, subscriptions: books.subscriptions.filter((sub) => !off.has(sub.title)) };
}

/**
 * The player's choice of an insurance. Before the first roll (`immediate`) it counts at once - nobody can insure just before a fire
 * when no game has been played yet; later it waits for the next Payday, as `queueInsuranceChange` says.
 */
export function chooseInsurance(
  state: CashflowGameState,
  kind: string,
  on: boolean,
  immediate: boolean,
): CashflowGameState {
  if (!state.insurance || !(kind in state.insurance.premiums)) return state;
  let queued = queueInsuranceChange(state, kind, on);
  // of the car insurances only one is held: taking one lets the other go
  const group = insuranceInfo(kind)?.exclusiveGroup;
  if (on && group) {
    for (const other of INSURANCE_CATALOG) {
      if (other.kind !== kind && other.exclusiveGroup === group) {
        queued = queueInsuranceChange(queued, other.kind, false);
      }
    }
  }
  const insurance = queued.insurance!;
  const answered = { ...queued, insurance: { ...insurance, fresh: undefined } };
  const next = immediate ? applyInsuranceChanges(answered) : answered;
  if (next.insurance && next.insurance.fresh === undefined) delete next.insurance.fresh;
  return next;
}
