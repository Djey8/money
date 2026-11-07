import type { CashflowGameSet } from './types';

/** Looks a game set / profession up by id in whatever sets the caller holds. */
export function findCashflowGameSet(
  gameSets: CashflowGameSet[],
  gameSetId: string,
): CashflowGameSet {
  const gameSet = gameSets.find((candidate) => candidate.id === gameSetId);
  if (!gameSet) throw new Error(`Unknown Cashflow game set: ${gameSetId}`);
  return gameSet;
}

/**
 * The id a character is played under at a difficulty (JFK, 2026-10-27): the Easy and the Hard version of a character are characters of
 * their own that share the story (`id~easy`, `id~hard`); Medium is the id itself. A character without versions stays as it is.
 */
export function professionIdAtDifficulty(
  gameSet: CashflowGameSet | undefined,
  professionId: string,
  difficulty: 'easy' | 'medium' | 'hard' | undefined,
): string {
  const base = professionId.split('~')[0];
  if (!difficulty || difficulty === 'medium') return base;
  const id = `${base}~${difficulty}`;
  return gameSet?.professions.some((candidate) => candidate.id === id) ? id : base;
}

export function findCashflowProfession(gameSet: CashflowGameSet, professionId: string) {
  const profession = gameSet.professions.find((candidate) => candidate.id === professionId);
  if (!profession) {
    throw new Error(`Unknown Cashflow profession: ${professionId} (game set ${gameSet.id})`);
  }
  return profession;
}
