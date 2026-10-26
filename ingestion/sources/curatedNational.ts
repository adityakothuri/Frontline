/**
 * Curated national resources adapter.
 *
 * For categories that have **no public place-locator API** (food, clothing,
 * transportation, community_support), this ingests a small set of **real,
 * hand-verified national resources** — hotlines and locators like the USDA
 * National Hunger Hotline, 211, Feeding America, VA VTS, DAV. These are NOT
 * simulated: each is a genuine national org verified against its official site.
 *
 * They are nationwide referrals, so they carry **no coordinates** — the search
 * RPC surfaces null-coord resources in every query for their category, and they
 * place no map pin (a hotline isn't a place). Source of truth is
 * `ingestion/data/curated-national.json`; edit + re-run to update.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResourceCategory, SourceType, VeteranRelevance } from '../../src/types/resource.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'curated-national';

interface CuratedEntry {
  external_id: string;
  category: ResourceCategory;
  name: string;
  description: string;
  phone: string | null;
  website: string | null;
  eligibility: string | null;
  source_type: SourceType;
  veteran_relevance: VeteranRelevance;
  /** Date a human last confirmed this entry against its official site. */
  verified_on: string;
}

interface CuratedFile {
  resources: CuratedEntry[];
}

function normalize(entry: CuratedEntry, today: string): NormalizedResource {
  return {
    id: `curated:${entry.external_id}`,
    name: entry.name,
    category: entry.category,
    description: entry.description,
    address: null,
    latitude: null, // national referral — no single location, no map pin
    longitude: null,
    phone: entry.phone,
    website: entry.website,
    hours: null,
    eligibility: entry.eligibility,
    documents_needed: [],
    source_url: entry.website,
    source_type: entry.source_type,
    veteran_relevance: entry.veteran_relevance,
    verification_status: 'verified',
    // The real human-review date, not the run date — an unreviewed entry goes
    // stale on schedule instead of looking freshly checked forever.
    last_checked: entry.verified_on,
    last_updated: entry.verified_on,
    tags: ['national', entry.category],
    created_at: today,
    updated_at: today,
    external_id: entry.external_id,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: entry,
  };
}

export const createCuratedNationalSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    // Reads the curated JSON file (config.baseUrl is its path). No network.
    async fetch(_query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const file = JSON.parse(readFileSync(resolve(config.baseUrl), 'utf8')) as CuratedFile;
      const seen = new Set<string>();
      const results: NormalizedResource[] = [];
      for (const entry of file.resources) {
        const normalized = normalize(entry, today);
        if (seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        results.push(normalized);
      }
      return results;
    },
  };
};
