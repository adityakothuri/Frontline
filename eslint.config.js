// Flat ESLint config (ESLint 9).
// - `eslint-config-expo` provides Expo's recommended React Native + TypeScript rules.
// - `eslint-config-prettier` disables stylistic rules that would fight Prettier,
//   so formatting is owned by Prettier and correctness by ESLint.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Lint Frontline app source only; build output, deps, docs and local
    // dot-folders (editor/tooling state) are not app code.
    ignores: [
      'node_modules/**',
      '.*/**',
      'dist/**',
      'web-build/**',
      'docs/**',
      // Deno-flavored TS (npm: specifiers, Deno globals) — not app code.
      'supabase/functions/**',
    ],
  },
  {
    // Extra TypeScript strictness on top of Expo's defaults: the codebase is
    // deliberately `any`-free, so enforce it (and no empty catch blocks).
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      // React Compiler's `set-state-in-effect` targets derived-state cascades
      // (`useEffect(() => setX(f(y)), [y])`), which should be computed during
      // render instead. In this codebase it fires only on the other shape: an
      // async fetch flipping to `{ status: 'loading' }` before awaiting the
      // service. There is no way to show a skeleton when the query inputs
      // change without that transition, short of adopting a query library —
      // so the rule is off rather than suppressed at ~10 call sites.
      // Revisit if a real data-fetching layer (e.g. TanStack Query) lands.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
