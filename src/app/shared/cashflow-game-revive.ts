/**
 * Reading back the parts of a saved game that the field-by-field reader of `AppDataService` does not list (JFK, 2026-10-26): the life,
 * the career, the dreams, the insurances, the card of a tile. Every leaf of a saved game is stored encrypted, as text, so a number or a
 * yes/no comes back as text. The names of the fields say what they were: those that hold numbers and those that hold a yes or no; the
 * rest are text. A field that is added to one of these parts only has to be named here if it is a number or a yes/no.
 */

/** Fields (by name, in any of these parts) that hold a number. */
const NUMBER_FIELDS = new Set([
  'kids',
  'kidsDelta',
  'age',
  'round',
  'points',
  'bonusPoints',
  'offersPerLanding',
  'dreamOffers',
  'maxOpenDreams',
  'livingStandard',
  'rollFrom',
  'minPaydays',
  'paydaysInStage',
  'sinceBonus',
  'everyPaydays',
  'roll',
  'confirmRoll',
  'momentRoll',
  'from',
  'upTo',
  'count',
]);

/** Fields that hold a yes or no. */
const BOOLEAN_FIELDS = new Set([
  'on',
  'car',
  'rerolled',
  'boost',
  'declined',
  'dreamMayDecline',
  'lifeMayDecline',
  'careerMustRoll',
  'ownProjects',
  'done',
  'sponsorship',
  'ongoingReward',
  'lifeCanDecline',
]);

/** Fields whose parts are all numbers, whatever their own names are (the dice rolled on a card). */
const NUMBER_CONTAINERS = new Set(['rolls']);

function isNumberField(key: string): boolean {
  return NUMBER_FIELDS.has(key) || /(Minor|Left|Percent|Turns|Paydays|Count)$/.test(key);
}

/**
 * Turns a stored value back into what it was: objects and lists keep their shape, every leaf is decrypted (`decrypt`) and made a number
 * or a yes/no by the name of its field.
 */
export function reviveGameValue(
  value: unknown,
  decrypt: (leaf: string) => string,
  key = '',
  numbers = false,
): unknown {
  if (value === null || value === undefined) return undefined;
  const allNumbers = numbers || NUMBER_CONTAINERS.has(key);
  if (Array.isArray(value)) {
    return value.map((item) => reviveGameValue(item, decrypt, key, allNumbers));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
      const revived = reviveGameValue(item, decrypt, name, allNumbers);
      if (revived !== undefined) out[name] = revived;
    }
    return out;
  }
  const text = decrypt(typeof value === 'string' ? value : String(value));
  if (numbers || isNumberField(key)) {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (BOOLEAN_FIELDS.has(key)) return text === 'true';
  return text;
}

/** The parts of a game state this reader covers. */
export const REVIVED_GAME_FIELDS = [
  'emergencyDeck',
  'insurance',
  'possessions',
  'traits',
  'flags',
  'life',
  'lifeLines',
  'lifeScheduled',
  'lifeDeck',
  'jobSearch',
  'sponsorship',
  'livingStandard',
  'lineTitles',
  'lifeNews',
  'career',
  'dreams',
  'dreamSettings',
  'dreamDeck',
  // the budget the game planned: months of rows (a tag and an amount)
  'budgetPlan',
  'customRules',
] as const;

/** What a tile asks of the turn besides its kind and place: the card drawn and what was done with it. */
export const REVIVED_PENDING_FIELDS = [
  'tile',
  'storyCardId',
  'emergency',
  'life',
  'career',
  'dream',
] as const;

function reviveFields(
  raw: Record<string, unknown>,
  fields: readonly string[],
  decrypt: (leaf: string) => string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (raw[field] == null) continue;
    const revived = reviveGameValue(raw[field], decrypt, field);
    if (revived !== undefined) out[field] = revived;
  }
  return out;
}

/** The parts of a saved game this reader covers, revived; fields the game was saved without stay out. */
export function reviveGameExtras(
  raw: Record<string, unknown>,
  decrypt: (leaf: string) => string,
): Record<string, unknown> {
  return reviveFields(raw, REVIVED_GAME_FIELDS, decrypt);
}

/** The same for the pending decision of the turn. */
export function revivePendingExtras(
  pending: Record<string, unknown>,
  decrypt: (leaf: string) => string,
): Record<string, unknown> {
  return reviveFields(pending, REVIVED_PENDING_FIELDS, decrypt);
}
