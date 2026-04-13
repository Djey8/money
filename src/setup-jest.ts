import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

// Global mocks for browser APIs not available in jsdom
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    display: 'none',
    appearance: ['-webkit-appearance'],
    getPropertyValue: () => ''
  })
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Fail tests on unexpected console.error/warn (catch silent failures)
const originalError = console.error;
const originalWarn = console.warn;

// Known Angular/test-infra warnings to ignore
const SUPPRESSED_PATTERNS = [
  /NG0304/, // Angular "not a known element" in test stubs
  /No provider for/, // expected in isolated unit tests
  /No #chart-container/, // BudgetComponent — no DOM in test harness
  /Decryption failed/, // CrypticService — expected in wrong-key tests
];

console.error = (...args: any[]) => {
  originalError(...args);
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (SUPPRESSED_PATTERNS.some(p => p.test(msg))) return;
  throw new Error(`Unexpected console.error in test:\n${msg}`);
};

console.warn = (...args: any[]) => {
  originalWarn(...args);
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (SUPPRESSED_PATTERNS.some(p => p.test(msg))) return;
  throw new Error(`Unexpected console.warn in test:\n${msg}`);
};
