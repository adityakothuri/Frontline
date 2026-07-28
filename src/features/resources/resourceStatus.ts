import { colors } from '@/theme';
import type { Resource, SourceType } from '@/types/resource';

/**
 * Presentation helpers for a resource's live status and trust signals — shared by
 * the resource card and the detail page. Tones map to theme colors here so the
 * card, the status pill, and the detail trust row all read from one source
 * (never color alone — always paired with text).
 */

export type StatusTone = 'success' | 'warning' | 'muted';

/** The single tone→color map for every status/trust surface. Warning uses the
 * text-grade amber — these strings are the trust layer and must stay legible. */
export const STATUS_TONE_COLOR: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warningText,
  muted: colors.textMuted,
};

/** Days after which a `last_checked` date is treated as possibly outdated. */
const STALE_AFTER_DAYS = 90;

export function openNowStatus(isOpenNow: boolean | null): {
  label: string;
  tone: StatusTone;
} {
  if (isOpenNow === true) return { label: 'Open now', tone: 'success' };
  if (isOpenNow === false) return { label: 'Closed now', tone: 'muted' };
  return { label: 'Hours unknown', tone: 'muted' };
}

// "Official VA/gov data", not "verified by a human" — the label must only
// claim what the pipeline actually did: pull from that kind of source.
// Kept short enough to stay one line on a card at caption size.
const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  official: 'Official VA/gov data',
  directory: 'Directory listing',
  nonprofit: 'Nonprofit',
  community: 'Community-submitted',
  unverified: 'Unverified',
};

export function isStale(lastChecked: string, now: Date = new Date()): boolean {
  const checked = new Date(lastChecked).getTime();
  if (Number.isNaN(checked)) return false;
  const ageDays = (now.getTime() - checked) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_AFTER_DAYS;
}

/** A friendly date like `Jun 18, 2026` from an ISO `YYYY-MM-DD` string. */
export function formatCheckedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * One hedged sentence of guidance when info is stale or not verified; null when
 * trusted. Derived from the same stale + verification check as `sourceStatus`,
 * so the warning and the badge tone can never disagree.
 */
export function trustWarning(resource: Resource): string | null {
  const stale = isStale(resource.last_checked);
  if (!stale && resource.verification_status === 'verified') return null;
  return stale
    ? 'This info hasn’t been confirmed recently — call ahead or check the official source.'
    : 'This info isn’t verified yet — call ahead or check the official source.';
}

/**
 * Licence attributions that must be VISIBLE TO THE USER, not merely recorded in
 * the repo, keyed by the provenance tag their rows carry.
 *
 * OpenStreetMap's ODbL 1.0 requires the credit wherever the data is shown, and
 * the clothing category is entirely OSM-derived. Putting it here rather than in a
 * component means the card, the map preview and the detail page all get it from
 * one place — `sourceStatus` is the only thing they share.
 *
 * Feed America (CC BY-SA) and CareerOneStop (DOL ETA + Minnesota DEED) carry
 * their attribution inside each row's `description` instead, because both landed
 * before this hook existed and the wording is longer than a badge can hold.
 */
const TAG_ATTRIBUTION: Record<string, string> = {
  osm: '© OpenStreetMap contributors',
};

/** The licence credit a resource owes, if any. */
export function attribution(resource: Resource): string | null {
  for (const tag of resource.tags) {
    const credit = TAG_ATTRIBUTION[tag];
    if (credit) return credit;
  }
  return null;
}

/** The trust badge: what the source is, how verified, and whether it's stale. */
export function sourceStatus(resource: Resource): { label: string; tone: StatusTone } {
  const stale = isStale(resource.last_checked);
  const verified = resource.verification_status === 'verified' && !stale;

  // "updated", not "checked" — last_checked is the last successful upstream
  // fetch (or, for curated lists, the real manual-review date), not a visit.
  const base = SOURCE_TYPE_LABEL[resource.source_type];
  const dated = stale
    ? `${base} · may be outdated`
    : `${base} · updated ${formatCheckedDate(resource.last_checked)}`;

  // The licence credit rides on the same line the user already reads for
  // provenance, which is exactly where ODbL wants it.
  const credit = attribution(resource);
  const label = credit ? `${dated} · ${credit}` : dated;

  return { label, tone: verified ? 'success' : 'warning' };
}
