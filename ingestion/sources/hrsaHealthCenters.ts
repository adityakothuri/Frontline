/**
 * HRSA Health Center Program — federally funded community clinics (FQHCs) that
 * see everyone on a sliding fee scale. For a veteran not enrolled in VA care, or
 * far from a VA clinic, this is often the real answer.
 *
 * `general`, not veteran-specific: the file has no per-site veteran flag. Veteran
 * rows rank first and general rows are capped in-app (`DENSE_GENERAL_CAPS`).
 *
 * "Operating Hours per Week" is a weekly total, not a schedule, so `hours` stays
 * null and the total goes in the description. Mobile vans are excluded — a van's
 * registered address is not where the van is.
 */
import { parseCsvStream } from '../lib/csv.ts';
import { titleCaseName } from '../lib/displayName.ts';
import { httpRequest } from '../lib/http.ts';
import {
  formatAddress,
  isSaneCoord,
  normalizeUrl,
  parseStateFilter,
  trimOrNull,
} from '../lib/normalize.ts';
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

// School-based health centres serve enrolled students, not an adult veteran.
// `academy` catches charter/vocational schools at the cost of the odd real
// "Academy Health" clinic — the acceptable side of the trade.
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

/**
 * Keep a site phone with 10 or 11 digits. Looser than `cleanPhone` in
 * lib/normalize.ts: an 11th digit here is often a one-digit extension.
 */
const sitePhone = (raw: string | null): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? raw : null;
};

/** "40.00" → "open about 40 hours a week". Never written to `hours`, which must be a schedule. */
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

  if (SCHOOL_BASED_SITE.test(siteName)) return null;

  const city = trimOrNull(row[COL.city]);
  const zip = trimOrNull(row[COL.zip])?.slice(0, 5) ?? null;
  const lat = Number(row[COL.latitude]);
  const lng = Number(row[COL.longitude]);
  const hasCoords = isSaneCoord(lat, lng);

  const seasonal =
    locationType === 'Seasonal' ? ' This site is seasonal, so check it is open before you go.' : '';

  // The parent organization, when it differs, tells a veteran who runs the site.
  const centerName = trimOrNull(row[COL.centerName]);
  const runBy =
    centerName && centerName.toUpperCase() !== siteName.toUpperCase()
      ? ` Run by ${titleCaseName(centerName)}.`
      : '';

  return {
    // The file has no site id that survives its rebuilds, so state + ZIP + name is the identity.
    id: `hrsa:${state}-${zip ?? '00000'}-${siteName
      .replace(/[^A-Za-z0-9]+/g, '-')
      .toLowerCase()
      .slice(0, 60)}`,
    name: titleCaseName(siteName),
    category: 'healthcare',
    description:
      'A federally funded community health centre. They see patients whether or not you have ' +
      'insurance and charge on a sliding scale based on your income, so cost should not stop you ' +
      'from being seen. Primary care, and often dental, mental health and prescriptions.' +
      `${runBy}${hoursSentence(trimOrNull(row[COL.hoursPerWeek]))}${seasonal}`,
    address: formatAddress(street, city, state, zip),
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    geocode: hasCoords ? undefined : { street, city, state, zip },
    phone: sitePhone(trimOrNull(row[COL.phone])),
    website: normalizeUrl(row[COL.website]),
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

      const stateFilter = parseStateFilter(query.state);

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
