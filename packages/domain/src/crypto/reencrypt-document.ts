import { isEncryptedValue } from './cryptic';

export interface RewriteEncryptedValuesResult {
  data: unknown;
  /** JSONPath-ish location of every value `rewrite` was called on, e.g. `$.transactions[3].amount`. */
  rewrittenPaths: string[];
}

/**
 * Recursively walks `data`, calling `rewrite(value, path)` on every leaf
 * string for which `isEncryptedValue` is true, and leaving everything else
 * (numbers, booleans, dates, IDs, already-plaintext strings, structure)
 * completely untouched. Keyed on value *shape*, not a fixed field-name list
 * like `convertDocumentToMinorUnits` — encryption is applied broadly across
 * the document (`backend/services/transaction-derived-state.js`'s
 * `writeValue` encrypts whatever leaf it's given, regardless of field name),
 * so there is no fixed set of "encrypted field names" to enumerate.
 *
 * One function serves two distinct callers by choice of `rewrite`:
 *   - re-encryption (key rotation): `(v) => newSession.encrypt(oldSession.decrypt(v))`
 *   - pure decryption (verification, producing a comparable plaintext view):
 *     `(v) => session.decrypt(v)`
 */
export function rewriteEncryptedValues(
  data: unknown,
  rewrite: (value: string, path: string) => string,
): RewriteEncryptedValuesResult {
  const rewrittenPaths: string[] = [];

  // Checked first, before the array/object branches below, so an encrypted
  // value is caught regardless of *where* it sits — a bare array element
  // (`node.map` would otherwise recurse into it and fall through to the
  // `return node` below with no `isEncryptedValue` check at all) or even
  // the document root itself, not only an object property.
  function walk(node: unknown, path: string): unknown {
    if (isEncryptedValue(node)) {
      rewrittenPaths.push(path);
      return rewrite(node, path);
    }
    if (Array.isArray(node)) {
      return node.map((item, i) => walk(item, `${path}[${i}]`));
    }
    if (node !== null && typeof node === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        result[key] = walk(value, `${path}.${key}`);
      }
      return result;
    }
    return node;
  }

  return { data: walk(data, '$'), rewrittenPaths };
}
