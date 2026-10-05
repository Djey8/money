import { packSavedGame, unpackSavedGame } from './saved-game-codec';

declare const require: (module: string) => any;

const sample = {
  name: 'Ünïcode ✓ game',
  rows: Array.from({ length: 400 }, (_, i) => ({
    i,
    account: 'Daily',
    amount: i * 1.5,
    note: 'Payday',
  })),
};

describe('saved game codec', () => {
  const globals = globalThis as any;
  const saved = {
    CompressionStream: globals.CompressionStream,
    DecompressionStream: globals.DecompressionStream,
    TextEncoder: globals.TextEncoder,
    TextDecoder: globals.TextDecoder,
  };

  afterEach(() => Object.assign(globals, saved));

  it('stores plain text when the browser cannot compress, and reads it back', async () => {
    globals.CompressionStream = undefined;

    const packed = await packSavedGame(sample);

    expect(packed.startsWith('raw:')).toBe(true);
    expect(await unpackSavedGame(packed)).toEqual(sample);
  });

  it('compresses with gzip when it can - much smaller, and it round-trips', async () => {
    const web = require('stream/web');
    const util = require('util');
    Object.assign(globals, {
      CompressionStream: web.CompressionStream,
      DecompressionStream: web.DecompressionStream,
      TextEncoder: util.TextEncoder,
      TextDecoder: util.TextDecoder,
    });

    const packed = await packSavedGame(sample);

    expect(packed.startsWith('gz:')).toBe(true);
    expect(packed.length).toBeLessThan(JSON.stringify(sample).length / 3);
    expect(await unpackSavedGame(packed)).toEqual(sample);
  });

  it('refuses something that is not a saved game', async () => {
    await expect(unpackSavedGame('nonsense')).rejects.toThrow('Unknown saved game format');
  });
});
