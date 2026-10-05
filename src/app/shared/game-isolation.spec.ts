/**
 * The Cashflow game lives inside the normal app, but nothing of it may run for a normal account
 * (JFK, 2026-10-04: "if something is only for the game, I don't want it in my normal account").
 * This guards the places where shared code reaches into the game: every call on the game service from
 * a shared file has to sit behind `CashflowGameService.isCashflowGame()` - on the same line or in the
 * block just above - or be one of the few calls that are inert or guard themselves.
 */
// A module (not a global script), so this does not clash with the other spec declaring `require`.
export {};
declare const require: (module: string) => any;
declare const process: { cwd(): string };

const SHARED_FILES = [
  'src/app/panels/add/add.component.ts',
  'src/app/panels/info/info-grow/info-grow.component.ts',
  'src/app/panels/info/info-asset/info-asset.component.ts',
  'src/app/panels/settings/settings.component.ts',
  'src/app/panels/menu/menu.component.ts',
  'src/app/main/grow/grow.component.ts',
  'src/app/main/grow/grow-trade.service.ts',
  'src/app/main/subscription/subscription.component.ts',
  'src/app/shared/services/subscription-processing.service.ts',
  'src/app/app.component.ts',
  'src/app/stats/charts/core-charts.ts',
];

/** Calls that are safe for any account: they guard themselves, or only clear game leftovers. */
const INERT_CALLS = new Set([
  'isCashflowGame', // the guard itself
  'marketSaleFor', // returns null unless it is a game account
  'clearPersistedUndoStack', // logout: clears the stored game undo history
]);

/** How many lines above a call its guard may sit (an `if` block around a few statements). */
const GUARD_WINDOW = 30;

const NEWLINE = /\r?\n/;

function readSource(file: string): string {
  const fs = require('fs');
  const path = require('path');
  return fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
}

describe('Cashflow game isolation', () => {
  for (const file of SHARED_FILES) {
    it(`${file}: every game call is behind the game-account check`, () => {
      const lines = readSource(file).split(NEWLINE);
      const unguarded: string[] = [];

      lines.forEach((line, index) => {
        const match = /\b(?:this\.)?(?:cashflowGameService|cashflowGame)\.(\w+)\s*\(/.exec(line);
        if (!match || INERT_CALLS.has(match[1])) return;
        const context = lines.slice(Math.max(0, index - GUARD_WINDOW), index + 1).join('\n');
        if (!/isCashflowGame|isCashflowGameActive|isCashflowGameAccount/.test(context)) {
          unguarded.push(`line ${index + 1}: ${line.trim()}`);
        }
      });

      expect(unguarded).toEqual([]);
    });
  }

  it('the game-only chart markers need a running game', () => {
    const code = readSource('src/app/stats/charts/core-charts.ts')
      .split(NEWLINE)
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    expect(code).toContain('gameMarkerFor');
    // No detection of game tags in the shared chart code itself: it goes through gameMarkerFor.
    expect(code).not.toMatch(/#doodad|@bank loan/);
  });
});
