import type { ResourceSearchResult } from '@/services/resources';
import type { Resource } from '@/types/resource';

/**
 * Test factories — build a realistic `Resource` / search result with sane
 * defaults so each test only states the fields it cares about. Keeps the unit
 * tests focused and free of duplicated 20-field literals.
 */
export function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'res-1',
    name: 'Test Resource',
    category: 'benefits_help',
    description: 'A test resource.',
    address: '100 Main St, Dallas, TX 75201',
    latitude: 32.78,
    longitude: -96.8,
    phone: '800-555-0100',
    website: 'https://example.gov',
    hours: null,
    eligibility: null,
    documents_needed: [],
    source_url: 'https://example.gov/source',
    source_type: 'official',
    veteran_relevance: 'veteran_specific',
    verification_status: 'verified',
    last_checked: '2026-07-24',
    last_updated: '2026-07-24',
    tags: [],
    created_at: '2026-07-24',
    updated_at: '2026-07-24',
    ...overrides,
  };
}

export function makeResult(
  resource: Partial<Resource> = {},
  distanceMiles: number | null = 1,
  isOpenNow: boolean | null = null,
): ResourceSearchResult {
  return { resource: makeResource(resource), distanceMiles, isOpenNow };
}
