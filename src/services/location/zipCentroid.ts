import type { Coordinates } from '@/lib/geo';
import { supabaseRequest } from '../supabase/client';
import { supabaseConfig } from '../supabase/config';

type CentroidRow = { latitude: number; longitude: number };

/**
 * A US ZIP's centroid from `zip_centroids`, the table `search_resources` uses,
 * so the map centres where the results do. Null when unknown or unconfigured.
 */
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
