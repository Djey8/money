// Node globals: the spec tsconfig carries no node typings.
declare const require: (id: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const read = (relative: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../../..', relative), 'utf8');

/**
 * On touch devices a tap on an input must never zoom the page in (iOS zooms when a field's font is under
 * 16px), while the user stays free to pinch-zoom. This fix was lost once in a merge conflict resolution
 * (2026-05-10) and had to be rebuilt - these checks make losing it again a failing test.
 */
describe('mobile zoom guards', () => {
  const css = read('src/styles.css').replace(/\s+/g, ' ');

  it('keeps every form control at 16px or more on touch devices', () => {
    const block = css.match(/@media \(hover: none\) and \(pointer: coarse\) \{(.*?)\} \}/);
    expect(block).not.toBeNull();
    const rule = block![1];
    for (const selector of [
      'input',
      'select',
      'textarea',
      "input[type='text']",
      "input[type='number']",
    ]) {
      expect(rule).toContain(selector);
    }
    expect(rule).toMatch(/font-size: 16px !important/);
  });

  it('removes the double-tap zoom delay without blocking pinch', () => {
    expect(css).toMatch(/touch-action: manipulation/);
    expect(css).not.toMatch(/touch-action: none/);
  });

  it('lets the user pinch-zoom: the viewport sets no zoom limit', () => {
    const viewport = read('src/index.html').match(/<meta name="viewport" content="([^"]*)"/);
    expect(viewport).not.toBeNull();
    expect(viewport![1]).not.toMatch(/maximum-scale/);
    expect(viewport![1]).not.toMatch(/user-scalable\s*=\s*(no|0)/);
  });
});
