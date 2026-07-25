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
    // Lint Frontline app source only. Build output, deps, and the vendored
    // Claude/Codex tooling and Obsidian docs are not app code.
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      '.claude/**',
      '.codex/**',
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
    },
  },
]);
