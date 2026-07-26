import type { ViewStyle } from 'react-native';
import { colors, withAlpha } from './colors';
import { radii } from './spacing';

/** Alpha-composite `color` at `amount` over a solid base (the paper surface by
 *  default) → a solid color. Use for a card/surface wash that must stay opaque
 *  and keep AA text contrast, rather than a translucent tint over the page. */
export function surfaceTint(color: string, amount = 0.06, base: string = colors.surface): string {
  const parse = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [br, bg, bb] = parse(base);
  const [cr, cg, cb] = parse(color);
  const mix = (b: number, c: number) => Math.round(b * (1 - amount) + c * amount);
  return `rgb(${mix(br, cr)}, ${mix(bg, cg)}, ${mix(bb, cb)})`;
}

/**
 * The per-category visual identity, derived from one category hue (the `color`
 * on `NEED_CATEGORY_META` / `RESOURCE_CATEGORY_META`). Category color is a
 * SEMANTIC identity layer — it says "this is healthcare / housing / legal",
 * like green means verified. It never drives actions; olive (`colors.accent`)
 * stays the single action color. Consumers pass `meta.color` in so the two
 * category metadata maps remain the only source of category hex values.
 *
 * Alphas match the tints already in use (NeedCategoryCard medallion 0.16, the
 * map legend 0.14) so everything reads as one system.
 */
export type CategoryVisual = {
  /** Full hue — the icon and any category-colored graphic. */
  color: string;
  /** Medallion / chip fill (a soft translucent tint of the hue). */
  tint: string;
};

export function categoryVisual(color: string): CategoryVisual {
  return {
    color,
    tint: withAlpha(color, 0.16),
  };
}

/** The canonical medallion container (a soft category-tinted rounded square that
 *  holds the category icon). Generalizes the NeedCategoryCard pattern; pass the
 *  `tint` from `categoryVisual` and choose a size to match the surface. */
export function medallionStyle(tint: string, size = 44): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint,
  };
}
