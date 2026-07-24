/**
 * SSVF providers adapter (VA Supportive Services for Veteran Families).
 *
 * The VA publishes its SSVF grantee intake list — the ~235 nonprofits funded to
 * do rapid re-housing and homelessness prevention for veteran families — only
 * as a fiscal-year XLSX, no API. That list is converted to
 * `ingestion/data/ssvf-providers.json` (org, FAIN, states/counties served,
 * intake phone/email) and ingested here, mirroring `curatedNational.ts`.
 *
 * These are `veteran_specific` housing rows — the single most on-mission
 * housing resource the app can offer. The list has no street addresses, so
 * rows carry no coordinates (listed and callable, never pinned).
 *
 * `last_checked` = the file's `retrieved_on` date (when the list was actually
 * pulled from the VA), NOT the ingestion run date — the honest freshness
 * signal for manually-refreshed data. Refresh quarterly: re-download the
 * current FY list, regenerate the JSON, re-run this source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'ssvf-providers';

interface SsvfProvider {
  organization: string;
  /** VA grant id (e.g. "12-AK-001") — stable across list revisions. */
  fain: string;
  states: string;
  /** Semicolon-separated "County (ST)" list. */
  areas_served: string;
  phone: string | null;
  email: string | null;
}

interface SsvfFile {
  source: string;
  source_url: string;
  retrieved_on: string;
  providers: SsvfProvider[];
}

/** "A (AK);B (AK);…" → "A, B, and 3 more areas" (kept short for the card). */
function describeAreas(raw: string): string | null {
  const areas = raw
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean);
  if (areas.length === 0) return null;
  const shown = areas.slice(0, 4);
  const rest = areas.length - shown.length;
  return rest > 0 ? `${shown.join(', ')}, and ${rest} more area${rest === 1 ? '' : 's'}` : shown.join(', ');
}

function normalize(entry: SsvfProvider, file: SsvfFile): NormalizedResource {
  const areas = describeAreas(entry.areas_served);
  return {
    id: `ssvf:${entry.fain}`,
    name: `${entry.organization} — SSVF Veteran Housing`,
    category: 'housing',
    description: `SSVF (Supportive Services for Veteran Families) provider — VA-funded help for veteran families who are homeless or about to lose housing: rapid re-housing, prevention, case management, and short-term financial help.${areas ? ` Serves ${areas}.` : ''}`,
    address: null,
    latitude: null, // the VA list has no street addresses — listed, never pinned
    longitude: null,
    phone: entry.phone,
    website: file.source_url,
    hours: null,
    eligibility:
      'For veterans and veteran families with very low income who are homeless or at risk of losing housing. Call the intake line to check eligibility.',
    documents_needed: [],
    source_url: file.source_url,
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    last_checked: file.retrieved_on,
    last_updated: file.retrieved_on,
    tags: ['ssvf', 'veteran-housing', 'homelessness-prevention'],
    created_at: file.retrieved_on,
    updated_at: file.retrieved_on,
    external_id: entry.fain,
    source_provider: PROVIDER,
    ingested_at: new Date().toISOString().slice(0, 10),
    raw: entry,
  };
}

export const createSsvfProvidersSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  return {
    provider: PROVIDER,
    // Reads the converted VA list (config.baseUrl is its path). No network.
    async fetch(_query: IngestionQuery): Promise<NormalizedResource[]> {
      const file = JSON.parse(readFileSync(resolve(config.baseUrl), 'utf8')) as SsvfFile;
      const seen = new Set<string>();
      const results: NormalizedResource[] = [];
      for (const entry of file.providers) {
        if (!entry.organization || !entry.fain || seen.has(entry.fain)) continue;
        seen.add(entry.fain);
        results.push(normalize(entry, file));
      }
      return results;
    },
  };
};
