/**
 * Public transit agencies, from the FTA National Transit Database.
 *
 * The question `transportation` still could not answer: a veteran in a rural county
 * with no car and an appointment 40 miles away. The VA's own transportation
 * programme (`vaTransportation.ts`) covers 163 medical centres; this covers the
 * **1,218 rural §5311 providers** and the demand-response services that will
 * collect someone from their door.
 *
 * WHY THIS WAS WRITTEN OFF BEFORE
 *
 * `transit.dot.gov/ntd/ntd-data` returns **403** to any non-browser client, so the
 * dataset looked inaccessible. It is not — the same data sits on Socrata, open and
 * keyless. Checking the portal instead of the publisher's marketing page is the
 * whole trick.
 *
 * TWO TABLES, JOINED ON `ntd_id`
 *
 *   ccvf-fykn  Reporter agency info — 2,914 agencies, 2,833 with a GeoJSON point
 *   uk25-sge7  Demand-response service schedules — 11,943 rows across 1,919 agencies,
 *              with real per-day `svc_begin_time` / `svc_end_time`
 *
 * That second table is one of only two sources in this pipeline that yields genuine
 * opening hours, which is why the join is worth the extra paging.
 *
 * There is **no phone field** in the NTD — `url` is the fallback. Agencies are
 * general-population and labelled so; the description flags the two things that
 * actually decide whether a veteran can use one: whether it is demand-response
 * (door to door, booked ahead) and whether it runs volunteer drivers.
 *
 * Public domain (`https://www.usa.gov/government-works`), attribution: Federal
 * Transit Administration.
 */
import { fromDayRanges, type DayRange } from '../lib/openingHours.ts';
import { fetchJson } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'fta-ntd';
const ATTRIBUTION_URL = 'https://www.transit.dot.gov/ntd';
const SCHEDULES_URL = 'https://data.transportation.gov/resource/uk25-sge7.json';

/** Socrata's default page size; 2,914 agencies is three pages. */
const PAGE = 1_000;
const MAX_PAGES = 25;

/** Below this, assume the dataset moved. 2,914 agencies live. */
const MIN_AGENCIES = 1_500;

interface AgencyRow {
  ntd_id?: string | null;
  agency_name?: string | null;
  doing_business_as?: string | null;
  reporter_type?: string | null;
  organization_type?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  url?: string | null;
  volunteer_drivers?: string | null;
  service_area_pop?: string | null;
  street_address_geo_reference?: { type?: string; coordinates?: number[] } | null;
}

interface ScheduleRow {
  ntd_id?: string | null;
  day_name?: string | null;
  svc_begin_time?: string | null;
  svc_end_time?: string | null;
  only_ada_flag?: string | null;
}

/**
 * Socrata types its columns loosely — a ZIP or a driver count can arrive as a JSON
 * number rather than a string, so this coerces instead of assuming `.trim()`
 * exists. Calling `.trim()` on a number is how the first run of this adapter died.
 */
const trimOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const t = String(value).trim();
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

/**
 * Agency names are mostly mixed-case already; only the all-caps ones need work.
 *
 * Transit is full of acronym names — RIPTA, MARTA, SEPTA, TARC — and blindly
 * title-casing turns them into "Ripta", which reads as a typo. Any all-caps token
 * of five characters or fewer is treated as an acronym and left alone; longer ones
 * are real words being shouted.
 */
function tidyName(raw: string): string {
  if (raw !== raw.toUpperCase()) return raw;
  const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to']);
  return raw
    .split(/\s+/)
    .map((word, i) => {
      const letters = word.replace(/[^A-Za-z]/g, '');
      if (letters.length > 0 && letters.length <= 5) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.replace(/^([a-z])/, (c) => c.toUpperCase());
    })
    .join(' ');
}

/** Page a Socrata resource until it runs out. */
async function fetchAll<T>(url: string, label: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await fetchJson<T[]>(`${url}?$limit=${PAGE}&$offset=${page * PAGE}`, {
      label,
      timeoutMs: 90_000,
    });
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function normalize(
  agency: AgencyRow,
  hours: string | null,
  today: string,
): NormalizedResource | null {
  const id = trimOrNull(agency.ntd_id);
  const rawName = trimOrNull(agency.doing_business_as) ?? trimOrNull(agency.agency_name);
  const state = trimOrNull(agency.state)?.toUpperCase();
  const street = [trimOrNull(agency.address_line_1), trimOrNull(agency.address_line_2)]
    .filter(Boolean)
    .join(', ');
  if (!id || !rawName || !state || state.length !== 2 || !street) return null;

  const city = trimOrNull(agency.city);
  const zip = trimOrNull(agency.zip_code)?.slice(0, 5) ?? null;

  const point = agency.street_address_geo_reference?.coordinates;
  // GeoJSON is [longitude, latitude] — reversing these is the classic way to end
  // up with every transit agency in the Indian Ocean.
  const lon = Array.isArray(point) ? Number(point[0]) : NaN;
  const lat = Array.isArray(point) ? Number(point[1]) : NaN;
  const hasCoords = isSaneCoord(lat, lon);

  const isRural = /rural/i.test(agency.reporter_type ?? '');
  const volunteers = Number(agency.volunteer_drivers);
  const hasVolunteers = Number.isFinite(volunteers) && volunteers > 0;

  const ruralNote = isRural
    ? ' This is a rural transit provider, so services are usually demand-response — you ring ahead ' +
      'and they collect you, rather than running a fixed route.'
    : '';
  const volunteerNote = hasVolunteers
    ? ` They run a volunteer driver programme (${volunteers} drivers), which is often the way to get ` +
      `a longer trip covered.`
    : '';

  return {
    id: `ntd:${id}`,
    name: tidyName(rawName),
    category: 'transportation',
    description:
      `Public transit serving this area.${ruralNote}${volunteerNote} Ask whether they can take you ` +
      `to a medical appointment, what it costs, and how far ahead you need to book — and mention ` +
      `you are a veteran, since some providers have reduced fares. If they cannot help, your VA ` +
      `medical centre's transportation representative may be able to.`,
    address:
      [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(', ') || null,
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lon : null,
    geocode: hasCoords ? undefined : { street, city, state, zip },
    // The NTD carries no phone at all; the agency website is the only contact.
    phone: null,
    website: normalizeUrl(trimOrNull(agency.url)),
    hours,
    eligibility:
      'Open to everyone. Fares and booking rules vary by agency, and demand-response services ' +
      'usually need a day or more of notice. Some agencies reduce fares for older people, people ' +
      'with disabilities, or veterans — ask.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    source_type: 'official',
    veteran_relevance: 'general',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: [
      'transportation',
      'public-transit',
      ...(isRural ? ['rural-transit', 'demand-response'] : []),
      ...(hasVolunteers ? ['volunteer-drivers'] : []),
      `state:${state}`,
    ],
    created_at: today,
    updated_at: today,
    external_id: id,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: {
      ntdId: id,
      reporterType: agency.reporter_type,
      volunteerDrivers: agency.volunteer_drivers,
    },
  };
}

export const createNtdTransitAgenciesSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);

      const [agencies, schedules] = await Promise.all([
        fetchAll<AgencyRow>(config.baseUrl, 'NTD agencies'),
        // Schedules are a bonus: if this table moves, agencies still land without
        // hours rather than the whole source failing.
        fetchAll<ScheduleRow>(SCHEDULES_URL, 'NTD schedules').catch((err) => {
          console.warn(
            `[ingest] fta-ntd: service schedules unavailable — ${String(err).slice(0, 90)}`,
          );
          return [] as ScheduleRow[];
        }),
      ]);

      if (agencies.length < MIN_AGENCIES) {
        throw new Error(
          `NTD: only ${agencies.length} agencies returned (expected ~2,914) — the dataset likely ` +
            `moved. Refusing to ingest.`,
        );
      }

      // ntd_id → per-day service window. ADA-only windows are excluded: they are
      // paratransit-eligibility hours, not when the service runs for everyone.
      const dayRanges = new Map<string, DayRange[]>();
      for (const row of schedules) {
        const id = trimOrNull(row.ntd_id);
        if (!id) continue;
        if (trimOrNull(row.only_ada_flag) === '1') continue;
        const day = trimOrNull(row.day_name);
        const opens = trimOrNull(row.svc_begin_time);
        const closes = trimOrNull(row.svc_end_time);
        if (!day || !opens || !closes) continue;
        const bucket = dayRanges.get(id);
        const entry = { day, opens, closes };
        if (bucket) bucket.push(entry);
        else dayRanges.set(id, [entry]);
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
      let withHours = 0;
      let rural = 0;
      for (const agency of agencies) {
        const id = trimOrNull(agency.ntd_id);
        const hours = id ? fromDayRanges(dayRanges.get(id) ?? []) : null;
        const row = normalize(agency, hours, today);
        if (!row || seen.has(row.id)) continue;
        if (stateFilter && !stateFilter.has(String(agency.state).trim().toUpperCase())) continue;
        seen.add(row.id);
        if (row.hours) withHours += 1;
        if (/rural/i.test(agency.reporter_type ?? '')) rural += 1;
        results.push(row);
      }

      console.log(
        `[ingest] fta-ntd: ${results.length} agencies from ${agencies.length} reporters ` +
          `(${rural} rural, ${withHours} with real service hours)`,
      );
      return results;
    },
  };
};
