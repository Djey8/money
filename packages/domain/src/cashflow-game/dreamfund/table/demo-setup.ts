import { DREAM_COACH_ID } from './bot-levels';
import type { DreamSettingsInput } from './types';

/**
 * The guided demo game (JFK, 2026-11-06): a table of one person and the bot Coach on a fixed map, where the person lives Jonas and the
 * dice and cards of the first rounds are always the same, so a coach on the screen can say exactly what is about to happen. It is the
 * real game on the real server - never ranked, never kept in the history (the server deletes it when it is over or stopped) - and
 * it is started from the manual, from the lobby, or by seating Coach at any table that has one person.
 */

/** The bot that makes a table the demo. */
export const DEMO_BOT = DREAM_COACH_ID;
/** The character of the demo: a dual student, the gentlest start. */
export const DEMO_CHARACTER = 'dual-student-informatik';
/** The layout seed of the demo map (a medium ring: an Opportunity, an Emergency, a Harvest, a Payday, a Dream, a Life card, a second Payday and a Career tile, in that order). */
export const DEMO_LAYOUT_SEED = 12;

/** The settings of the demo table: whatever the host asked for, these are what it is. */
export const DEMO_SETTINGS: DreamSettingsInput = {
  name: 'Guided demo',
  visibility: 'private',
  maxSeats: 2,
  difficulty: 'medium',
  shape: 'ring',
  size: 'medium',
  layoutSeed: DEMO_LAYOUT_SEED,
  mode: 'guided',
  professions: 'duplicates',
  turnOrder: 'seat',
  endCondition: 'first-win',
  spectators: false,
  pace: 'fast',
  turnGate: false,
  ranked: false,
  demo: 'basics',
};
