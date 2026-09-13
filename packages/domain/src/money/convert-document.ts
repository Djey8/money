import { isEncryptedValue } from '../crypto/cryptic';
import { fromMinorUnits, isCleanlyRepresentable, toMinorUnits } from './minor-units';

/**
 * Every field name across the documented data model
 * (docs/discovery/DOMAIN_MODEL.md §1) that holds a decimal money amount.
 * Field-name-driven rather than a hand-written path for every entity, so
 * it doesn't matter how deeply a field is nested (e.g. a Grow project's
 * embedded Share/Investment/Liabilitie) — anything named like a documented
 * money field gets converted wherever it appears.
 *
 * NOT included: `quantity` (Share — a count, not money), `investment`
 * (Liability.investment — a boolean flag, not an amount, despite the
 * name), `riskScore` (Grow — a 1-5 rating), any `*Date` field.
 */
export const MONEY_FIELD_NAMES = new Set([
  'amount',
  'deposit',
  'credit',
  'price',
  'target',
  'cashflow',
  'currentCost',
  'targetCost',
  'monthlySavings',
  'annualSavings',
  'alternativeCost',
  'originalCalculatedAmount',
]);

/**
 * `MONEY_FIELD_NAMES` plus every other field that is numeric but not
 * money: `quantity` (Share — a count), `riskScore` (Grow — a 1-5 rating),
 * and Settings' `allocation.{daily,splurge,smile,fire}`
 * (`backend/repositories/settings-repository.js`'s own
 * `Number(decryptValue(...))` calls). `decryptDocumentPreservingTypes`
 * needs "is this stored as a stringified number" for every numeric field,
 * not just money ones.
 *
 * `daily`/`smile`/`fire`/`splurge` are also used elsewhere in the document
 * as *container* keys (`data.smile`/`data.fire` — arrays of projects;
 * `income.expenses.{daily,splurge,smile,fire}` — arrays of tagged amounts)
 * — safe to include here regardless: the walk below resets the field-kind
 * to `undefined` the moment it descends into an array (see `walk`'s array
 * branch), so a container never gets treated as numeric just because its
 * key matches, even for a hypothetical future array of primitives under
 * one of these names.
 */
export const NUMERIC_FIELD_NAMES = new Set([
  ...MONEY_FIELD_NAMES,
  'quantity',
  'riskScore',
  'daily',
  'splurge',
  'smile',
  'fire',
]);

/**
 * Fields stored as the string `'true'`/`'false'` once encrypted (every
 * repository's own `decryptBoolean`-style helper —
 * `typeof decrypted === 'boolean' ? decrypted : decrypted === 'true'` — in
 * `grow-repository.js`, `liability-repository.js`, `fire-repository.js`,
 * `smile-repository.js` (the latter two also for `manuallyAdjusted` on a
 * Smile/Fire payment plan); `settings-repository.js`'s `isEuropeanFormat`
 * is the same idea with a stricter fallback). Liability's `investment` is
 * a real boolean leaf; Grow's own top-level `investment` (an embedded
 * Investment object, or `null`) never reaches the leaf branch below, so
 * the two don't collide despite sharing a name.
 */
export const BOOLEANIZED_FIELD_NAMES = new Set([
  'done',
  'investment',
  'isAsset',
  'isEuropeanFormat',
  'manuallyAdjusted',
]);

export interface DecryptDocumentCallbacks {
  /** Decrypts one stored field value. Required if any field might be encrypted (i.e. the user has `encryptDatabase` enabled) — omit only for a document known to be entirely plaintext. */
  decrypt?: (value: string) => string;
}

type FieldKind = 'numeric' | 'boolean' | undefined;

/**
 * Decrypts every `isEncryptedValue` leaf anywhere in `data` — any nesting,
 * any field name, array elements included, the same shape-driven coverage
 * as `rewriteEncryptedValues` — and additionally recovers the original
 * type for any field named in `NUMERIC_FIELD_NAMES`/`BOOLEANIZED_FIELD_NAMES`.
 * Encryption always stores a value as a plain string (every entity
 * repository's own `writeValue`/`session.encrypt(String(value))` step), so
 * without this, a decrypted `amount` or `isAsset` comes back as the string
 * `"-12.5"`/`"true"` instead of the number `-12.5`/boolean `true`. Every
 * other decrypted value stays a string, matching whatever type it was
 * written as — this function has no way to know a non-numeric,
 * non-boolean field's "real" type beyond string, and doesn't need to for
 * `GET /data/export`'s purpose (its only caller): giving back real
 * plaintext with correct JSON types for the fields that structurally have
 * one.
 *
 * Deliberately separate from `convertDocumentToMinorUnits`: this never
 * rescales a value (no `toMinorUnits`) and never re-encrypts the result —
 * an export must return plaintext, not a migration artifact. Throws if a
 * value looks encrypted but no `decrypt` callback was given, matching
 * `transaction-repository.js`'s existing convention of failing loudly
 * rather than silently returning leftover ciphertext (reachable if
 * `encryptDatabase` was toggled off without re-encrypting already-stored
 * data, which `PUT /encryption-config` explicitly allows).
 *
 * Shares `convertDocumentToMinorUnits`'s `SubscriptionChange.oldValue`/
 * `newValue` context rule: those two fields are only numeric when the
 * sibling `field` property equals `'amount'`.
 */
export function decryptDocumentPreservingTypes(
  data: unknown,
  callbacks: DecryptDocumentCallbacks = {},
): { data: unknown } {
  function decryptIfNeeded(value: unknown): unknown {
    if (isEncryptedValue(value)) {
      if (!callbacks.decrypt) {
        throw new Error(
          'Encrypted value encountered but no decrypt callback was provided (did you forget encryptDatabase handling?)',
        );
      }
      return callbacks.decrypt(value as string);
    }
    return value;
  }

  // `Number(...)`, not `parseFloat(...)` — matches every repository's own
  // `Number(decryptValue(...))` coercion convention. `convertField` below
  // (for `convertDocumentToMinorUnits`) deliberately keeps `parseFloat`
  // instead: that function also reports `skippedNonNumeric` fields via
  // `Number.isNaN`, and `parseFloat`'s more lenient partial-parse behavior
  // (e.g. `"60x"` -> `60`) predates this function and isn't being changed
  // as part of an unrelated export feature.
  function coerce(value: unknown, fieldKind: FieldKind): unknown {
    if (fieldKind === 'boolean') {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }
    if (fieldKind === 'numeric' && (typeof value === 'string' || typeof value === 'number')) {
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isNaN(numeric) ? value : numeric;
    }
    return value;
  }

  function fieldKindFor(key: string, isChangeValueKey: boolean): FieldKind {
    if (NUMERIC_FIELD_NAMES.has(key) || isChangeValueKey) return 'numeric';
    if (BOOLEANIZED_FIELD_NAMES.has(key)) return 'boolean';
    return undefined;
  }

  function walk(node: unknown, fieldKind: FieldKind): unknown {
    // Every array in the real schema that shares a name with
    // `NUMERIC_FIELD_NAMES`/`BOOLEANIZED_FIELD_NAMES` (`data.smile`,
    // `data.fire`, `income.expenses.*`) holds objects, never primitives —
    // but resetting to `undefined` here (rather than propagating the
    // parent's field-kind to each element) means a future array of
    // primitives reusing one of these names fails safe instead of being
    // silently mis-coerced.
    if (Array.isArray(node)) {
      return node.map((item) => walk(item, undefined));
    }
    if (node !== null && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const discriminator = 'field' in obj ? decryptIfNeeded(obj.field) : undefined;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const isChangeValueKey =
          discriminator === 'amount' && (key === 'oldValue' || key === 'newValue');
        result[key] = walk(value, fieldKindFor(key, isChangeValueKey));
      }
      return result;
    }
    return coerce(decryptIfNeeded(node), fieldKind);
  }

  return { data: walk(data, undefined) };
}

export interface ConversionCallbacks {
  /** Decrypts one stored field value. Required if any money field might be encrypted (i.e. the user has `encryptDatabase` enabled) — omit only for plaintext documents. */
  decrypt?: (value: string) => string;
  /** Re-encrypts a converted value for storage, mirroring `decrypt`. Required whenever `decrypt` is provided. */
  encrypt?: (value: string) => string;
}

export interface FieldConversion {
  /** JSONPath-ish location of the field within the document, e.g. `$.transactions[3].amount`. */
  path: string;
  from: number;
  to: number;
  cleanlyRepresentable: boolean;
}

export interface ConversionResult {
  data: unknown;
  fieldsConverted: FieldConversion[];
  /** Fields that looked like a money field by name but didn't hold a parseable number — left untouched, reported so a human can check whether that's expected (e.g. a legitimately empty/null field) or a sign something was missed. */
  skippedNonNumeric: string[];
}

/**
 * Recursively converts every documented money field in `data` from decimal
 * to integer minor units. `data` should already be the parsed `data` object
 * from a user's CouchDB document (i.e. `userDoc.data`, not the whole
 * document) — money fields are the same regardless of which top-level path
 * (`transactions`, `smile`, `balance.asset.shares`, ...) they live under.
 *
 * `SubscriptionChange.oldValue`/`newValue` are the one context-dependent
 * exception: they're only money when the sibling `field` property equals
 * `'amount'` (it can hold a date, account name, category, or frequency
 * otherwise), so they're matched by name + context, not name alone.
 */
export function convertDocumentToMinorUnits(
  data: unknown,
  callbacks: ConversionCallbacks = {},
): ConversionResult {
  const fieldsConverted: FieldConversion[] = [];
  const skippedNonNumeric: string[] = [];

  function decryptIfNeeded(value: unknown): { value: unknown; wasEncrypted: boolean } {
    if (isEncryptedValue(value)) {
      if (!callbacks.decrypt) {
        throw new Error(
          `Encrypted value encountered but no decrypt callback was provided (did you forget encryptDatabase handling?)`,
        );
      }
      return { value: callbacks.decrypt(value as string), wasEncrypted: true };
    }
    return { value, wasEncrypted: false };
  }

  function convertField(rawValue: unknown, fieldPath: string): unknown {
    const { value: candidate, wasEncrypted } = decryptIfNeeded(rawValue);

    const numeric = typeof candidate === 'number' ? candidate : parseFloat(candidate as string);
    if (typeof candidate !== 'number' && typeof candidate !== 'string') {
      skippedNonNumeric.push(fieldPath);
      return rawValue;
    }
    if (Number.isNaN(numeric)) {
      skippedNonNumeric.push(fieldPath);
      return rawValue;
    }

    const minor = toMinorUnits(numeric);
    fieldsConverted.push({
      path: fieldPath,
      from: numeric,
      to: minor,
      cleanlyRepresentable: isCleanlyRepresentable(numeric),
    });

    if (!wasEncrypted) return minor;
    if (!callbacks.encrypt) {
      throw new Error(`Value at ${fieldPath} was encrypted but no encrypt callback was provided`);
    }
    return callbacks.encrypt(String(minor));
  }

  /** Resolves a possibly-encrypted `field` discriminator (SubscriptionChange.field) to its plaintext value, without touching anything else about the record. */
  function resolveFieldDiscriminator(value: unknown): unknown {
    if (isEncryptedValue(value)) {
      return callbacks.decrypt ? callbacks.decrypt(value as string) : value;
    }
    return value;
  }

  function walk(node: unknown, nodePath: string): unknown {
    if (Array.isArray(node)) {
      return node.map((item, i) => walk(item, `${nodePath}[${i}]`));
    }
    if (node !== null && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const discriminator = 'field' in obj ? resolveFieldDiscriminator(obj.field) : undefined;
      const result: Record<string, unknown> = {};

      for (const [key, rawValue] of Object.entries(obj)) {
        const fieldPath = `${nodePath}.${key}`;
        const isChangeValueKey =
          discriminator === 'amount' && (key === 'oldValue' || key === 'newValue');

        if (MONEY_FIELD_NAMES.has(key) || isChangeValueKey) {
          result[key] = convertField(rawValue, fieldPath);
        } else if (rawValue !== null && typeof rawValue === 'object') {
          result[key] = walk(rawValue, fieldPath);
        } else {
          result[key] = rawValue;
        }
      }
      return result;
    }
    return node;
  }

  const converted = walk(data, '$');
  return { data: converted, fieldsConverted, skippedNonNumeric };
}

export interface ReverseFieldConversion {
  /** JSONPath-ish location of the field within the document, e.g. `$.transactions[3].amount`. */
  path: string;
  from: number;
  to: number;
}

export interface ReverseConversionResult {
  data: unknown;
  fieldsConverted: ReverseFieldConversion[];
  /** Fields that looked like a money field by name but didn't hold a parseable number — left untouched, reported for the same reason as `convertDocumentToMinorUnits`'s `skippedNonNumeric`. */
  skippedNonNumeric: string[];
}

/**
 * The inverse of `convertDocumentToMinorUnits`: converts every documented
 * money field in `data` from integer minor units back to decimal. Exists
 * for the self-hosted frontend's read boundary — per
 * docs/adr/0002-money-minor-units-migration.md, the existing UI keeps
 * operating on decimal floats internally even after a user migrates to
 * schemaVersion 2, so a schemaVersion-2 document's money fields need to be
 * converted back to decimal (and re-encrypted, if they were encrypted)
 * before the existing frontend code reads them — moving the UI's own
 * internal representation to integers is explicitly out of scope here.
 *
 * Money-field matching, nesting behavior, and the `SubscriptionChange`
 * `field`-discriminator rule are identical to `convertDocumentToMinorUnits`;
 * only the arithmetic direction differs (`fromMinorUnits` instead of
 * `toMinorUnits`, and no `cleanlyRepresentable` concept — minor units are
 * always integers, so the conversion back to decimal has nothing to round).
 */
export function convertDocumentFromMinorUnits(
  data: unknown,
  callbacks: ConversionCallbacks = {},
): ReverseConversionResult {
  const fieldsConverted: ReverseFieldConversion[] = [];
  const skippedNonNumeric: string[] = [];

  function decryptIfNeeded(value: unknown): { value: unknown; wasEncrypted: boolean } {
    if (isEncryptedValue(value)) {
      if (!callbacks.decrypt) {
        throw new Error(
          `Encrypted value encountered but no decrypt callback was provided (did you forget encryptDatabase handling?)`,
        );
      }
      return { value: callbacks.decrypt(value as string), wasEncrypted: true };
    }
    return { value, wasEncrypted: false };
  }

  function convertField(rawValue: unknown, fieldPath: string): unknown {
    const { value: candidate, wasEncrypted } = decryptIfNeeded(rawValue);

    const numeric = typeof candidate === 'number' ? candidate : parseFloat(candidate as string);
    if (typeof candidate !== 'number' && typeof candidate !== 'string') {
      skippedNonNumeric.push(fieldPath);
      return rawValue;
    }
    if (Number.isNaN(numeric)) {
      skippedNonNumeric.push(fieldPath);
      return rawValue;
    }

    const decimal = fromMinorUnits(numeric);
    fieldsConverted.push({ path: fieldPath, from: numeric, to: decimal });

    if (!wasEncrypted) return decimal;
    if (!callbacks.encrypt) {
      throw new Error(`Value at ${fieldPath} was encrypted but no encrypt callback was provided`);
    }
    return callbacks.encrypt(String(decimal));
  }

  /** Resolves a possibly-encrypted `field` discriminator (SubscriptionChange.field) to its plaintext value, without touching anything else about the record. */
  function resolveFieldDiscriminator(value: unknown): unknown {
    if (isEncryptedValue(value)) {
      return callbacks.decrypt ? callbacks.decrypt(value as string) : value;
    }
    return value;
  }

  function walk(node: unknown, nodePath: string): unknown {
    if (Array.isArray(node)) {
      return node.map((item, i) => walk(item, `${nodePath}[${i}]`));
    }
    if (node !== null && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const discriminator = 'field' in obj ? resolveFieldDiscriminator(obj.field) : undefined;
      const result: Record<string, unknown> = {};

      for (const [key, rawValue] of Object.entries(obj)) {
        const fieldPath = `${nodePath}.${key}`;
        const isChangeValueKey =
          discriminator === 'amount' && (key === 'oldValue' || key === 'newValue');

        if (MONEY_FIELD_NAMES.has(key) || isChangeValueKey) {
          result[key] = convertField(rawValue, fieldPath);
        } else if (rawValue !== null && typeof rawValue === 'object') {
          result[key] = walk(rawValue, fieldPath);
        } else {
          result[key] = rawValue;
        }
      }
      return result;
    }
    return node;
  }

  const converted = walk(data, '$');
  return { data: converted, fieldsConverted, skippedNonNumeric };
}
