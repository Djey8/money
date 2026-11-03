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

/** How much an insurance is worth to most people: what a plain-spoken adviser would say. */
export type InsuranceValue = 'essential' | 'useful' | 'situational' | 'rarely';

interface Words {
  en: string;
  de: string;
}

export interface InsuranceInfo {
  kind: string;
  /** 1 is decided first: the order of the decision, the most important first. */
  priority: number;
  value: InsuranceValue;
  /** Only a character who has a car / a pet is offered it. */
  needs?: 'car' | 'pet';
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
  /** What it protects against, in the player's words. */
  covers: Words;
  /** What it does in the game: the effect on the cards it applies to. */
  effect: Words;
  /** Why it is worth it - or why it is not. */
  advice: Words;
}

/**
 * Every insurance of the game, most important first. An insurance only ever works on the cards that name it (`EmergencyCard.insurance`);
 * one with no card yet is listed as such (`insuranceCoverage`) and the cards for it are still to be written (todo/dreamfund-insurances.md).
 */
export const INSURANCE_CATALOG: readonly InsuranceInfo[] = [
  {
    kind: 'liability',
    priority: 1,
    value: 'essential',
    lineKey: 'liabilityInsurance',
    lineTitle: 'Haftpflichtversicherung',
    covers: {
      en: "Damage you cause to other people or their things: the neighbour's window, a bike you knock over, a borrowed phone you drop. Also a lost key of somebody else's.",
      de: 'Schäden, die du anderen oder ihren Sachen zufügst: das Fenster des Nachbarn, ein umgestoßenes Fahrrad, ein heruntergefallenes geliehenes Handy. Auch ein verlorener fremder Schlüssel.',
    },
    effect: {
      en: 'An emergency card of this kind costs you the deductible only, never more than 500.',
      de: 'Eine Notfallkarte dieser Art kostet dich nur den Selbstbehalt, nie mehr als 500.',
    },
    advice: {
      en: 'The cheapest protection against the biggest ruin: one bad accident can mean debt for life. Everybody should have it.',
      de: 'Der günstigste Schutz gegen den größten Ruin: ein schlimmer Unfall kann Schulden fürs Leben bedeuten. Jeder sollte sie haben.',
    },
  },
  {
    kind: 'disability',
    priority: 2,
    value: 'essential',
    baseMinor: 6500,
    lineKey: 'disabilityInsurance',
    lineTitle: 'Berufsunfähigkeitsversicherung',
    covers: {
      en: 'You can no longer do your job because of an illness or an accident: it pays a monthly pension instead of your salary.',
      de: 'Du kannst wegen Krankheit oder Unfall deinen Beruf nicht mehr ausüben: sie zahlt eine monatliche Rente anstelle deines Gehalts.',
    },
    effect: {
      en: 'Protects against the events that take your income away (cards for it are still to come).',
      de: 'Schützt vor Ereignissen, die dein Einkommen wegnehmen (Karten dazu folgen noch).',
    },
    advice: {
      en: 'Dear, but the one that keeps a working life from ending in a crash. Worth it the earlier you start.',
      de: 'Teuer, aber sie verhindert, dass ein Arbeitsleben in einem Absturz endet. Lohnt sich umso mehr, je früher du anfängst.',
    },
  },
  {
    kind: 'household',
    priority: 3,
    value: 'essential',
    lineKey: 'householdInsurance',
    lineTitle: 'Hausratversicherung',
    covers: {
      en: 'Your things at home: a burglary, a fire, a burst pipe, a storm - everything you own that is not nailed down.',
      de: 'Deine Sachen zu Hause: Einbruch, Feuer, Leitungswasser, Sturm - alles, was nicht niet- und nagelfest ist.',
    },
    effect: {
      en: 'An emergency card of this kind costs you the deductible only, never more than 500.',
      de: 'Eine Notfallkarte dieser Art kostet dich nur den Selbstbehalt, nie mehr als 500.',
    },
    advice: {
      en: 'Cheap against a loss that would take years to pay off. Keep it while you own things you could not replace from savings.',
      de: 'Günstig gegen einen Verlust, den du jahrelang abzahlen müsstest. Behalte sie, solange du Dinge besitzt, die du nicht aus Rücklagen ersetzen könntest.',
    },
  },
  {
    kind: 'car_partial',
    priority: 4,
    value: 'useful',
    needs: 'car',
    exclusiveGroup: 'car',
    baseMinor: 3000,
    lineKey: 'carPartialInsurance',
    lineTitle: 'Teilkaskoversicherung',
    covers: {
      en: 'Your car against theft, glass breakage, fire, storm, hail and a collision with game.',
      de: 'Dein Auto gegen Diebstahl, Glasbruch, Brand, Sturm, Hagel und Wildunfall.',
    },
    effect: {
      en: 'A car emergency of this kind costs you the deductible only. It does not cover a crash you caused yourself.',
      de: 'Ein Autonotfall dieser Art kostet dich nur den Selbstbehalt. Einen selbst verschuldeten Unfall deckt sie nicht.',
    },
    advice: {
      en: 'A good middle: the usual damage is covered for little. You cannot hold it together with the full cover.',
      de: 'Ein guter Mittelweg: die üblichen Schäden sind günstig gedeckt. Zusammen mit der Vollkasko geht sie nicht.',
    },
  },
  {
    kind: 'car_full',
    priority: 4,
    value: 'situational',
    needs: 'car',
    exclusiveGroup: 'car',
    baseMinor: 6000,
    lineKey: 'carFullInsurance',
    lineTitle: 'Vollkaskoversicherung',
    covers: {
      en: 'Everything the partial cover pays, and your own car after a crash you caused or vandalism.',
      de: 'Alles, was die Teilkasko zahlt, und dein eigenes Auto nach einem selbst verschuldeten Unfall oder Vandalismus.',
    },
    effect: {
      en: 'Covers the cards of the partial cover and the damage you cause yourself, for the deductible only.',
      de: 'Deckt die Karten der Teilkasko und selbst verursachte Schäden, nur gegen den Selbstbehalt.',
    },
    advice: {
      en: 'Twice the price of the partial cover. Worth it for a new or dear car; an old one rarely repays it.',
      de: 'Doppelt so teuer wie die Teilkasko. Lohnt sich für ein neues oder teures Auto; bei einem alten selten.',
    },
  },
  {
    kind: 'legal',
    priority: 5,
    value: 'useful',
    baseMinor: 2500,
    lineKey: 'legalInsurance',
    lineTitle: 'Rechtsschutzversicherung',
    covers: {
      en: 'The costs of a lawsuit or a lawyer: a dispute with the landlord, the employer, a seller or after a traffic accident.',
      de: 'Die Kosten für Anwalt und Gericht: Streit mit Vermieter, Arbeitgeber, Verkäufer oder nach einem Verkehrsunfall.',
    },
    effect: {
      en: 'Protects against legal-dispute cards (still to come).',
      de: 'Schützt vor Rechtsstreit-Karten (folgen noch).',
    },
    advice: {
      en: 'Useful when you rent or work in a conflict-prone place; most years it pays nothing.',
      de: 'Sinnvoll, wenn du zur Miete wohnst oder in einem streitanfälligen Umfeld arbeitest; in den meisten Jahren zahlt sie nichts.',
    },
  },
  {
    kind: 'accident',
    priority: 6,
    value: 'useful',
    baseMinor: 1200,
    lineKey: 'accidentInsurance',
    lineTitle: 'Unfallversicherung',
    covers: {
      en: 'A lasting damage to your health after an accident, in leisure time too: a lump sum when you stay impaired.',
      de: 'Ein dauerhafter Gesundheitsschaden nach einem Unfall, auch in der Freizeit: eine Einmalzahlung bei bleibender Beeinträchtigung.',
    },
    effect: {
      en: 'Softens the accident cards (still to come).',
      de: 'Mildert die Unfall-Karten (folgen noch).',
    },
    advice: {
      en: 'Cheap, but it only pays for accidents - an illness is not covered. No substitute for the disability insurance.',
      de: 'Günstig, zahlt aber nur bei Unfällen - Krankheit ist nicht gedeckt. Kein Ersatz für die Berufsunfähigkeit.',
    },
  },
  {
    kind: 'life_risk',
    priority: 7,
    value: 'situational',
    baseMinor: 2000,
    lineKey: 'riskLifeInsurance',
    lineTitle: 'Risikolebensversicherung',
    covers: {
      en: 'Your death: it pays the family or the partner a sum so that a home or a loan can be carried on.',
      de: 'Dein Tod: sie zahlt der Familie oder dem Partner eine Summe, damit Haus oder Kredit weiter getragen werden können.',
    },
    effect: {
      en: 'Protects people who depend on you (cards for it are still to come).',
      de: 'Schützt Menschen, die von dir abhängen (Karten dazu folgen noch).',
    },
    advice: {
      en: 'Only for those with children, a partner who depends on them or a loan taken together. Alone it is a waste.',
      de: 'Nur für Menschen mit Kindern, einem abhängigen Partner oder einem gemeinsamen Kredit. Allein ist sie Verschwendung.',
    },
  },
  {
    kind: 'dental',
    priority: 8,
    value: 'situational',
    baseMinor: 2000,
    lineKey: 'dentalInsurance',
    lineTitle: 'Zahnzusatzversicherung',
    covers: {
      en: 'What the health insurance does not pay at the dentist: crowns, implants, a professional cleaning.',
      de: 'Was die Krankenkasse beim Zahnarzt nicht zahlt: Kronen, Implantate, professionelle Zahnreinigung.',
    },
    effect: {
      en: 'Makes the dentist cards cheaper (still to come).',
      de: 'Macht die Zahnarzt-Karten günstiger (folgen noch).',
    },
    advice: {
      en: 'Pays off only with a long waiting time ahead of the treatment; taken at the dentist it pays nothing.',
      de: 'Lohnt sich nur mit langer Wartezeit vor der Behandlung; erst beim Zahnarzt abgeschlossen zahlt sie nichts.',
    },
  },
  {
    kind: 'household_bike',
    priority: 9,
    value: 'situational',
    baseMinor: 1000,
    lineKey: 'bikeInsurance',
    lineTitle: 'Fahrradversicherung',
    covers: {
      en: 'A stolen bike or e-bike, also when it is locked outside - what the household insurance leaves out.',
      de: 'Ein gestohlenes Fahrrad oder E-Bike, auch wenn es draußen angeschlossen ist - was die Hausrat nicht abdeckt.',
    },
    effect: {
      en: 'A bike theft card costs you the deductible only.',
      de: 'Eine Fahrraddiebstahl-Karte kostet dich nur den Selbstbehalt.',
    },
    advice: {
      en: 'Worth it for a dear bike or a big city. For an old one the premium is soon more than the bike.',
      de: 'Lohnt sich für ein teures Rad oder in der Großstadt. Bei einem alten Rad ist die Prämie bald mehr als das Rad.',
    },
  },
  {
    kind: 'travel',
    priority: 10,
    value: 'situational',
    baseMinor: 800,
    lineKey: 'travelInsurance',
    lineTitle: 'Reiseversicherung',
    covers: {
      en: 'A trip you must cancel and a doctor or a flight home abroad.',
      de: 'Eine Reise, die du absagen musst, und Arzt oder Rückflug im Ausland.',
    },
    effect: {
      en: 'Protects the travel cards (still to come).',
      de: 'Schützt die Reise-Karten (folgen noch).',
    },
    advice: {
      en: 'The foreign health part is cheap and sensible. The cancellation part pays only for a dear trip.',
      de: 'Der Auslandskrankenteil ist günstig und sinnvoll. Der Rücktrittsteil lohnt nur bei einer teuren Reise.',
    },
  },
  {
    kind: 'pet_liability',
    priority: 11,
    value: 'useful',
    needs: 'pet',
    baseMinor: 800,
    lineKey: 'petLiabilityInsurance',
    lineTitle: 'Tierhalterhaftpflicht',
    covers: {
      en: 'What your dog or horse damages or hurts - the private liability does not cover it.',
      de: 'Was dein Hund oder dein Pferd beschädigt oder verletzt - die private Haftpflicht deckt es nicht.',
    },
    effect: {
      en: 'Protects the pet cards (still to come).',
      de: 'Schützt die Tier-Karten (folgen noch).',
    },
    advice: {
      en: 'Required by law for a dog in some states, and worth it everywhere.',
      de: 'Für Hunde in manchen Ländern Pflicht und überall sinnvoll.',
    },
  },
  {
    kind: 'pet_health',
    priority: 12,
    value: 'rarely',
    needs: 'pet',
    baseMinor: 2500,
    lineKey: 'petHealthInsurance',
    lineTitle: 'Tierkrankenversicherung',
    covers: {
      en: "The vet's bill for an operation or a long illness of your pet.",
      de: 'Die Tierarztrechnung für eine Operation oder eine lange Krankheit deines Tieres.',
    },
    effect: {
      en: 'Makes the vet cards cheaper (still to come).',
      de: 'Macht die Tierarzt-Karten günstiger (folgen noch).',
    },
    advice: {
      en: 'Dear for what it pays; many put the money aside for the vet instead.',
      de: 'Teuer für das, was sie zahlt; viele legen das Geld lieber für den Tierarzt zurück.',
    },
  },
  {
    kind: 'phone',
    priority: 13,
    value: 'rarely',
    baseMinor: 900,
    lineKey: 'phoneInsurance',
    lineTitle: 'Handyversicherung',
    covers: {
      en: 'A phone that falls, is stolen or gets wet.',
      de: 'Ein Handy, das herunterfällt, gestohlen wird oder nass wird.',
    },
    effect: {
      en: 'Protects the phone cards (still to come).',
      de: 'Schützt die Handy-Karten (folgen noch).',
    },
    advice: {
      en: 'Over two years the premiums are nearly the price of a new phone. Rarely worth it.',
      de: 'Über zwei Jahre sind die Prämien fast der Preis eines neuen Handys. Selten lohnend.',
    },
  },
  {
    kind: 'debt',
    priority: 14,
    value: 'rarely',
    baseMinor: 3500,
    lineKey: 'debtInsurance',
    lineTitle: 'Restschuldversicherung',
    covers: {
      en: 'The rest of a loan when you die, are ill or lose your job.',
      de: 'Die Restschuld eines Kredits bei Tod, Krankheit oder Arbeitslosigkeit.',
    },
    effect: {
      en: 'Protects a loan (cards for it are still to come).',
      de: 'Schützt einen Kredit (Karten dazu folgen noch).',
    },
    advice: {
      en: 'Very dear and full of exceptions: the bank earns more on it than on the loan. Better to keep a reserve.',
      de: 'Sehr teuer und voller Ausnahmen: die Bank verdient daran mehr als am Kredit. Besser eine Rücklage behalten.',
    },
  },
];

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

/** What a character can be offered now: the car insurances with a car, the pet insurances with a pet. */
function offerable(state: CashflowGameState): InsuranceInfo[] {
  return INSURANCE_CATALOG.filter(
    (info) =>
      info.baseMinor !== undefined &&
      (info.needs !== 'car' || state.life?.car) &&
      (info.needs !== 'pet' || (state.life?.pet && state.life.pet !== 'none')),
  );
}

function offerLines<T extends BooksWithInsurance>(
  books: T,
  wanted: (info: InsuranceInfo) => boolean,
  options: PremiumOptions,
): T {
  const { state } = books;
  const known = state.insurance?.premiums ?? {};
  const missing = offerable(state).filter((info) => wanted(info) && !(info.kind in known));
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
  const fresh = missing.filter((info) => info.needs === 'car').map((info) => info.kind);
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
        ...(fresh.length > 0 || state.insurance?.fresh
          ? { fresh: [...(state.insurance?.fresh ?? []), ...fresh] }
          : {}),
      },
    },
  };
}

/**
 * A character with a car is offered the two car insurances: a premium line for each, not held yet (so nothing is paid until the player
 * hops in) and listed as `fresh` so that the screen can say so. Done again it changes nothing.
 */
export function offerCarInsurance<T extends BooksWithInsurance>(
  books: T,
  options: PremiumOptions,
): T {
  if (!books.state.life?.car) return books;
  return offerLines(books, (info) => info.needs === 'car', options);
}

/**
 * Every insurance of the catalogue the character can have is on offer (JFK, 2026-11-03): a premium line for each, not held until the
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
