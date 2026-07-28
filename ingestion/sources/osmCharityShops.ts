/**
 * Charity and second-hand shops, from OpenStreetMap via the Overpass API.
 *
 * WHY THIS EXISTS
 *
 * `clothing` held **one** row. A veteran needing interview clothes, a winter coat
 * or work boots had nowhere to go. Two previous audits concluded no national
 * dataset existed, and both were wrong in the same way: they checked the
 * *retailers'* own websites. Goodwill returns 403 to everything including its own
 * `robots.txt`, so permission cannot even be established; Salvation Army's locator
 * is broken. Neither matters, because the community had already mapped them:
 *
 *   Goodwill ~2,252 · Salvation Army ~495 · Habitat ReStore ~319 · St Vincent de Paul ~141
 *
 * One Overpass query returns **8,664 US locations**, 96.6% with a name, 56% with a
 * full street address, and — the part no other source in this pipeline offers at
 * this rate — **2,472 with real `opening_hours`**.
 *
 * TWO THINGS THAT BREAK NAIVE ATTEMPTS
 *
 * 1. Overpass rejects `Content-Type: text/plain` with **406**. The query must be
 *    form-encoded as `data=…`.
 * 2. `out tags center;` — not `out tags;` — is what gives ways and relations a
 *    single lat/lon. A shop mapped as a building outline is a way, and without
 *    `center` it comes back with no coordinates at all.
 *
 * LICENCE — ODbL 1.0, AND IT HAS A UI CONSEQUENCE
 *
 * Attribution must be **visible to the user**, not merely present in the repo.
 * Rows carry `source_type: 'community'` and an `osm` tag, and
 * `src/features/resources/resourceStatus.ts` renders "© OpenStreetMap
 * contributors" for them. Share-alike attaches to a redistributed *database*, not
 * to rendering in the app, so the `osm` tag also exists so an ODbL request could
 * be honoured without relicensing the whole table.
 *
 * These are general-population shops, labelled `general` — no veteran-specific
 * clothing dataset exists anywhere, and pretending otherwise would be a lie a
 * veteran would discover at the counter.
 */
import { fromOsm } from '../lib/openingHours.ts';
import { httpRequest } from '../lib/http.ts';
import { stableKey } from '../lib/stableKey.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'osm-clothing';
const ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

/**
 * `out tags center` gives every element a single lat/lon, including ways and
 * relations — a shop mapped as a building outline would otherwise have none.
 */
const QUERY = `[out:json][timeout:290];
area["ISO3166-1"="US"][admin_level=2]->.us;
(
  nwr["shop"="charity"](area.us);
  nwr["shop"="second_hand"](area.us);
  nwr["social_facility"="clothing_bank"](area.us);
);
out tags center;`;

/** Below this, assume Overpass truncated or the tagging changed. 8,664 live. */
const MIN_SHOPS = 4_000;

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

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

/** OSM phone tags are free-text; keep only something dialable. */
function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(';')[0].trim();
  const digits = first.replace(/\D/g, '');
  if (digits.length === 10) return first;
  if (digits.length === 11 && digits.startsWith('1')) return first;
  return null;
}

/** What kind of place this is, for the description. */
function shopKind(tags: Record<string, string>): string {
  if (tags.social_facility === 'clothing_bank') return 'a clothing bank';
  if (tags.shop === 'charity') return 'a charity shop';
  return 'a second-hand shop';
}

function normalize(element: OverpassElement, today: string): NormalizedResource | null {
  const tags = element.tags ?? {};
  const name = trimOrNull(tags.name);
  // An unnamed pin is not something a veteran can be sent to.
  if (!name) return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null || !isSaneCoord(lat, lon)) return null;

  const houseNumber = trimOrNull(tags['addr:housenumber']);
  const streetName = trimOrNull(tags['addr:street']);
  const street = houseNumber && streetName ? `${houseNumber} ${streetName}` : streetName;
  const city = trimOrNull(tags['addr:city']);
  const state = trimOrNull(tags['addr:state'])?.toUpperCase() ?? null;
  const zip = trimOrNull(tags['addr:postcode'])?.slice(0, 5) ?? null;

  const address =
    [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', ') || null;

  const isClothingBank = tags.social_facility === 'clothing_bank';
  const freeNote = isClothingBank
    ? 'Clothing is given out free here.'
    : 'Clothing, shoes and household goods at low prices, and many charity shops run voucher or ' +
      'free-clothing programmes for people referred by a caseworker — worth asking.';

  return {
    // OSM ids are stable per element but change type when a node becomes a way, so
    // identity is derived from name + place, as with the other keyless feeds.
    id: `osm:${stableKey(name, address, state ?? '')}`,
    name,
    category: 'clothing',
    description:
      `${name} is ${shopKind(tags)}. ${freeNote} If you need interview clothes or work boots, say ` +
      `so — staff often know what help is available locally. Mapped by OpenStreetMap contributors, ` +
      `so details can be out of date; call ahead where there is a number.`,
    address,
    latitude: lat,
    longitude: lon,
    phone: cleanPhone(trimOrNull(tags.phone) ?? trimOrNull(tags['contact:phone'])),
    website: normalizeUrl(trimOrNull(tags.website) ?? trimOrNull(tags['contact:website'])),
    hours: fromOsm(tags.opening_hours),
    eligibility:
      'Open to everyone. Charity shops are ordinary shops — no referral or proof of anything is ' +
      'needed to walk in and buy. Clothing banks give items out free, and some ask for a referral ' +
      'from a caseworker or veterans service officer.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    // Crowd-sourced, so the app should say so rather than assert official data.
    // This is what renders the "Community-submitted" label and the hedged warning.
    source_type: 'community',
    veteran_relevance: 'general',
    verification_status: 'needs_review',
    last_checked: today,
    last_updated: today,
    // `osm` is load-bearing: `resourceStatus.ts` keys the ODbL attribution off it,
    // and it makes the OSM-derived subset selectable if ODbL share-alike is ever
    // invoked against a redistributed database.
    tags: [
      'osm',
      'clothing',
      'thrift-store',
      ...(isClothingBank ? ['clothing-bank', 'free'] : ['low-cost']),
      ...(state ? [`state:${state}`] : []),
    ],
    created_at: today,
    updated_at: today,
    external_id: `${element.type ?? 'node'}/${element.id ?? stableKey(name, address, state ?? '')}`,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { type: element.type, id: element.id, tags },
  };
}

export const createOsmCharityShopsSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);

      // Two header requirements, both verified by trial against the live API:
      //
      //  * The body must be form-encoded. A `text/plain` body gets 406.
      //  * The User-Agent must be honest. `lib/http.ts` defaults to a
      //    `Mozilla/5.0 (compatible; …)` string so that va.gov and
      //    careeronestop.org don't 403 us, but Overpass's mod_security rejects
      //    exactly that shape with 406 — measured: `Mozilla/5.0 (compatible;
      //    FrontlineIngest/1.0)` → 406, plain `FrontlineIngest/1.0` → 200. Which
      //    is the right outcome: Overpass's usage policy asks callers to identify
      //    themselves rather than pose as a browser.
      const response = await httpRequest(config.baseUrl, {
        label: 'Overpass',
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }).toString(),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'FrontlineIngest/1.0 (veteran resource directory)',
        },
        // A national query is heavy; Overpass allows 290s server-side.
        timeoutMs: 330_000,
        // Overpass runs two slots per IP — a retry storm just queues behind itself.
        maxRetries: 2,
        retryBaseMs: 30_000,
      });
      if (!response.ok) throw new Error(`Overpass: HTTP ${response.status}`);
      const body = (await response.json()) as { elements?: OverpassElement[] };
      const elements = body.elements ?? [];

      if (elements.length < MIN_SHOPS) {
        throw new Error(
          `Overpass: only ${elements.length} elements returned (expected ~8,600) — the query was ` +
            `truncated or the tagging changed. Refusing to ingest a partial national set.`,
        );
      }

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let unnamed = 0;
      let withHours = 0;
      for (const element of elements) {
        const normalized = normalize(element, today);
        if (!normalized) {
          if (!element.tags?.name) unnamed += 1;
          continue;
        }
        if (stateFilter) {
          const state = element.tags?.['addr:state']?.toUpperCase();
          if (!state || !stateFilter.has(state)) continue;
        }
        if (seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        if (normalized.hours) withHours += 1;
        results.push(normalized);
      }

      console.log(
        `[ingest] osm-clothing: ${results.length} shops from ${elements.length} elements ` +
          `(${withHours} with opening hours, ${unnamed} unnamed skipped)`,
      );
      return results;
    },
  };
};
