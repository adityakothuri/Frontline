/**
 * Legal Services Corporation grantees — free civil legal aid, by service area.
 *
 * WHY `legal` NEEDS THIS
 *
 * The audit found the `legal` category had no independent content at all: all
 * 7,160 rows were the VA-accredited-organization list cross-listed from
 * `benefits_help`, so a veteran tapping Legal got the Benefits list again.
 * Accredited representatives handle VA claims — they do not handle the eviction,
 * the custody case, the licence suspension or the debt that is actually about to
 * cost a veteran their housing or their job.
 *
 * LSC funds the civil legal aid programme in every state, and its 132 grantees are
 * the front door to free civil representation for anyone low-income.
 *
 * WHY THESE ARE REFERRALS AND NOT PINS
 *
 * The dataset behind LSC's own locator map (`Programs.json`, found in
 * `find-legal-services.js`) has exactly five fields: name, website, toll-free
 * number, local number, fax, and a service-area id like `TX-15`. There are no
 * office addresses — a grantee runs several offices and the map draws service-area
 * rectangles, not points. Branch addresses would mean crawling 132 separate
 * grantee websites.
 *
 * So each row is a state-scoped referral: null coords, null address, `state:XX`
 * from the service-area id, and a phone number that works. That is what the data
 * supports, and after 0027 the RPC ranks in-state referrals first.
 */
import { fetchJson } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'lsc-legal-aid';
const ATTRIBUTION_URL = 'https://www.lsc.gov/about-lsc/what-legal-aid/i-need-legal-help';

/** Below this, assume the file moved. 132 named grantees live on 2026-07-28. */
const MIN_GRANTEES = 90;

interface LscProgram {
  R_Legalname?: string | null;
  Web_URL?: string | null;
  Local_800?: string | null;
  Phone?: string | null;
  Fax?: string | null;
  /** Service area, e.g. `TX-15`, `AK-1`. The state prefix is the useful part. */
  Serv_Area_ID?: string | null;
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

const normalizeUrl = (raw: string | null): string | null => {
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
};

/** `TX-15` → `TX`. Non-state prefixes (territories, MI-*) pass through as-is. */
function serviceState(id: string | null): string | null {
  const m = /^([A-Za-z]{2})-/.exec(id?.trim() ?? '');
  return m ? m[1].toUpperCase() : null;
}

function normalize(program: LscProgram, today: string): NormalizedResource | null {
  const name = trimOrNull(program.R_Legalname);
  const state = serviceState(program.Serv_Area_ID ?? null);
  if (!name || !state) return null;

  // The toll-free intake line is the one a veteran should call; the direct number
  // is usually an administrative office.
  const tollFree = trimOrNull(program.Local_800);
  const direct = trimOrNull(program.Phone);

  return {
    id: `lsc:${trimOrNull(program.Serv_Area_ID) ?? state}-${name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase().slice(0, 50)}`,
    name,
    category: 'legal',
    description:
      'Free civil legal aid, funded by the Legal Services Corporation. They handle the civil ' +
      'problems that can cost you your home or your income — eviction and foreclosure, benefits ' +
      'denials and appeals, family and custody matters, debt collection, and consumer disputes. ' +
      'They serve a whole region rather than one office, so call the intake line and they will ' +
      'route you to the nearest office. There is no charge.',
    // No addresses exist in this dataset; null address is also what makes the app
    // treat this as the statewide referral it is (`isNationalReferral`).
    address: null,
    latitude: null,
    longitude: null,
    phone: tollFree ?? direct,
    website: normalizeUrl(trimOrNull(program.Web_URL)),
    hours: null,
    eligibility:
      'Based on income — most programmes serve households under 125% of the federal poverty ' +
      'guideline, and many prioritise veterans, older adults and people facing eviction. Call the ' +
      'intake line; they will screen you and say straight away whether they can take your case.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    source_type: 'nonprofit',
    // Civil legal aid is open to anyone low-income, not veteran-specific. It is
    // marked `veteran_benefit` rather than `general` deliberately: the referral
    // machinery only surfaces non-general rows, and a veteran facing eviction
    // needs this far more than they need another accredited claims rep.
    veteran_relevance: 'veteran_benefit',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['legal-aid', 'civil-legal-help', 'eviction-defense', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: `${trimOrNull(program.Serv_Area_ID) ?? state}-${name}`.slice(0, 200),
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { ...program },
  };
}

export const createLscLegalAidSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const programs = await fetchJson<LscProgram[]>(config.baseUrl, { label: 'LSC' });

      if (!Array.isArray(programs)) throw new Error('LSC: Programs.json is not an array');

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (const program of programs) {
        const normalized = normalize(program, today);
        if (!normalized || seen.has(normalized.id)) continue;
        const state = serviceState(program.Serv_Area_ID ?? null);
        if (stateFilter && (!state || !stateFilter.has(state))) continue;
        seen.add(normalized.id);
        results.push(normalized);
      }

      if (!stateFilter && results.length < MIN_GRANTEES) {
        throw new Error(
          `LSC: only ${results.length} grantees parsed from ${programs.length} records ` +
            `(expected at least ${MIN_GRANTEES}) — the file shape likely changed.`,
        );
      }

      console.log(`[ingest] lsc-legal-aid: ${results.length} grantees from ${programs.length} records`);
      return results;
    },
  };
};
