// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: ['dist/**'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
  },
  {
    // Test files assert on the shape of dynamically-built JSON fixtures
    // (this package converts `unknown` trees) — `any` here is normal test
    // convenience, not a sign the underlying module is loosely typed.
    files: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Config files themselves (this file, jest.config.js) run as plain
    // CommonJS under Node, not through the TS compiler — root's own
    // eslint.config.js follows the same files-scoped pattern.
    files: ['*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  // Must stay last: turns off stylistic ESLint rules that would conflict with Prettier.
  eslintConfigPrettier,
);
