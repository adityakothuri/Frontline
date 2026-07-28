/**
 * HRSA Health Center Program — federally funded community clinics (FQHCs).
 *
 * WHY A GENERAL SOURCE IS HERE
 *
 * Community health centres are required to see everyone regardless of ability to
 * pay, on a sliding fee scale. For a veteran who is not enrolled in VA health
 * care, lives too far from a VA clinic, or needs to be seen this week rather than
 * in six, this is the actual answer — and VA Community Care often pays for it.
 * HRSA explicitly names veterans among the populations these centres serve.
 *
 * It is nonetheless `general`, not veteran-specific: there is no per-site veteran
 * flag in this file, and claiming one would be the sort of invention this audit
 * exists to remove. Veteran rows still fill each category's capacity first
 * (migration 0021) and general rows are capped to the nearest few in-app
 * (`DENSE_GENERAL_CAPS`), so these back the catalogue up without swamping it.
 *
 * WHAT THIS FILE DOES *NOT* GIVE US: A SCHEDULE
 *
 * The column named "Operating Hours per Week" is a weekly TOTAL — `40.00`, `8.00`
 * — not opening times. There is no way to derive "Mon-Fri 09:00-17:00" from it,
 * and guessing one would be exactly the class of fabrication that produced the
 * ZIP-centroid bug. So `hours` stays null and the weekly total goes in the
 * description, where "open about 40 hours a week" is true and useful.
 *
 * Mobile Van sites (1,376 of 18,963) are excluded: a van's registered address is
 * not where the van is, so pinning it would mislead. Seasonal sites are kept —
 * they are real fixed places — with their status said out loud.
 */
import { parseCsvStream } from '../lib/csv.ts';
import { httpRequest } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'hrsa-health-centers';
const ATTRIBUTION_URL = 'https://findahealthcenter.hrsa.gov/';

/** Site types we can honestly place on a map. */
const PLACEABLE_LOCATION_TYPES = new Set(['Permanent', 'Seasonal']);

// School-based health centres are real HRSA sites, but they serve the students
// enrolled at that school — an adult veteran cannot walk into an elementary-school
// clinic and be seen. 2,959 of them were sitting in `healthcare` on 2026-07-28,
// carrying this adapter's generic "open to everyone, including veterans" text,
// which for these sites is simply untrue.
//
// Exactly the same reasoning retired 51,839 school cafeterias from `food` in
// migration 0025: Frontline serves older veterans, and a resource they are not
// eligible to use is worse than no resource.
//
// `academy` is included because charter and vocational schools use it; that risks
// dropping a genuine clinic named "Academy Health", which is the acceptable side of
// this trade.
const SCHOOL_BASED_SITE =
  /\b(elementary|middle school|high school|jr\.? high|junior high|head start|preschool|pre-k|daycare|day care|academy|school[- ]based health|school health center)\b/i;

/** Below this, assume the file moved or its columns changed. ~17,600 placeable of 18,963. */
const MIN_SITES = 10_000;

const COL = {
  siteName: 'Site Name',
  siteAddress: 'Site Address',
  city: 'Site City',
  state: 'Site State Abbreviation',
  zip: 'Site Postal Code',
  phone: 'Site Telephone Number',
  website: 'Site Web Address',
  hoursPerWeek: 'Operating Hours per Week',
  status: 'Site Status Description',
  locationType: 'Health Center Location Type Description',
  centerName: 'Health Center Name',
  longitude: 'Geocoding Artifact Address Primary X Coordinate',
  latitude: 'Geocoding Artifact Address Primary Y Coordinate',
} as const;

const trimOrNull = (s: string | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

const isSaneCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

const normalizeUrl = (raw: string | null): string | null => {
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
};

/** "805-346-8185" → keep; anything without 10 digits is not dialable. */
const cleanPhone = (raw: string | null): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? raw : null;
};

/** Site names are ALL CAPS in this file. */
function titleCase(name: string): string {
  const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to']);
  const KEEP_UPPER = /^(?:FQHC|HIV|WIC|II|III|IV|LLC|INC|USA|US)$/;
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      const upper = word.toUpperCase().replace(/[^A-Z]/g, '');
      if (KEEP_UPPER.test(upper)) return word.toUpperCase();
      if (i > 0 && SMALL.has(word)) return word;
      return word.replace(/^([a-z])/, (c) => c.toUpperCase());
    })
    .join(' ');
}

/**
 * "40.00" → "They're open about 40 hours a week." A weekly total is not a
 * schedule, so it is stated as the approximate thing it is, and never written
 * into `hours` (which the app parses as real opening times).
 */
function hoursSentence(raw: string | null): string {
  const weekly = Number(raw);
  if (!Number.isFinite(weekly) || weekly <= 0) {
    return ' Call to check when they are open.';
  }
  return ` They are open about ${Math.round(weekly)} hours a week — call for exact times.`;
}

function normalize(row: Record<string, string>, today: string): NormalizedResource | null {
  const siteName = trimOrNull(row[COL.siteName]);
  const street = trimOrNull(row[COL.siteAddress]);
  const state = trimOrNull(row[COL.state])?.toUpperCase();
  if (!siteName || !street || !state || state.length !== 2) return null;
  if (trimOrNull(row[COL.status]) !== 'Active') return null;

  const locationType = trimOrNull(row[COL.locationType]) ?? '';
  if (!PLACEABLE_LOCATION_TYPES.has(locationType)) return null;

  // A clinic inside a school is not somewhere an adult veteran can be seen.
  if (SCHOOL_BASED_SITE.test(siteName)) return null;

  const city = trimOrNull(row[COL.city]);
  const zip = trimOrNull(row[COL.zip])?.slice(0, 5) ?? null;
  const lat = Number(row[COL.latitude]);
  const lng = Number(row[COL.longitude]);
  const hasCoords = isSaneCoord(lat, lng);

  const seasonal =
    locationType === 'Seasonal'
      ? ' This site is seasonal, so check it is open before you go.'
      : '';

  // The parent organization, when it differs, tells a veteran who runs the site.
  const centerName = trimOrNull(row[COL.centerName]);
  const runBy =
    centerName && centerName.toUpperCase() !== siteName.toUpperCase()
      ? ` Run by ${titleCase(centerName)}.`
      : '';

  return {
    // Site name + address is the identity; this file has no stable site id column
    // that survives its annual rebuild.
    id: `hrsa:${state}-${zip ?? '00000'}-${siteName.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase().slice(0, 60)}`,
    name: titleCase(siteName),
    category: 'healthcare',
    description:
      'A federally funded community health centre. They see patients whether or not you have ' +
      'insurance and charge on a sliding scale based on your income, so cost should not stop you ' +
      'from being seen. Primary care, and often dental, mental health and prescriptions.' +
      `${runBy}${hoursSentence(trimOrNull(row[COL.hoursPerWeek]))}${seasonal}`,
    address: [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', '),
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    geocode: hasCoords ? undefined : { street, city, state, zip },
    phone: cleanPhone(trimOrNull(row[COL.phone])),
    website: normalizeUrl(trimOrNull(row[COL.website])),
    // A weekly hour count is not a schedule — see hoursSentence.
    hours: null,
    eligibility:
      'Open to everyone, including veterans not enrolled in VA health care. Fees slide with your ' +
      'income and they cannot turn you away for inability to pay. If you are in VA care, ask ' +
      'whether VA Community Care will cover the visit before you go.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    source_type: 'official',
    veteran_relevance: 'general',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['health-center', 'fqhc', 'sliding-scale', 'primary-care', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: `${state}-${zip ?? ''}-${siteName}`.slice(0, 200),
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { site: siteName, center: centerName, locationType },
  };
}

export const createHrsaHealthCentersSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);

      const response = await httpRequest(config.baseUrl, { label: 'HRSA', timeoutMs: 300_000 });
      if (!response.ok || !response.body) {
        throw new Error(`HRSA: HTTP ${response.status} for ${config.baseUrl}`);
      }

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let scanned = 0;
      let mobile = 0;
      let malformed = 0;
      let columnsChecked = false;

      for await (const row of parseCsvStream(response.body, (n) => (malformed += n))) {
        if (!columnsChecked) {
          const missing = Object.values(COL).filter((c) => !(c in row));
          if (missing.length > 0) {
            throw new Error(`HRSA: site file is missing expected columns: ${missing.join(', ')}`);
          }
          columnsChecked = true;
        }
        scanned += 1;
        if (trimOrNull(row[COL.locationType]) === 'Mobile Van') mobile += 1;

        const normalized = normalize(row, today);
        if (!normalized || seen.has(normalized.id)) continue;
        if (stateFilter && !stateFilter.has(String(row[COL.state]).trim().toUpperCase())) continue;
        seen.add(normalized.id);
        results.push(normalized);
      }

      if (!stateFilter && results.length < MIN_SITES) {
        throw new Error(
          `HRSA: only ${results.length} placeable sites from ${scanned} rows (expected at least ` +
            `${MIN_SITES}) — the file or its columns likely changed. Refusing to ingest.`,
        );
      }

      console.log(
        `[ingest] hrsa-health-centers: ${results.length} sites from ${scanned} rows ` +
          `(${mobile} mobile vans excluded` +
          (malformed > 0 ? `, ${malformed} malformed rows skipped` : '') +
          ')',
      );
      return results;
    },
  };
};
