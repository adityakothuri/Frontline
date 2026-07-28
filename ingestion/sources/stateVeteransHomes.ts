/**
 * State Veterans Homes adapter (National Association of State Veterans Homes).
 *
 * State Veterans Homes are the long-term care system built for veterans:
 * skilled nursing, domiciliary, and adult day health care, run by the states
 * and certified and partly funded by the VA. For an aging veteran — Frontline's
 * actual user — this is among the most consequential resources that exists, and
 * the app had nothing like it.
 *
 * The VA publishes no machine-readable list. NASVH, the association the homes
 * belong to, runs a WordPress site whose `veterans-homes` post type is exposed
 * over `wp-json`, so this reads that rather than scraping rendered pages.
 * Measured 2026-07-28: the feed returns 174 posts, of which **166 parse into a
 * home with an address** — that is the number that lands in the table, and the
 * one ingestion/README.md and freshnessGate.ts now agree on.
 *
 * The record body is WPBakery shortcode soup, but the useful part is a flat
 * sequence of `LABEL:` headings followed by their values — see `parseSections`.
 * That layout is the load-bearing assumption here; `fetch` fails loudly if it
 * stops holding rather than silently ingesting empty rows.
 *
 * Homes carry no coordinates, so rows emit `geocode` parts and the runner pins
 * them via the Census batch geocoder. Cross-listed into `healthcare` as well as
 * `housing`: a veteran looking for either nursing care or somewhere to live
 * should find them.
 */
import { titleCaseName } from '../lib/displayName.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'state-veterans-homes';
const ATTRIBUTION_URL = 'https://nasvh.org/directory/';
const PER_PAGE = 100;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;

/** Below this share of homes yielding an address, assume the page shape changed. */
const MIN_ADDRESS_RATE = 0.8;

interface WpPost {
  id: number;
  title?: { rendered?: string };
  content?: { rendered?: string };
  link?: string;
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

const trimOrNull = (s: string | undefined | null): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Body HTML → `{ LABEL: [values…] }`.
 *
 * Shortcodes and tags are stripped to leave the visible text, then each line
 * ending in `:` opens a section that the following lines belong to. Lines
 * before the first label are the home's blurb, kept under the '' key.
 */
function parseSections(html: string): Map<string, string[]> {
  const text = decodeEntities(html)
    .replace(/\[[^\]]*\]/g, ' ') // WPBakery shortcodes
    .replace(/<[^>]+>/g, '\n');
  const sections = new Map<string, string[]>();
  let current = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.endsWith(':') && line.length <= 40) {
      current = line.slice(0, -1).trim().toUpperCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    const bucket = sections.get(current);
    if (bucket) bucket.push(line);
    else sections.set(current, [line]);
  }
  return sections;
}

/** First `<a href>` in the body that points somewhere other than NASVH itself. */
function externalLink(html: string): string | null {
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = decodeEntities(m[1]);
    if (/^https?:\/\//i.test(href) && !/nasvh\.org/i.test(href)) return href;
  }
  return null;
}

/** "Sumter, SC 329153" → the parts the Census geocoder wants. */
function splitCityStateZip(line: string): { city: string | null; state: string | null; zip: string | null } {
  const m = line.match(/^(.*?),\s*([A-Za-z]{2})\.?\s*(\d{5})?(?:-\d{4})?\s*$/);
  if (!m) return { city: trimOrNull(line), state: null, zip: null };
  return {
    city: trimOrNull(m[1]),
    state: m[2].toUpperCase(),
    // Some entries carry a mistyped 6-digit ZIP; keep only a clean 5-digit one
    // rather than feed the geocoder something it will reject for the whole row.
    zip: m[3]?.length === 5 ? m[3] : null,
  };
}

const PHONE_RE = /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;

async function fetchPage(url: string): Promise<WpPost[]> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 400) return []; // past the last page
      if (!response.ok) throw new Error(`NASVH: HTTP ${response.status} for ${url}`);
      return (await response.json()) as WpPost[];
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalize(post: WpPost, today: string): NormalizedResource | null {
  const body = post.content?.rendered ?? '';
  const name = trimOrNull(decodeEntities(post.title?.rendered ?? ''));
  if (!name || !body) return null;

  const sections = parseSections(body);
  const addressLines = sections.get('MAILING ADDRESS') ?? [];
  if (addressLines.length === 0) return null; // not a home record we can place

  const street = trimOrNull(addressLines[0]);
  const { city, state, zip } = splitCityStateZip(addressLines[addressLines.length - 1] ?? '');
  if (!street || !state) return null;

  const phoneLine = (sections.get('TELEPHONE') ?? []).join(' ');
  const phone = trimOrNull(PHONE_RE.exec(phoneLine)?.[1]);
  const beds = (sections.get('BED CAPACITY') ?? []).join('; ');
  const website = externalLink(body) ?? ATTRIBUTION_URL;

  const care = beds
    ? ` Care offered: ${beds}.`
    : ' Levels of care vary by home — call to ask what they offer.';

  return {
    id: `svh:${post.id}`,
    // Upstream stores names in upper case; see lib/displayName.ts.
    name: titleCaseName(name),
    category: 'housing',
    description:
      `State Veterans Home — long-term care built for veterans: skilled nursing, ` +
      `assisted living or domiciliary care, and often adult day care and memory care. ` +
      `Run by the state and certified by the VA, which pays part of the cost.${care}`,
    address: [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', '),
    latitude: null,
    longitude: null,
    geocode: { street, city, state, zip },
    phone,
    website,
    hours: null,
    eligibility:
      'For veterans; many homes also accept spouses and Gold Star parents. Rules, waiting lists, and cost vary by state — call the home to ask what you qualify for and what it would cost.',
    documents_needed: ['DD-214'],
    source_url: ATTRIBUTION_URL,
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['state-veterans-home', 'long-term-care', 'nursing-home', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: String(post.id),
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { id: post.id, link: post.link, sections: Object.fromEntries(sections) },
  };
}

/**
 * A second row under `healthcare`. These homes are nursing facilities as much as
 * they are somewhere to live, and a veteran searching for care shouldn't have to
 * guess that "housing" is where the nursing homes are.
 */
function crossListHealthcare(base: NormalizedResource): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:healthcare`,
    external_id: `${base.external_id}:healthcare`,
    category: 'healthcare',
    tags: [...base.tags, 'skilled-nursing'],
  };
}

export const createStateVeteransHomesSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(_query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const base = config.baseUrl.replace(/\/$/, '');

      const posts: WpPost[] = [];
      for (let page = 1; ; page++) {
        const batch = await fetchPage(`${base}?per_page=${PER_PAGE}&page=${page}`);
        posts.push(...batch);
        if (batch.length < PER_PAGE) break;
      }
      if (posts.length === 0) throw new Error('NASVH: no veterans-homes records returned');

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (const post of posts) {
        const normalized = normalize(post, today);
        if (!normalized || seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized, crossListHealthcare(normalized));
      }

      // The parser leans on NASVH's "LABEL:" body convention. If a redesign
      // breaks it, every record silently loses its address — fail the run
      // instead, so the freshness gate surfaces it rather than the table
      // quietly emptying.
      const homes = results.length / 2;
      if (homes < posts.length * MIN_ADDRESS_RATE) {
        throw new Error(
          `NASVH: only ${homes}/${posts.length} homes yielded an address — the page format likely changed.`,
        );
      }
      console.log(`[ingest] state-veterans-homes: ${homes} homes (${results.length} rows)`);
      return results;
    },
  };
};
