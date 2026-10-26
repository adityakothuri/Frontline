import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, LayoutChangeEvent, Platform, StyleSheet } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { AppText, EmptyState, Glyph, PressableScale } from '@/components';
import { colors, durations, pressScale, radii, spacing, springs, stagger, timings } from '@/theme';
import { fadeIn, fadeOut, settleIn, sinkOut } from '@/theme/motionPresets';
import { mapStyle, MAP_CHROME_EDGE, MAP_PAPER } from '@/theme/mapStyle';
import { tapSelection } from '@/lib/haptics';
import { resourceToNeedCategory, type ResourceSearchResult } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { useUserLocation, geocodeZip, resolveZipCentroid } from '@/services/location';
import type { Coordinates } from '@/lib/geo';
import type { NeedCategory } from '@/types/need';
import { CategoryDot, OpenPin, UserPuck } from './MapPin';
import { pinKey } from './pinKey';
import { ResourcePreview } from './ResourcePreview';

// Zoom limits (map region deltas, in degrees): how far the +/- buttons can go.
const MIN_DELTA = 0.004; // closest zoom-in
const MAX_DELTA = 80; // widest zoom-out

/** The span the camera flies to when a pin is focused — unless the veteran is
 *  already closer, in which case it keeps their zoom. */
const FOCUS_DELTA = 0.05;

export type ResourceMapProps = {
  results: ResourceSearchResult[];
  /** The searched need category, when the map is scoped to one (Results). Omitted
   *  on the general Map tab, where each pin's category is derived from its resource. */
  needCategory?: NeedCategory;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Height of chrome floating over the top of the map; the camera and map furniture stay clear of it. */
  topInset?: number;
  /** Height of chrome floating over the bottom of the map. Excludes the preview
   *  card, which measures itself and stacks on top of this inset. */
  bottomInset?: number;
  /** Bump to re-fit the camera to the current pins, e.g. after the ZIP changes
   *  under a mounted map. Otherwise the camera is framed once, on ready. */
  fitToken?: number;
};

// Wide-US fallback for the instant before any pin exists.
const FALLBACK_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 40,
  longitudeDelta: 40,
};

/** Breathing room around the pins when the camera fits them all, on top of
 *  whatever chrome the screen reports. */
const FIT_PADDING = { top: 40, right: 60, bottom: 120, left: 60 };

/** Three 48pt cells in one housing; bounds how far the stack may lift. */
const CONTROL_CELL = 48;
const CONTROL_STACK_HEIGHT = CONTROL_CELL * 3;

// Map view of the same result set as the list: one pin per located resource,
// with phone/online-only resources counted in a note instead.
//
// Several hundred markers stay cheap only while no state changes as the camera
// moves (the region lives in a ref) and `CategoryDot` gets a stable `onSelect`
// and no selection prop. Break either and every marker re-renders on every pan.
export function ResourceMap({
  results,
  needCategory,
  selectedId,
  onSelect,
  topInset = 0,
  bottomInset = 0,
  fitToken = 0,
}: ResourceMapProps) {
  const mapRef = useRef<MapView>(null);
  const { profile } = useProfile();
  // Track position only while focused: expo-router keeps tabs mounted, so the
  // GPS watch would otherwise keep running behind other tabs.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { status, locate, coordinates } = useUserLocation(profile?.zip, focused);
  const [hint, setHint] = useState<string | null>(null);
  const [recentering, setRecentering] = useState(false);
  // Two readiness signals, deliberately separate.
  // `ready`: the native map is up. Pins, the puck and camera commands must wait
  // for it — on Android a Marker added earlier is a native crash, and camera
  // calls are silently dropped. Never let a timer set it.
  // `revealed`: the paper veil has lifted — with `ready`, or after
  // `timings.mapReadyBudget` so a slow map is shown standing up, not hidden.
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Bounds the control lift; also gates the reveal fallback and the first fit.
  const [mapHeight, setMapHeight] = useState(0);
  // Located results, deduplicated by id. `search_resources` unions in referrals,
  // so the same resource can arrive twice — two markers with one React key.
  const located = useMemo(() => {
    const seen = new Set<string>();
    return results.filter((r) => {
      if (r.resource.latitude === null || r.resource.longitude === null) return false;
      if (seen.has(r.resource.id)) return false;
      seen.add(r.resource.id);
      return true;
    });
  }, [results]);
  const offMapCount = results.length - located.length;

  // Pins raised over tapped dots: the open one plus any still sinking. Kept
  // apart from the dots so selection never changes the marker field.
  const [pins, setPins] = useState<string[]>([]);
  const locatedById = useMemo(() => new Map(located.map((r) => [r.resource.id, r])), [located]);
  // The selected place gets a pin; every other pin sinks. Returns `prev` when
  // nothing changed so a refetch does not reorder the pin markers.
  useEffect(() => {
    setPins((prev) => {
      const onMap = prev.filter((id) => locatedById.has(id));
      const wantsPin = selectedId !== null && locatedById.has(selectedId);
      if (wantsPin && onMap[onMap.length - 1] === selectedId) {
        return onMap.length === prev.length ? prev : onMap;
      }
      const sinking = onMap.filter((id) => id !== selectedId);
      return wantsPin ? [...sinking, selectedId as string] : sinking;
    });
  }, [selectedId, locatedById]);
  const dropPin = useCallback(
    (id: string) => setPins((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : prev)),
    [],
  );

  // First paint centers on the first pinned result; fitToPins refines on ready.
  const initialRegion = useMemo<Region>(() => {
    const first = located[0]?.resource;
    if (!first || first.latitude === null || first.longitude === null) return FALLBACK_REGION;
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      latitudeDelta: 0.4,
      longitudeDelta: 0.4,
    };
  }, [located]);

  // Live map region as a ref, not state: the zoom buttons read it synchronously,
  // and keeping it out of state means camera moves re-render nothing.
  const regionRef = useRef<Region>(initialRegion);

  // Fly the camera to a selected pin, once per id. `located` must stay in the
  // deps (a focus id can arrive before its results), and `focusedRef` stops a
  // filter toggle or refetch from snapping the camera back.
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      focusedRef.current = null;
      return;
    }
    if (!ready || focusedRef.current === selectedId) return;
    const target = located.find((r) => r.resource.id === selectedId);
    if (!target) return;
    focusedRef.current = selectedId;
    // Zoom in to street level, never out, so a closer user zoom is kept.
    const span = Math.min(regionRef.current.latitudeDelta, FOCUS_DELTA);
    mapRef.current?.animateToRegion(
      {
        latitude: target.resource.latitude as number,
        longitude: target.resource.longitude as number,
        latitudeDelta: span,
        longitudeDelta: span,
      },
      timings.mapFocus,
    );
  }, [selectedId, located, ready]);

  const fitToPins = ({ animated = false }: { animated?: boolean } = {}) => {
    // A selected pin in this set owns the camera (the focus effect handles it).
    if (located.length === 0) return;
    const hasSelectedPin = selectedId !== null && located.some((r) => r.resource.id === selectedId);
    if (hasSelectedPin) return;
    // A single pin is a zero-area fit on both platforms, which zooms to maximum.
    const first = located[0].resource;
    if (located.length === 1) {
      mapRef.current?.animateToRegion(
        {
          latitude: first.latitude as number,
          longitude: first.longitude as number,
          latitudeDelta: FOCUS_DELTA,
          longitudeDelta: FOCUS_DELTA,
        },
        timings.mapFocus,
      );
      return;
    }
    mapRef.current?.fitToCoordinates(
      located.map((r) => ({
        latitude: r.resource.latitude as number,
        longitude: r.resource.longitude as number,
      })),
      {
        edgePadding: {
          ...FIT_PADDING,
          top: FIT_PADDING.top + topInset,
          bottom: FIT_PADDING.bottom + bottomInset,
        },
        animated,
      },
    );
  };

  // Re-frame when the token changes. Skipped on the first run, which would race
  // the initial fit below.
  const fitTokenRef = useRef(fitToken);
  useEffect(() => {
    if (fitTokenRef.current === fitToken) return;
    fitTokenRef.current = fitToken;
    if (!ready) return;
    fitToPins({ animated: true });
    // The token is the trigger; `fitToPins` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, ready]);

  // Lift the veil with readiness, or on the budget once the container has a
  // size (a mount-time timer could fire over a zero-height map).
  useEffect(() => {
    if (revealed) return;
    if (ready) {
      setRevealed(true);
      return;
    }
    if (mapHeight === 0) return;
    const timer = setTimeout(() => setRevealed(true), timings.mapReadyBudget);
    return () => clearTimeout(timer);
  }, [ready, revealed, mapHeight]);

  // First framing, once, when the map is ready *and* measured:
  // `fitToCoordinates` against an unmeasured frame fits nothing.
  const framedRef = useRef(false);
  useEffect(() => {
    if (framedRef.current || !ready || mapHeight === 0) return;
    framedRef.current = true;
    fitToPins();
    // Same reasoning as the token effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mapHeight]);

  // Zoom by scaling the current region's span (factor < 1 zooms in), clamped.
  const zoomBy = (factor: number) => {
    const r = regionRef.current;
    const clamp = (d: number) => Math.min(MAX_DELTA, Math.max(MIN_DELTA, d * factor));
    const next = {
      latitude: r.latitude,
      longitude: r.longitude,
      latitudeDelta: clamp(r.latitudeDelta),
      longitudeDelta: clamp(r.longitudeDelta),
    };
    // Record the target now: `animateToRegion` emits no region changes until
    // the flight ends, so a quick second tap would otherwise repeat this target.
    regionRef.current = next;
    mapRef.current?.animateToRegion(next, timings.mapZoom);
  };

  const recenter = async () => {
    setHint(null);
    setRecentering(true);
    try {
      // Center on the ZIP the search used, not GPS (a stale fix can be another
      // city): backend centroid, then OS geocoder, then GPS only without a ZIP.
      let target: Coordinates | null = null;
      if (profile?.zip) {
        target = await resolveZipCentroid(profile.zip);
        if (!target) target = await geocodeZip(profile.zip);
      }
      if (!target) target = await locate();
      if (target) {
        mapRef.current?.animateToRegion(
          { ...target, latitudeDelta: 0.08, longitudeDelta: 0.08 },
          timings.mapFocus,
        );
      } else {
        setHint(
          profile?.zip
            ? 'Couldn’t find that ZIP right now.'
            : 'Turn on location, or add a ZIP in your profile, to recenter.',
        );
      }
    } finally {
      setRecentering(false);
    }
  };

  const selected = results.find((r) => r.resource.id === selectedId) ?? null;

  // Stable callback so `CategoryDot`'s memo holds; never inline it at the marker.
  const selectPin = useCallback(
    (id: string) => {
      tapSelection();
      onSelect(id);
    },
    [onSelect],
  );

  // The controls ride above the preview card, lifted by its measured height.
  const [previewHeight, setPreviewHeight] = useState(0);
  // Whether the control stack can actually clear the chrome below it.
  const [controlsClear, setControlsClear] = useState(true);
  const lift = useSharedValue(0);
  // So the lift's delay applies only to a card arriving.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    // Clamped so the controls never lift behind the top chrome.
    const headroom = mapHeight - topInset - CONTROL_STACK_HEIGHT - spacing.xl * 2;
    // A sum: the card stacks on top of the bottom chrome.
    const wanted = selected ? bottomInset + previewHeight + spacing.md : bottomInset;
    // Reanimated resolves this straight to the end value under Reduce Motion.
    const opening = selected !== null && !wasOpenRef.current;
    wasOpenRef.current = selected !== null;
    if (wanted > headroom) {
      // Docked top corner (lift unused). Park at the closed position unanimated
      // so it reappears in place when the card closes.
      lift.set(Math.max(0, Math.min(bottomInset, headroom)));
    } else {
      // Delayed one `stagger.step` when a card opens, to move with the card.
      const to = Math.max(0, Math.min(wanted, headroom));
      lift.set(withDelay(opening ? stagger.step : 0, withSpring(to, springs.settle)));
    }
    // If it cannot clear the chrome it would sit untappable behind the card, so
    // it docks to the top corner instead.
    setControlsClear(wanted <= headroom);
  }, [selected, previewHeight, mapHeight, topInset, bottomInset, lift]);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.get() }] }));

  // Once mounted, keep the MapView even with zero pins: remounting throws away
  // the user's camera. The empty state only shows before a map has existed.
  if (located.length === 0 && !ready) {
    return (
      // No action: Results has the list toggle; the Map tab handles this upstream.
      <EmptyState
        title="Phone & online only"
        message="These resources don’t have a map location — reach them by phone or online."
      />
    );
  }

  return (
    <View
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height)}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        // Muted cartography so markers carry the colour; Android uses the JSON
        // style, which MapKit ignores.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? mapStyle : undefined}
        // The app is light-only; keep the map light in device dark mode.
        userInterfaceStyle="light"
        // Keeps the legal link and compass clear of floating chrome.
        mapPadding={{
          top: topInset,
          right: 0,
          bottom: bottomInset + (selected ? previewHeight + spacing.md : 0),
          left: 0,
        }}
        // Either marks the map usable. `onMapLoaded` is Google-only (no-op on
        // Apple Maps).
        onMapReady={() => setReady(true)}
        onMapLoaded={() => setReady(true)}
        // Ref only — no state, so panning re-renders no markers.
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
        }}
        onPress={() => {
          onSelect(null);
          setHint(null);
        }}
        // Drawn by `UserPuck` instead; the OS blue dot clashes with the pins.
        showsUserLocation={false}
        showsPointsOfInterests={false}
        // Android extras: we ship our own recenter button and don't want the
        // Google directions toolbar taking over on a marker tap.
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {/* Gated on `ready` (Android crash otherwise). Read `pinKey.ts` before
            changing the key. */}
        {ready
          ? located.map((result) => (
              <CategoryDot key={pinKey(result)} result={result} onSelect={selectPin} />
            ))
          : null}

        {/* Keyed by place, so re-selecting a sinking pin reverses it. */}
        {ready
          ? pins.map((id) => {
              const result = locatedById.get(id);
              return result ? (
                <OpenPin
                  key={`pin:${id}`}
                  result={result}
                  open={id === selectedId}
                  onClosed={dropPin}
                />
              ) : null;
            })
          : null}

        {ready && coordinates ? <UserPuck coordinate={coordinates} /> : null}
      </MapView>

      {/* Paper veil over the map until it is revealed. An overlay, not an
          entering animation: an MKMapView mounted inside a layout animation can
          paint blank on first open. */}
      {revealed ? null : (
        <Animated.View
          exiting={fadeOut(durations.reveal)}
          pointerEvents="none"
          style={styles.veil}
        />
      )}

      {offMapCount > 0 ? (
        <View style={[styles.note, { top: topInset + spacing.sm }]}>
          {/* Bounded and clamped so large type cannot run off both edges. */}
          <AppText
            variant="caption"
            color="textSecondary"
            numberOfLines={2}
            style={styles.noteText}
          >
            {offMapCount} phone/online {offMapCount === 1 ? 'resource' : 'resources'} not shown on
            the map
          </AppText>
        </View>
      ) : null}

      {/* Bottom-right, lifted clear of the chrome; docks under the top chrome
          when there is no room. Keyed by position so a move crossfades;
          `skipEntering` keeps the fade off first paint. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View
          key={controlsClear ? 'lifted' : 'docked'}
          entering={fadeIn()}
          exiting={fadeOut()}
          style={[styles.controls, controlsClear ? liftStyle : { top: topInset + spacing.lg }]}
          pointerEvents="box-none"
        >
          <>
            {hint ? (
              <View style={styles.hint}>
                <AppText variant="caption" color="textSecondary">
                  {hint}
                </AppText>
              </View>
            ) : null}
            {/* Recenter is olive: the only one of the three that is an action. */}
            <View style={styles.controlStack}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                onPress={() => zoomBy(0.5)}
                scaleTo={pressScale.control}
                style={styles.controlCell}
              >
                <Glyph name="plus" size={22} />
              </PressableScale>
              <View style={styles.controlDivider} />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                onPress={() => zoomBy(2)}
                scaleTo={pressScale.control}
                style={styles.controlCell}
              >
                <Glyph name="minus" size={22} />
              </PressableScale>
              <View style={styles.controlDivider} />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Recenter the map on your ZIP code"
                onPress={recenter}
                disabled={status === 'locating' || recentering}
                scaleTo={pressScale.control}
                style={styles.controlCell}
              >
                {status === 'locating' || recentering ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Glyph name="locate" size={22} color={colors.accent} />
                )}
              </PressableScale>
            </View>
          </>
        </Animated.View>
      </LayoutAnimationConfig>

      {selected ? (
        // Animated on this wrapper because it is the node that unmounts; one
        // `stagger.step` behind the pin's bloom.
        <Animated.View
          entering={settleIn().delay(stagger.step)}
          exiting={sinkOut()}
          style={[styles.preview, { bottom: bottomInset + spacing.md }]}
          onLayout={(e: LayoutChangeEvent) => setPreviewHeight(e.nativeEvent.layout.height)}
          // Without this, VoiceOver must swipe past every marker to reach the card.
          accessibilityViewIsModal
        >
          {/* Unkeyed: switching pins swaps the contents in place. */}
          <ResourcePreview
            result={selected}
            needCategory={needCategory ?? resourceToNeedCategory(selected.resource.category)}
            onClose={() => onSelect(null)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
  controlStack: {
    borderRadius: radii.sm,
    backgroundColor: MAP_PAPER,
    borderWidth: 1,
    borderColor: MAP_CHROME_EDGE,
    overflow: 'hidden',
  },
  controlCell: {
    width: CONTROL_CELL,
    height: CONTROL_CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  note: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: MAP_PAPER,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: MAP_CHROME_EDGE,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  noteText: { flexShrink: 1 },
  // `bottom` is set at the render site from `bottomInset`.
  preview: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  controls: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  hint: {
    maxWidth: 220,
    backgroundColor: MAP_PAPER,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: MAP_CHROME_EDGE,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
