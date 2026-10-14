import { describe, expect, it } from 'vitest';
import { makeResult } from '@/test/factories';
import { pinKey } from './pinKey';

/**
 * These assertions look almost too small to write down. They are here because
 * the bug they prevent — every pin on the map drawing the food icon — shipped
 * once already, is invisible in code review, and cannot be caught by any other
 * test in this suite: it lives in the native annotation-view recycle path, which
 * vitest does not run. See `pinKey.ts` for the full account.
 */
describe('pinKey', () => {
  it('carries the category, so two pins that look different can never share a key', () => {
    const food = makeResult({ id: 'same-id', category: 'food' });
    const housing = makeResult({ id: 'same-id', category: 'housing' });

    expect(pinKey(food, 'pin')).not.toBe(pinKey(housing, 'pin'));
  });

  it('includes the category verbatim', () => {
    // Asserted directly rather than only via inequality above: a key built from,
    // say, a hash of the category would satisfy the first test while being much
    // harder to debug from a screenshot of a map full of wrong glyphs.
    expect(pinKey(makeResult({ id: 'res-9', category: 'legal' }), 'pin')).toBe('res-9:legal:pin');
  });

  it('distinguishes two different places in the same category', () => {
    const a = makeResult({ id: 'res-1', category: 'food' });
    const b = makeResult({ id: 'res-2', category: 'food' });

    expect(pinKey(a, 'pin')).not.toBe(pinKey(b, 'pin'));
  });

  it('carries the tier, so a zoom threshold crossing cannot reuse frozen bitmaps', () => {
    // The tier flips for every pin on the map at once. If it were missing from
    // the key, MapKit would keep handing back the teardrop bitmaps it already
    // had and the zoomed-out map would never become dots — the same class of
    // failure as the food-icon bug, one level up.
    const result = makeResult({ id: 'res-4', category: 'housing' });

    expect(pinKey(result, 'dot')).not.toBe(pinKey(result, 'pin'));
  });

  it('takes no selection input at all, so a tap cannot change a marker key', () => {
    // The signature *is* the guarantee, and it is the one that matters most here:
    // there is no argument a tap can move. An open pin draws as a teardrop at any
    // zoom, so if the caller resolved that before calling here, tapping a dot
    // would flip its key `…:dot` → `…:pin` and remount the marker from inside its
    // own press handler — a red screen on every tap from any zoomed-out view.
    // That shipped. See `pinKey.ts`.
    expect(pinKey.length).toBe(2);
  });

  it('keys a pin by the field tier, so a dot stays a dot key while it is open', () => {
    // What the caller must pass is the camera's tier for the whole field. This is
    // the assertion that fails if someone reintroduces `selected ? 'pin' : tier`
    // at the call site and updates this file to match.
    const result = makeResult({ id: 'res-7', category: 'food' });

    expect(pinKey(result, 'dot')).toBe('res-7:food:dot');
    expect(pinKey(result, 'pin')).toBe('res-7:food:pin');
  });
});
