/**
 * The Grow page is a standalone component whose `imports` list names the info panels. If a new static
 * import ever closes a circle back to it, one of those names is still `undefined` when the decorator
 * runs and the page dies in the browser with "Cannot read properties of undefined (reading 'ɵcmp')"
 * (this happened when the info panel first imported the Buy / Sell service, 2026-10-03). Jest's usual
 * single entry point hides that, so this loads the page from several entry points - the order the
 * modules are first touched in is what decides whether a circle bites.
 */
// A module (not a global script), so this does not clash with the other spec declaring `require`.
export {};
declare const require: (module: string) => unknown;

function dependenciesOf(componentName: string, modulePath: string): unknown[] {
  const component = (require(modulePath) as Record<string, any>)[componentName];
  const definition = component.ɵcmp; // JIT-compiles the decorator; throws on a broken import
  const deps = definition.directiveDefs;
  return typeof deps === 'function' ? deps() : (deps ?? []);
}

const ENTRY_POINTS = [
  'src/app/panels/info/info-grow/info-grow.component',
  'src/app/main/grow/grow.component',
  'src/app/shared/services/app-data.service',
  'src/app/panels/add/add.component',
  'src/app/app.component',
];

describe('Grow page loads whichever module is touched first', () => {
  for (const entry of ENTRY_POINTS) {
    it(`entering through ${entry}`, () => {
      jest.isolateModules(() => {
        require(entry);
        const growDeps = dependenciesOf('GrowComponent', 'src/app/main/grow/grow.component');
        const infoDeps = dependenciesOf(
          'InfoGrowComponent',
          'src/app/panels/info/info-grow/info-grow.component',
        );

        expect(growDeps.length).toBeGreaterThan(0);
        expect(growDeps.every((dep) => dep !== undefined)).toBe(true);
        expect(infoDeps.every((dep) => dep !== undefined)).toBe(true);
      });
    });
  }
});
