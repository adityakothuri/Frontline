/**
 * Idempotent write of normalized resources + their provenance into Supabase,
 * via the service-role key over PostgREST (same trust boundary as
 * scripts/seed.ts — never the app's publishable key). Resources merge on their
 * deterministic `id`; provenance merges on (provider, external_id). Re-running
 * ingestion updates rows in place and never duplicates.
 */
import type { NormalizedResource } from './types.ts';

export interface AdminConfig {
  url: string;
  serviceKey: string;
}

const BATCH = 500;

/**
 * Providers whose upstream payload is archived in `resource_sources.raw`.
 *
 * `raw` is lineage only (nothing queries it) and was once larger than the
 * catalogue itself (0026_reclaim_raw_payloads.sql), so it is opt-in: kept for
 * the small hand-maintained or scraped sources whose drift is hard to
 * reconstruct, not for big machine feeds that are cheaper to re-fetch.
 */
const STORE_RAW_PROVIDERS = new Set([
  'curated-national',
  'ssvf-providers',
  'vso-organizations',
  'state-veterans-homes',
  'lsc-legal-aid',
  'fisher-houses',
]);

async function upsertRows(
  config: AdminConfig,
  table: string,
  onConflict: string,
  rows: unknown[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    // Postgres `text` cannot hold a NUL (U+0000) and PostgREST rejects the whole
    // batch (22P05) if any field has one. JSON.stringify emits NUL as the escape
    // \\u0000, so strip that from the serialized body — every field, incl. raw.
    const body = JSON.stringify(batch).replace(/\\u0000/g, '');
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`${table}: HTTP ${response.status} — ${await response.text()}`);
    }
  }
}

export async function upsertResources(
  config: AdminConfig,
  items: NormalizedResource[],
): Promise<void> {
  if (items.length === 0) return;

  const resourceRows = items.map((item) => {
    // raw is lineage-only (goes to resource_sources); geocode is runner-only.
    const { raw, geocode, ...resource } = item;
    void raw;
    void geocode;
    return resource;
  });
  const sourceRows = items.map((item) => ({
    provider: item.source_provider,
    external_id: item.external_id,
    resource_id: item.id,
    // `raw` is NOT NULL, so opting out means an empty object, not null.
    raw: STORE_RAW_PROVIDERS.has(item.source_provider) ? item.raw : {},
  }));

  // Resources first — resource_sources.resource_id references resources(id).
  await upsertRows(config, 'resources', 'id', resourceRows);
  await upsertRows(config, 'resource_sources', 'provider,external_id', sourceRows);
}
