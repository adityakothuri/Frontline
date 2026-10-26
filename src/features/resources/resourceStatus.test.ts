import { describe, expect, it } from 'vitest';
import { makeResource } from '@/test/factories';
import { isStale, openNowStatus, shortSourceLabel, sourceStatus } from './resourceStatus';

const today = new Date().toISOString().slice(0, 10);

describe('isStale', () => {
  it('flags dates older than 90 days', () => {
    expect(isStale('2026-01-01', new Date('2026-07-25'))).toBe(true);
  });

  it('accepts recent dates', () => {
    expect(isStale('2026-07-20', new Date('2026-07-25'))).toBe(false);
  });

  it('treats an unparseable date as not stale (no false alarm)', () => {
    expect(isStale('not-a-date')).toBe(false);
  });
});

describe('openNowStatus', () => {
  const verified = makeResource({ last_checked: today });
  const unverified = makeResource({ last_checked: today, verification_status: 'unverified' });
  const stale = makeResource({ last_checked: '2020-01-01' });

  it('is green only when open from a verified, current source', () => {
    expect(openNowStatus(true, verified)).toEqual({ label: 'Open now', tone: 'success' });
    expect(openNowStatus(false, verified)).toEqual({ label: 'Closed now', tone: 'muted' });
  });

  it('is brown whenever the hours are unknown', () => {
    expect(openNowStatus(null, verified)).toEqual({ label: 'Hours unknown', tone: 'warning' });
  });

  it('is brown for an unverified or stale source', () => {
    expect(openNowStatus(true, unverified).tone).toBe('warning');
    expect(openNowStatus(true, stale).tone).toBe('warning');
    expect(openNowStatus(false, stale).tone).toBe('warning');
  });
});

describe('sourceStatus', () => {
  it('reads verified + fresh as a success tone', () => {
    const status = sourceStatus(makeResource({ last_checked: today }));
    expect(status.tone).toBe('success');
    expect(status.label).toContain('Official VA/gov data · updated');
  });

  it('warns and says "may be outdated" when stale', () => {
    const status = sourceStatus(makeResource({ last_checked: '2020-01-01' }));
    expect(status.tone).toBe('warning');
    expect(status.label).toContain('may be outdated');
  });
});

describe('shortSourceLabel', () => {
  const now = new Date('2026-07-30T12:00:00Z');

  it('dates a verified, fresh listing from its own digits', () => {
    expect(
      shortSourceLabel(
        makeResource({ verification_status: 'verified', last_checked: '2026-07-27' }),
        now,
      ),
    ).toEqual({ label: 'Verified 07/27', tone: 'success' });
  });

  it('asks for a check when the listing is not verified', () => {
    expect(
      shortSourceLabel(
        makeResource({ verification_status: 'needs_review', last_checked: '2026-07-27' }),
        now,
      ),
    ).toEqual({ label: 'Check the source', tone: 'warning' });
  });

  it('flags a stale listing even if it was once verified', () => {
    expect(
      shortSourceLabel(
        makeResource({ verification_status: 'verified', last_checked: '2026-01-01' }),
        now,
      ),
    ).toEqual({ label: 'May be outdated', tone: 'warning' });
  });
});
