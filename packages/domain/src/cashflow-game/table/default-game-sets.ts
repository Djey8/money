import type { CashflowGameSet } from '../types';

/**
 * The game sets a table falls back to when its context names none. The domain package does not import the printed card catalog
 * itself - it would then travel into every bundle that imports the package, the Firebase edition's included (ADR-0004, found by
 * the edition guard 2026-10-18). The caller that has the catalog (the server, the lab scripts, the specs) registers it once.
 */
let registered: CashflowGameSet[] | null = null;

export function setDefaultTableGameSets(gameSets: CashflowGameSet[]): void {
  registered = gameSets;
}

export function defaultTableGameSets(): CashflowGameSet[] {
  if (!registered) {
    throw new Error(
      'No game sets: give the table context its gameSets, or register them with setDefaultTableGameSets.',
    );
  }
  return registered;
}
