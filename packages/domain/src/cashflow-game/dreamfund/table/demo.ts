import { DEMO_RIGS } from './demo-rigs.generated';
import type { DreamCommand, DreamTable } from './types';

/**
 * The forced throws of the guided demo game (demo-setup.ts). A table's dice and cards all come from one number, `rngState`; the story of
 * the demo needs some moves to come out one way (this die, that card), so for each of them the authoring script
 * (scripts/dreamfund-demo-author.js) searched the number that makes the real rules give exactly that, and wrote it into
 * demo-rigs.generated.ts. When the person at a demo table makes the next move of the story, the table plays that number instead of its own.
 * Everything else - the other player, a move that is not next in the story - plays the table's own randomness, so nothing here can be exploited
 * on a normal table: it only does anything when `settings.demo` is set.
 */

export interface DemoRig {
  type: DreamCommand['type'];
  state: number;
  label?: string;
}

/** The number to play instead of the table's own for this move, or null. */
export function demoRigFor(
  table: DreamTable,
  playerId: string,
  command: DreamCommand,
): number | null {
  if (!table.settings.demo || table.hostId !== playerId) return null;
  const next = DEMO_RIGS[table.demoStep ?? 0];
  return next && next.type === command.type ? next.state : null;
}
