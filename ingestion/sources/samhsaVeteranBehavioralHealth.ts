/**
 * SAMHSA FindTreatment.gov — facilities with a veterans program.
 *
 * Mental health and substance use treatment is the gap this app could least
 * afford. Before this source, `healthcare` was 1,982 rows and every one of them
 * was a VA facility, so a veteran more than a drive from a VA clinic had nothing
 * — and the two things veterans most often need help with, PTSD and addiction,
 * were only findable inside the VA.
 *
 * FindTreatment.gov is SAMHSA's national behavioural-health directory, and its
 * facilities carry a "Special Programs/Groups Offered" attribute whose values
 * include `Veterans`. That is the whole reason this source is here: it is a
 * *veteran filter on a general dataset*, so the facilities that survive it are
 * places that have said they run a veterans program.
 *
 * Measured 2026-07-28: the API reports 8,355 matches, which yield **6,253
 * distinct facilities**. `sType=BOTH` is a union of the substance-use (4,510) and
 * mental-health (3,845) directories, so a facility offering both is listed twice
 * and the `seen` guard collapses 1,682 such pairs; a further 420 have no street
 * address and are dropped.
 *
 * WHY THIS WAS TRIED BEFORE AND ABANDONED
 *
 * The 2026-07-22 rebuild dropped SAMHSA with the note that "`sCodes=VET` did not
 * filter". It does. The bug was elsewhere: `limitValue` is a radius in **metres**,
 * not miles (confirmed in the locator's own bundle,
 * `locator_common_bundle.js` — `t.distanceInMeters=parseFloat(limitValue)`), so
 * every geo-scoped request was searching a 10-metre circle and matching nothing.
 *
 * This adapter sidesteps radius entirely: omitting `sAddr` and `limitType`
 * returns the NATIONAL set, so the whole veteran slice arrives in five paginated
 * calls with coordinates already attached. No key, and robots.txt permits it
 * (empty `Disallow`).
 *
 * WHAT IT DOES NOT HAVE: hours. Nothing in this feed carries them.
 */
import { fetchJson } from '../lib/http.ts';
import { stableKey } from '../lib/stableKey.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'samhsa-veteran-bh';
const ATTRIBUTION_URL = 'https://findtreatment.gov/';

/** `sType=BOTH` is a UNION of substance-use and mental-health facilities. */
const SERVICE_TYPE = 'BOTH';

/**
 * Service filter codes, verified live 2026-07-28 against the locator:
 *   VET   → "Veterans"                        8,355 facilities
 *   ADMIL → "Active duty military"
 *   MILF  → "Members of military families"
 * `sCodes` is AND-ed, so asking for all three collapses to 4,950. VET alone is
 * the right filter: a facility with a veterans program is what a veteran needs,
 * whether or not it also serves active duty.
 */
const VETERAN_SERVICE_CODE = 'VET';

/** The API accepts 2000; the whole veteran set is then five pages. */
const PAGE_SIZE = 2_000;
/** Guard against a paging bug walking forever. */
const MAX_PAGES = 40;

/**
 * Below this, assume the API or the filter changed rather than ingest a fraction
 * of the dataset — 8,355 was the live count on 2026-07-28, and this source is
 * the backbone of `healthcare`.
 */
const MIN_ROWS = 5_000;

interface LocatorService {
  /** Human-readable category, e.g. "Special Programs/Groups Offered". */
  f1?: string;
  /** Short code, e.g. "SG". */
  f2?: string;
  /** Semicolon-delimited values, e.g. "Veterans; Seniors or older adults". */
  f3?: string;
}

interface LocatorRow {
  /** Per-page row index — NOT a stable id. See `stableKey` use below. */
  _irow?: number;
  name1?: string;
  name2?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  intake1?: string | null;
  hotline1?: string | null;
  website?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  typeFacility?: string | null;
  services?: LocatorService[];
}

interface LocatorPage {
  page?: number;
  totalPages?: number;
  recordCount?: number;
  rows?: LocatorRow[];
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/** Reject the null island and out-of-range junk rather than pin a bad coord. */
const isSaneCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

function parseCoords(row: LocatorRow): { latitude: number; longitude: number } | null {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (row.latitude == null || row.longitude == null || !isSaneCoord(lat, lng)) return null;
  return { latitude: lat, longitude: lng };
}

const normalizeUrl = (raw: string | null | undefined): string | null => {
  const url = trimOrNull(raw);
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, '')}`;
};

/** Look a service category up by its short code (`SG`, `TC`, `PAY`, …). */
function serviceValues(row: LocatorRow, code: string): string[] {
  const match = row.services?.find((s) => s.f2 === code);
  if (!match?.f3) return [];
  return match.f3
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Service-category codes whose values are worth surfacing to a veteran. */
const SERVICE_GROUPS = 'SG';
const TYPE_OF_CARE = 'TC';
const PAYMENT_ASSISTANCE = 'PYAS';
const PAYMENT_ACCEPTED = 'PAY';

/**
 * The API is asked for `sCodes=VET`, but this re-checks the returned record
 * rather than trusting the filter. It is exactly the assumption that went wrong
 * last time this source was attempted, and the check is one array lookup.
 */
const hasVeteranProgram = (row: LocatorRow): boolean =>
  serviceValues(row, SERVICE_GROUPS).some((v) => /^veterans$/i.test(v));

/** "Sliding fee scale" / "Payment assistance" → a sentence a veteran can act on. */
function affordability(row: LocatorRow): string {
  const help = serviceValues(row, PAYMENT_ASSISTANCE);
  const accepted = serviceValues(row, PAYMENT_ACCEPTED);
  if (help.length > 0) {
    return ` They report payment help: ${help.join('; ').toLowerCase()}.`;
  }
  if (accepted.some((v) => /medicaid|medicare/i.test(v))) {
    return ' They accept Medicaid or Medicare — ask what your cost would be.';
  }
  return ' Ask what it costs and whether they bill VA Community Care before you go.';
}

function normalize(row: LocatorRow, today: string): NormalizedResource | null {
  const name = trimOrNull(row.name1);
  const state = trimOrNull(row.state)?.toUpperCase();
  if (!name || !state) return null;
  if (!hasVeteranProgram(row)) return null;

  const coords = parseCoords(row);
  const street = [trimOrNull(row.street1), trimOrNull(row.street2)].filter(Boolean).join(', ');
  const city = trimOrNull(row.city);
  const zip = trimOrNull(row.zip);
  // A PO box is not somewhere you attend treatment; without a street we cannot
  // honestly present this as a place to go.
  if (!street || /^p\.?\s*o\.?\s*box/i.test(street)) return null;

  // This endpoint returns no facility id — only `_irow`, a per-page index that
  // changes between runs — so the id is derived from the facility's identity.
  const key = stableKey(`${name} ${trimOrNull(row.name2) ?? ''}`, `${street} ${city ?? ''}`, state);

  const care = serviceValues(row, TYPE_OF_CARE);
  const careLine =
    care.length > 0
      ? `They offer ${care.join('; ').toLowerCase()}.`
      : 'They offer mental health or substance use treatment.';

  // `name2` is the program/site name under the parent organization ("Athens").
  const program = trimOrNull(row.name2);

  return {
    id: `samhsa:${key}`,
    name: program && !name.includes(program) ? `${name} — ${program}` : name,
    category: 'healthcare',
    description:
      `Behavioural health provider with a program for veterans, listed in SAMHSA's national ` +
      `treatment directory. ${careLine}${affordability(row)}`,
    address: [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', '),
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    // Rows without usable coordinates still have a full street address, so let
    // the runner's Census geocoder try rather than dropping the facility.
    geocode: coords ? undefined : { street, city, state, zip },
    // `intake1` is the intake line where one exists — that is the number a
    // veteran actually needs, so prefer it over the switchboard.
    phone: trimOrNull(row.intake1) ?? trimOrNull(row.phone) ?? trimOrNull(row.hotline1),
    website: normalizeUrl(row.website),
    hours: null, // FindTreatment.gov carries none.
    eligibility:
      'Open to veterans; this facility reports a program specifically for veterans. You do not need to be enrolled in VA health care. Call first to ask about intake, cost, and whether they bill VA Community Care.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    source_type: 'directory',
    veteran_relevance: 'veteran_specific',
    // SAMHSA rebuilds the directory annually from its facility survey and takes
    // corrections weekly, so a listing is credible but not VA-authoritative —
    // `needs_review` is what makes the app say "Directory listing" rather than
    // "Official VA/gov data".
    verification_status: 'needs_review',
    last_checked: today,
    last_updated: today,
    tags: [
      'behavioral-health',
      'mental-health',
      'substance-use',
      'veterans-program',
      `state:${state}`,
    ],
    created_at: today,
    updated_at: today,
    external_id: key,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: row,
  };
}

/**
 * A second row under `community_support`. Peer support and counselling for
 * PTSD sit as naturally under "family & caregiver support" as under healthcare,
 * and a veteran who taps that shell should not have to know the difference.
 */
function crossListCommunity(base: NormalizedResource): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:community`,
    external_id: `${base.external_id}:community`,
    category: 'community_support',
    tags: [...base.tags, 'counseling'],
  };
}

export const createSamhsaVeteranBehavioralHealthSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const base = config.baseUrl.replace(/\/$/, '');

      const rows: LocatorRow[] = [];
      let expectedTotal: number | null = null;

      // No sAddr / limitType: that is what makes this the national set.
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url =
          `${base}?sType=${SERVICE_TYPE}&sCodes=${VETERAN_SERVICE_CODE}` +
          `&pageSize=${PAGE_SIZE}&page=${page}`;
        const body = await fetchJson<LocatorPage>(url, { label: 'SAMHSA', timeoutMs: 90_000 });
        expectedTotal ??= body.recordCount ?? null;
        const batch = body.rows ?? [];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        if (body.totalPages && page >= body.totalPages) break;
      }

      if (expectedTotal !== null && rows.length < expectedTotal * 0.9) {
        throw new Error(
          `SAMHSA: fetched ${rows.length} of ${expectedTotal} facilities — pages were lost.`,
        );
      }

      const stateFilter = query.state
        ? new Set(
            query.state
              .toUpperCase()
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let notVeteran = 0;
      let unusable = 0;
      for (const row of rows) {
        const normalized = normalize(row, today);
        if (!normalized) {
          if (!hasVeteranProgram(row)) notVeteran += 1;
          else unusable += 1;
          continue;
        }
        if (stateFilter && !stateFilter.has(String(row.state).toUpperCase())) continue;
        if (seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized, crossListCommunity(normalized));
      }

      // The veterans filter is the entire point of this source. If SAMHSA renames
      // the `SG`/"Veterans" value, `hasVeteranProgram` starts rejecting
      // everything — fail rather than quietly ingest general facilities as
      // veteran-specific, which is the mistake that got this source dropped in
      // July 2026.
      if (!stateFilter && results.length / 2 < MIN_ROWS) {
        throw new Error(
          `SAMHSA: only ${results.length / 2} facilities carried a "Veterans" program ` +
            `(of ${rows.length} fetched, ${notVeteran} lacked the flag) — the sCodes=VET filter ` +
            `or the SG service value likely changed. Refusing to ingest.`,
        );
      }

      console.log(
        `[ingest] samhsa-veteran-bh: ${results.length / 2} veteran-program facilities ` +
          `(${results.length} rows) from ${rows.length} fetched` +
          (unusable > 0 ? `; ${unusable} skipped — no street address` : ''),
      );
      return results;
    },
  };
};
