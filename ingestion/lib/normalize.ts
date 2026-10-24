/**
 * Field-cleaning helpers shared by the source adapters in `ingestion/sources/`.
 * Each one is the canonical version of a helper several adapters used to copy.
 */

/**
 * Trimmed text, or null when blank. Non-strings are coerced because Socrata and
 * other loosely-typed JSON feeds send a ZIP or a count as a number.
 */
export function trimOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

/** A pinnable coordinate pair: finite, in range, and not (0, 0) — "null island". */
export function isSaneCoord(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** "www.example.org" → "https://www.example.org"; blank → null. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const url = trimOrNull(raw);
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
}

/** Decode the HTML entities these feeds emit. `&amp;` goes last so nothing is decoded twice. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * The first number in a free-text phone field, kept only if it is a dialable US
 * number. Cells sometimes list two: "(907) 269-4802; (907) 269-4721".
 */
export function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(/[;/]/)[0].trim();
  const digits = first.replace(/\D/g, '');
  if (digits.length === 10) return first;
  if (digits.length === 11 && digits.startsWith('1')) return first;
  return null;
}

/** "Street, City, ST 12345", skipping missing parts; null when nothing is known. */
export function formatAddress(
  street: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string | null {
  const region = [state, zip].filter(Boolean).join(' ');
  const locality = [city, region].filter(Boolean).join(', ');
  return [street, locality].filter(Boolean).join(', ') || null;
}

/** `--state "tx, fl"` → {TX, FL}; no flag → null (national run). */
export function parseStateFilter(state: string | undefined): Set<string> | null {
  if (!state) return null;
  return new Set(
    state
      .toUpperCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
