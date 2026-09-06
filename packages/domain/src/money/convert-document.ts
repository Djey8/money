import { isEncryptedValue } from '../crypto/cryptic';
import { isCleanlyRepresentable, toMinorUnits } from './minor-units';

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
const MONEY_FIELD_NAMES = new Set([
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
