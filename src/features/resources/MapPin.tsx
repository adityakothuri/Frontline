import { memo, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker, type MapMarker } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, durations, radii, withAlpha } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MAP_PAPER } from '@/theme/mapStyle';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import type { ResourceSearchResult } from '@/services/resources';
import type { Coordinates } from '@/lib/geo';

/**
 * The map's markers: every place is a small category-coloured dot; tapping one
 * raises a pin out of it.
 *
 * - `CategoryDot` — one per place, and nothing about it changes after mount.
 * - `OpenPin` — a *separate* marker over the tapped dot; the only one that animates.
 *
 * Keep them separate. A field marker that changes hits these react-native-maps
 * (1.27, Apple Maps) quirks:
 *
 *   1. A marker's frame only grows: `AIRMapMarker` never shrinks it, so a dot
 *      that once drew a pin keeps an invisible pin-sized tap box.
 *   2. Marker children are appended, not inserted, so Fabric flattening a View
 *      reshuffles them. Every View here is `collapsable={false}` and nothing
 *      directly inside a marker mounts conditionally.
 *   3. SVG views get recycled between markers (wrong colours), so these are
 *      plain Views.
 *   4. Draw order follows `zIndex` but hit-testing follows subview order. Dots
 *      take no `zIndex`, and a tapped dot is deselected at once because MapKit
 *      selection adds 999 to it.
 *
 * Reanimated stays out of markers (UI-thread transforms bypass the commit the
 * marker updates from); the pin animates via React state and rAF.
 */

/** Marker stacking. Dots set none (rule 4); these sit above 999, the bump a
 *  MapKit-selected dot gets, so a pin never draws under its own dot. */
export const Z = {
  PUCK: 1500,
  CLOSING_PIN: 2900,
  OPEN_PIN: 3000,
} as const;

/** The dot: a 12pt category square in a paper ring in a faint ink keyline, so
 *  it separates from both paper-toned land and paper-coloured roads. */
const DOT = { size: 16, paper: 14, fill: 12 } as const;
const EDGE_COLOR = withAlpha(colors.textPrimary, 0.14);

/** The open pin: a 40pt category square with ring, keyline, halo, pointer and glyph. */
const PIN = {
  body: 40,
  ring: 3,
  keyline: 1,
  halo: 5,
  /** Body centre to the pointer's point. */
  tipDrop: 33,
  /** Half the pointer's width where it leaves the body. */
  foot: 9,
  glyph: 19,
} as const;

/** The pin's outer square: body + paper ring + keyline. */
const PIN_OUTER = PIN.body + (PIN.ring + PIN.keyline) * 2;

/** The pin's canvas: the outer square plus its halo, and the pointer below.
 *  `cx`/`cy` are the body's centre, `tipY` the pointer's point. */
const PIN_CANVAS = (() => {
  const half = PIN_OUTER / 2 + PIN.halo;
  const tipY = half + PIN.tipDrop;
  return { width: half * 2, height: tipY + PIN.ring, cx: half, cy: half, tipY };
})();

/** The pin's point lands at the top of the dot's fill, leaving the dot visible. */
const TIP_LIFT = DOT.size / 2 - 2;

/** The pin overflows the dot-sized marker frame upward (iOS does not clip), so
 *  the marker never resizes (rule 1) and only the dot's square is tappable. */
const PIN_OFFSET = {
  left: DOT.size / 2 - PIN_CANVAS.cx,
  top: DOT.size / 2 - TIP_LIFT - PIN_CANVAS.tipY,
} as const;

/** The pin's scale at progress 0: its body the size of the dot's fill. */
const OPEN_FROM = DOT.fill / PIN.body;

/** Offset that starts a dot-sized pin centred on the dot rather than above it,
 *  easing to zero as it rises onto its point. */
const settleFromDot = (scale: number, eased: number) =>
  (TIP_LIFT + PIN.tipDrop * scale) * (1 - eased);

/** Share of the run spent fading over the dot, so the hand-over does not pop. */
const HANDOVER = 0.3;

const OPEN_MS = durations.slow;
const CLOSE_MS = durations.fast;

/** Ease-out cubic; run backwards on close it accelerates away. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** The pin's progress, 0 (dot) to 1 (pin). Reverses from wherever it is when
 *  `open` flips; Reduce Motion jumps to the end. */
function useOpenProgress(open: boolean, reduced: boolean): number {
  const [progress, setProgress] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const to = open ? 1 : 0;
    const from = current.current;
    if (reduced || from === to) {
      current.current = to;
      setProgress(to);
      return;
    }
    // Scaled by the distance left, so a half-finished rise sinks in half the time.
    const duration = (open ? OPEN_MS : CLOSE_MS) * Math.abs(to - from);
    const started = Date.now();
    let frame = 0;
    const step = () => {
      const t = clamp01((Date.now() - started) / duration);
      const p = from + (to - from) * t;
      current.current = p;
      setProgress(p);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [open, reduced]);

  return progress;
}

const coordinateOf = (result: ResourceSearchResult) => ({
  latitude: result.resource.latitude as number,
  longitude: result.resource.longitude as number,
});

/** One place in the field. Memoised; its props never change on a tap. */
export const CategoryDot = memo(function CategoryDot({
  result,
  onSelect,
}: {
  result: ResourceSearchResult;
  /** Takes the id rather than being pre-bound, so `memo` holds. */
  onSelect: (id: string) => void;
}) {
  const meta = RESOURCE_CATEGORY_META[result.resource.category];
  const marker = useRef<MapMarker>(null);
  return (
    <Marker
      ref={marker}
      coordinate={coordinateOf(result)}
      // Names the category: on a dot the hue is the only other cue.
      accessibilityRole="button"
      accessibilityLabel={`${result.resource.name}, ${meta.label}`}
      accessibilityHint="Opens a preview of this place"
      // `anchor` (Google) and `centerOffset` (Apple) both centre it.
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      // No `zIndex`, deliberately (rule 4). Static, so no re-snapshot needed.
      tracksViewChanges={false}
      onPress={(e) => {
        e.stopPropagation();
        onSelect(result.resource.id);
        // Undo MapKit's own selection (rule 4); selection lives in React. The
        // press reaches JS after the native select, so this wins.
        marker.current?.hideCallout();
      }}
    >
      <Dot color={meta.color} />
    </Marker>
  );
});

/** The dot's three concentric squares, in one fixed 16pt frame. */
function Dot({ color }: { color: string }) {
  return (
    <View collapsable={false} style={styles.dotKeyline}>
      <View collapsable={false} style={styles.dotPaper}>
        <View collapsable={false} style={[styles.dotFill, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

/**
 * The pin raised over a tapped dot; unmounted once it has sunk back (`onClosed`).
 * Drawn as overflow of a dot-sized frame (rule 1), so taps on its body reach the
 * dots beneath. Apple Maps only: Google snapshots the frame and would clip it.
 */
export const OpenPin = memo(function OpenPin({
  result,
  open,
  onClosed,
}: {
  result: ResourceSearchResult;
  /** True while this is the selected place; false while it sinks back. */
  open: boolean;
  /** Called once the pin has sunk all the way back into its dot. */
  onClosed: (id: string) => void;
}) {
  const meta = RESOURCE_CATEGORY_META[result.resource.category];
  const reduced = useReducedMotion();
  const progress = useOpenProgress(open, reduced);
  const id = result.resource.id;

  useEffect(() => {
    if (!open && progress === 0) onClosed(id);
  }, [open, progress, onClosed, id]);

  const eased = easeOut(progress);
  const scale = OPEN_FROM + (1 - OPEN_FROM) * eased;
  const settle = settleFromDot(scale, eased);
  const shown = clamp01(progress / HANDOVER);

  return (
    <Marker
      coordinate={coordinateOf(result)}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      zIndex={open ? Z.OPEN_PIN : Z.CLOSING_PIN}
      tracksViewChanges
      onPress={(e) => e.stopPropagation()}
      // The card is what a screen reader should land on; the pin repeats it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View collapsable={false} style={styles.frame} pointerEvents="none">
        <View
          collapsable={false}
          style={[
            styles.pin,
            {
              opacity: shown,
              // Grows from its point. Array form in points: RN's string parser
              // throws on fractional percentages.
              transformOrigin: ['50%', PIN_CANVAS.tipY, 0],
              // The settle runs before the scale, in unscaled points.
              transform: [{ translateY: settle }, { scale }],
            },
          ]}
        >
          {/* A ring, not a glow: a soft edge would band against the tiles. */}
          <View
            collapsable={false}
            style={[styles.halo, { borderColor: withAlpha(meta.color, 0.22), opacity: eased }]}
          />
          {/* Pointer first, so the body's ring covers its root; the larger
              paper triangle gives it a paper edge. */}
          <View collapsable={false} style={styles.pointerPaper} />
          <View collapsable={false} style={[styles.pointerFill, { borderTopColor: meta.color }]} />
          <View collapsable={false} style={styles.pinKeyline}>
            <View collapsable={false} style={styles.pinPaper}>
              <View collapsable={false} style={[styles.pinFill, { backgroundColor: meta.color }]}>
                {/* At dot size a glyph is a smudge, so it fades in as it grows. */}
                <View collapsable={false} style={{ opacity: eased }}>
                  <Ionicons name={meta.icon} size={PIN.glyph} color={colors.background} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Marker>
  );
});

/** "You are here" in the app's palette, replacing the OS blue dot. The halo is
 *  a fixed size, not an accuracy circle, so it claims no precision. */
export const UserPuck = memo(function UserPuck({ coordinate }: { coordinate: Coordinates }) {
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      // Above every place, below an open pin.
      zIndex={Z.PUCK}
      tracksViewChanges={false}
      // Not a control, so kept out of the accessibility tree.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View collapsable={false} style={styles.puckHalo}>
        <View collapsable={false} style={styles.puckKeyline}>
          <View collapsable={false} style={styles.puckDisc} />
        </View>
      </View>
    </Marker>
  );
});

const PUCK = { disc: 20, keyline: 22, halo: 32, collar: 3 } as const;

const centred = { alignItems: 'center', justifyContent: 'center' } as const;

const styles = StyleSheet.create({
  // Each ring's radius = inner radius + ring width, so corners stay concentric.
  dotKeyline: {
    width: DOT.size,
    height: DOT.size,
    borderRadius: radii.xs + (DOT.size - DOT.fill) / 2,
    backgroundColor: EDGE_COLOR,
    ...centred,
  },
  dotPaper: {
    width: DOT.paper,
    height: DOT.paper,
    borderRadius: radii.xs + (DOT.paper - DOT.fill) / 2,
    backgroundColor: MAP_PAPER,
    ...centred,
  },
  dotFill: { width: DOT.fill, height: DOT.fill, borderRadius: radii.xs },

  frame: { width: DOT.size, height: DOT.size },
  pin: {
    position: 'absolute',
    left: PIN_OFFSET.left,
    top: PIN_OFFSET.top,
    width: PIN_CANVAS.width,
    height: PIN_CANVAS.height,
  },
  halo: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PIN_CANVAS.width,
    height: PIN_CANVAS.width,
    borderRadius: radii.md + PIN.ring + PIN.keyline + PIN.halo,
    borderWidth: PIN.halo,
  },
  pinKeyline: {
    position: 'absolute',
    left: PIN_CANVAS.cx - PIN_OUTER / 2,
    top: PIN_CANVAS.cy - PIN_OUTER / 2,
    width: PIN_OUTER,
    height: PIN_OUTER,
    borderRadius: radii.md + PIN.ring + PIN.keyline,
    backgroundColor: EDGE_COLOR,
    ...centred,
  },
  pinPaper: {
    width: PIN.body + PIN.ring * 2,
    height: PIN.body + PIN.ring * 2,
    borderRadius: radii.md + PIN.ring,
    backgroundColor: MAP_PAPER,
    ...centred,
  },
  pinFill: { width: PIN.body, height: PIN.body, borderRadius: radii.md, ...centred },
  // Border triangles: a zero-size box with a coloured top border and
  // transparent sides draws a downward triangle.
  pointerPaper: {
    position: 'absolute',
    left: PIN_CANVAS.cx - PIN.foot - PIN.ring,
    top: PIN_CANVAS.cy + PIN.body / 2,
    width: 0,
    height: 0,
    borderLeftWidth: PIN.foot + PIN.ring,
    borderRightWidth: PIN.foot + PIN.ring,
    borderTopWidth: PIN.tipDrop - PIN.body / 2 + PIN.ring,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
    borderTopColor: MAP_PAPER,
  },
  pointerFill: {
    position: 'absolute',
    left: PIN_CANVAS.cx - PIN.foot,
    top: PIN_CANVAS.cy + PIN.body / 2,
    width: 0,
    height: 0,
    borderLeftWidth: PIN.foot,
    borderRightWidth: PIN.foot,
    borderTopWidth: PIN.tipDrop - PIN.body / 2,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
  },

  puckHalo: {
    width: PUCK.halo,
    height: PUCK.halo,
    borderRadius: PUCK.halo / 2,
    backgroundColor: withAlpha(colors.accent, 0.18),
    ...centred,
  },
  puckKeyline: {
    width: PUCK.keyline,
    height: PUCK.keyline,
    borderRadius: PUCK.keyline / 2,
    backgroundColor: EDGE_COLOR,
    ...centred,
  },
  puckDisc: {
    width: PUCK.disc,
    height: PUCK.disc,
    borderRadius: PUCK.disc / 2,
    borderWidth: PUCK.collar,
    borderColor: MAP_PAPER,
    backgroundColor: colors.accent,
  },
});
