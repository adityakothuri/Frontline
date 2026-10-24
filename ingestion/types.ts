/**
 * Frontline resource ingestion — the source-agnostic contract.
 *
 * Ingestion is standalone backend tooling (run with Node's TS type-stripping,
 * like scripts/seed.ts) — NOT part of the app bundle. Adding a data source is
 * one new module under sources/ that exports a `SourceFactory`; validation,
 * upsert and provenance are shared.
 */
import type { Resource } from '../src/types/resource.ts';

/**
 * A resource an adapter has produced, ready for the DB write. Extends the app's
 * `Resource` (the columns `resources` stores) with the provenance a source
 * carries: the provider's id, the provider key, the fetch date, and the raw
 * payload (persisted to `resource_sources` for lineage — never to `resources`).
 */
export interface NormalizedResource extends Resource {
  external_id: string;
  source_provider: string;
  ingested_at: string;
  raw: unknown;
  /**
   * Structured address parts for providers that give an address but no
   * coordinates. The runner resolves these to exact coordinates via the Census
   * batch geocoder (`censusGeocode.ts`) before upsert; unmatched addresses keep
   * null coords (listed, never pinned). Stripped before the DB write.
   */
  geocode?: AddressParts;
}

/** Address parts the Census geocoder accepts. */
export interface AddressParts {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/** What the caller wants pulled. A source honors the fields it supports. */
export interface IngestionQuery {
  lat?: number;
  long?: number;
  radiusMiles?: number;
  state?: string;
  /** Pull the whole dataset with no geo filter (for nationwide coverage). */
  national?: boolean;
  /** Optional provider-specific type filters (e.g. VA 'health','benefits','vet_center'). */
  types?: string[];
  perPage: number;
  maxPages: number;
}

/** Per-source connection config. Secrets come from the runner's env, never git. */
export interface SourceConfig {
  apiKey: string;
  baseUrl: string;
  /** Delay between paged requests, to respect provider rate limits (the VA
   *  sandbox is strict). Omit to let the source pick a sensible default. */
  throttleMs?: number;
  /** Retries on HTTP 429 (rate limit) before giving up. */
  maxRetries?: number;
}

/** One data source: fetch its records and normalize each to a `Resource`. */
export interface IngestionSource {
  /** Stored as `resources.source_provider`, e.g. 'va-facilities'. */
  readonly provider: string;
  fetch(query: IngestionQuery): Promise<NormalizedResource[]>;
}

export type SourceFactory = (config: SourceConfig) => IngestionSource;
