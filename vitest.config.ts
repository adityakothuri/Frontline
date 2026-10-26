import { defineConfig } from 'vitest/config';

// Unit tests cover pure, deterministic logic (geo math, sorting, status, hours,
// need↔resource mapping) — no React Native runtime, so the default node
// environment is enough. The `@/` alias mirrors tsconfig's path mapping.
//
// `ingestion/` is included for the same reason: the pieces of the pipeline that
// decide whether to DELETE rows or how to filter a provider's records are pure
// logic with expensive failure modes, and they deserve tests even though the
// pipeline itself is backend tooling rather than app code.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'ingestion/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
});
