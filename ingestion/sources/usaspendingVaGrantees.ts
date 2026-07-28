/**
 * USAspending — organizations that hold VA and DOL veteran-services grants.
 *
 * WHY A SPENDING DATABASE IS A RESOURCE DIRECTORY
 *
 * The VA funds community organizations to deliver most of its homeless, legal,
 * suicide-prevention and employment services, and it publishes almost none of
 * those provider lists in machine-readable form. Grant & Per Diem — transitional
 * housing for homeless veterans, the single biggest such network — was recorded in
 * the last data audit as "PDF award lists only", and SSVF only exists in this app
 * because someone downloaded a spreadsheet by hand into
 * `ingestion/data/ssvf-providers.json` (235 providers, no addresses at all).
 *
 * But every one of those grants is a federal award, and federal awards are in
 * USAspending with the recipient's name and street address. Filtering by CFDA
 * program number turns the spending API into the provider directory the VA
 * doesn't publish — no key, no scraping, and it refreshes monthly on its own.
 *
 * WHAT THIS IS NOT
 *
 * A recipient address is the address the organization gave the government, which
 * is its main office — usually but not always where services are delivered. A
 * multi-site provider appears once, at its headquarters. So rows are
 * `needs_review`, and the copy tells the veteran to call first rather than turn
 * up. That is honest and still far better than a phone number with no place
 * attached, which is what SSVF has today.
 *
 * There are no phone numbers in this feed and no hours.
 */
import type { ResourceCategory } from '../../src/types/resource.ts';
import { postJson } from '../lib/http.ts';
import { stableKey } from '../lib/stableKey.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'usaspending-va-grants';
const ATTRIBUTION_URL = 'https://www.usaspending.gov/';

/** Grant, cooperative-agreement and direct-payment award types. */
const AWARD_TYPE_CODES = ['02', '03', '04', '05'];

/** USAspending caps `limit` at 100. */
const PAGE_SIZE = 100;
const MAX_PAGES = 60;

/**
 * Only awards active in the last two federal years: a grantee whose funding ended
 * three years ago is not somewhere to send a veteran today.
 */
const LOOKBACK_YEARS = 2;

/**
 * Below this, assume the API or the CFDA numbers changed. ~3,180 awards was the
 * live total on 2026-07-28; they collapse to fewer organizations because a
 * provider holds several awards over the period.
 */
const MIN_ORGS = 800;

/**
 * The programs, each with the category it belongs in and how to describe it.
 * CFDA numbers and award counts verified live 2026-07-28.
 */
interface Program {
  cfda: string;
  label: string;
  category: ResourceCategory;
  /** Second category, where the service genuinely spans both. */
  crossList?: ResourceCategory;
  /** Sentence explaining what this program funds, in a veteran's terms. */
  blurb: string;
  tags: string[];
}

const PROGRAMS: Program[] = [
  {
    cfda: '64.024',
    label: 'VA Grant & Per Diem transitional housing',
    category: 'housing',
    blurb:
      'runs transitional housing for veterans who are homeless or at risk, funded by the VA Grant & Per Diem program — a bed, case management, and help getting into permanent housing',
    tags: ['gpd', 'transitional-housing', 'homeless-veterans'],
  },
  {
    cfda: '64.033',
    label: 'Supportive Services for Veteran Families (SSVF)',
    category: 'housing',
    blurb:
      'is an SSVF grantee: rapid re-housing and homelessness prevention for veterans and their families — rent and utility help, deposits, and case management',
    tags: ['ssvf', 'rapid-rehousing', 'homelessness-prevention'],
  },
  {
    cfda: '17.805',
    label: "Homeless Veterans' Reintegration Program (HVRP)",
    category: 'jobs',
    blurb:
      'runs a Homeless Veterans Reintegration Program: job training, placement and support for veterans coming out of homelessness',
    tags: ['hvrp', 'employment', 'homeless-veterans'],
  },
  {
    cfda: '17.801',
    label: 'Jobs for Veterans State Grants',
    category: 'jobs',
    blurb:
      'holds a Jobs for Veterans State Grant, which funds the veteran employment representatives who help veterans find work through the public workforce system',
    tags: ['jvsg', 'employment', 'workforce'],
  },
  {
    cfda: '64.056',
    label: 'VA legal services for homeless veterans',
    category: 'legal',
    blurb:
      'provides free legal help to veterans who are homeless or at risk, funded by the VA — eviction defence, child support and family matters, driving licences, fines, and discharge upgrades',
    tags: ['legal-aid', 'homeless-veterans', 'eviction-defense'],
  },
  {
    cfda: '64.055',
    label: 'Staff Sergeant Fox suicide prevention grant',
    category: 'healthcare',
    crossList: 'community_support',
    blurb:
      'delivers suicide-prevention services for veterans under the Staff Sergeant Parker Gordon Fox grant program — outreach, peer support, safety planning and connection to care',
    tags: ['suicide-prevention', 'ssg-fox', 'mental-health'],
  },
  {
    cfda: '64.015',
    label: 'Veterans state nursing home care',
    category: 'housing',
    crossList: 'healthcare',
    blurb:
      'operates state nursing home care for veterans with VA per-diem support — skilled nursing and long-term care',
    tags: ['state-veterans-home', 'nursing-home', 'long-term-care'],
  },
  {
    cfda: '64.014',
    label: 'Veterans state domiciliary care',
    category: 'housing',
    crossList: 'healthcare',
    blurb:
      'operates state domiciliary care for veterans — supported residential living for veterans who need help but not skilled nursing',
    tags: ['state-veterans-home', 'domiciliary-care'],
  },
];

interface RecipientLocation {
  address_line1?: string | null;
  address_line2?: string | null;
  city_name?: string | null;
  state_code?: string | null;
  zip5?: string | null;
  county_name?: string | null;
}

interface AwardRow {
  'Award ID'?: string | null;
  'Recipient Name'?: string | null;
  'Award Amount'?: number | null;
  'Recipient Location'?: RecipientLocation | null;
  'CFDA Number'?: string | null;
}

interface AwardPage {
  results?: AwardRow[];
  page_metadata?: { hasNext?: boolean };
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/** Recipient names arrive SHOUTING; title-case them so cards are readable. */
function titleCase(name: string): string {
  const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to']);
  // Acronyms a veteran would recognise should stay upper-case.
  const KEEP_UPPER = /^(?:VA|DAV|VFW|LLC|INC|USA|US|YMCA|YWCA|II|III|IV|[A-Z]&[A-Z])$/;
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      const upper = word.toUpperCase().replace(/[^A-Z&]/g, '');
      if (KEEP_UPPER.test(upper)) return word.toUpperCase();
      if (i > 0 && SMALL.has(word)) return word;
      return word.replace(/^([a-z])/, (c) => c.toUpperCase());
    })
    .join(' ');
}

/** FY-aligned start date `LOOKBACK_YEARS` federal years back. */
function lookbackStart(today: Date): string {
  const fyOfToday = today.getUTCMonth() >= 9 ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
  return `${fyOfToday - LOOKBACK_YEARS}-10-01`;
}

/** One organization holding one program's award, deduped across award rows. */
interface Grantee {
  name: string;
  program: Program;
  street: string;
  city: string | null;
  state: string;
  zip: string | null;
}

async function fetchProgram(baseUrl: string, program: Program, start: string, end: string): Promise<AwardRow[]> {
  const rows: AwardRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await postJson<AwardPage>(
      baseUrl,
      {
        filters: {
          award_type_codes: AWARD_TYPE_CODES,
          program_numbers: [program.cfda],
          time_period: [{ start_date: start, end_date: end }],
        },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Recipient Location', 'CFDA Number'],
        page,
        limit: PAGE_SIZE,
        sort: 'Award Amount',
        order: 'desc',
        subawards: false,
      },
      { label: `USAspending ${program.cfda}`, timeoutMs: 90_000 },
    );
    const batch = body.results ?? [];
    rows.push(...batch);
    if (!body.page_metadata?.hasNext || batch.length === 0) break;
  }
  return rows;
}

function toGrantee(row: AwardRow, program: Program): Grantee | null {
  const rawName = trimOrNull(row['Recipient Name']);
  const loc = row['Recipient Location'] ?? {};
  const state = trimOrNull(loc.state_code)?.toUpperCase();
  const street = [trimOrNull(loc.address_line1), trimOrNull(loc.address_line2)]
    .filter(Boolean)
    .join(', ');
  if (!rawName || !state || !street) return null;
  // A PO box is a mailbox, not a place to walk into.
  if (/^p\.?\s*o\.?\s*box/i.test(street)) return null;
  // Redacted recipients ("MULTIPLE RECIPIENTS", individuals) are not organizations.
  if (/^(multiple recipients|redacted|miscellaneous)/i.test(rawName)) return null;

  return { name: titleCase(rawName), program, street, city: trimOrNull(loc.city_name), state, zip: trimOrNull(loc.zip5) };
}

function normalize(grantee: Grantee, today: string): NormalizedResource {
  const { program } = grantee;
  const key = stableKey(`${grantee.name} ${program.cfda}`, `${grantee.street} ${grantee.city ?? ''}`, grantee.state);

  return {
    id: `usasp:${key}`,
    name: `${grantee.name} — ${program.label}`,
    category: program.category,
    description:
      `${grantee.name} ${program.blurb}. This is the organization's registered address, which may ` +
      `be its main office rather than where services are delivered — call or check their website ` +
      `before travelling.`,
    address: [
      grantee.street,
      [grantee.city, [grantee.state, grantee.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(', '),
    latitude: null,
    longitude: null,
    geocode: { street: grantee.street, city: grantee.city, state: grantee.state, zip: grantee.zip },
    // USAspending carries no contact details at all.
    phone: null,
    website: null,
    hours: null,
    eligibility:
      'For veterans, and for most of these programs their families too. Each grantee sets its own ' +
      'intake — some take walk-ins, some need a referral from a VA social worker or a coordinated ' +
      'entry system. Call and ask how to start, and what to bring.',
    source_url: ATTRIBUTION_URL,
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    // The award is official; that this address is a service site is an inference.
    verification_status: 'needs_review',
    documents_needed: ['DD-214'],
    last_checked: today,
    last_updated: today,
    tags: [...program.tags, 'va-grantee', `cfda:${program.cfda}`, `state:${grantee.state}`],
    created_at: today,
    updated_at: today,
    external_id: key,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { ...grantee, program: program.cfda },
  };
}

function crossList(base: NormalizedResource, category: ResourceCategory): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:${category}`,
    external_id: `${base.external_id}:${category}`,
    category,
  };
}

export const createUsaspendingVaGranteesSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const start = lookbackStart(now);

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let awards = 0;

      for (const program of PROGRAMS) {
        const rows = await fetchProgram(config.baseUrl, program, start, today);
        awards += rows.length;
        let kept = 0;
        for (const row of rows) {
          const grantee = toGrantee(row, program);
          if (!grantee) continue;
          if (stateFilter && !stateFilter.has(grantee.state)) continue;
          const normalized = normalize(grantee, today);
          // A provider holds several awards per program over two federal years;
          // they collapse to one row per organization × program.
          if (seen.has(normalized.id)) continue;
          seen.add(normalized.id);
          kept += 1;
          results.push(normalized);
          if (program.crossList) results.push(crossList(normalized, program.crossList));
        }
        console.log(`[ingest]   ${program.cfda} ${program.label}: ${kept} organizations from ${rows.length} awards`);
      }

      if (!stateFilter && seen.size < MIN_ORGS) {
        throw new Error(
          `USAspending: only ${seen.size} grantee organizations from ${awards} awards ` +
            `(expected at least ${MIN_ORGS}) — a CFDA number or the response shape likely changed.`,
        );
      }

      console.log(
        `[ingest] usaspending-va-grants: ${seen.size} organizations (${results.length} rows) from ${awards} awards`,
      );
      return results;
    },
  };
};
