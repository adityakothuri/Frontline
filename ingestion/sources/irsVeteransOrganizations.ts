/**
 * IRS Exempt Organizations Business Master File — chartered veterans organizations.
 *
 * WHY THIS IS HERE INSTEAD OF A POST LOCATOR
 *
 * American Legion posts, VFW posts, DAV chapters, AMVETS and VVA chapters are
 * roughly 15,000 physical places where veterans actually gather, and several run
 * a service officer who will file a claim for you. None of the five publishes a
 * usable API: the Legion's locator is Personify WebForms, VFW's is Sitecore
 * viewstate, DAV's page is a hub of links. Scraping all five would be five
 * bespoke, permanently-breaking scrapers.
 *
 * They are all tax-exempt organizations, and the IRS publishes every one of them
 * monthly as plain CSV. `SUBSECTION = 19` is literally "Post or Organization of
 * Past or Present Members of the Armed Forces" — an IRS-verified veteran filter —
 * and `NTEE_CD` beginning `W30` is "Military/Veterans' Organizations". Verified
 * 2026-07-28: 24,843 c(19) ∪ 14,437 W30 = 33,210 organizations.
 *
 * HONEST LIMITS — these drive `needs_review` and the description copy
 *
 * A BMF address is the organization's *mailing* address as filed with the IRS.
 * For a post that owns its hall that is the hall; for a small chapter it is often
 * the treasurer's house or a PO box. 27.7% are PO boxes and are dropped outright.
 * There is no phone, no website, and no hours in this file at all, and no way to
 * tell a thriving post from one that exists only on paper.
 *
 * So these are listed as a `directory` at `needs_review`, which makes the app
 * render "Directory listing · may be outdated" and the hedged trust warning
 * rather than presenting them as verified. They are a lead worth a phone call,
 * and the copy says so — not a promise that someone is there today.
 */
import { parseCsvStream } from '../lib/csv.ts';
import { httpRequest } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'irs-veterans-orgs';
const ATTRIBUTION_URL =
  'https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf';

/**
 * Regional extracts. `eo4` is international organizations — excluded, since a
 * veterans post in another country cannot be placed by a US ZIP or reached by a
 * veteran browsing a radius.
 */
const REGION_FILES = ['eo1.csv', 'eo2.csv', 'eo3.csv'] as const;

/** IRS subsection code 19: post or organization of past/present armed forces members. */
const VETERANS_SUBSECTION = '19';
/** NTEE code prefix for Military/Veterans' Organizations. */
const VETERANS_NTEE_PREFIX = 'W30';
/** Only currently-recognised exempt organizations. */
const ACTIVE_STATUS = '01';

/**
 * Below this, assume a URL moved or the columns changed rather than ingest a
 * fraction. ~33,210 match nationally and ~24,000 survive the PO-box filter.
 */
const MIN_ORGS = 15_000;

/** Header names this adapter depends on; checked so a schema change fails loudly. */
const REQUIRED_COLUMNS = ['EIN', 'NAME', 'STREET', 'CITY', 'STATE', 'ZIP', 'SUBSECTION', 'NTEE_CD', 'STATUS'] as const;

const trimOrNull = (s: string | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

const isPoBox = (street: string): boolean =>
  /^(?:p\.?\s*o\.?\s*box|post\s+office\s+box|box\s+\d|p\.?o\.?b\b)/i.test(street.trim());

/**
 * The BMF stores names in upper case with abbreviations ("AMERICAN LEGION POST
 * 0123 DEPT OF OHIO"). Leading zeros on post numbers read as noise, and full
 * caps reads as shouting on a card.
 */
function cleanName(raw: string): string {
  const SMALL = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to']);
  // Acronyms only. `AMERICAN` was in this list by mistake and rendered every
  // American Legion post as "AMERICAN Legion".
  const KEEP_UPPER = /^(?:VFW|DAV|AMVETS|VVA|USA|US|VA|II|III|IV|POW|MIA)$/;
  return raw
    .replace(/\bPOST\s+0+(\d)/i, 'Post $1')
    .replace(/\bPOST\s+(\d)/i, 'Post $1')
    .replace(/\bDEPT\b/gi, 'Department')
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

const isVeteransOrg = (row: Record<string, string>): boolean =>
  row.SUBSECTION?.trim() === VETERANS_SUBSECTION ||
  row.NTEE_CD?.trim().toUpperCase().startsWith(VETERANS_NTEE_PREFIX);

function normalize(row: Record<string, string>, today: string): NormalizedResource | null {
  const ein = trimOrNull(row.EIN);
  const rawName = trimOrNull(row.NAME);
  const street = trimOrNull(row.STREET);
  const state = trimOrNull(row.STATE)?.toUpperCase();
  if (!ein || !rawName || !street || !state || state.length !== 2) return null;
  if (row.STATUS?.trim() !== ACTIVE_STATUS) return null;
  if (isPoBox(street)) return null;

  const city = trimOrNull(row.CITY);
  // BMF ZIPs are ZIP+4 without the hyphen; the geocoder wants five digits.
  const zip = trimOrNull(row.ZIP)?.slice(0, 5) ?? null;

  return {
    id: `irsvet:${ein}`,
    name: cleanName(rawName),
    category: 'community_support',
    description:
      'A chartered veterans organization — a post, chapter or auxiliary. Places like this are ' +
      'where veterans in the area meet, and many have a service officer who can help you file a ' +
      'VA claim for free. This address and name come from the IRS register of tax-exempt ' +
      'organizations, which lists the mailing address on file — it may be a post home you can ' +
      'visit, or an officer\'s address. Call or look them up before you travel.',
    address: [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', '),
    latitude: null,
    longitude: null,
    geocode: { street, city, state, zip },
    // The BMF has no contact details whatsoever.
    phone: null,
    website: null,
    hours: null,
    eligibility:
      'Most posts and chapters welcome any veteran, and many welcome family members too; some ask ' +
      'for service in a specific era or conflict. Membership is never required to ask for help ' +
      'finding a service officer.',
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    // Federal data, but a tax register is a register — not a verified directory
    // of open, staffed locations. `directory` + `needs_review` is what makes the
    // app hedge rather than assert.
    source_type: 'directory',
    veteran_relevance: 'veteran_specific',
    verification_status: 'needs_review',
    last_checked: today,
    last_updated: today,
    tags: ['veterans-organization', 'post', 'irs-registered', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: ein,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: {
      ein,
      name: rawName,
      subsection: row.SUBSECTION?.trim(),
      ntee: row.NTEE_CD?.trim(),
    },
  };
}

export const createIrsVeteransOrganizationsSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const base = config.baseUrl.replace(/\/$/, '');

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let scanned = 0;
      let matched = 0;
      let poBoxes = 0;
      let malformed = 0;
      let columnsChecked = false;

      for (const file of REGION_FILES) {
        const response = await httpRequest(`${base}/${file}`, {
          label: `IRS ${file}`,
          timeoutMs: 300_000,
        });
        if (!response.ok || !response.body) {
          throw new Error(`IRS: HTTP ${response.status} for ${file}`);
        }

        for await (const row of parseCsvStream(response.body, (n) => (malformed += n))) {
          if (!columnsChecked) {
            const missing = REQUIRED_COLUMNS.filter((c) => !(c in row));
            if (missing.length > 0) {
              throw new Error(`IRS: BMF is missing expected columns: ${missing.join(', ')}`);
            }
            columnsChecked = true;
          }
          scanned += 1;
          if (!isVeteransOrg(row)) continue;
          matched += 1;

          const street = row.STREET?.trim() ?? '';
          if (street && isPoBox(street)) poBoxes += 1;

          const normalized = normalize(row, today);
          if (!normalized || seen.has(normalized.id)) continue;
          if (stateFilter && !stateFilter.has(String(row.STATE).trim().toUpperCase())) continue;
          seen.add(normalized.id);
          results.push(normalized);
        }
      }

      if (!stateFilter && results.length < MIN_ORGS) {
        throw new Error(
          `IRS: only ${results.length} veterans organizations from ${matched} matches in ` +
            `${scanned} rows (expected at least ${MIN_ORGS}) — a subsection/NTEE code or a ` +
            `column name likely changed. Refusing to ingest.`,
        );
      }

      console.log(
        `[ingest] irs-veterans-orgs: ${results.length} organizations from ${matched} veteran ` +
          `matches in ${scanned} exempt orgs (${poBoxes} PO boxes dropped` +
          (malformed > 0 ? `, ${malformed} malformed rows skipped` : '') +
          ')',
      );
      return results;
    },
  };
};
