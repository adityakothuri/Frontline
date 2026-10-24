import type { ResourceSearchResult } from '@/services/resources';

/**
 * The React `key` for a map marker (guarded by `pinKey.test.ts`).
 *
 * MapKit recycles annotation views with frozen bitmaps, so every appearance
 * input that can differ between pins sharing an id must be in the key — today,
 * the category (hue and glyph). An id-only key draws the wrong icons.
 *
 * Nothing a tap or the camera changes may go in: a key that changes on press
 * remounts the marker inside its own native press handler and crashes.
 * See `docs/obsidian/07 Bugs/` for both incidents.
 */
export function pinKey(result: ResourceSearchResult): string {
  return `${result.resource.id}:${result.resource.category}`;
}
