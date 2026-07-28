/**
 * Fisher Houses — free lodging for families of veterans in hospital.
 *
 * When a veteran is admitted to a VA medical center far from home, the family
 * either pays for a hotel for weeks or doesn't come. A Fisher House sits on the
 * medical center campus and puts them up at no charge. There are only ~74 of
 * them, which makes this the smallest source in the pipeline — and per row, the
 * one most likely to matter enormously to the person who finds it.
 *
 * Fisher House Foundation runs an undocumented but stable JSON endpoint behind
 * its house directory (`/api/houses/current`, discovered as
 * `fetch('/api/houses/' + houseType)` in the directory page). It returns
 * structured addresses AND coordinates, so nothing needs geocoding. `/upcoming`
 * covers houses under construction — deliberately NOT ingested: a veteran cannot
 * stay in a building that isn't open.
 *
 * The house manager's name, phone and email are embedded in the record's
 * `content` HTML rather than exposed as fields, so they are extracted by regex.
 * The phone is used (it is the number to call for a room) but the manager's
 * personal email is not stored — a published contact for one purpose is not ours
 * to redistribute in another.
 */
import { fetchJson } from '../lib/http.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'fisher-houses';
const ATTRIBUTION_URL = 'https://www.fisherhouse.org/programs/houses/';

/**
 * Below this, assume the endpoint changed. 74 was the live count on 2026-07-28;
 * the network grows by a house or two a year, never shrinks by half.
 */
const MIN_HOUSES = 50;

interface HouseAddress {
  street_address?: string | null;
  street_address_2?: string | null;
  locality?: string | null;
  admin_area?: string | null;
  postal_code?: string | null;
  country_iso?: string | null;
}

interface House {
  id?: number | string;
  title?: string;
  coords?: { lat?: number | null; lng?: number | null } | null;
  address?: HouseAddress | null;
  content?: string | null;
}

const trimOrNull = (s: string | null | undefined): string | null => {
  const t = s?.trim();
  return t ? t : null;
};

const isSaneCoord = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");

const PHONE_RE = /\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/;

/** First plausible phone number in the record body — the house's own line. */
function managerPhone(content: string | null | undefined): string | null {
  if (!content) return null;
  const text = decodeEntities(content.replace(/<[^>]+>/g, ' '));
  const m = PHONE_RE.exec(text);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Titles arrive as "Pennsylvania: VA Pittsburgh Healthcare System". The state
 * prefix is redundant once the address is shown, and "Fisher House" is the name
 * a veteran is looking for, so it is put back in.
 */
function houseName(title: string): string {
  const withoutState = title.replace(/^[A-Za-z\s]+:\s*/, '').trim() || title.trim();
  return /fisher house/i.test(withoutState)
    ? withoutState
    : `Fisher House — ${withoutState}`;
}

function normalize(house: House, today: string): NormalizedResource | null {
  const id = trimOrNull(String(house.id ?? ''));
  const title = trimOrNull(house.title);
  if (!id || !title) return null;

  const addr = house.address ?? {};
  const state = trimOrNull(addr.admin_area)?.toUpperCase();
  const street = [trimOrNull(addr.street_address), trimOrNull(addr.street_address_2)]
    .filter(Boolean)
    .join(', ');
  const city = trimOrNull(addr.locality);
  const zip = trimOrNull(addr.postal_code);
  if (!state || !street) return null;

  // Only US houses; the foundation also lists a few on overseas bases, which the
  // app's ZIP/state model cannot place.
  const country = trimOrNull(addr.country_iso)?.toUpperCase();
  if (country && country !== 'US') return null;

  const lat = Number(house.coords?.lat);
  const lng = Number(house.coords?.lng);
  const hasCoords = house.coords?.lat != null && house.coords?.lng != null && isSaneCoord(lat, lng);

  return {
    id: `fisher:${id}`,
    name: houseName(title),
    category: 'housing',
    description:
      'Free lodging for the family of a veteran or service member receiving care at this medical ' +
      'centre. A private room in a comfortable house on or near the hospital campus, with a shared ' +
      'kitchen and laundry — there is never a charge to stay. Ask the hospital social worker or ' +
      'patient advocate to request a room for you; rooms are limited and go quickly.',
    address: [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', '),
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    geocode: hasCoords ? undefined : { street, city, state, zip },
    phone: managerPhone(house.content),
    website: ATTRIBUTION_URL,
    hours: null,
    eligibility:
      'For families and caregivers of veterans and service members getting treatment at the ' +
      'associated medical centre. There is no cost. Referrals normally come through the hospital ' +
      "social work or patient advocate office, so start there — don't wait until you arrive.",
    documents_needed: [],
    source_url: ATTRIBUTION_URL,
    source_type: 'nonprofit',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['fisher-house', 'family-lodging', 'caregiver-support', `state:${state}`],
    created_at: today,
    updated_at: today,
    external_id: id,
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { id: house.id, title: house.title, address: addr, coords: house.coords },
  };
}

/**
 * A second row under `community_support`. A Fisher House is caregiver and family
 * support as much as it is lodging, and `family_caregiver` is the need shell that
 * maps there — a spouse looking for help being near their veteran should find it
 * without guessing that it's filed under housing.
 */
function crossListCommunity(base: NormalizedResource): NormalizedResource {
  return {
    ...base,
    id: `${base.id}:community`,
    external_id: `${base.external_id}:community`,
    category: 'community_support',
    tags: [...base.tags, 'family-support'],
  };
}

export const createFisherHousesSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const houses = await fetchJson<House[]>(config.baseUrl, { label: 'Fisher House' });

      if (!Array.isArray(houses) || houses.length < MIN_HOUSES) {
        throw new Error(
          `Fisher House: ${Array.isArray(houses) ? houses.length : 'non-array'} records returned ` +
            `(expected at least ${MIN_HOUSES}) — the endpoint likely changed.`,
        );
      }

      const stateFilter = query.state
        ? new Set(query.state.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean))
        : null;

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (const house of houses) {
        const normalized = normalize(house, today);
        if (!normalized || seen.has(normalized.id)) continue;
        if (stateFilter && !normalized.tags.some((t) => stateFilter.has(t.replace('state:', '')))) {
          continue;
        }
        seen.add(normalized.id);
        results.push(normalized, crossListCommunity(normalized));
      }

      console.log(`[ingest] fisher-houses: ${results.length / 2} houses (${results.length} rows)`);
      return results;
    },
  };
};
