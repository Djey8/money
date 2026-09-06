'use strict';

const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // This backend is a generic CouchDB-backed blob store (routes/data.js's setNestedValue
      // walks a request-supplied path and does `current[key] = ...`/`current[key]` by design;
      // routes/auth.js and the test suite do the same for dynamic field access). That's the
      // documented, intended behavior of the data API, not an injection bug -- there's no way
      // to distinguish these ~33 legitimate call sites from a real vulnerability with this
      // rule, so disabling per-line would mean scattering dozens of near-identical
      // suppressions instead of one documented decision. Real input validation for these
      // paths is handled explicitly in the route/middleware layer (see backend/middleware/
      // and the auth checks in routes/data.js), not by this lint rule.
      'security/detect-object-injection': 'off',
      // Standard convention: a leading underscore marks an intentionally-unused binding, e.g.
      // `const { _id, _rev, ...rest } = doc;` to strip CouchDB's internal fields.
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Jest globals (describe/it/expect/jest/...) for test files only.
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  // Must stay last: turns off stylistic ESLint rules that would conflict with Prettier.
  eslintConfigPrettier,
];
