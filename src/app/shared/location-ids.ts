import { randomUuid } from './transaction-ids';

/** Stable id for a location; transactions and transfers reference it, so a rename never breaks a link. */
export function newLocationId(): string {
  return `loc_${randomUuid()}`;
}
