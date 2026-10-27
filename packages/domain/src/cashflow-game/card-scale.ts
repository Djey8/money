import type { CashflowGameSet } from './types';

/**
 * The price level of a character (JFK, 2026-10-27): a surgeon and a dual student play the same cards, but the surgeon's cards are
 * bigger - a share costs more and pays more, a property is a bigger property, a dream costs more - by the same factor everywhere, so
 * what a card is worth in proportion to the character's life stays the same. Only the amounts of the Opportunity, Harvest and Dream
 * piles are scaled; the Emergency and Life piles follow the character's living standard.
 */

/** A key that holds money (in minor units): `costMinor`, `unitPriceMinor`, and `minor` of an expense card. */
const isMoneyKey = (key: string) => key.endsWith('Minor') || key === 'minor';

/**
 * Round numbers (JFK, 2026-10-27: Easy works with round and nice numbers): the step grows with the amount, so 1,234 becomes 1,200 and
 * 12,340 becomes 12,500.
 */
export function niceMinor(minor: number): number {
  const abs = Math.abs(minor);
  const step =
    abs >= 10_000_000
      ? 1_000_000
      : abs >= 1_000_000
        ? 100_000
        : abs >= 200_000
          ? 50_000
          : abs >= 50_000
            ? 10_000
            : abs >= 10_000
              ? 5_000
              : abs >= 2_000
                ? 500
                : abs >= 500
                  ? 100
                  : 0;
  return step ? Math.round(minor / step) * step : minor;
}

export interface ScaleOptions {
  /** Round the amounts to nice numbers (Easy). */
  round?: boolean;
}

function scaleValue(
  value: unknown,
  factor: number,
  options: ScaleOptions,
  money: boolean,
): unknown {
  if (typeof value === 'number') {
    if (!money) return value;
    const scaled = Math.round(value * factor);
    return options.round ? niceMinor(scaled) : scaled;
  }
  if (Array.isArray(value)) return value.map((item) => scaleValue(item, factor, options, money));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        scaleValue(item, factor, options, money || isMoneyKey(key)),
      ]),
    );
  }
  return value;
}

/** A copy of data with every amount in it multiplied by the factor (percentages, counts and ids stay). */
export function scaleMoney<T>(value: T, factor: number, options: ScaleOptions = {}): T {
  return scaleValue(value, factor, options, false) as T;
}

const cache = new WeakMap<CashflowGameSet, Map<string, CashflowGameSet>>();

/**
 * The game set as one character plays it: the piles of cards scaled to the character's price level. A factor of 1 without rounding
 * is the set itself (nothing is copied); the result is kept per set and factor.
 */
export function gameSetFor(
  set: CashflowGameSet,
  factor: number | undefined,
  options: ScaleOptions = {},
): CashflowGameSet {
  const scale = factor ?? 1;
  if (scale === 1 && !options.round) return set;
  const key = `${scale}|${options.round ? 'round' : 'exact'}`;
  let sets = cache.get(set);
  if (!sets) cache.set(set, (sets = new Map()));
  let scaled = sets.get(key);
  if (!scaled && set.decks) {
    const decks = { ...set.decks };
    for (const pile of ['opportunity', 'harvest', 'dream'] as const) {
      if (decks[pile]) {
        (decks as Record<string, unknown>)[pile] = scaleMoney(decks[pile], scale, options);
      }
    }
    scaled = {
      ...set,
      loanRule: scaleMoney(set.loanRule, scale, options),
      decks,
    };
    sets.set(key, scaled);
  }
  return scaled ?? set;
}
