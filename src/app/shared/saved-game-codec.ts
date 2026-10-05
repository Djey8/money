/**
 * A saved Cashflow game is one JSON document - every transaction, subscription, Grow project... of the
 * game - and it lives inside the user's single database document, so it is stored compressed
 * (gzip, then base64: roughly a tenth of the size). Where the browser cannot compress, it is stored
 * as plain text instead; the prefix says which, so either kind can always be read back.
 */
const GZIP_PREFIX = 'gz:';
const RAW_PREFIX = 'raw:';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Runs the bytes through a compression / decompression stream and collects what comes out. */
async function transform(bytes: Uint8Array, stream: any): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  const reading = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      chunks.push(value);
    }
  })();
  await Promise.all([
    (async () => {
      await writer.write(bytes);
      await writer.close();
    })(),
    reading,
  ]);
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function packSavedGame(value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  const Compression = (globalThis as any).CompressionStream;
  if (!Compression || typeof TextEncoder === 'undefined') return RAW_PREFIX + json;
  try {
    const compressed = await transform(new TextEncoder().encode(json), new Compression('gzip'));
    return GZIP_PREFIX + toBase64(compressed);
  } catch {
    return RAW_PREFIX + json;
  }
}

export async function unpackSavedGame<T>(packed: string): Promise<T> {
  if (packed.startsWith(RAW_PREFIX)) return JSON.parse(packed.slice(RAW_PREFIX.length)) as T;
  if (!packed.startsWith(GZIP_PREFIX)) throw new Error('Unknown saved game format.');
  const Decompression = (globalThis as any).DecompressionStream;
  if (!Decompression || typeof TextDecoder === 'undefined') {
    throw new Error('This browser cannot open a compressed saved game.');
  }
  const bytes = await transform(
    fromBase64(packed.slice(GZIP_PREFIX.length)),
    new Decompression('gzip'),
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
