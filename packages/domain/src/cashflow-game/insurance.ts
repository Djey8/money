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
}

/** Everything the player can switch, with what is waiting for the next Payday. */
export function insuranceOffers(state: Pick<CashflowGameState, 'insurance'>): InsuranceOffer[] {
  const insurance = state.insurance;
  if (!insurance) return [];
  return Object.entries(insurance.premiums).map(([kind, premiumTitle]) => {
    const held = insurance.active.includes(kind);
    const change = insurance.pending.find((candidate) => candidate.kind === kind);
    return { kind, premiumTitle, held, heldNext: change ? change.on : held };
  });
}
