import { readFileSync } from 'node:fs';

/**
 * Load `KEY=value` lines from a git-ignored env file into `process.env`, without
 * clobbering values already set in the shell. Silently does nothing when the
 * file is absent (values may instead come from CI secrets). Shared by the
 * ingestion runner, the freshness gate, and `scripts/seed.ts` so the parser
 * lives in exactly one place.
 */
export function loadEnvFile(absolutePath: string): void {
  try {
    const raw = readFileSync(absolutePath, 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // File absent — the shell env / CI secrets may carry the values.
  }
}
