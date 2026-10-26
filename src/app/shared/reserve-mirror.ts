import { AppStateService } from './services/app-state.service';

/**
 * The emergency reserve of a game is the Mojo (JFK, 2026-10-26): its Fire project only follows it, bucket by bucket. Called wherever the
 * Mojo changes - the income statement rebuilding the funds, and the Add dialog putting money into `@Mojo`.
 */
export function mirrorReserveToMojo(): void {
  const state = AppStateService.instance;
  let inMojo = Number(state.mojo?.amount) || 0;
  for (const project of state.allFireEmergencies.filter((fire) => fire.reserve)) {
    for (const bucket of project.buckets) {
      const part = Math.min(Number(bucket.target), Math.max(0, inMojo));
      bucket.amount = Math.round(part * 100) / 100;
      inMojo -= part;
    }
  }
}
