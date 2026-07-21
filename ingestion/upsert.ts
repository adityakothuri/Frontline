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

async function upsertRows(
  config: AdminConfig,
  table: string,
  onConflict: string,
  rows: unknown[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
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
    const { raw, ...resource } = item; // raw is lineage-only; it goes to resource_sources
    void raw;
    return resource;
  });
  const sourceRows = items.map((item) => ({
    provider: item.source_provider,
    external_id: item.external_id,
    resource_id: item.id,
    raw: item.raw,
  }));

  // Resources first — resource_sources.resource_id references resources(id).
  await upsertRows(config, 'resources', 'id', resourceRows);
  await upsertRows(config, 'resource_sources', 'provider,external_id', sourceRows);
}
