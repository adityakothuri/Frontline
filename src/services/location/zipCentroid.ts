import type { Coordinates } from '@/lib/geo';
import { supabaseRequest } from '../supabase/client';
import { supabaseConfig } from '../supabase/config';

/**
 * Resolve a US ZIP to its centroid from the backend `zip_centroids` table — the
 * SAME authoritative source `search_resources` uses server-side, so the map
 * recenters exactly where the results are centered. Returns null when the
 * backend isn't configured or the ZIP isn't a known ZCTA (caller falls back).
 */
type CentroidRow = { latitude: number; longitude: number };

export async function resolveZipCentroid(zip: string): Promise<Coordinates | null> {
  if (!supabaseConfig) return null;
  try {
    const rows = await supabaseRequest<CentroidRow[]>(
      `/rest/v1/zip_centroids?zip=eq.${encodeURIComponent(zip)}&select=latitude,longitude&limit=1`,
    );
    const row = rows[0];
    return row ? { latitude: row.latitude, longitude: row.longitude } : null;
  } catch {
    return null;
  }
}
