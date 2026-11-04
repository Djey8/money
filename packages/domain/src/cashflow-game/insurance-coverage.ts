import { isInsuredAgainst, type EmergencyCard } from './emergency-deck';

/**
 * The cards an insurance works on (JFK, 2026-11-03): the Emergency cards that name it - the full car cover also those of the partial
 * cover. An insurance with no card is listed as still to come (todo/dreamfund-insurances.md); it has no effect yet. The cards are
 * given by the caller: the domain package does not import the printed catalog itself, so it stays out of every bundle that imports it
 * (the app loads it on demand, ADR-0004).
 */
export function insuranceCoverage(kind: string, cards: readonly EmergencyCard[]): EmergencyCard[] {
  return cards.filter((card) => isInsuredAgainst(card, [kind]));
}
