/**
 * Catholic Charities USA local agencies.
 *
 * 168 agencies covering every state and territory, and — unusually for a
 * scraped source — **100% with coordinates and 167 of 168 with a phone**. They run
 * the practical, unglamorous help a veteran in trouble needs: food, rent and
 * utility assistance, clothing, immigration and housing casework.
 *
 * Previous audits missed this because the old URL moved: `/find-help/` **301s** to
 * `/about-us/find-a-local-agency/`, and that page embeds the whole national list
 * server-side in a single `<script type="application/json">` tag — no XHR, no
 * pagination, no key. `robots.txt` is `Disallow:` (empty), i.e. everything
 * permitted, and it advertises a sitemap.
 *
 * HONEST CATEGORISATION
 *
 * These are agency **headquarters** that run many programmes, not clothing closets
 * or pantries. So the primary row is `community_support` — "this organisation can
 * help with several things" — cross-listed into `clothing` and `food` because a
 * veteran searching either should find them, with copy that says plainly they must
 * ring to find out what that particular agency runs. Filing an agency HQ as a food
 * pantry would send someone to a front desk expecting groceries.
 *
 * `serviced_zip[]` is carried into `raw`: an explicit ZIP service area per agency,
 * which is better than radius maths and worth using if the app ever wants
 * "which agency covers me".
 */
import { fetchText } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'catholic-charities';
const DIRECTORY_URL = 'https://www.catholiccharitiesusa.org/about-us/find-a-local-agency/';

/** Below this, assume the page stopped embedding the list. 168 live. */
const MIN_AGENCIES = 100;

interface Agency {
  title?: string | null;
  address?: string | null;
  apartment_or_suite?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  website_url?: string | null;
  serviced_zip?: string[] | null;
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

const normalizeUrl = (raw: string | null): string | null => {
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** The one embedded JSON island that holds the agency list. */
function extractAgencies(html: string): Agency[] {
  for (const match of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeEntities(match[1]));
    } catch {
      continue;
    }
    const data = (parsed as { data?: unknown })?.data;
    if (Array.isArray(data) && data.length > 50) return data as Agency[];
  }
  return [];
}

function normalize(agency: Agency, today: string): NormalizedResource | null {
  const name = trimOrNull(agency.title);
  const state = trimOrNull(agency.state)?.toUpperCase();
  if (!name || !state || state.length !== 2) return null;

  const street = [trimOrNull(agency.address), trimOrNull(agency.apartment_or_suite)]
    .filter(Boolean)
    .join(', ');
  const city = trimOrNull(agency.city);
  const zip = trimOrNull(agency.zip_code)?.slice(0, 5) ?? null;

  const lat = Number(agency.latitude);
  const lon = Number(agency.longitude);
  const hasCoords = agency.latitude != null && agency.longitude != null && isSaneCoord(lat, lon);

  return {
    id: `ccusa:${state}-${name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase().slice(0, 60)}`,
    name,
    category: 'community_support',
    description:
      'A local Catholic Charities agency. They handle the practical emergencies — help with rent ' +
      'and utility bills, food, clothing, and caseworkers who know what else is available in the ' +
      'area. Help is not limited to Catholics and there is no charge to ask. This is the agency ' +
      'office, and each one runs a different mix of programmes, so call and say what you need ' +
      'rather than turning up for something specific.',
    address:
      [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(', ') || null,
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lon : null,
    geocode: hasCoords ? undefined : { street: street || null, city, state, zip },
    phone: trimOrNull(agency.phone),
    website: normalizeUrl(trimOrNull(agency.website_url)),
    hours: null,
    eligibility:
      'Open to anyone who needs help, regardless of religion. Most assistance is income-based and ' +
      'some programmes need proof of address or of the bill you are behind on — ask what to bring ' +
      'when you call.',
    documents_needed: [],
    source_url: DIRECTORY_URL,
    source_type: 'nonprofit',
    veteran_relevance: 'general',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['catholic-charities', 'emergency-assistance', 'caseworker', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: `${state}-${name}`.slice(0, 200),
    source_provider: PROVIDER,
    ingested_at: today,
    // `serviced_zip` is an explicit ZIP service area — better than radius maths if
    // the app ever wants to answer "which agency covers my ZIP".
    raw: { title: name, state, servicedZip: agency.serviced_zip ?? null },
  };
}

/**
 * Cross-listed into the two categories a veteran would actually search for this
 * kind of help under. `clothing` in particular went from one row to a real
 * category this cycle, and these agencies are among the few in it with a
 * caseworker on the other end of the phone.
 */
function crossList(base: NormalizedResource, category: 'clothing' | 'food'): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:${category}`,
    external_id: `${base.external_id}:${category}`,
    category,
    tags: [...base.tags, category],
  };
}

export const createCatholicCharitiesSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const html = await fetchText(config.baseUrl, {
        label: 'Catholic Charities',
        timeoutMs: 90_000,
      });
      const agencies = extractAgencies(html);

      if (agencies.length < MIN_AGENCIES) {
        throw new Error(
          `Catholic Charities: only ${agencies.length} agencies found in the embedded JSON ` +
            `(expected ~168) — the page stopped server-rendering the list. Refusing to ingest.`,
        );
      }

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (const agency of agencies) {
        const row = normalize(agency, today);
        if (!row || seen.has(row.id)) continue;
        if (stateFilter && !stateFilter.has(String(agency.state).toUpperCase())) continue;
        seen.add(row.id);
        results.push(row, crossList(row, 'clothing'), crossList(row, 'food'));
      }

      console.log(
        `[ingest] catholic-charities: ${results.length / 3} agencies (${results.length} rows) ` +
          `from ${agencies.length} in the directory`,
      );
      return results;
    },
  };
};
