// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // --- Initial-adoption baseline for this pre-existing codebase ---
      // This app predates strict TS/Angular linting by years. These four rules are each
      // real, defensible style/modernization preferences, but enforcing them now would mean
      // either a huge, high-risk mechanical refactor with no behavior-change justification, or
      // hundreds of individual per-line suppressions that would bury the signal from real
      // issues. Turned off for initial adoption; tightening these back on (ideally file-by-file
      // as files are touched) is tracked as follow-up lint-hardening work, not part of this
      // lint-setup pass. Counts below are the as-of-adoption violation counts.
      '@typescript-eslint/no-explicit-any': 'off', // 1155 violations: codebase predates strict typing; needs a dedicated typing pass
      '@angular-eslint/prefer-inject': 'off', // 268 violations: constructor-DI -> inject() is a real migration (ng generate @angular/core:inject), not a lint fix
      '@typescript-eslint/prefer-for-of': 'off', // 180 violations: many index-based `for` loops use the index for more than element access; not safely auto-convertible without per-loop review
      '@typescript-eslint/no-unused-vars': 'off', // 284 violations: scattered across the whole app; some are dead code, some are structurally-required (e.g. framework callback signatures) and need per-instance triage, not a blanket rule
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // --- Initial-adoption baseline (see the **/*.ts block above for the rationale) ---
      '@angular-eslint/template/prefer-control-flow': 'off', // 1185 violations: *ngIf/*ngFor -> @if/@for is a whole-app template migration (ng generate @angular/core:control-flow), not a lint fix
      '@angular-eslint/template/label-has-associated-control': 'off', // 71 violations: real a11y work (wiring for/id or aria-labelledby per form control), tracked as follow-up, not a lint-setup fix
      '@angular-eslint/template/click-events-have-key-events': 'off', // 66 violations: real a11y work (adding keyboard handlers to clickable non-interactive elements), tracked as follow-up
      '@angular-eslint/template/interactive-supports-focus': 'off', // 33 violations: real a11y work (tabindex/role wiring), tracked as follow-up
      '@angular-eslint/template/eqeqeq': 'off', // 32 violations: templates commonly rely on `== null` to match both null and undefined in one check; switching to === would need each site rewritten as `=== null || === undefined`, a behavior-risk change, not a lint fix
    },
  },
  {
    // no-useless-assignment's flow analysis misreports the location of (and sometimes the
    // presence of) a real violation across mutually-exclusive if/else branches in these two
    // files (verified by hand: the reported line/col moves to an unrelated statement, or to
    // a comment, whenever surrounding lines shift), making a precise per-line disable
    // impractical/unreliable. Both underlying variables (`trend`, `strategyDescription`) are
    // genuinely read after the if/else in question. Disabled for just these two files rather
    // than guessed at with an unstable inline suppression.
    files: ['src/app/stats/analytics/predictive.ts', 'src/app/stats/analytics/prescriptive.ts'],
    rules: {
      'no-useless-assignment': 'off',
    },
  },
  // Must stay last: turns off stylistic ESLint rules that would conflict with Prettier.
  eslintConfigPrettier,
]);
