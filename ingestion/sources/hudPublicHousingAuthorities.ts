/**
 * HUD Public Housing Authorities — the offices that issue HUD-VASH vouchers.
 *
 * HUD-VASH is the main permanent-housing programme for homeless veterans: the VA
 * provides case management, and a local Public Housing Authority issues the
 * actual voucher. The app has carried a national HUD-VASH referral for months
 * with nowhere to send anyone, because the veteran's next step is a specific PHA
 * office and there was no list of them.
 *
 * HUD publishes all 3,776 as an ArcGIS feature layer with `LAT`/`LON`, a phone
 * number and an email — public domain, keyless, quarterly-ish updates.
 *
 * `general`, honestly: the layer has no HUD-VASH column, so this cannot claim
 * per-office veteran programmes. Nearly every PHA administers some vouchers and
 * all of them handle public housing waiting lists, which is what a veteran at
 * risk of homelessness needs regardless. The description says to ask for HUD-VASH
 * by name rather than implying the office is veteran-specific.
 */
import { fetchJson } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'hud-pha';
const ATTRIBUTION_URL = 'https://www.hud.gov/program_offices/public_indian_housing/pha/contacts';

/** ArcGIS caps a query at 2,000 features; page with resultOffset. */
const PAGE_SIZE = 2_000;
const MAX_PAGES = 10;

/** Below this, assume the layer moved. 3,776 was the live count on 2026-07-28. */
const MIN_AUTHORITIES = 2_500;

interface PhaAttributes {
  PARTICIPANT_CODE?: string | null;
  FORMAL_PARTICIPANT_NAME?: string | null;
  HA_PHN_NUM?: string | null;
  HA_EMAIL_ADDR_TEXT?: string | null;
  STD_ADDR?: string | null;
  STD_CITY?: string | null;
  STD_ST?: string | null;
  STD_ZIP5?: string | null;
  HA_PROGRAM_TYPE?: string | null;
  TOTAL_UNITS?: number | null;
  SECTION8_UNITS_CNT?: number | null;
  LAT?: number | null;
  LON?: number | null;
}

interface FeatureResponse {
  features?: { attributes?: PhaAttributes }[];
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

const isSaneCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

/** HUD stores phones as raw digits; format so they're tappable and readable. */
function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits.length >= 10 ? raw.trim() : null;
}

function titleCase(name: string): string {
  const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to']);
  const KEEP_UPPER = /^(?:HA|PHA|HUD|USA|US|II|III|IV)$/;
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

function normalize(attrs: PhaAttributes, today: string): NormalizedResource | null {
  const code = trimOrNull(attrs.PARTICIPANT_CODE);
  const rawName = trimOrNull(attrs.FORMAL_PARTICIPANT_NAME);
  const street = trimOrNull(attrs.STD_ADDR);
  const state = trimOrNull(attrs.STD_ST)?.toUpperCase();
  if (!code || !rawName || !street || !state || state.length !== 2) return null;
  if (/^p\.?\s*o\.?\s*box/i.test(street)) return null;

  const city = trimOrNull(attrs.STD_CITY);
  const zip = trimOrNull(attrs.STD_ZIP5);
  const lat = Number(attrs.LAT);
  const lng = Number(attrs.LON);
  const hasCoords = attrs.LAT != null && attrs.LON != null && isSaneCoord(lat, lng);

  const vouchers = Number(attrs.SECTION8_UNITS_CNT);
  const voucherLine =
    Number.isFinite(vouchers) && vouchers > 0
      ? ` They administer about ${vouchers.toLocaleString('en-US')} housing vouchers.`
      : '';

  return {
    id: `hudpha:${code}`,
    name: titleCase(rawName),
    category: 'housing',
    description:
      'The local public housing authority. This is the office that issues HUD-VASH vouchers — the ' +
      'main permanent-housing programme for veterans who are homeless — as well as Section 8 ' +
      'vouchers and public housing. Ask for HUD-VASH by name; your VA case manager refers you, and ' +
      `this office issues the voucher.${voucherLine}`,
    address: [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', '),
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    geocode: hasCoords ? undefined : { street, city, state, zip },
    phone: formatPhone(trimOrNull(attrs.HA_PHN_NUM)),
    website: null,
    hours: null,
    eligibility:
      'Open to everyone; income limits apply and most authorities keep a waiting list. Veterans ' +
      'who are homeless can be referred to HUD-VASH through a VA case manager, which is handled ' +
      'separately from the general waiting list — say you are a veteran when you call.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    source_type: 'official',
    veteran_relevance: 'general',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['public-housing-authority', 'hud-vash', 'housing-voucher', 'section-8', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: code,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { code, name: rawName, programType: attrs.HA_PROGRAM_TYPE, totalUnits: attrs.TOTAL_UNITS },
  };
}

export const createHudPublicHousingAuthoritiesSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let fetched = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        const url =
          `${config.baseUrl}?where=1%3D1&outFields=*&returnGeometry=false&f=pjson` +
          `&resultRecordCount=${PAGE_SIZE}&resultOffset=${page * PAGE_SIZE}`;
        const body = await fetchJson<FeatureResponse>(url, { label: 'HUD PHA', timeoutMs: 90_000 });
        if (body.error) throw new Error(`HUD PHA: ${body.error.message ?? 'ArcGIS error'}`);

        const features = body.features ?? [];
        fetched += features.length;
        for (const feature of features) {
          const attrs = feature.attributes;
          if (!attrs) continue;
          const normalized = normalize(attrs, today);
          if (!normalized || seen.has(normalized.id)) continue;
          if (stateFilter && !stateFilter.has(String(attrs.STD_ST).trim().toUpperCase())) continue;
          seen.add(normalized.id);
          results.push(normalized);
        }
        if (features.length < PAGE_SIZE) break;
      }

      if (!stateFilter && fetched < MIN_AUTHORITIES) {
        throw new Error(
          `HUD PHA: only ${fetched} authorities returned (expected at least ${MIN_AUTHORITIES}) — ` +
            `the feature layer likely moved.`,
        );
      }

      console.log(
        `[ingest] hud-pha: ${results.length} housing authorities from ${fetched} features`,
      );
      return results;
    },
  };
};
