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
  },
  // Must stay last: turns off stylistic ESLint rules that would conflict with Prettier.
  eslintConfigPrettier,
];
