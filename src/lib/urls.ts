/**
 * Make an ingested website string openable.
 *
 * Upstream directories routinely record `www.example.org` with no scheme, which
 * `Linking.openURL` rejects outright. Pure and testable, so the one regex that
 * decides "already has a scheme" is pinned by `urls.test.ts` — the first version
 * treated `example.org:8080/page` as a scheme and refused to prefix it.
 *
 * Returns null for an empty string: there is nothing to open, and `https://` on
 * its own is not a place.
 */
export function normaliseWebsiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // A real scheme is followed by `//` (http, https, ftp) or is one of the two
  // non-hierarchical ones a listing could plausibly carry.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^(mailto|tel):/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
