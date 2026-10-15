import { fixedClock } from '../clock';
import { identityText } from '../game-text';
import type { TableContext } from './reducer';

/**
 * Shared set-up for the table's tests (and for the server's later): a context with a fixed clock, untranslated text and plain
 * money formatting. Not exported from the package.
 */
export const testContext: TableContext = {
  clock: fixedClock('2026-10-15', '2026-10-15T09:00:00.000Z'),
  text: identityText,
  money: (minor) => `${minor / 100}`,
  plainMoney: (minor) => `${minor / 100}`,
  cards: {
    textFor: () => ({}),
    symbolFor: (symbol: string | undefined) => symbol,
    sharedText: () => '',
    groupName: (group: string) => group,
  },
};

/** Freezes a value deeply, so a test proves a function never mutates what it is given. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}
