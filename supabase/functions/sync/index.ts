/**
 * Frontline backup sync — the only path to the deny-all saved_backups /
 * profile_backups tables. The device UUID is a bearer capability secret; this
 * function is the isolation boundary (service-role behind an anon-key gate).
 *
 * POST { action: 'pull', deviceId }
 *   -> { saved: SavedEntry[] | null, profile: VeteranProfile | null, savedUpdatedAt, profileUpdatedAt }
 * POST { action: 'pushSaved', deviceId, entries, updatedAt }
 * POST { action: 'pushProfile', deviceId, profile, updatedAt }
 *   -> { ok: true } (writes older than the stored updated_at are ignored — a
 *      reinstall's empty local state can never clobber good backup data).
 *
 * Errors: 400 malformed, 401 bad key, 405 method, 429 rate-limited, 500 db.
 */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RATE_LIMIT_PER_HOUR = 120;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Service-role REST helper against PostgREST. */
async function pg(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function rateLimited(request: Request): Promise<boolean> {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sync:${ip}`));
    const ipHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const response = await pg('rpc/increment_rate_limit', {
      method: 'POST',
      body: JSON.stringify({ p_ip_hash: ipHash }),
    });
    if (!response.ok) return false; // fail open — never take sync down
    return ((await response.json()) as number) > RATE_LIMIT_PER_HOUR;
  } catch {
    return false;
  }
}

/** Upsert only when the incoming updatedAt is newer than what's stored. */
async function upsertIfNewer(
  table: string,
  deviceId: string,
  column: string,
  value: unknown,
  updatedAt: string,
): Promise<Response> {
  const existing = await pg(
    `${table}?device_id=eq.${deviceId}&select=updated_at`,
    { method: 'GET', headers: { Accept: 'application/vnd.pgrst.object+json' } },
  );
  if (existing.ok) {
    const { updated_at } = (await existing.json()) as { updated_at: string };
    if (new Date(updatedAt).getTime() <= new Date(updated_at).getTime()) {
      return json({ ok: true, skipped: true }); // stale write — ignore
    }
  }
  const write = await pg(table, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ device_id: deviceId, [column]: value, updated_at: updatedAt }),
  });
  return write.ok ? json({ ok: true }) : json({ error: 'db write failed' }, 500);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  // verify_jwt is off (publishable anon keys aren't JWTs); gate on the anon key.
  const expectedKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (expectedKey && request.headers.get('apikey') !== expectedKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || !UUID_RE.test(deviceId)) {
    return json({ error: 'deviceId must be a UUID' }, 400);
  }
  if (await rateLimited(request)) return json({ error: 'Rate limit exceeded' }, 429);

  try {
    if (body.action === 'pull') {
      const [savedRes, profileRes] = await Promise.all([
        pg(`saved_backups?device_id=eq.${deviceId}&select=entries,updated_at`, { method: 'GET' }),
        pg(`profile_backups?device_id=eq.${deviceId}&select=profile,updated_at`, { method: 'GET' }),
      ]);
      const saved = savedRes.ok ? ((await savedRes.json()) as { entries: unknown; updated_at: string }[]) : [];
      const profile = profileRes.ok ? ((await profileRes.json()) as { profile: unknown; updated_at: string }[]) : [];
      return json({
        saved: saved[0]?.entries ?? null,
        savedUpdatedAt: saved[0]?.updated_at ?? null,
        profile: profile[0]?.profile ?? null,
        profileUpdatedAt: profile[0]?.updated_at ?? null,
      });
    }

    if (body.action === 'pushSaved') {
      if (!Array.isArray(body.entries) || typeof body.updatedAt !== 'string') {
        return json({ error: 'entries[] and updatedAt required' }, 400);
      }
      return await upsertIfNewer('saved_backups', deviceId, 'entries', body.entries, body.updatedAt);
    }

    if (body.action === 'pushProfile') {
      if (typeof body.profile !== 'object' || body.profile === null || typeof body.updatedAt !== 'string') {
        return json({ error: 'profile and updatedAt required' }, 400);
      }
      return await upsertIfNewer('profile_backups', deviceId, 'profile', body.profile, body.updatedAt);
    }

    if (body.action === 'clearProfile') {
      // "Reset setup" must stick. Write a NULL tombstone via the monotonic path
      // (not a DELETE) so a profile-edit push still in flight — stamped before
      // this reset — can't recreate the row afterward. Restore reads NULL as
      // "no profile".
      if (typeof body.updatedAt !== 'string') return json({ error: 'updatedAt required' }, 400);
      return await upsertIfNewer('profile_backups', deviceId, 'profile', null, body.updatedAt);
    }

    return json({ error: 'action must be pull | pushSaved | pushProfile | clearProfile' }, 400);
  } catch (error) {
    console.error('sync function error:', error instanceof Error ? error.message : error);
    return json({ error: 'Internal error' }, 500);
  }
});
