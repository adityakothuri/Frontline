import { defineConfig } from 'vitest/config';

// Unit tests cover pure, deterministic logic (geo math, sorting, status, hours,
// need↔resource mapping) — no React Native runtime, so the default node
// environment is enough. The `@/` alias mirrors tsconfig's path mapping.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
});
