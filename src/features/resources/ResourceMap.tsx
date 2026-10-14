import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, LayoutChangeEvent, Platform, StyleSheet } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, EmptyState, PressableScale } from '@/components';
import { colors, pressScale, radii, shadows, spacing, springs, timings } from '@/theme';
import { mapStyle, MAP_CHROME_EDGE, MAP_PAPER } from '@/theme/mapStyle';
import { tapSelection } from '@/lib/haptics';
import { resourceToNeedCategory, type ResourceSearchResult } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { useUserLocation, geocodeZip, resolveZipCentroid } from '@/services/location';
import type { Coordinates } from '@/lib/geo';
import type { NeedCategory } from '@/types/need';
import { CategoryPin, UserPuck } from './MapPin';
import { pinKey, type PinTier } from './pinKey';
import { ResourcePreview } from './ResourcePreview';

// Zoom limits (map region deltas, in degrees): how far the +/- buttons can go.
const MIN_DELTA = 0.004; // closest zoom-in
const MAX_DELTA = 80; // widest zoom-out

/**
 * The latitude span above which pins stop being teardrops and become dots.
 *
 * 0.12 degrees is roughly 13km top to bottom — about the point where a city
 * stops fitting on the screen. Below it you are looking at a neighbourhood and
 * want to know *what* each place is; above it you are looking at a metro and the
 * only question a marker can still answer is *where* and *what kind*.
 */
const DOT_ABOVE_DELTA = 0.12;

/** Which tier a given latitude span earns. One function so the threshold is
 *  applied identically by the camera callback and by the initial fit. */
const tierForSpan = (latitudeDelta: number): PinTier =>
  latitudeDelta > DOT_ABOVE_DELTA ? 'dot' : 'pin';

export type ResourceMapProps = {
  results: ResourceSearchResult[];
  /** The searched need category, when the map is scoped to one (Results). Omitted
   *  on the general Map tab, where each pin's category is derived from its resource. */
  needCategory?: NeedCategory;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Height of any chrome floating over the top of the map (the Map tab's
   *  header). Keeps the camera, the platform's own map furniture and the off-map
   *  note out from underneath it. */
  topInset?: number;
  /** Height of any chrome floating over the *bottom* of the map (the Map tab's
   *  category rail). The preview card is **not** included: it reports its own
   *  height separately, and the two are summed rather than swapped — a card opens
   *  on top of the rail rather than replacing it. */
  bottomInset?: number;
  /**
   * Bump to re-fit the camera to the current pins.
   *
   * The camera is otherwise framed exactly once, on `onMapReady`. That was fine
   * when the ZIP could not change under a live map; it no longer is. Editing the
   * ZIP in Profile swaps the entire result set while this component stays
   * mounted — and without this the map keeps its old camera and shows a stretch
   * of the old city with no pins on it.
   */
  fitToken?: number;
};

// Wide-US fallback for the instant before any pin exists (with zero located
// results the map isn't rendered at all, so this is rarely seen). The real
// first-paint region derives from the data — no seed-city dependency.
const FALLBACK_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 40,
  longitudeDelta: 40,
};

/** Breathing room around the pins when the camera fits them all, on top of
 *  whatever chrome the screen reports. */
const FIT_PADDING = { top: 40, right: 60, bottom: 120, left: 60 };

/** Three 48pt cells in one housing. Used to bound how far the stack may lift
 *  before it would disappear under the chrome. */
const CONTROL_CELL = 48;
const CONTROL_STACK_HEIGHT = CONTROL_CELL * 3;

// The map view of the same result set as the list. Every located resource gets
// its own pin — nothing is grouped or thinned, so what you see is what was found
// — while phone/online-only resources (no coordinates) can't be pinned and are
// surfaced as a note instead of silently dropped.
//
// Holding several hundred markers at once is affordable because of two things
// that have to stay true: this component keeps no state that changes while the
// camera moves (the region lives in a ref), and `CategoryPin` is memoised on a
// stable `onSelect`. Reintroduce either — a region in state, an inline arrow —
// and every pin on the map re-renders on every pan.
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
  // Only track position while this map is the screen in front of the veteran.
  // Tabs stay mounted in expo-router, so without this the watch would keep
  // running on Home, Discover, Saved and Profile — GPS for a puck nobody is
  // looking at.
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
  // Gate the focus animation: an animateToRegion issued before the native map is
  // ready can be dropped (notably on Android), so we wait for onMapReady.
  const [mapReady, setMapReady] = useState(false);
  // The map's own height — what bounds how far the controls may lift.
  const [mapHeight, setMapHeight] = useState(0);
  // How much pin the current zoom earns. This is the *only* piece of camera
  // state allowed to live in React, and it earns that by changing at most twice
  // per zoom journey rather than once per frame — see the setter below.
  const [pinTier, setPinTier] = useState<PinTier>('pin');
  // Located results, deduplicated by id.
  //
  // The dedupe is not defensive tidying. `search_resources` unions a referral set
  // into its rows, so the same resource can legitimately come back twice — and
  // two rows sharing an id produce two markers sharing a React key, which is the
  // exact condition `pinKey` exists to prevent. Adding the category to the key
  // does not cover it, because a duplicate is the *same* resource in the *same*
  // category. Filtering here rather than at the key means the count the screen
  // reports and the pins it draws also agree.
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

  // The live map region, deliberately a ref and *not* state. The zoom buttons
  // read it synchronously to scale the current view and cannot wait for a
  // render — and nothing else needs it, so nothing re-renders as the camera
  // moves. It used to be mirrored in state to drive the clustering grid, which
  // meant every marker on the map re-rendered on every pan.
  const regionRef = useRef<Region>(initialRegion);

  // When a pin is selected from outside (a card's "See in map", or the Map tab's
  // ?focus= param), glide the camera to it. The preview for `selected` renders
  // below, so the veteran lands on the pin with its card already open.
  //
  // `located` has to stay in the deps — a focus id can arrive before the results
  // it refers to — but it is a fresh array on every filter toggle and every
  // background refetch. Without `focusedRef`, hiding an unrelated category while
  // a pin was open snapped the camera back to that pin and threw away wherever
  // the veteran had panned. Each id is flown to once.
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      focusedRef.current = null;
      return;
    }
    if (!mapReady || focusedRef.current === selectedId) return;
    const target = located.find((r) => r.resource.id === selectedId);
    if (!target) return;
    focusedRef.current = selectedId;
    mapRef.current?.animateToRegion(
      {
        latitude: target.resource.latitude as number,
        longitude: target.resource.longitude as number,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      timings.mapFocus,
    );
  }, [selectedId, located, mapReady]);

  const fitToPins = ({ animated = false }: { animated?: boolean } = {}) => {
    // A pre-selected pin *that exists in this set* owns the camera (the focus
    // effect zooms to it); don't fight it by fitting all pins on map-ready. But
    // if the focus id isn't in this dataset, still fit everything — never leave
    // the map parked on an arbitrary initial region.
    if (located.length === 0) return;
    const hasSelectedPin = selectedId !== null && located.some((r) => r.resource.id === selectedId);
    if (hasSelectedPin) return;
    // One pin is a degenerate fit on both platforms — a zero-area rect on iOS, a
    // zero-area LatLngBounds on Android — and both resolve to maximum zoom, which
    // lands on the roof of the building rather than in its neighbourhood. A thin
    // category in a rural ZIP hits this routinely.
    const first = located[0].resource;
    if (located.length === 1) {
      setPinTier(tierForSpan(0.05));
      mapRef.current?.animateToRegion(
        {
          latitude: first.latitude as number,
          longitude: first.longitude as number,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        timings.mapFocus,
      );
      return;
    }
    const latitudes = located.map((r) => r.resource.latitude as number);
    // The tier for the very first paint, computed from the data rather than
    // waited for from the camera. `fitToCoordinates` does not report the region
    // it settled on, and whether a non-animated fit emits
    // `onRegionChangeComplete` at all is a platform detail we would rather not
    // depend on — so the fit's own span decides, and the callback below only
    // ever has to handle what the veteran does afterwards.
    setPinTier(tierForSpan(Math.max(...latitudes) - Math.min(...latitudes)));
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

  // Re-frame the camera when the screen says the *place* changed, not merely the
  // pins. Skipped on the first run: `onMapReady` already fits, and doing it twice
  // races the initial fit against itself.
  const fitTokenRef = useRef(fitToken);
  useEffect(() => {
    if (fitTokenRef.current === fitToken) return;
    fitTokenRef.current = fitToken;
    if (!mapReady) return;
    fitToPins({ animated: true });
    // `fitToPins` is redefined every render and is intentionally not a
    // dependency; the token is the trigger, and it closes over the current
    // `located` because this effect re-runs after the results that changed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, mapReady]);

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
    // Record the target now, not when the camera lands. `animateToRegion` sets
    // `ignoreRegionChanges` natively and emits nothing until the flight ends, so
    // for the whole 180ms `regionRef` would still hold the pre-tap region — and a
    // second tap inside that window would compute the identical target and do
    // nothing. Double-tapping a zoom control is completely ordinary.
    regionRef.current = next;
    mapRef.current?.animateToRegion(next, timings.mapZoom);
  };

  const recenter = async () => {
    setHint(null);
    setRecentering(true);
    try {
      // The ZIP the veteran chose is the map's frame of reference — every pin is
      // near it — so center on the ZIP centroid, not device GPS (which on a
      // simulator or a stale fix can be a different city). Prefer the backend
      // zip_centroids table (exactly what search uses), then the OS geocoder,
      // then GPS only when there's no ZIP at all.
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

  // Wrapped once, here, rather than inline at the marker. `onSelect` is the
  // parent's setter and is referentially stable, so this is too — which is the
  // whole reason `CategoryPin`'s `memo` holds across a few hundred markers.
  // An inline arrow at the call site would hand every pin a fresh prop identity
  // on every render and undo it.
  const selectPin = useCallback(
    (id: string) => {
      tapSelection();
      onSelect(id);
    },
    [onSelect],
  );

  // The zoom and recenter controls used to be *replaced* by the preview card,
  // which meant tapping a pin cost you the ability to zoom around it. They now
  // ride above the card instead, lifted by however tall it turned out to be.
  const [previewHeight, setPreviewHeight] = useState(0);
  // Whether the control stack can actually clear the chrome below it.
  const [controlsClear, setControlsClear] = useState(true);
  const lift = useSharedValue(0);
  useEffect(() => {
    // Clamped, because an unclamped lift pushes the controls up *behind the
    // chrome*, where they are invisible and untappable. On a 4.7" screen a tall
    // card (two-line name, wrapped source row, three pills) plus one step of
    // Dynamic Type already got within 14pt of the header. The floor is what the
    // viewport can actually give: whatever is left between the chrome and the
    // stack's own height.
    const headroom = mapHeight - topInset - CONTROL_STACK_HEIGHT - spacing.xl * 2;
    // A **sum**, not a choice. The card and whatever chrome the screen reports
    // below the map are both on screen at once — the card stacks on top of the
    // Map tab's category rail rather than replacing it, which is what the sheet
    // it replaced used to do.
    const wanted = selected ? bottomInset + previewHeight + spacing.md : bottomInset;
    // Reanimated resolves this straight to the end value under Reduce Motion.
    lift.set(withSpring(Math.max(0, Math.min(wanted, headroom)), springs.settle));
    // Clamped below what the chrome needs means the stack cannot clear it: on a
    // short screen with accessibility-sized chrome it ends up parked behind the
    // card, nominally on screen and completely untappable. It moves to the top
    // corner instead — see `controlsClear` at the render site. Withdrawing it
    // entirely was the previous answer and is worse now that this sums, because
    // the clamp binds routinely rather than rarely.
    setControlsClear(wanted <= headroom);
  }, [selected, previewHeight, mapHeight, topInset, bottomInset, lift]);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.get() }] }));

  // A map that has had pins keeps its `MapView` even when it currently has none.
  //
  // Tearing the native map down and rebuilding it throws the camera away: the
  // remount re-runs `initialRegion` and `fitToPins`, so switching every category
  // off and one back on used to drop the veteran back at fit-all, losing wherever
  // they had panned and zoomed. This is the same failure the loading gate was
  // written to avoid, and it was arriving through a different branch.
  //
  // The empty state is still right the *first* time — a result set with no
  // coordinates at all has no map to show and never will. `mapReady` is the test
  // for "has one already": it can only be true if a `MapView` mounted and the
  // native map finished standing up, and it survives every prop change short of
  // this component unmounting.
  if (located.length === 0 && !mapReady) {
    return (
      // No action here: on Results the list is one toggle away, and the Map tab
      // catches this case before it reaches us (`nothingMappable` in `map.tsx`),
      // with an exit into Discover.
      <EmptyState
        icon="call-outline"
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
        // Apple's muted map type is built for exactly this: it desaturates the
        // cartography so markers carry the colour. Android gets the same
        // intention through the JSON style, which MapKit ignores.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? mapStyle : undefined}
        // The app has one theme. A device in dark mode should not get a dark map
        // behind paper-coloured chrome.
        userInterfaceStyle="light"
        // Keeps the platform's own furniture (Apple's legal link, the compass,
        // the user-location dot) clear of whatever floats over the top.
        mapPadding={{
          top: topInset,
          right: 0,
          bottom: bottomInset + (selected ? previewHeight + spacing.md : 0),
          left: 0,
        }}
        onMapReady={() => {
          setMapReady(true);
          fitToPins();
        }}
        // A ref assignment, and one comparison that almost never commits. No
        // other state changes here, so panning the map re-renders no markers.
        // See the note on `regionRef` above.
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
          // Returning the previous value is React's own bail-out: identical
          // state skips the render entirely. So this costs one comparison per
          // gesture and re-renders the field only on the two or three frames in
          // a session where the zoom actually crosses the threshold — which is
          // exactly when every marker *should* be redrawn.
          setPinTier((prev) => {
            const next = tierForSpan(r.latitudeDelta);
            return prev === next ? prev : next;
          });
        }}
        onPress={() => {
          onSelect(null);
          setHint(null);
        }}
        // Our own puck instead of the OS blue dot: see `UserPuck`. The stock dot
        // is the one element on this screen belonging to another design system,
        // and it is olive's opposite on the wheel, so it out-shouted the pins.
        showsUserLocation={false}
        showsPointsOfInterests={false}
        // Android extras: we ship our own recenter button and don't want the
        // Google directions toolbar taking over on a marker tap.
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {/* Every located place, one pin each — held back until the map is ready
            so a few hundred markers don't rasterize while MapKit is still
            standing itself up. `pinKey` carries the category and the tier on
            purpose; read it before changing this key. */}
        {/* `pinTier` — the camera's tier for the whole field — feeds the key and
            the prop, and nothing else does. An open pin still draws as a full
            teardrop at any zoom, but `CategoryPin` derives that itself from
            `selected`; resolving it *here* and keying the marker with it meant
            tapping a dot flipped its key `…:dot` → `…:pin`, unmounting the marker
            from inside its own press handler. Red screen on every tap from any
            zoomed-out view. Read `pinKey.ts` before touching this line. */}
        {mapReady
          ? located.map((result) => (
              <CategoryPin
                key={pinKey(result, pinTier)}
                result={result}
                tier={pinTier}
                selected={result.resource.id === selectedId}
                onSelect={selectPin}
              />
            ))
          : null}

        {mapReady && coordinates ? <UserPuck coordinate={coordinates} /> : null}
      </MapView>

      {offMapCount > 0 ? (
        <View style={[styles.note, { top: topInset + spacing.sm }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          {/* Bounded and clamped: content-width plus centring ran off *both*
              edges at large type, since the copy is ~250pt at 12px. */}
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

      {/* Bottom-right by default, lifted clear of the chrome below. When there is
          not enough room to lift it that far — a short screen, accessibility type
          sizes, an open card on top of a rail — it **docks under the top chrome**
          instead of vanishing. Hiding it was defensible when the card replaced
          the map's other chrome; now that the two stack, the clamp binds on an
          SE-class phone every time a card opens, and a veteran who cannot zoom
          their own map is a worse outcome than controls in an unfamiliar corner. */}
      <Animated.View
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
          {/* One instrument, three cells. These used to be two boxes that agreed
            on width, radius, border and elevation but still sat apart, which
            read as two objects that happened to be stacked rather than as the
            map's controls. Recenter keeps its olive glyph inside the shared
            housing — it is the only one of the three that is an action. */}
          <View style={styles.controlStack}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              onPress={() => zoomBy(0.5)}
              scaleTo={pressScale.control}
              style={styles.controlCell}
            >
              <Ionicons name="add" size={22} color={colors.textPrimary} />
            </PressableScale>
            <View style={styles.controlDivider} />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              onPress={() => zoomBy(2)}
              scaleTo={pressScale.control}
              style={styles.controlCell}
            >
              <Ionicons name="remove" size={22} color={colors.textPrimary} />
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
                <Ionicons name="locate" size={22} color={colors.accent} />
              )}
            </PressableScale>
          </View>
        </>
      </Animated.View>

      {selected ? (
        <View
          // Lifted clear of whatever the screen reports below the map. On the Map
          // tab that is the category rail, which stays put while a card is open —
          // at a flat `spacing.md` the card sat on top of it.
          style={[styles.preview, { bottom: bottomInset + spacing.md }]}
          onLayout={(e: LayoutChangeEvent) => setPreviewHeight(e.nativeEvent.layout.height)}
          // The card renders after the marker field, so without this a VoiceOver
          // user who taps a pin has to swipe past every remaining marker — up to a
          // few hundred of them — to reach the card that tap just opened. Modal
          // takes the rest of the screen out of the tree while it is up, which is
          // also true of what the card is: a thing you deal with, then dismiss.
          accessibilityViewIsModal
        >
          <ResourcePreview
            key={selected.resource.id}
            result={selected}
            needCategory={needCategory ?? resourceToNeedCategory(selected.resource.category)}
            onClose={() => onSelect(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills whatever container the screen gives it (the whole screen on the Map
  // tab, the area under the header on Results).
  root: { flex: 1 },
  // Zoom and recenter as one continuous instrument: a single housing, three
  // 48pt cells, hairline dividers. They were previously two separate boxes that
  // agreed on width, radius, border and elevation and still read as two objects
  // floating near each other.
  controlStack: {
    borderRadius: radii.md,
    backgroundColor: MAP_PAPER,
    borderWidth: 1,
    borderColor: MAP_CHROME_EDGE,
    overflow: 'hidden',
    ...shadows.md,
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
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: MAP_CHROME_EDGE,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    // It floats over the map, so it earns an elevation like everything else that
    // does. It had none.
    ...shadows.sm,
  },
  noteText: { flexShrink: 1 },
  // spacing.lg, not md: at 12 the card visibly overhung the 24pt column the
  // heading and chips sit in, and read as wider than the app.
  // `bottom` is supplied at the render site, off `bottomInset`.
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: MAP_CHROME_EDGE,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
});
