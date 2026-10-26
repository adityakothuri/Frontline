/**
 * VA Veterans Transportation Program — how a veteran without a car gets to an
 * appointment.
 *
 * The VA answers "I have an appointment and no way to get there" per medical
 * centre: ~163 facilities, each with a Veterans Transportation Program
 * representative and a number to ring for a ride.
 *
 * THE PARSING TRAP
 *
 * Phone numbers on va.gov are inside a custom element's **attribute**:
 *
 *     <va-telephone contact="205-933-8101" extension="333110">
 *
 * so the usual "strip the tags and read the text" approach finds **zero** phone
 * numbers on a page that has 486 of them. The attribute has to be read directly.
 *
 * `va.gov/robots.txt` does not disallow `/resources/`, and this is federal work in
 * the public domain.
 *
 * Coordinates: none on the page, but every address is a VA medical centre we
 * already hold in `va-facilities`, so the Census geocoder resolves them cleanly.
 */
import { fetchText } from '../lib/http.ts';
import { decodeEntities, formatAddress, parseStateFilter, trimOrNull } from '../lib/normalize.ts';
import type {
  IngestionQuery,
  IngestionSource,
  NormalizedResource,
  SourceConfig,
  SourceFactory,
} from '../types.ts';

const PROVIDER = 'va-transportation';
const VTP_URL = 'https://www.va.gov/resources/veterans-transportation-program-representatives/';

/** Below this, assume the page was restructured. 163 facility blocks live. */
const MIN_FACILITIES = 80;

/** `Birmingham, AL 35233` at the end of an address block. */
const CITY_STATE_ZIP = /^(.+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/;

const stripTags = (html: string): string[] =>
  decodeEntities(
    html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '\n'),
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

interface Facility {
  /** The health-care system heading, e.g. "VA Birmingham health care". */
  system: string;
  /** The named site, e.g. "VA Birmingham Medical Center". */
  site: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
}

/**
 * Split the page into `<h4>`-delimited facility blocks and read each one.
 *
 * The first line after the heading is the site name, then the street, then
 * `City, ST ZIP`. The phone comes from the first `va-telephone` attribute in the
 * block — which is the "to schedule a ride" number, the one a veteran needs.
 */
function parseFacilities(html: string): Facility[] {
  const out: Facility[] = [];
  const blocks = [...html.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4|<\/main)/gi)];

  for (const [, heading, body] of blocks) {
    const system = trimOrNull(decodeEntities(heading.replace(/<[^>]+>/g, '')));
    if (!system) continue;

    const lines = stripTags(body);
    // Address lines run from the site name until the "To schedule a ride:" cue.
    const cueAt = lines.findIndex((l) => /^to schedule a ride/i.test(l));
    const head = cueAt === -1 ? lines.slice(0, 4) : lines.slice(0, cueAt);

    let city: string | null = null;
    let state: string | null = null;
    let zip: string | null = null;
    let cityLineAt = -1;
    for (let i = head.length - 1; i >= 0; i--) {
      const m = CITY_STATE_ZIP.exec(head[i]);
      if (m) {
        city = m[1].trim();
        state = m[2].toUpperCase();
        zip = m[3];
        cityLineAt = i;
        break;
      }
    }

    const site = trimOrNull(head[0]);
    // Everything between the site name and the city line is the street.
    const street = cityLineAt > 1 ? trimOrNull(head.slice(1, cityLineAt).join(', ')) : null;

    // Phones live in the attribute, not the text — see the header note.
    const phone = /<va-telephone[^>]*\bcontact="([^"]+)"/i.exec(body)?.[1] ?? null;

    if (!state) continue; // cannot place it — skip rather than guess
    out.push({ system, site, street, city, state, zip, phone: trimOrNull(phone) });
  }
  return out;
}

function normalize(facility: Facility, today: string): NormalizedResource {
  const name = facility.site ?? facility.system;
  const address = formatAddress(facility.street, facility.city, facility.state, facility.zip);

  const howTo = facility.phone
    ? `Call ${facility.phone}, select 0, and ask for a VTP representative.`
    : 'Call the medical centre and ask for the Veterans Transportation Program representative.';

  return {
    id: `vatransport:${facility.state}-${name
      .replace(/[^A-Za-z0-9]+/g, '-')
      .toLowerCase()
      .slice(0, 60)}`,
    name: `Rides to appointments — ${name}`,
    category: 'transportation',
    description:
      `This medical centre has a Veterans Transportation Program representative who arranges rides ` +
      `to VA health appointments — including volunteer drivers, shuttles between VA sites, and help ` +
      `for veterans who cannot travel alone. ${howTo} Ask well before your appointment; rides are ` +
      `arranged in advance, not on the day.`,
    address,
    latitude: null,
    longitude: null,
    geocode: facility.street
      ? { street: facility.street, city: facility.city, state: facility.state, zip: facility.zip }
      : undefined,
    phone: facility.phone,
    website: VTP_URL,
    hours: null,
    eligibility:
      'For veterans enrolled in VA health care who are travelling to a VA appointment. Some rides ' +
      'are open to any enrolled veteran; others prioritise those with a service-connected ' +
      'disability, a low income, or no other way to travel. Ask the representative what you ' +
      'qualify for — and ask about travel-pay reimbursement in the same call.',
    documents_needed: [],
    source_url: VTP_URL,
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    last_checked: today,
    last_updated: today,
    tags: ['transportation', 'vtp', 'rides-to-appointments', `state:${facility.state}`],
    created_at: today,
    updated_at: today,
    external_id: `${facility.state}-${name}`.slice(0, 200),
    source_provider: PROVIDER,
    ingested_at: today,
    raw: { ...facility },
  };
}

export const createVaTransportationSource: SourceFactory = (
  config: SourceConfig,
): IngestionSource => {
  return {
    provider: PROVIDER,
    async fetch(query: IngestionQuery): Promise<NormalizedResource[]> {
      const today = new Date().toISOString().slice(0, 10);
      const html = await fetchText(config.baseUrl, { label: 'VA VTP', timeoutMs: 90_000 });
      const facilities = parseFacilities(html);

      if (facilities.length < MIN_FACILITIES) {
        throw new Error(
          `VA VTP: only ${facilities.length} facilities parsed (expected ~163) — the page was ` +
            `likely restructured. Refusing to ingest.`,
        );
      }

      const stateFilter = parseStateFilter(query.state);

      const results: NormalizedResource[] = [];
      const seen = new Set<string>();
      for (const facility of facilities) {
        if (stateFilter && !stateFilter.has(facility.state ?? '')) continue;
        const row = normalize(facility, today);
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        results.push(row);
      }

      const withPhone = results.filter((r) => r.phone).length;
      console.log(
        `[ingest] va-transportation: ${results.length} facilities (${withPhone} with a ride line) ` +
          `from ${facilities.length} parsed`,
      );
      return results;
    },
  };
};
