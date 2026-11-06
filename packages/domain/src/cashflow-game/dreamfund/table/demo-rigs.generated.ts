// Written by scripts/dreamfund-demo-author.js - do not edit by hand.
import type { DemoRig } from './demo';

/** The forced throws of the guided demo, in the order the story makes them. */
export const DEMO_RIGS: DemoRig[] = [
  { type: 'roll', state: 3816266512, label: "roll 1 -> Opportunity" },
  { type: 'choose_pile', state: 1401181143, label: "Seed pile with the subscription audit" },
  { type: 'roll_opportunity', state: 2654435761, label: "the saving card die" },
  { type: 'roll', state: 3972434726, label: "roll 2 -> an Emergency that needs the Bank" },
  { type: 'roll', state: 3668339987, label: "roll 3 -> Harvest" },
  { type: 'roll', state: 3816266512, label: "roll 4 -> Payday" },
  { type: 'roll', state: 3493733942, label: "roll 5 -> Dream" },
  { type: 'roll', state: 2323661502, label: "roll 6 -> Life (a gym membership)" },
  { type: 'roll', state: 3668339987, label: "roll 7 -> Payday" },
  { type: 'roll', state: 1161830751, label: "roll 8 -> Career, promoted" },
];
