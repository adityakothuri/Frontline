/**
 * VA-accredited VSO representatives adapter.
 *
 * VA Office of General Counsel accreditation data: the Veterans Service
 * Organization representatives accredited to help veterans file and manage VA
 * benefit claims — for FREE. This is real, veteran-specific legal help, the
 * replacement for the general LSC legal-aid source we dropped.
 *
 * The VA publishes this only as a browser Excel/HTML export (no API), so it's
 * a manual-refresh source like SSVF: exported to `data/vso-representatives.json`
 * and ingested here. The list has city/state/zip but **no street address**, so
 * reps are placed at their **ZIP centroid** (`zipCentroid.ts`) — the honest
 * finest granularity, and enough for radius search; they're call-first anyway.
 * A rep whose ZIP isn't a known ZCTA is skipped (can't be placed in a radius).
 *
 * `veteran_specific`, category `legal`. `last_checked` = the file's
 * `retrieved_on` (real export date), NOT the run date — quarterly manual refresh.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zipCentroid } from '../zipCentroid.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'vso-representatives';

interface Rep {
  reg_num: string;
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
}

interface RepFile {
  source_url: string;
  retrieved_on: string;
  representatives: Rep[];
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

/** VA data is mixed-case but names can be ALL-CAPS; leave as-is, just trim. */
function displayName(rep: Rep): string {
  const name = [trimOrNull(rep.first_name), trimOrNull(rep.last_name)].filter(Boolean).join(' ');
  return name || 'VSO Representative';
}

function normalize(rep: Rep, file: RepFile): NormalizedResource | null {
  const zip = trimOrNull(rep.zip);
  const coords = zipCentroid(zip);
  if (!coords) return null; // no placeable ZIP → can't honor "within radius"

  const reg = trimOrNull(rep.reg_num);
  if (!reg) return null;

  const city = trimOrNull(rep.city);
  const state = trimOrNull(rep.state);
  const address = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null;

  return {
    id: `vso:${reg}`,
    name: `VSO Rep — ${displayName(rep)}`,
    category: 'legal',
    description:
      'VA-accredited Veterans Service Organization (VSO) representative. They help veterans file and manage VA benefit claims and appeals — for free. Call to confirm availability and what to bring.',
    address,
    latitude: coords.latitude,
    longitude: coords.longitude,
    phone: trimOrNull(rep.phone),
    website: file.source_url,
    hours: null,
    eligibility:
      'For veterans and eligible family members filing VA claims. Free. VSO representation does not require income eligibility.',
    documents_needed: [],
    source_url: file.source_url,
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    // The real export date, not the run date — goes stale if not re-exported.
    last_checked: file.retrieved_on,
    last_updated: file.retrieved_on,
    tags: ['vso-representative', 'va-claims', 'accredited'],
    created_at: file.retrieved_on,
    updated_at: file.retrieved_on,
    external_id: reg,
    source_provider: PROVIDER,
    ingested_at: new Date().toISOString().slice(0, 10),
    raw: rep,
  };
}

export const createVsoRepresentativesSource: SourceFactory = (config: SourceConfig): IngestionSource => {
  return {
    provider: PROVIDER,
    // Reads the exported VA accreditation list (config.baseUrl is its path). No network.
    async fetch(_query: IngestionQuery): Promise<NormalizedResource[]> {
      const file = JSON.parse(readFileSync(resolve(config.baseUrl), 'utf8')) as RepFile;
      const seen = new Set<string>();
      const results: NormalizedResource[] = [];
      for (const rep of file.representatives) {
        const normalized = normalize(rep, file);
        if (!normalized || seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized);
      }
      return results;
    },
  };
};
