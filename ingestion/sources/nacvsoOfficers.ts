/**
 * County Veterans Service Officers, via the NACVSO member directory.
 *
 * A CVSO is a county employee whose job is filing and appealing VA claims for
 * local veterans, free. No central list exists; NACVSO's directory is the closest.
 *
 * Robots: nacvso.org disallows the Novi AMS JSON backend (`/api/`, `/novi-api/`),
 * which this never touches, but not the rendered profile pages — and robots.txt
 * advertises the sitemap that lists them. Only that HTML is read, with low
 * concurrency and a fixed delay (~2,900 pages against a small site).
 *
 * Each profile is one officer; rows collapse by office (~4.4 officers each).
 * Addresses print as "<street> <city>, <ST> <ZIP>" with no comma before the city,
 * so the street/city split is ambiguous: the full string is displayed and the
 * geocoder gets street + state + ZIP.
 */
import { fetchText, sleep } from '../lib/http.ts';
import { decodeEntities, parseStateFilter, trimOrNull } from '../lib/normalize.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'nacvso-cvso';
const DIRECTORY_URL = 'https://www.nacvso.org/county-veterans-service-officers';

/** Profile URL prefixes we read. Everything else in the sitemap is ignored. */
const PROFILE_PREFIXES = [
  '/county-veterans-service-officers/',
  '/state-veterans-service-officers/',
] as const;

/** Deliberately gentle: a small association's site, ~2,900 pages. */
const CONCURRENCY = 3;
const DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Below this many offices, assume the page shape changed. A full run yields ~673;
 * a parser break yields near zero.
 */
const MIN_OFFICES = 500;

/** Separate floor for the sitemap itself: ~2,935 profile URLs are listed today. */
const MIN_PROFILE_URLS = 1_500;

/** `Fricke Bldg, 608 N Court St Carroll, IA 51401 United States` → parts. */
const ADDRESS_TAIL = /^(.*?),?\s*([A-Z]{2})\.?\s+(\d{5})(?:-\d{4})?\s*(?:United States)?\s*$/;
const PHONE = /(\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4})/;

/** Rendered page → visible text lines, scripts and styles removed. */
function textLines(html: string): string[] {
  const body = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  return decodeEntities(body.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** One office as the directory describes it. */
interface Office {
  organization: string;
  state: string;
  /** Full address string as printed, for display. */
  address: string | null;
  /** Street portion — everything before the `, ST ZIP` tail. */
  street: string | null;
  zip: string | null;
  phone: string | null;
  officerCount: number;
}

/**
 * Extract the office from a profile page.
 *
 * The load-bearing anchor is the literal line `Parent:` — the profile prints the
 * officer, then their own address, then `Parent:` followed by the office name,
 * the office address, and the office phone. The office is what we want; an
 * individual officer's own listing may be a home address.
 */
function parseProfile(html: string): Office | null {
  const lines = textLines(html);
  const anchor = lines.indexOf('Parent:');
  if (anchor === -1) return null;

  const organization = trimOrNull(lines[anchor + 1]);
  if (!organization) return null;

  // The parent-member name embeds the state ("…Veteran Service Office-IA"); it
  // validates the address below.
  const suffix = /-([A-Z]{2})$/.exec(organization);

  // Address and phone follow within a few lines. The window stays tight because
  // the page footer carries NACVSO's own Washington DC address.
  const window = lines.slice(anchor + 2, anchor + 6);
  let address: string | null = null;
  let street: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;
  for (const line of window) {
    const match = ADDRESS_TAIL.exec(line);
    if (!match) continue;
    const lineState = match[2].toUpperCase();
    // If the office's own name tells us the state, an address in a different one
    // is not this office's address — it is page furniture.
    if (suffix && lineState !== suffix[1]) continue;
    address = line.replace(/\s*United States\s*$/, '').trim();
    street = trimOrNull(match[1]);
    state = lineState;
    zip = match[3];
    break;
  }
  const phone = window.map((l) => PHONE.exec(l)?.[1]).find(Boolean) ?? null;

  const resolvedState = suffix?.[1] ?? state;
  if (!resolvedState) return null; // cannot place it in any state — skip

  return {
    // Strip the state suffix from the display name: "…Office-IA" reads as a typo.
    organization: organization.replace(/-[A-Z]{2}$/, '').trim(),
    state: resolvedState,
    address,
    street,
    zip,
    phone: phone ? phone.trim() : null,
    officerCount: 1,
  };
}

function slugsFromSitemap(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return urls.filter((u) =>
    PROFILE_PREFIXES.some((p) => {
      const at = u.indexOf(p);
      // Must be a profile *under* the prefix, not the index page itself.
      return at !== -1 && u.length > at + p.length;
    }),
  );
}

function normalize(office: Office, today: string): NormalizedResource {
  const slug = `${office.state}-${office.organization.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}`
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const staff =
    office.officerCount === 1
      ? 'An accredited veterans service officer works here'
      : `${office.officerCount} accredited veterans service officers work here`;

  return {
    id: `cvso:${slug}`,
    name: office.organization,
    category: 'benefits_help',
    description:
      `${staff}. A county veterans service officer is a county-government employee whose job is ` +
      `helping local veterans claim what they are owed — disability compensation, pension, survivor ` +
      `benefits, and appeals. They will sit down with you, fill in the forms, and represent you ` +
      `before the VA. It is free, and you do not need an appointment at every office — call first ` +
      `to check.`,
    address: office.address,
    latitude: null,
    longitude: null,
    // Street + state + ZIP only (see header). No printed address → unpinned but callable.
    geocode: office.street
      ? { street: office.street, city: null, state: office.state, zip: office.zip }
      : undefined,
    phone: office.phone,
    website: DIRECTORY_URL,
    hours: null,
    eligibility:
      'For veterans who live in the county this office serves, and often their spouses and ' +
      'survivors too. Bring your DD-214 if you have it, plus any medical records that relate to ' +
      'your claim. There is never a charge — you should never pay anyone to file a VA claim.',
    documents_needed: ['DD-214'],
    source_url: DIRECTORY_URL,
    // A membership directory maintained by the association, not a government
    // register — credible, but not VA-authoritative.
    source_type: 'directory',
    veteran_relevance: 'veteran_specific',
    verification_status: 'needs_review',
    last_checked: today,
    last_updated: today,
    tags: [
      'cvso',
      'county-veterans-service-officer',
      'claims-help',
      'accredited',
      `state:${office.state}`,
    ],
    created_at: today,
    updated_at: today,
    external_id: slug,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { ...office },
  };
}

/**
 * A second row under `legal`. A CVSO represents a veteran before the VA, which is
 * the thing a veteran tapping "Legal" over a denied claim is looking for — and
 * `legal` had zero usable veteran rows before this.
 */
function crossListLegal(base: NormalizedResource): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:legal`,
    external_id: `${base.external_id}:legal`,
    category: 'legal',
    tags: [...base.tags, 'legal'],
  };
}

export const createNacvsoOfficersSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);

      const sitemap = await fetchText(config.baseUrl, {
        label: 'NACVSO sitemap',
        timeoutMs: 60_000,
      });
      const urls = slugsFromSitemap(sitemap);
      if (urls.length < MIN_PROFILE_URLS) {
        throw new Error(
          `NACVSO: sitemap listed only ${urls.length} officer profiles (expected ~2,935) — ` +
            `the directory structure likely changed.`,
        );
      }

      const stateFilter = parseStateFilter(query.state);
      // A state-scoped run is for spot-checks; the sitemap gives no state, so it
      // still has to fetch every page and filter after parsing. Cap the work.
      const targets = stateFilter ? urls.slice(0, 400) : urls;

      const byOffice = new Map<string, Office>();
      let fetched = 0;
      let unparsed = 0;

      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const batch = targets.slice(i, i + CONCURRENCY);
        const pages = await Promise.all(
          batch.map(async (url) => {
            try {
              return await fetchText(url, {
                label: 'NACVSO',
                timeoutMs: REQUEST_TIMEOUT_MS,
                maxRetries: 1,
              });
            } catch {
              // One profile failing is not worth failing 2,900 pages of work.
              return null;
            }
          }),
        );
        for (const html of pages) {
          if (html === null) continue;
          fetched += 1;
          const office = parseProfile(html);
          if (!office) {
            unparsed += 1;
            continue;
          }
          if (stateFilter && !stateFilter.has(office.state)) continue;
          const key = `${office.organization}|${office.state}`;
          const existing = byOffice.get(key);
          if (existing) {
            existing.officerCount += 1;
            existing.phone ??= office.phone;
            existing.address ??= office.address;
            existing.street ??= office.street;
            existing.zip ??= office.zip;
          } else {
            byOffice.set(key, office);
          }
        }
        await sleep(DELAY_MS);
        if (i > 0 && i % (CONCURRENCY * 100) === 0) {
          console.log(
            `[ingest] nacvso-cvso: ${i}/${targets.length} profiles, ${byOffice.size} offices…`,
          );
        }
      }

      const offices = [...byOffice.values()];
      if (!stateFilter && offices.length < MIN_OFFICES) {
        throw new Error(
          `NACVSO: only ${offices.length} offices parsed from ${fetched} profiles ` +
            `(expected at least ${MIN_OFFICES}) — the profile page shape likely changed.`,
        );
      }

      const results: NormalizedResource[] = [];
      for (const office of offices) {
        const row = normalize(office, today);
        results.push(row, crossListLegal(row));
      }

      const withPhone = offices.filter((o) => o.phone).length;
      console.log(
        `[ingest] nacvso-cvso: ${offices.length} offices (${results.length} rows) from ${fetched} ` +
          `profiles; ${withPhone} with a phone` +
          (unparsed > 0 ? `, ${unparsed} profiles unparsed` : ''),
      );
      return results;
    },
  };
};
