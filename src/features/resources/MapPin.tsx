import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, durations, timings, withAlpha } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MAP_PAPER } from '@/theme/mapStyle';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { ResourceSearchResult } from '@/services/resources';
import type { Coordinates } from '@/lib/geo';
import type { PinTier } from './pinKey';

/**
 * One place on the map, as a category-coloured teardrop standing on its own
 * coordinate — or, zoomed out, as a bare category dot (see `PinTier`). This file
 * also owns `UserPuck`, the app's own "you are here", because every constraint
 * below applies to it identically.
 *
 * The whole file is shaped by one hard-won constraint. `react-native-maps`
 * snapshots a custom marker's children into a native annotation view, and once
 * `tracksViewChanges` goes false that bitmap is frozen — after which MapKit
 * freely *recycles* annotation views as pins leave and re-enter the viewport. A
 * single shared raster timer once let a recycled view come back wearing another
 * pin's frozen bitmap, and because food is the densest category in any result
 * set, pins of every category ended up drawing the food icon. See
 * `docs/obsidian/07 Bugs/2026-07-28 Map pins all draw the food icon.md`.
 *
 * The fix, which this component implements and may not drop:
 *   1. Each pin owns its raster window, re-armed whenever *its own* appearance
 *      changes (`useRasterWindow`).
 *   2. Every input to that appearance is in the caller's React `key`, which is
 *      built by `pinKey()` in `pinKey.ts` and carries the category for exactly
 *      this reason.
 *
 * ## The one pin that moves
 *
 * `Anti-AI-Slop Design Rules.md` banned animating map pins outright. That ban is
 * **explicitly overridden by the user for the tap** — and only for the tap: an
 * opened pin blooms up to size, one marker at a time, and the field never moves.
 *
 * How it animates matters more than that it does, because two earlier attempts
 * crashed the app on every tap. Both causes are recorded here because neither is
 * reachable by any gate this project has:
 *
 *   1. A Reanimated `Animated.View` **inside** a `Marker`. `react-native-maps`
 *      snapshots marker children into a native annotation view, and a UI-thread
 *      transform bypasses the React commit that the snapshot is triggered by.
 *      Banned. The scale below is React state moved by `requestAnimationFrame`
 *      and applied as a plain style on a plain `View` — `tracksViewChanges` is
 *      documented as observing *content* changes, so the thing driving the
 *      animation has to be the thing the library is watching for.
 *   2. A React key that moved when the pin was selected. Both attempts had one:
 *      first an explicit `open` token, then — after that was reverted — the
 *      caller resolving the *drawn* tier and keying with it, which flipped a
 *      tapped dot's key `…:dot` → `…:pin`. Either way React unmounted the marker
 *      from inside that marker's own press handler. That is why `drawTier` is
 *      derived **here** and never at the call site: `tier` is the camera's, it
 *      keys the marker, and selection cannot touch it. See `pinKey.ts`.
 *
 * The cost of the mechanism that is left is ~19 re-renders of **one** memoised
 * component over `OPEN_MS`, which is what the budget below is spent on.
 *
 * The component is `memo`ised and takes `onSelect` rather than a pre-bound
 * `onPress` on purpose. The map can hold every located result at once — several
 * hundred markers in a dense ZIP — and an inline arrow from the parent would give
 * each one a fresh prop identity on every render, so opening a preview or moving
 * the camera would re-render the entire field.
 */

/**
 * Keep re-rasterizing for a beat after the pin mounts or changes appearance, so
 * the Ionicons glyph has painted before the bitmap freezes. `inputs` must list
 * every value that changes how the pin looks.
 *
 * React compares dep arrays element-wise, so passing a fresh array literal each
 * render is fine — but its **length must be constant across renders**, or React
 * warns and the comparison stops being meaningful. Never pass a spread or a
 * conditional element. The `eslint-disable` below removes the only automated
 * guard against that, which is why it is written down here.
 */
function useRasterWindow(inputs: unknown[]): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), timings.pinRaster);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, inputs);
  return tracking;
}

/**
 * How long the open animation runs.
 *
 * This is squeezed between two hard ceilings, and `durations.slow` is the largest
 * token that clears both:
 *
 *   - **`timings.pinRaster` (600ms).** A marker can only be re-snapshotted while
 *     its raster window is open, and the window re-arms on `selected`. An
 *     animation outlasting it freezes mid-flight.
 *   - **`timings.mapFocus` (350ms).** Every selection also flies the camera to
 *     `latitudeDelta: 0.05`, which is below `DOT_ABOVE_DELTA` — so the field
 *     flips `dot` → `pin` on arrival and every marker's key changes with it.
 *     The tapped pin remounts, adopts its open state instantly (see
 *     `useOpenProgress`), and anything still running is cut off there.
 *
 * So this number is not a taste decision, and raising it does not make the
 * animation longer — it makes it truncate.
 */
const OPEN_MS = durations.slow;

/** Ease-out cubic. Damped, no overshoot — the house ban on elastic easing holds
 *  here as much as anywhere, and a marker is the last place to spend frames on a
 *  bounce. The one deliberate overshoot is the glyph's, below. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * How far past its resting rim the ripple travels before it fades out, in points.
 *
 * This is also **canvas padding** — it is added to the open pin's `pad`, because
 * an `Svg` clips at its own viewport and a ring drawn outside it simply is not
 * there. That makes it the one number here with a cost attached: it widens the
 * open marker's transparent canvas, and a marker's tappable area is its whole
 * frame. 6pt buys visible travel while keeping the open pin's canvas narrower
 * than the ~33pt spacing at the zoom the camera lands on after a tap, so it does
 * not start swallowing its neighbours' taps.
 */
const RIPPLE_REACH = 6;
/** The fraction of the run the ripple gets. It is the fastest layer on purpose:
 *  it reads as the impact of the tap, so it has to be gone well before the pin
 *  has finished settling, or it reads as a second object instead. */
const RIPPLE_SPAN = 0.7;
const RIPPLE_ALPHA = 0.32;

/** The glyph's pop-then-settle, in fractions of the run. The same 1.14 overshoot
 *  the tab bar and `ReminderBell` use — this is the house's one bouncy idiom, and
 *  it is allowed on a glyph because a glyph has no edge to smear. `LEAD` is what
 *  makes the icon feel carried by the pin rather than painted on it. */
const GLYPH_LEAD = 0.14;
const GLYPH_PEAK = 0.45;
const GLYPH_FROM = 0.55;
const GLYPH_OVERSHOOT = 1.14;

const glyphScale = (p: number): number => {
  const t = clamp01((p - GLYPH_LEAD) / (1 - GLYPH_LEAD));
  return t < GLYPH_PEAK
    ? GLYPH_FROM + (GLYPH_OVERSHOOT - GLYPH_FROM) * easeOut(t / GLYPH_PEAK)
    : GLYPH_OVERSHOOT + (1 - GLYPH_OVERSHOOT) * easeOut((t - GLYPH_PEAK) / (1 - GLYPH_PEAK));
};

/**
 * The open animation's clock: 0 when the pin is closed, 1 when it is fully open,
 * moved by `requestAnimationFrame` and held in **React state** so every frame is
 * a real content change the annotation view can observe. Every animated layer
 * below is a pure function of this one number.
 *
 * Closing is deliberately instant. A close would have to interpolate between two
 * drawings that are not the same shape — at the dot tier a teardrop tipped on its
 * coordinate shrinking into a disc centred on it, which slides ~10pt sideways
 * while it goes — and the geometry swap at the end of that is the honest boundary
 * anyway. Exits are shorter than entrances by house rule; this is the limit of
 * that rule.
 *
 * A pin that *mounts* already open adopts 1 without animating. That is not an
 * edge case: the whole field remounts every time the camera crosses
 * `DOT_ABOVE_DELTA`, including on the flight that every tap triggers, and ~330
 * markers each playing an entrance is a stutter, not an animation.
 */
function useOpenProgress(selected: boolean, reduced: boolean): number {
  const [progress, setProgress] = useState(selected ? 1 : 0);
  const mounted = useRef(false);

  useEffect(() => {
    const to = selected ? 1 : 0;
    if (!mounted.current || reduced || to === 0) {
      mounted.current = true;
      setProgress(to);
      return;
    }
    let frame = 0;
    const started = Date.now();
    const step = () => {
      const t = clamp01((Date.now() - started) / OPEN_MS);
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    setProgress(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [selected, reduced]);

  return progress;
}

/** Circle radius, tip drop below the circle's centre, and halo width — the whole
 *  pin geometry, in two sizes. Selected is bigger *and* differently filled, so
 *  the open pin is findable in a field of its neighbours.
 *
 *  `rest` used to be radius 17 / tipDrop 28, which drew a 41.5x52pt marker —
 *  about half again the size of a stock MapKit pin. One of those is handsome;
 *  three hundred of them in a dense ZIP is a wall, and the map underneath stops
 *  being readable. At 13/22 the marker is ~33x42 and the field reads as places
 *  on a map rather than as a texture. `selected` deliberately did **not** shrink
 *  with it: the gap between the two is now large enough that the open pin is
 *  obvious without needing the colour change to carry it alone. */
const PIN = {
  rest: { radius: 13, tipDrop: 22, halo: 0, reach: 0, glyph: 13 },
  selected: { radius: 20, tipDrop: 33, halo: 5, reach: RIPPLE_REACH, glyph: 19 },
} as const;

const STROKE = 2;

/**
 * The zoomed-out marker: a bare category disc, no teardrop and no glyph.
 *
 * At a city-wide span a teardrop is bigger than the block it stands on, so a few
 * hundred of them overlap into a single coloured mass that hides the map and
 * tells you nothing. A disc at this size still carries the one thing that
 * survives at that zoom — which category, by hue — and lets the streets through
 * between them.
 *
 * This is **not** clustering. Every located result still gets its own marker on
 * its own coordinate at this tier, and every one is still tappable; only the
 * drawing changes. Grouping was removed on purpose on 2026-07-30.
 *
 * Its strokes are their own numbers rather than `RING`/`EDGE`, which are sized
 * for a 26pt-wide body: at 12pt across, a 5pt paper ring would leave almost no
 * category colour to see.
 */
const DOT = { radius: 6, ring: 2, edge: 3 } as const;

/**
 * The paper ring drawn *under* the coloured stroke, so the pin separates from
 * whatever it happens to be standing on.
 *
 * The body fill is `MAP_PAPER` and the muted cartography's land is barely a step
 * away from it — so without this the pin's only edge is a 2pt category stroke,
 * which a road casing or a place label swallows. Every serious map app draws
 * this ring; it costs one extra `Path` and no animation.
 */
const RING = STROKE + 3;

/**
 * A fine ink keyline outside the paper ring.
 *
 * The ring alone is not enough, and the reason is exact: paper and the map's
 * road fill are within a point or two of each other. So over a road — which is
 * precisely where places are — the ring, the pin body and the map are all the
 * same colour, and the pin is back to a 2pt category stroke for an edge. Drawn
 * *under* the ring, so only its outer ~0.75pt shows.
 */
const EDGE = RING + 1.5;
const EDGE_COLOR = withAlpha(colors.textPrimary, 0.14);

/**
 * The contact shadow under the tip: what makes the pin stand on the map rather
 * than float over it. Soft, tiny, and a transparency of the same ink as every
 * other shadow in the system rather than a hardcoded rgba.
 *
 * `drop` matters. Centred exactly on the tip, the ring's own 5pt round cap sat
 * on top of the ellipse and punched a paper disc out of its middle, leaving two
 * grey whiskers either side of the point instead of a shadow.
 */
const SHADOW = {
  rx: 7,
  ry: 2,
  drop: 1.5,
  fill: withAlpha(colors.textPrimary, 0.18),
} as const;

type PinGeometry = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  /** Where the point actually lands — the marker's anchor is derived from this. */
  tipY: number;
  path: string;
};

/**
 * The teardrop outline: the major arc of the circle, closed with two straight
 * runs down to the tip.
 *
 * The tangent points are where a line from the tip just grazes the circle, so
 * the flanks meet the body without a corner. With `d` the centre-to-tip
 * distance, that contact sits at `acos(radius / d)` off the downward axis.
 *
 * The tip is the point of the whole exercise: the marker anchors on it, so the
 * pin touches the coordinate it describes. The circular pins this replaced
 * floated a half-body above their own address.
 *
 * Note `pad` clears the *ring*, not the coloured stroke — the ring is the widest
 * thing drawn — and the canvas extends below the tip to hold the contact shadow.
 * That extra room is why `tipY` is returned: the anchor is no longer the bottom
 * of the box, and hardcoding `y: 1` would push every pin off its building by the
 * height of its own shadow.
 *
 * `margin` is whatever the caller needs cleared outside the coloured stroke: the
 * halo ring's width, plus (on the open pin) the ripple's reach, because an `Svg`
 * clips at its own viewport and a ring animating outside it simply is not drawn.
 */
function pinGeometry(radius: number, tipDrop: number, margin: number): PinGeometry {
  // Clears the *widest* stroke, which is the keyline, plus half a point of
  // antialiasing headroom — that last bit is not superstition: at exactly half
  // the stroke width the outer edge lands on the canvas boundary on all four
  // sides of the rest pin (which has no margin to pad it) and gets shaved.
  const pad = margin + EDGE / 2 + 0.5;
  const cx = radius + pad;
  const cy = radius + pad;
  const tipY = cy + tipDrop;

  const alpha = Math.acos(Math.min(1, radius / tipDrop));
  const dx = radius * Math.sin(alpha);
  const dy = radius * Math.cos(alpha);
  const right = { x: cx + dx, y: cy + dy };
  const left = { x: cx - dx, y: cy + dy };

  return {
    width: cx * 2,
    // Whichever reaches lower — the keyline's round cap at the tip, or the
    // shadow — plus the same half-point of antialiasing headroom `pad` gets.
    height: tipY + Math.max(EDGE / 2, SHADOW.drop + SHADOW.ry) + 0.5,
    cx,
    cy,
    tipY,
    // Sweep 0 + large-arc 1: the long way round, over the top of the circle.
    path:
      `M ${right.x} ${right.y} ` +
      `A ${radius} ${radius} 0 1 0 ${left.x} ${left.y} ` +
      `L ${cx} ${tipY} Z`,
  };
}

/**
 * Where a marker sits in the stack.
 *
 * Two rules, in order. The open pin is always on top — it is the one the veteran
 * is reading. Everything else is ordered **south-first**, which is how depth
 * reads on a map: a pin nearer the bottom of the screen is nearer the viewer, so
 * it should occlude the one behind it rather than the other way round. Without
 * this, overlapping pins stacked in whatever order MapKit happened to add them,
 * and a fully covered pin was untappable with nothing on screen to say so.
 *
 * The x1000 is not decoration. Two pins that visually overlap at maximum zoom
 * are a few ten-thousandths of a degree apart; at a smaller multiplier they
 * round to the same value and the ordering does nothing exactly where it is
 * needed. The range this produces (0…180000 for any latitude on earth) stays
 * clear of the two reserved bands below.
 */
const Z_SELECTED = 2_000_000;
const Z_PUCK = 1_000_000;
const zForLatitude = (latitude: number) => Math.round((90 - latitude) * 1000);

export const CategoryPin = memo(function CategoryPin({
  result,
  tier,
  selected,
  onSelect,
}: {
  result: ResourceSearchResult;
  /** How much pin the *camera* earns for the whole field. This is the same value
   *  the caller passed to `pinKey`, and it must stay that way: it is the marker's
   *  identity, so nothing a tap changes may be folded into it. Whether this
   *  marker actually draws as a dot is derived below, from this plus `selected`. */
  tier: PinTier;
  selected: boolean;
  /** Takes the id rather than being pre-bound, so the prop stays referentially
   *  stable across renders and `memo` above actually holds. */
  onSelect: (id: string) => void;
}) {
  const meta = RESOURCE_CATEGORY_META[result.resource.category];
  const tracking = useRasterWindow([meta.icon, meta.color, selected, tier]);
  const reduced = useReducedMotion();
  const open = useOpenProgress(selected, reduced);

  // The open pin is always drawn in full, whatever the zoom: it is the one the
  // veteran is reading, and a dot cannot show that it is open. Derived *here* and
  // never at the call site — see the key note in this file's header.
  const dot = !selected && tier === 'dot';
  const size = selected ? PIN.selected : PIN.rest;

  // Both drawings, every render, because the animation interpolates between them:
  // the pin grows from exactly the size it was resting at, whichever tier that
  // was. The single 0.62 constant this replaces was measured for the teardrop, so
  // tapping a dot started three times too big and the pin appeared to shrink.
  const restGeo = useMemo(
    () =>
      tier === 'dot'
        ? dotGeometry()
        : pinGeometry(PIN.rest.radius, PIN.rest.tipDrop, PIN.rest.halo + PIN.rest.reach),
    [tier],
  );
  const openGeo = useMemo(
    () =>
      pinGeometry(
        PIN.selected.radius,
        PIN.selected.tipDrop,
        PIN.selected.halo + PIN.selected.reach,
      ),
    [],
  );
  const geo = selected ? openGeo : restGeo;

  // Scale, ripple and glyph are all pure functions of `open`. At rest they resolve
  // to a no-op transform and nothing extra drawn, so a closed pin costs exactly
  // what it always did.
  const popFrom = restGeo.width / openGeo.width;
  const pop = selected ? popFrom + (1 - popFrom) * easeOut(open) : 1;
  const rippleP = clamp01(open / RIPPLE_SPAN);
  const glyphPop = selected ? glyphScale(open) : 1;

  // Opening *from a dot* also has to move, not just grow, and this is the ~10pt
  // discontinuity left as a follow-up on 2026-07-31.
  //
  // A dot is centred on its coordinate; a teardrop stands its tip on it. The
  // scale above pins the tip, so without this the body leaps a third of its own
  // height upward on the first frame and then grows from there — the pin appears
  // to come from somewhere other than the dot that was tapped. Starting the
  // drawing one scaled tip-drop lower puts its *centre* exactly where the dot's
  // centre was, and easing that to zero walks it onto its point. Unscaled points,
  // and listed before the scale, so it reads as CSS does.
  const settleFromDot =
    selected && tier === 'dot' ? PIN.selected.tipDrop * pop * (1 - easeOut(open)) : 0;

  return (
    <Marker
      coordinate={{
        latitude: result.resource.latitude as number,
        longitude: result.resource.longitude as number,
      }}
      // Pins are the primary interaction on a full-screen map, so they cannot be
      // unlabelled tappables. The category is named because the hue alone is what
      // a sighted user reads it from — and at the dot tier the hue is *all* there
      // is, so the label is the only thing carrying the category at all.
      accessibilityRole="button"
      accessibilityLabel={`${result.resource.name}, ${meta.label}`}
      accessibilityHint="Opens a preview of this place"
      // The tip, not the body's middle, marks the spot. This has to be said
      // twice, because the two platforms take it differently — and `anchor`
      // alone is a **no-op on Apple Maps**, which is the only map 1.0 ships:
      // `AIRMapMarkerManager.m` exports `centerOffset` and never `anchor` (only
      // the Google Maps manager exports `anchor`). `MKAnnotationView` centres
      // itself on the coordinate, so without the offset below the pin's *body*
      // sits on the building and the tip hangs ~22pt south of it.
      //
      // `centerOffset` moves the view down for positive y; the tip is below the
      // view's centre, so the correction is negative. A dot has no tip — it is
      // centred on its coordinate — and `dotGeometry` returns `tipY` at the
      // centre, so both props fall out to no offset without a special case.
      anchor={{ x: 0.5, y: geo.tipY / geo.height }}
      centerOffset={{ x: 0, y: geo.height / 2 - geo.tipY }}
      zIndex={selected ? Z_SELECTED : zForLatitude(result.resource.latitude as number)}
      tracksViewChanges={tracking}
      onPress={(e) => {
        e.stopPropagation();
        onSelect(result.resource.id);
      }}
    >
      {/* `transformOrigin` at the tip, not the default centre. The tip is the
          part that means something — it is the coordinate the marker is standing
          on — so growing from anywhere else drags the point across the map for
          the length of the animation and lands it on a different building than
          it started over. A dot has no tip and `dotGeometry` puts `tipY` at its
          centre, so this resolves to a plain centred scale there.

          Written as the array form, with the y-offset in points, because the
          string form cannot carry this number. RN parses a `transformOrigin`
          string with `/(top|bottom|left|right|center|\d+(?:%|px)|0)/g`, which has
          no decimal branch — a tip at 90.64% of the canvas matched as the bare
          `0` (y) followed by `64327485380117%`, which landed in the z slot and
          threw on every pin tap. `tipY` is already in the units this wants. */}
      <View
        style={{
          width: geo.width,
          height: geo.height,
          transformOrigin: ['50%', geo.tipY, 0],
          transform: [{ translateY: settleFromDot }, { scale: pop }],
        }}
      >
        {dot ? (
          <Svg width={geo.width} height={geo.height}>
            {/* Keyline, paper, then the hue as a solid fill — the same three
                layers as the teardrop, at a scale where a stroked outline would
                leave no colour to read. */}
            <Circle
              cx={geo.cx}
              cy={geo.cy}
              r={DOT.radius}
              fill="none"
              stroke={EDGE_COLOR}
              strokeWidth={DOT.edge}
            />
            <Circle
              cx={geo.cx}
              cy={geo.cy}
              r={DOT.radius}
              fill="none"
              stroke={MAP_PAPER}
              strokeWidth={DOT.ring}
            />
            <Circle cx={geo.cx} cy={geo.cy} r={DOT.radius} fill={meta.color} />
          </Svg>
        ) : (
          <>
            <Svg width={geo.width} height={geo.height}>
              {/* Ground first, then the pin standing on it. Dropped below the tip
                  so the ring's round cap doesn't punch a hole through its middle. */}
              <Ellipse
                cx={geo.cx}
                cy={geo.tipY + SHADOW.drop}
                rx={SHADOW.rx}
                ry={SHADOW.ry}
                fill={SHADOW.fill}
              />
              {/* Keyline, then paper ring, then the category. Three strokes on one
                  path, widest first, so each leaves a sliver of the one beneath. */}
              <Path
                d={geo.path}
                fill="none"
                stroke={EDGE_COLOR}
                strokeWidth={EDGE}
                strokeLinejoin="round"
              />
              <Path
                d={geo.path}
                fill="none"
                stroke={MAP_PAPER}
                strokeWidth={RING}
                strokeLinejoin="round"
              />
              {/* The halo only exists on the selected pin, and it is a ring rather
                  than a glow: a soft edge would band against the map tiles. It
                  blooms outward into place rather than appearing at full width —
                  the ring is what makes the open pin findable in a dense field, so
                  it is worth the frames to let the eye catch it arriving. */}
              {size.halo > 0 ? (
                <Circle
                  cx={geo.cx}
                  cy={geo.cy}
                  r={size.radius + (size.halo / 2) * easeOut(open)}
                  fill="none"
                  stroke={withAlpha(meta.color, 0.22 * easeOut(open))}
                  strokeWidth={size.halo * easeOut(open)}
                />
              ) : null}
              {/* The ripple: one ring thrown off the pin at the moment of the tap,
                  travelling `RIPPLE_REACH` past the halo and fading as it goes.
                  It is the whole reason the open canvas carries extra padding, and
                  it is drawn *under* the body below so the pin stays the solid
                  object and this stays an echo of it. Gone by `RIPPLE_SPAN`. */}
              {selected && rippleP < 1 ? (
                <Circle
                  cx={geo.cx}
                  cy={geo.cy}
                  r={size.radius + size.halo / 2 + RIPPLE_REACH * easeOut(rippleP)}
                  fill="none"
                  stroke={withAlpha(meta.color, RIPPLE_ALPHA * (1 - rippleP))}
                  strokeWidth={STROKE}
                />
              ) : null}
              <Path
                d={geo.path}
                fill={selected ? meta.color : MAP_PAPER}
                stroke={meta.color}
                strokeWidth={STROKE}
                strokeLinejoin="round"
              />
            </Svg>
            {/* The glyph is carried by the pin rather than painted on it: it
                starts small, lands one beat behind the body, and overshoots to
                1.14 before settling — the same pop the tab bar and `ReminderBell`
                use. Scaling about its own centre, unlike the body, because a
                glyph has no tip that means anything. */}
            <View
              style={[
                styles.glyph,
                {
                  top: geo.cy - size.glyph / 2,
                  left: geo.cx - size.glyph / 2,
                  transform: [{ scale: glyphPop }],
                },
              ]}
            >
              <Ionicons
                name={meta.icon}
                size={size.glyph}
                color={selected ? colors.background : meta.color}
              />
            </View>
          </>
        )}
      </View>
    </Marker>
  );
});

/** The dot's canvas. Returns the same shape as `pinGeometry` so the `Marker`
 *  above needs no branch for its anchor: `tipY` is the centre, which resolves
 *  both anchor props to "centre on the coordinate". */
function dotGeometry(): PinGeometry {
  // Same half-point of antialiasing headroom the teardrop pads for.
  const pad = DOT.edge / 2 + 0.5;
  const c = DOT.radius + pad;
  return { width: c * 2, height: c * 2, cx: c, cy: c, tipY: c, path: '' };
}

/**
 * "You are here", in the app's own vocabulary instead of the OS blue dot.
 *
 * The stock dot is the one thing on this screen that belongs to another design
 * system, and it is olive's opposite on the colour wheel — so it read as the
 * loudest, most important thing on a map whose actual subject is the pins.
 *
 * The halo is a **halo**, not an accuracy circle: it is a fixed number of points
 * and does not scale with the camera, so it makes no claim about precision. An
 * accuracy circle that lies about accuracy is worse than none.
 *
 * Note this marker breaks no rule about animation. Its *coordinate* changes as
 * the veteran moves and MapKit slides the view accordingly, but its *bitmap*
 * never changes — which is the thing `tracksViewChanges` is about.
 */
export const UserPuck = memo(function UserPuck({ coordinate }: { coordinate: Coordinates }) {
  // Empty, and it must stay a constant-length array: nothing about how this
  // marker looks can ever change, so it rasterizes once and freezes.
  const tracking = useRasterWindow([]);
  const size = PUCK.halo * 2;
  const c = PUCK.halo;

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      // Above every place pin, below an open preview's pin. Where you are beats
      // where things are, but not the one thing you just asked about.
      zIndex={Z_PUCK}
      tracksViewChanges={tracking}
      // Not a control: it reports position and does nothing when tapped, so it
      // must not sit in the accessibility tree as an unlabelled button among a
      // few hundred labelled pins.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={PUCK.halo - 1} fill={withAlpha(colors.accent, 0.18)} />
        <Circle
          cx={c}
          cy={c}
          r={PUCK.radius}
          fill="none"
          stroke={EDGE_COLOR}
          strokeWidth={PUCK.ring + 1.5}
        />
        <Circle
          cx={c}
          cy={c}
          r={PUCK.radius}
          fill={colors.accent}
          stroke={MAP_PAPER}
          strokeWidth={PUCK.ring}
        />
      </Svg>
    </Marker>
  );
});

/** The puck's disc, its paper collar, and the soft olive field around it. */
const PUCK = { radius: 7, ring: 3, halo: 16 } as const;

const styles = StyleSheet.create({
  glyph: { position: 'absolute' },
});
