import { colors } from '@/theme';
import type { ReminderSnapshot } from '@/services/reminders';
import type { Resource, SourceType } from '@/types/resource';

/**
 * Presentation helpers for a resource's live status and trust signals, shared by
 * card, preview and detail. Tone colour is always paired with text.
 */

export type StatusTone = 'success' | 'warning' | 'muted';

/** Tone→colour for every status/trust surface; warning uses text-grade amber. */
export const STATUS_TONE_COLOR: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warningText,
  muted: colors.textSecondary,
};

/** Days after which a `last_checked` date is treated as possibly outdated. */
const STALE_AFTER_DAYS = 90;

/** The open-now line. Green only when open and from a verified, current source;
 *  warning whenever hours are unknown or the source is doubtful. */
export function openNowStatus(
  isOpenNow: boolean | null,
  resource: Resource,
  now: Date = new Date(),
): { label: string; tone: StatusTone } {
  if (isOpenNow === null) return { label: 'Hours unknown', tone: 'warning' };
  const doubtful = shortSourceLabel(resource, now).tone === 'warning';
  if (isOpenNow) return { label: 'Open now', tone: doubtful ? 'warning' : 'success' };
  return { label: 'Closed now', tone: doubtful ? 'warning' : 'muted' };
}

// Claims only what the pipeline did (pulled from that kind of source), and
// stays one line on a card at caption size.
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
 * Licence credits that must be shown to the user, keyed by provenance tag.
 * ODbL requires the OSM credit wherever its data appears. Feed America and
 * CareerOneStop carry theirs in each row's `description` instead.
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

  // "updated", not "checked": last_checked is the last upstream fetch, not a visit.
  const base = SOURCE_TYPE_LABEL[resource.source_type];
  const dated = stale
    ? `${base} · may be outdated`
    : `${base} · updated ${formatCheckedDate(resource.last_checked)}`;

  const credit = attribution(resource);
  const label = credit ? `${dated} · ${credit}` : dated;

  return { label, tone: verified ? 'success' : 'warning' };
}

/** The trust state in a few words for a one-line strip (`Verified 07/27`,
 *  `May be outdated`, `Check the source`). The full line is `sourceStatus`. */
export function shortSourceLabel(
  resource: Resource,
  now: Date = new Date(),
): { label: string; tone: StatusTone } {
  if (isStale(resource.last_checked, now)) return { label: 'May be outdated', tone: 'warning' };
  if (resource.verification_status !== 'verified') {
    return { label: 'Check the source', tone: 'warning' };
  }
  // Read the ISO date's own digits: `new Date('2026-07-27')` is UTC midnight,
  // which renders as the 26th west of Greenwich.
  const [, month, day] = resource.last_checked.split('-');
  return { label: month && day ? `Verified ${month}/${day}` : 'Verified', tone: 'success' };
}

/**
 * What a reminder stores about a resource, so its trust line matches the card's
 * exactly. Captured, not looked up, so schedules can be rebuilt offline.
 */
export function toReminderSnapshot(resource: Resource): ReminderSnapshot {
  return {
    name: resource.name,
    hours: resource.hours,
    category: resource.category,
    sourceLabel: sourceStatus(resource).label,
    capturedAt: new Date().toISOString(),
  };
}
