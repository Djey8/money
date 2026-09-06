import * as CryptoJS from 'crypto-js';

/**
 * Server-side port of the wire format implemented by the Angular
 * `CrypticService` (src/app/shared/services/cryptic.service.ts). This is a
 * PORT, not a reimplementation from first principles: it uses the same
 * `crypto-js` library and the same sequence of operations, so a v2
 * ciphertext produced by either side decrypts correctly on the other.
 * See docs/adr/0001-pro-api-encryption-handling.md and
 * docs/adr/0005-domain-package-structure.md.
 *
 * Format ("v2:" + base64(salt[16] + iv[16] + hmac[32] + ciphertext)):
 *   key  = PBKDF2(password, salt, iterations: 10000, keySize: 8 words / 256 bits, hasher: SHA256)
 *   ct   = AES-256-CBC(plaintext, key, iv, PKCS7)
 *   hmac = HMAC-SHA256(salt || iv || ct, key)
 *
 * PBKDF2 at 10,000 iterations is deliberately slow — the Angular service
 * amortizes this by deriving the key once per browser session (one random
 * salt, cached, reused for every field it encrypts that session; see
 * `getSessionSalt()`/`derivedKeyCache` in cryptic.service.ts) rather than
 * re-deriving per value. A backend request that (de/en)crypts many fields
 * (e.g. a whole transactions array) needs the same amortization or it will
 * be orders of magnitude slower than the frontend for the same data.
 * `EncryptionSession` below provides that; the top-level `encrypt`/
 * `decrypt` functions are one-shot convenience wrappers for a single value
 * and pay the full PBKDF2 cost every call — don't use them in a loop.
 */

const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_SIZE = 8; // 8 words = 32 bytes = 256 bits
const V2_PREFIX = 'v2:';
const SALT_BYTES = 16;
const IV_BYTES = 16;
const HMAC_BYTES = 32;
const V2_MIN_BYTES = SALT_BYTES + IV_BYTES + HMAC_BYTES; // 64

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/** Test-only injection points. Never pass these outside a test — production callers should omit both so a fresh random salt/IV is used, unless deliberately pinning a session salt (see `EncryptionSession`). */
export interface EncryptOptions {
  saltHex?: string;
  ivHex?: string;
}

function deriveKey(password: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: PBKDF2_KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
}

function encryptWithKey(
  plaintext: string,
  salt: CryptoJS.lib.WordArray,
  derivedKey: CryptoJS.lib.WordArray,
  ivHex?: string,
): string {
  const iv = ivHex ? CryptoJS.enc.Hex.parse(ivHex) : CryptoJS.lib.WordArray.random(IV_BYTES);

  const encrypted = CryptoJS.AES.encrypt(plaintext, derivedKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const ciphertext = encrypted.ciphertext;
  const payload = salt.clone().concat(iv).concat(ciphertext);
  const hmac = CryptoJS.HmacSHA256(payload, derivedKey);

  const result = salt.clone().concat(iv).concat(hmac).concat(ciphertext);
  return V2_PREFIX + CryptoJS.enc.Base64.stringify(result);
}

/** True if `value` is in the v2 wire format (as opposed to the legacy passphrase format or plaintext). */
export function isV2Ciphertext(value: string): boolean {
  return typeof value === 'string' && value.startsWith(V2_PREFIX);
}

function decryptV2WithDeriveFn(
  base64Data: string,
  getDerivedKey: (salt: CryptoJS.lib.WordArray) => CryptoJS.lib.WordArray,
): string {
  const data = CryptoJS.enc.Base64.parse(base64Data);
  const words = data.words;
  const totalBytes = data.sigBytes;
  if (totalBytes < V2_MIN_BYTES) {
    throw new DecryptionError('Invalid v2 ciphertext: too short');
  }

  const salt = CryptoJS.lib.WordArray.create(words.slice(0, 4), SALT_BYTES);
  const iv = CryptoJS.lib.WordArray.create(words.slice(4, 8), IV_BYTES);
  const storedHmac = CryptoJS.lib.WordArray.create(words.slice(8, 16), HMAC_BYTES);
  const ciphertext = CryptoJS.lib.WordArray.create(words.slice(16), totalBytes - V2_MIN_BYTES);

  const derivedKey = getDerivedKey(salt);

  const payload = salt.clone().concat(iv).concat(ciphertext);
  const computedHmac = CryptoJS.HmacSHA256(payload, derivedKey);
  if (CryptoJS.enc.Hex.stringify(computedHmac) !== CryptoJS.enc.Hex.stringify(storedHmac)) {
    throw new DecryptionError(
      'HMAC verification failed — ciphertext may be tampered or the key is wrong',
    );
  }

  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Reads the legacy passphrase-based format (pre-v2, no per-record salt/IV
 * management — crypto-js's simplified `AES.decrypt(ciphertext, passphrase)`
 * API, OpenSSL-compatible "Salted__" framing with an MD5-based KDF).
 * Read-only: nothing in this codebase writes this format anymore.
 */
function decryptLegacy(ciphertext: string, key: string): string {
  return CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8);
}

/**
 * Holds one password's derived-key cache (keyed by salt) across many
 * encrypt/decrypt calls, so PBKDF2 runs once per distinct salt encountered
 * rather than once per value — the same amortization `CrypticService` gets
 * from its per-session salt. Use one `EncryptionSession` per request (or
 * per migration run) that touches more than a handful of fields.
 */
export class EncryptionSession {
  private readonly derivedKeyCache = new Map<string, CryptoJS.lib.WordArray>();

  constructor(private readonly password: string) {}

  private getDerivedKey(salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
    const saltHex = CryptoJS.enc.Hex.stringify(salt);
    const cached = this.derivedKeyCache.get(saltHex);
    if (cached) return cached;
    const key = deriveKey(this.password, salt);
    this.derivedKeyCache.set(saltHex, key);
    return key;
  }

  /**
   * Encrypts one value. Pass `saltHex` to pin every call in this session to
   * one salt (matching `CrypticService`'s per-session-salt pattern exactly,
   * including its performance characteristics) — omit it to generate a
   * fresh random salt per value (more conservative, and still benefits
   * from this session's derived-key cache if the same salt recurs).
   */
  encrypt(plaintext: string, options: EncryptOptions = {}): string {
    const salt = options.saltHex
      ? CryptoJS.enc.Hex.parse(options.saltHex)
      : CryptoJS.lib.WordArray.random(SALT_BYTES);
    return encryptWithKey(plaintext, salt, this.getDerivedKey(salt), options.ivHex);
  }

  /** Decrypts a v2 or legacy-format value, reusing this session's derived-key cache for v2 values. */
  decrypt(ciphertext: string): string {
    if (isV2Ciphertext(ciphertext)) {
      return decryptV2WithDeriveFn(ciphertext.slice(V2_PREFIX.length), (salt) =>
        this.getDerivedKey(salt),
      );
    }
    return decryptLegacy(ciphertext, this.password);
  }
}

/**
 * Encrypts a single `plaintext` with `key`, producing the same
 * "v2:"-prefixed wire format the frontend reads and writes. One-shot
 * convenience wrapper — pays a full PBKDF2 derivation every call. Encrypting
 * more than a few values with the same key in one request/operation should
 * use `EncryptionSession` instead.
 */
export function encrypt(plaintext: string, key: string, options: EncryptOptions = {}): string {
  return new EncryptionSession(key).encrypt(plaintext, options);
}

/**
 * Decrypts a value written by either the current (v2) or legacy format.
 * Throws `DecryptionError` on HMAC mismatch or a malformed v2 payload.
 * Unlike the frontend's `CrypticService.decrypt`, this never silently
 * swallows a failure into an empty string — a caller with the right key
 * calling this on data it owns should treat any failure as a real error.
 * One-shot convenience wrapper — see `EncryptionSession` for multi-value use.
 */
export function decrypt(ciphertext: string, key: string): string {
  return new EncryptionSession(key).decrypt(ciphertext);
}
