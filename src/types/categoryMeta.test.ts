import { describe, expect, it } from 'vitest';
import { colors, surfaceTint } from '@/theme';
import { RESOURCE_CATEGORY_META, RESOURCE_CATEGORIES } from './resource';
import { NEED_CATEGORY_META, NEED_CATEGORIES } from './need';
import { resourceToNeedCategory } from '@/services/resources/needMapping';

/**
 * The category palette makes three promises that were previously enforced only
 * by a doc comment: the two metadata maps agree, no two categories look alike,
 * and every hue is dark enough to be legible as an icon. Each is cheap to check
 * and expensive to notice by eye, so they're checked here.
 *
 * Thresholds are the floor, not the target — the shipped palette clears them
 * with room (min ΔE 17.9, min contrast 4.06:1). See the "Category identity
 * hues" section of `docs/obsidian/02 Design/UI Design System.md`.
 */

const srgb = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const channels = (hex: string) =>
  (hex.replace('#', '').match(/../g) as string[]).map((x) => srgb(parseInt(x, 16) / 255));

const relativeLuminance = (hex: string) => {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: string, b: string) => {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** `surfaceTint` composites to an `rgb(r, g, b)` string; everything above reads
 *  hex. Bridge rather than duplicate the maths. */
const rgbToHex = (value: string): string => {
  const parts = value.match(/\d+/g);
  if (!parts || parts.length < 3) return value;
  return `#${parts
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`;
};

/** CIELAB, so "different" is measured perceptually rather than in raw RGB. */
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = channels(hex);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

/** CIE76 — a cheap stand-in for the CIEDE2000 the design doc quotes. */
const deltaE = (a: string, b: string) => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

describe('category metadata', () => {
  it('gives every category a hue and an icon', () => {
    for (const category of RESOURCE_CATEGORIES) {
      expect(RESOURCE_CATEGORY_META[category].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
    for (const need of NEED_CATEGORIES) {
      expect(NEED_CATEGORY_META[need].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('keeps the two metadata maps in sync', () => {
    // Some needs fan out to several resource categories (essentials ← food +
    // clothing), so only the 1:1 correspondences can be required to match.
    const sole = new Map<string, string[]>();
    for (const category of RESOURCE_CATEGORIES) {
      const need = resourceToNeedCategory(category);
      sole.set(need, [...(sole.get(need) ?? []), category]);
    }
    for (const [need, categories] of sole) {
      if (categories.length !== 1) continue;
      expect(
        NEED_CATEGORY_META[need as keyof typeof NEED_CATEGORY_META].color,
        `need "${need}" and resource "${categories[0]}" must share a hue`,
      ).toBe(RESOURCE_CATEGORY_META[categories[0] as keyof typeof RESOURCE_CATEGORY_META].color);
    }
  });

  it('keeps every category hue perceptually distinct from the others', () => {
    for (const a of RESOURCE_CATEGORIES) {
      for (const b of RESOURCE_CATEGORIES) {
        if (a >= b) continue;
        const distance = deltaE(RESOURCE_CATEGORY_META[a].color, RESOURCE_CATEGORY_META[b].color);
        expect(distance, `${a} and ${b} are too close to tell apart`).toBeGreaterThan(12);
      }
    }
  });

  it('keeps every category hue legible as an icon on paper', () => {
    // WCAG 1.4.11: non-text UI needs 3:1. These hues are icons and map pins.
    for (const category of RESOURCE_CATEGORIES) {
      const ratio = contrastRatio(RESOURCE_CATEGORY_META[category].color, colors.background);
      expect(ratio, `${category} icon is too light on the paper background`).toBeGreaterThan(3);
    }
  });

  it('keeps every category hue legible as an icon on its own filter chip', () => {
    // The check above measures the icon on plain paper. The map's filter chip is
    // a harder surface: the hue's own 0.16 wash, composited over
    // `backgroundElevated` rather than `background`. That is where these icons
    // actually have to be read, and until now it was verified by hand — measured
    // at 3.2–3.7:1 for the tightest five hues, so it passed, but it passed
    // unproven. A wash strength or an elevated-paper tweak could have quietly
    // taken it under 3:1 with nothing to catch it.
    for (const category of RESOURCE_CATEGORIES) {
      const hue = RESOURCE_CATEGORY_META[category].color;
      const chip = rgbToHex(surfaceTint(hue, 0.16, colors.backgroundElevated));
      const ratio = contrastRatio(hue, chip);
      expect(ratio, `${category} icon is too light on its own chip wash`).toBeGreaterThan(3);
    }
  });

  it('keeps every category hue legible on the compound medallion-over-hero wash', () => {
    // The worst surface each hue lands on, and the one the palette is supposed to
    // be validated against ([[UI Design System]] "≥3:1 for the icon on its own
    // medallion wash — the compound tint-on-tint case"). Nothing asserted it
    // until now: the chip check above uses a *single* 0.16 wash over elevated
    // paper, which is a full step looser.
    //
    // Direction matters here and is easy to get backwards. More hue in the
    // backdrop means LESS separation from the glyph drawn in that same hue, so
    // stacking medallion 0.16 on top of hero 0.14 is tighter than either alone —
    // `food` measures 3.02:1 here against 3.14 on the chip and ~3.9 on a Home
    // tile's bare wash. The tile is the *loosest* of the three, which is why
    // a tile-specific assertion would have been strictly subsumed by this one and
    // could never have failed independently.
    for (const category of RESOURCE_CATEGORIES) {
      const hue = RESOURCE_CATEGORY_META[category].color;
      const hero = rgbToHex(surfaceTint(hue, 0.14, colors.surface));
      const compound = rgbToHex(surfaceTint(hue, 0.16, hero));
      const ratio = contrastRatio(hue, compound);
      expect(
        ratio,
        `${category} icon is too light on the medallion-over-hero wash`,
      ).toBeGreaterThan(3);
    }
  });

  it('keeps category hues clear of the semantic tokens', () => {
    // Olive = action, emerald = verified, amber = caution. A category hue that
    // lands on one of those makes an identity look like a state. `emergency` is
    // the deliberate exception: there, identity and severity are the same.
    const semantic = { accent: colors.accent, success: colors.success, warning: colors.warning };
    for (const category of RESOURCE_CATEGORIES) {
      if (category === 'emergency') continue;
      for (const [name, token] of Object.entries(semantic)) {
        const distance = deltaE(RESOURCE_CATEGORY_META[category].color, token);
        expect(distance, `${category} is too close to the "${name}" token`).toBeGreaterThan(12);
      }
    }
  });
});
