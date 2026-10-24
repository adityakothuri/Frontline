/**
 * American Job Centers — staffed public workforce offices. ~1,500 of ~2,170 open
 * centres have a DVOP/LVER veterans' employment representative; the rest still
 * give veterans priority of service by law (38 U.S.C. § 4215), so they are
 * `veteran_benefit` rather than `general`.
 *
 * Source: CareerOneStop's free bulk XLSX, with coordinates and phones. The site
 * 403s a default client, so `lib/http.ts`'s browser User-Agent is required.
 *
 * The CareerOneStop licence requires acknowledging US DOL ETA and Minnesota DEED
 * wherever the data is shown; `description` is the one field every surface
 * renders, so the attribution lives there. Rep names and emails are not stored
 * (high turnover; the direct phone line is what matters).
 */
import { readXlsxTable } from '../lib/xlsx.ts';
import { httpRequest } from '../lib/http.ts';
import {
  cleanPhone,
  formatAddress,
  isSaneCoord,
  normalizeUrl,
  parseStateFilter,
  trimOrNull,
} from '../lib/normalize.ts';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'careeronestop-ajc';
const ATTRIBUTION_URL =
  'https://www.careeronestop.org/localhelp/americanjobcenters/find-american-job-centers.aspx';

/**
 * Required by the CareerOneStop data licence. Kept as one sentence so it can ride
 * in every row's description without crowding out the useful text.
 */
const ATTRIBUTION =
  'Data from CareerOneStop, sponsored by the U.S. Department of Labor Employment and Training ' +
  'Administration and the Minnesota Department of Employment and Economic Development.';

/** Below this, assume the file moved or its columns changed. 2,169 are open today. */
const MIN_CENTERS = 1_500;

/** Header names, verified 2026-07-28. `Latitiude` is misspelled in the source file. */
const COL = {
  id: 'ID',
  name: 'Name of Center',
  programType: 'Program Type',
  address1: 'Address1',
  address2: 'Address2',
  city: 'City',
  state: 'State',
  zip: 'Zip Code',
  phone: 'Phone',
  website: 'Web Site URL',
  hasVetRep: 'Vet Rep Yes/No',
  vetRepPhone: 'Vet Rep1 Phone',
  exOffenderPrograms: 'Have Programs for Ex-Offenders',
  latitude: 'Latitiude',
  longitude: 'Longitude',
  closed: 'Center Closure Y/N',
} as const;

/** "Comprehensive American Job Center" → "comprehensive" / "affiliate". */
function centerKind(programType: string | null): string {
  if (!programType) return 'American Job Center';
  return /comprehensive/i.test(programType)
    ? 'a comprehensive American Job Center'
    : 'an affiliate American Job Center';
}

function normalize(row: Record<string, string>, today: string): NormalizedResource | null {
  const id = trimOrNull(row[COL.id]);
  const name = trimOrNull(row[COL.name]);
  const street = trimOrNull(row[COL.address1]);
  const state = trimOrNull(row[COL.state])?.toUpperCase();
  if (!id || !name || !street || !state || state.length !== 2) return null;

  if (trimOrNull(row[COL.closed])?.toUpperCase() === 'Y') return null;

  const suite = trimOrNull(row[COL.address2]);
  const fullStreet = [street, suite].filter(Boolean).join(', ');
  const city = trimOrNull(row[COL.city]);
  const zip = trimOrNull(row[COL.zip])?.slice(0, 5) ?? null;

  const lat = Number(row[COL.latitude]);
  const lng = Number(row[COL.longitude]);
  const hasCoords = isSaneCoord(lat, lng);

  const centerPhone = cleanPhone(trimOrNull(row[COL.phone]));
  const vetRepPhone = cleanPhone(trimOrNull(row[COL.vetRepPhone]));
  const hasVetRep = /^yes$/i.test(trimOrNull(row[COL.hasVetRep]) ?? '');

  // Prefer the veterans' representative's direct line: reaching that specific
  // person is the reason a veteran should call this office rather than any other.
  // The centre's main line goes in the description as the fallback when they
  // differ, so a stale extension is never a dead end.
  const phone = vetRepPhone ?? centerPhone;
  const fallbackLine =
    vetRepPhone && centerPhone && vetRepPhone !== centerPhone
      ? ` If that line doesn't answer, the centre's main number is ${centerPhone}.`
      : '';

  const vetLine = hasVetRep
    ? 'This centre has a veterans’ employment representative — staff whose specific job is helping ' +
      'veterans find work, funded by the Jobs for Veterans State Grant. ' +
      (vetRepPhone
        ? 'The number listed reaches them directly.'
        : 'Ask for the veterans’ representative when you call.')
    : 'Veterans get priority of service here by federal law — say you are a veteran when you arrive ' +
      'or call, and you move ahead of the queue for staff time and training referrals.';

  const exOffender = /^yes$/i.test(trimOrNull(row[COL.exOffenderPrograms]) ?? '')
    ? ' They also run programmes for people with a criminal record.'
    : '';

  return {
    id: `ajc:${id}`,
    name,
    category: 'jobs',
    description:
      `${name} is ${centerKind(trimOrNull(row[COL.programType]))} — a free public office for job ` +
      `seekers. Help with your résumé, job search, interview practice, training grants and ` +
      `apprenticeships, plus computers and printers you can use. ${vetLine}${fallbackLine}` +
      `${exOffender} ${ATTRIBUTION}`,
    address: formatAddress(fullStreet, city, state, zip),
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    geocode: hasCoords ? undefined : { street: fullStreet, city, state, zip },
    phone,
    website: normalizeUrl(row[COL.website]),
    // The file has no opening times — only a free-text status note on 24 rows.
    hours: null,
    eligibility:
      'Free and open to everyone, with no appointment needed at most centres. Veterans, and ' +
      'eligible spouses, get priority of service by law. Bring photo ID; bring your DD-214 too if ' +
      'you have it, since it is what unlocks the veterans’ programmes.',
    documents_needed: hasVetRep ? ['DD-214', 'Photo ID'] : ['Photo ID'],
    source_url: ATTRIBUTION_URL,
    source_type: 'official',
    // A centre with a dedicated veterans' representative is a veteran-specific
    // service. The rest are a statutory veteran benefit at a general office.
    veteran_relevance: hasVetRep ? 'veteran_specific' : 'veteran_benefit',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: [
      'american-job-center',
      'employment',
      'job-search',
      ...(hasVetRep ? ['veterans-employment-rep', 'dvop-lver'] : ['priority-of-service']),
      `state:${state}`,
    ],
    created_at: today,
    updated_at: today,
    external_id: id,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { id, name, programType: row[COL.programType], hasVetRep, closed: row[COL.closed] },
  };
}

export const createAmericanJobCentersSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);

      // readXlsxTable shells out to `unzip`, so the workbook needs to be on disk.
      const dir = await mkdtemp(join(tmpdir(), 'frontline-ajc-'));
      const file = join(dir, 'ajc.xlsx');
      let rows: Record<string, string>[];
      try {
        const response = await httpRequest(config.baseUrl, {
          label: 'CareerOneStop',
          timeoutMs: 180_000,
        });
        if (!response.ok) {
          throw new Error(`CareerOneStop: HTTP ${response.status} for ${config.baseUrl}`);
        }
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        rows = await readXlsxTable(file);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }

      const missing = Object.values(COL).filter((c) => !rows.some((r) => c in r));
      if (missing.length > 0) {
        throw new Error(
          `CareerOneStop: workbook is missing expected columns: ${missing.join(', ')}`,
        );
      }

      const stateFilter = parseStateFilter(query.state);

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      let closed = 0;
      let withVetRep = 0;
      for (const row of rows) {
        if (trimOrNull(row[COL.closed])?.toUpperCase() === 'Y') closed += 1;
        const normalized = normalize(row, today);
        if (!normalized || seen.has(normalized.id)) continue;
        if (stateFilter && !stateFilter.has(String(row[COL.state]).trim().toUpperCase())) continue;
        seen.add(normalized.id);
        if (normalized.veteran_relevance === 'veteran_specific') withVetRep += 1;
        results.push(normalized);
      }

      if (!stateFilter && results.length < MIN_CENTERS) {
        throw new Error(
          `CareerOneStop: only ${results.length} open centres from ${rows.length} rows (expected at ` +
            `least ${MIN_CENTERS}) — the workbook or its columns likely changed.`,
        );
      }

      console.log(
        `[ingest] careeronestop-ajc: ${results.length} open centres from ${rows.length} rows ` +
          `(${withVetRep} with a veterans' employment rep, ${closed} closed excluded)`,
      );
      return results;
    },
  };
};
