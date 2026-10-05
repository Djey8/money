import { AppStateService } from './services/app-state.service';

/**
 * How many coins of a special asset (gold) the player still owns, or 0 when the asset is not tracked
 * in coins (every ordinary asset). The count lives in the game's own state, not on the Asset record.
 */
export function coinsOwned(title: string): number {
  const deal = AppStateService.instance.cashflowGame?.assetDeals?.find(
    (candidate) => candidate.title === title && candidate.stage === 'owned',
  );
  return deal?.coins ?? 0;
}

/** The comment the Sell button pre-fills: "Sell Asset GOLD 10 x 300;" - all the coins you have, at their book value each - for coin assets; the usual "1 x <value>" for any other asset. */
export function assetSellComment(title: string, bookValue: number): string {
  const coins = coinsOwned(title);
  if (coins > 0)
    return `Sell Asset ${title} ${coins} x ${Math.round((bookValue / coins) * 100) / 100};`;
  return `Sell Asset ${title} 1 x ${bookValue};`;
}
