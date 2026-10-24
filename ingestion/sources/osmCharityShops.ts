/**
 * Charity and second-hand shops, from OpenStreetMap via the Overpass API — the
 * only national answer for `clothing`, including Goodwill and Salvation Army
 * locations whose own sites block automated access.
 *
 * Two Overpass details: the query must be form-encoded (`data=…`; a text/plain
 * body gets 406), and `out tags center;` is what gives ways and relations a
 * single lat/lon.
 *
 * Licence: ODbL 1.0, and attribution must be visible. Rows carry
 * `source_type: 'community'` and an `osm` tag, from which
 * `src/features/resources/resourceStatus.ts` renders "© OpenStreetMap
 * contributors". General-population shops, labelled `general`.
 */
import { fromOsm } from '../lib/openingHours.ts';
import { httpRequest } from '../lib/http.ts';
import {
  cleanPhone,
  formatAddress,
  isSaneCoord,
  normalizeUrl,
  parseStateFilter,
  trimOrNull,
} from '../lib/normalize.ts';
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

  const address = formatAddress(street, city, state, zip);

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
    website: normalizeUrl(trimOrNull(tags.website) ?? tags['contact:website']),
    hours: fromOsm(tags.opening_hours),
    eligibility:
      'Open to everyone. Charity shops are ordinary shops — no referral or proof of anything is ' +
      'needed to walk in and buy. Clothing banks give items out free, and some ask for a referral ' +
      'from a caseworker or veterans service officer.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    // Renders the "Community-submitted" label and hedged warning.
    source_type: 'community',
    veteran_relevance: 'general',
    verification_status: 'needs_review',
    last_checked: today,
    last_updated: today,
    // `osm` is load-bearing: resourceStatus.ts keys the ODbL attribution off it.
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

      // Form-encoded body (text/plain → 406) and an honest User-Agent: Overpass
      // 406s the browser-shaped default from lib/http.ts.
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

      const stateFilter = parseStateFilter(query.state);

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
