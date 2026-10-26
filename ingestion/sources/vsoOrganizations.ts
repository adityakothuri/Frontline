/**
 * VA-accredited Veterans Service Organizations, from VA OGC's organization export.
 *
 * Accredited VSOs (American Legion, VFW, DAV, state departments of veterans
 * affairs, NACVSO's County Veterans Service Officers, …) file and manage VA
 * claims for free — the most useful thing an older veteran can be pointed at.
 *
 * The export gives an organization, a town, and a single *national* phone line
 * (none for CVSOs) — no street address. So rows are statewide referrals, one per
 * organization × state, with null coordinates and a `state:XX` tag; they surface
 * in the app's "Statewide & national veteran help" section (`isNationalReferral`
 * in src/services/resources/sortResults.ts). Rep counts and the busiest towns go
 * in the description. Server-side scoping: 0027_search_state_scoped_referrals.sql.
 */
import { sleep } from '../lib/http.ts';
import { decodeEntities, parseStateFilter, trimOrNull } from '../lib/normalize.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'vso-organizations';
const SOURCE_URL = 'https://www.va.gov/ogc/apps/accreditation/';
const REQUEST_TIMEOUT_MS = 120_000;
// va.gov drops the ~4.7 MB export (ECONNRESET) when re-requested soon after a
// previous download, so back off in tens of seconds rather than a few.
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 3_000;

/** Column order in the OGC export. Verified 2026-07-27. */
const COLUMNS = [
  'Organization Name',
  'POA',
  'Org Phone',
  'Org City',
  'Org State',
  'Representative',
  'Rep City',
  'Rep State',
  'Rep Zip',
  'Registration Num',
] as const;

/**
 * Below this many parsed offices, assume the export changed rather than ingest
 * junk. 7,564 parse today, so 2,500 is a wide margin that still catches a
 * redesign that guts the table.
 */
const MIN_OFFICES = 2_500;

/** The export guards text cells with a leading apostrophe (`'60429`). */
const unguard = (s: string): string => s.replace(/^'/, '').trim();

/** One accredited office: an organization as it appears in one town. */
interface Office {
  organization: string;
  phone: string | null;
  city: string;
  state: string;
  zip: string;
  repCount: number;
}

/** An organization's whole presence in one state — what actually gets ingested. */
interface StateOrg {
  organization: string;
  state: string;
  phone: string | null;
  repCount: number;
  officeCount: number;
  /** Towns with an accredited rep, most reps first — used to show local coverage. */
  towns: string[];
}

/** How many towns to name in the description before trailing off into a count. */
const TOWNS_SHOWN = 4;

async function fetchExport(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        // The OGC app serves an HTML table as an Excel download and 403s a
        // bare fetch; it needs a browser-shaped request.
        headers: {
          accept: 'text/html,application/vnd.ms-excel,*/*',
          'user-agent': 'Mozilla/5.0 (compatible; FrontlineIngest/1.0)',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`VA OGC: HTTP ${response.status} for ${url}`);
      return await response.text();
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      const wait = RETRY_BASE_MS * 2 ** attempt;
      console.warn(
        `[ingest] vso-organizations: ${String(err).slice(0, 80)} — retrying in ${wait / 1000}s`,
      );
      await sleep(wait);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Export HTML → one `Office` per organization × town, with its rep count. */
function parseOffices(html: string): Office[] {
  const rows = [...html.matchAll(/<TR>(.*?)<\/TR>/gis)].map((m) =>
    [...m[1].matchAll(/<TD>(.*?)<\/TD>/gis)].map((c) =>
      decodeEntities(c[1].replace(/<[^>]+>/g, '')).trim(),
    ),
  );
  if (rows.length === 0) return [];

  const header = rows[0];
  if (header[0] !== COLUMNS[0] || header[8] !== COLUMNS[8]) {
    throw new Error(`VA OGC: unexpected columns — got ${header.join(', ')}`);
  }

  const byOffice = new Map<string, Office>();
  for (const row of rows.slice(1)) {
    if (row.length !== COLUMNS.length) continue;
    const organization = trimOrNull(row[0]);
    const city = trimOrNull(row[6]);
    const state = trimOrNull(row[7])?.toUpperCase();
    const zip = unguard(row[8]).slice(0, 5);
    // A malformed ZIP must not drop a rep: nothing downstream needs it at state grain.
    if (!organization || !city || !state) continue;

    const key = `${organization}|${state}|${city.toLowerCase()}`;
    const existing = byOffice.get(key);
    if (existing) {
      existing.repCount += 1;
      existing.phone ??= trimOrNull(row[2]);
      continue;
    }
    byOffice.set(key, {
      organization,
      phone: trimOrNull(row[2]),
      city,
      state,
      zip,
      repCount: 1,
    });
  }
  return [...byOffice.values()];
}

/**
 * NACVSO's members are County Veterans Service Officers — county-government
 * staff, not a national charity's field reps. A veteran needs to recognise them
 * by the name they'd actually search for, so they're titled as CVSOs.
 */
const CVSO_ORG = 'National Association of County Veterans Service Officers';

/** Per-town offices → one row per organization × state. */
function collapseByState(offices: Office[]): StateOrg[] {
  const byStateOrg = new Map<string, StateOrg & { townReps: Map<string, number> }>();

  for (const office of offices) {
    const key = `${office.organization}|${office.state}`;
    let entry = byStateOrg.get(key);
    if (!entry) {
      entry = {
        organization: office.organization,
        state: office.state,
        phone: office.phone,
        repCount: 0,
        officeCount: 0,
        towns: [],
        townReps: new Map(),
      };
      byStateOrg.set(key, entry);
    }
    entry.phone ??= office.phone;
    entry.repCount += office.repCount;
    entry.officeCount += 1;
    entry.townReps.set(office.city, (entry.townReps.get(office.city) ?? 0) + office.repCount);
  }

  return [...byStateOrg.values()].map(({ townReps, ...rest }) => ({
    ...rest,
    // Busiest towns first: those are the ones most likely to be near a veteran,
    // and they read as evidence of real coverage rather than an arbitrary list.
    towns: [...townReps.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([town]) => town),
  }));
}

/** "Houston, Dallas, San Antonio and 31 other towns" */
function describeCoverage(towns: string[]): string {
  const shown = towns.slice(0, TOWNS_SHOWN);
  const rest = towns.length - shown.length;
  const list =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  if (rest === 0) return list;
  return `${shown.join(', ')} and ${rest} other ${rest === 1 ? 'town' : 'towns'}`;
}

function normalize(org: StateOrg, today: string): NormalizedResource {
  const isCvso = org.organization === CVSO_ORG;
  const reps =
    org.repCount === 1
      ? 'One VA-accredited representative works'
      : `${org.repCount} VA-accredited representatives work`;

  // The one phone is the organization's national line (none for CVSOs), so the
  // copy says exactly what the number is and how to reach the local person.
  const howToReach = isCvso
    ? 'Ask your county government for the Veterans Service Officer, or search for your county veterans service office — the service is free.'
    : org.phone
      ? `The number listed is ${org.organization}'s main line, not a local office; ask them to connect you with the representative nearest you.`
      : `Contact ${org.organization} to be connected with the representative nearest you.`;

  const slug = org.organization
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');

  return {
    id: `vsoorg:${org.state}-${slug}`,
    name: isCvso
      ? `County Veterans Service Officers — ${org.state}`
      : `${org.organization} — ${org.state}`,
    category: 'benefits_help',
    description:
      `${reps} across ${org.state}, in ${describeCoverage(org.towns)}. They can file or appeal ` +
      `your VA claim with you — disability compensation, pension, survivor benefits — and they do ` +
      `it for free. You never pay a VSO to represent you. ${howToReach}`,
    // The export has no street address; null address makes this a statewide referral.
    address: null,
    latitude: null,
    longitude: null,
    phone: org.phone,
    website: SOURCE_URL,
    hours: null,
    eligibility:
      'Open to veterans and, for survivor benefits, their families. Book an appointment and ask what to bring — usually your DD-214 and any medical records. Their help is always free.',
    documents_needed: ['DD-214'],
    source_url: SOURCE_URL,
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['vso', 'accredited-representative', 'claims-help', `state:${org.state}`],
    created_at: today,
    updated_at: today,
    external_id: `${org.state}-${org.organization}`,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { ...org },
  };
}

/**
 * A second row under `legal`. These are the people accredited to *represent* a
 * veteran before VA, so a veteran who taps Legal should find them — but claims
 * help is what they're actually for, hence `benefits_help` as the primary.
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

export const createVsoOrganizationsSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const html = await fetchExport(config.baseUrl);
      const offices = parseOffices(html);

      if (offices.length < MIN_OFFICES) {
        throw new Error(
          `VA OGC: only ${offices.length} offices parsed (expected at least ${MIN_OFFICES}) — the export format likely changed.`,
        );
      }

      const stateFilter = parseStateFilter(query.state);

      const results: NormalizedResource[] = [];
      for (const org of collapseByState(offices)) {
        if (stateFilter && !stateFilter.has(org.state)) continue;
        const normalized = normalize(org, today);
        results.push(normalized, crossListLegal(normalized));
      }

      console.log(
        `[ingest] vso-organizations: ${results.length / 2} organization×state referrals ` +
          `from ${offices.length} offices parsed`,
      );
      return results;
    },
  };
};
