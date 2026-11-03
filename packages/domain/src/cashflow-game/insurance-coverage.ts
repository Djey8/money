import { EMERGENCY_CARDS } from '../cashflow-emergency-cards';
import { isInsuredAgainst, type EmergencyCard } from './emergency-deck';

/**
 * The cards an insurance works on (JFK, 2026-11-03): the Emergency cards that name it - the full car cover also those of the partial
 * cover. An insurance with no card is listed as still to come (todo/dreamfund-insurances.md); it has no effect yet.
 */
export function insuranceCoverage(kind: string): EmergencyCard[] {
  return (EMERGENCY_CARDS as unknown as EmergencyCard[]).filter((card) =>
    isInsuredAgainst(card, [kind]),
  );
}
