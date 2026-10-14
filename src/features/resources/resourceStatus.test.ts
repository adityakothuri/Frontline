import { describe, expect, it } from 'vitest';
import { makeResource } from '@/test/factories';
import { isStale, openNowStatus, sourceStatus, trustWarning } from './resourceStatus';

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
  it('maps the tri-state open flag to a label + tone', () => {
    expect(openNowStatus(true)).toEqual({ label: 'Open now', tone: 'success' });
    expect(openNowStatus(false)).toEqual({ label: 'Closed now', tone: 'muted' });
    expect(openNowStatus(null)).toEqual({ label: 'Hours unknown', tone: 'muted' });
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

describe('trustWarning', () => {
  it('is null for a verified, fresh resource', () => {
    expect(trustWarning(makeResource({ last_checked: today }))).toBeNull();
  });

  it('warns when unverified', () => {
    expect(
      trustWarning(makeResource({ verification_status: 'needs_review', last_checked: today })),
    ).toMatch(/isn.t verified yet/);
  });

  it('warns when stale', () => {
    expect(trustWarning(makeResource({ last_checked: '2020-01-01' }))).toMatch(
      /hasn.t been confirmed/,
    );
  });
});
