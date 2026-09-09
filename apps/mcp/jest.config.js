/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**'],
  // Source files use nodenext-style explicit ".js" extensions on relative
  // imports (required by "moduleResolution": "NodeNext" so the compiled
  // output's require() calls resolve); Jest's resolver needs to be told to
  // strip that extension back off to find the on-disk ".ts" sources.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
