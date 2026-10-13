import { randomUuid } from './transaction-ids';

/** Stable id for a transfer. */
export function newTransferId(): string {
  return `xfer_${randomUuid()}`;
}

export interface TransferDraft {
  fromLocationId: string | null | undefined;
  toLocationId: string | null | undefined;
  amount: number;
  date: string;
}

/**
 * Why a transfer cannot be saved, or null when it can: both ends are needed, they must differ, and the amount is a
 * positive number (the direction is from -> to, so an amount is never negative).
 */
export function transferProblem(draft: TransferDraft): string | null {
  if (!draft.fromLocationId) return 'Choose where the money comes from.';
  if (!draft.toLocationId) return 'Choose where the money goes to.';
  if (draft.fromLocationId === draft.toLocationId) {
    return 'A transfer needs two different locations.';
  }
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    return 'Enter an amount greater than 0.';
  }
  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'Choose a date.';
  return null;
}

/** Stable id for a recurring transfer. */
export function newRecurringTransferId(): string {
  return `rtransfer_${randomUuid()}`;
}

export interface RecurringDraft extends TransferDraft {
  startDate: string;
  endDate: string;
}

/** Why a recurring transfer cannot be saved, or null: a transfer's rules, plus a start date and a sane end date. */
export function recurringProblem(draft: RecurringDraft): string | null {
  const problem = transferProblem({ ...draft, date: draft.startDate });
  if (problem) return problem === 'Choose a date.' ? 'Choose a start date.' : problem;
  if (draft.endDate && draft.endDate < draft.startDate) {
    return 'The end date cannot be before the start date.';
  }
  return null;
}
