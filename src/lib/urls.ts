/**
 * Make an ingested website string openable: directories often record
 * `www.example.org` with no scheme, which `Linking.openURL` rejects. Null for an
 * empty string.
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
