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

// ── the car insurances (JFK, 2026-11-02) ──

export type CarInsuranceKind = 'car_partial' | 'car_full';
export const CAR_INSURANCES: readonly CarInsuranceKind[] = ['car_partial', 'car_full'];

const CAR_PREMIUMS: Record<CarInsuranceKind, { base: number; key: string; title: string }> = {
  car_partial: { base: 3000, key: 'carPartialInsurance', title: 'Teilkaskoversicherung' },
  car_full: { base: 6000, key: 'carFullInsurance', title: 'Vollkaskoversicherung' },
};

/**
 * What a car insurance costs a month, in minor units, whole euros: the base grows with the root of the character's price level (a dearer
 * car, a dearer repair) and with how the character's insurances compare with the Dual Student's.
 */
export function carPremiumMinor(
  kind: CarInsuranceKind,
  priceFactor = 1,
  insuranceFactor = 1,
): number {
  const euros = (CAR_PREMIUMS[kind].base / 100) * Math.sqrt(priceFactor) * insuranceFactor;
  return Math.max(100, Math.round(euros) * 100);
}

interface BooksWithInsurance {
  state: CashflowGameState;
  subscriptions: BookSubscription[];
}

/**
 * A character with a car is offered the two car insurances: a premium line for each, not held yet (so nothing is paid until the player
 * hops in) and listed as `fresh` so that the screen can say so. Done again it changes nothing.
 */
export function offerCarInsurance<T extends BooksWithInsurance>(
  books: T,
  options: { priceFactor?: number; insuranceFactor?: number; date?: string },
): T {
  const { state } = books;
  if (!state.life?.car) return books;
  const known = state.insurance?.premiums ?? {};
  const missing = CAR_INSURANCES.filter((kind) => !(kind in known));
  if (missing.length === 0) return books;
  const premiums = { ...known };
  const titles = [...state.gameSubscriptionTitles];
  const lineTitles = { ...(state.lineTitles ?? {}) };
  const added: BookSubscription[] = [];
  for (const kind of missing) {
    const info = CAR_PREMIUMS[kind];
    premiums[kind] = info.title;
    lineTitles[info.key] = info.title;
    if (!titles.includes(info.title)) titles.push(info.title);
    added.push({
      title: info.title,
      account: 'Fire',
      amountMinor: -carPremiumMinor(kind, options.priceFactor, options.insuranceFactor),
      startDate: options.date ?? '',
      endDate: '',
      category: `@${info.title}`,
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
        fresh: [...(state.insurance?.fresh ?? []), ...missing],
      },
    },
  };
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
  const queued = queueInsuranceChange(state, kind, on);
  const insurance = queued.insurance!;
  const answered = { ...queued, insurance: { ...insurance, fresh: undefined } };
  const next = immediate ? applyInsuranceChanges(answered) : answered;
  if (next.insurance && next.insurance.fresh === undefined) delete next.insurance.fresh;
  return next;
}
