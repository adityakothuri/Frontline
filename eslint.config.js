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
    // Lint Watchdog app source only. Build output, deps, and the vendored
    // Claude/Codex tooling and Obsidian docs are not app code.
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      '.claude/**',
      '.codex/**',
      'docs/**',
    ],
  },
]);
