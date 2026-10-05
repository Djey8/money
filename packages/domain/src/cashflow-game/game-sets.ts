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

export function findCashflowProfession(gameSet: CashflowGameSet, professionId: string) {
  const profession = gameSet.professions.find((candidate) => candidate.id === professionId);
  if (!profession) {
    throw new Error(`Unknown Cashflow profession: ${professionId} (game set ${gameSet.id})`);
  }
  return profession;
}
