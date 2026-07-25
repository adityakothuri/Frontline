import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, EmptyState, PressableScale } from '@/components';
import { colors, radii, shadows, spacing } from '@/theme';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import { resourceToNeedCategory, type ResourceSearchResult } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { useUserLocation, geocodeZip, resolveZipCentroid } from '@/services/location';
import type { Coordinates } from '@/lib/geo';
import type { NeedCategory } from '@/types/need';
import { ResourcePreview } from './ResourcePreview';

// Zoom limits (map region deltas, in degrees): how far the +/- buttons can go.
const MIN_DELTA = 0.004; // closest zoom-in
const MAX_DELTA = 80; // widest zoom-out

type ResourceMapProps = {
  results: ResourceSearchResult[];
  /** The searched need category, when the map is scoped to one (Results). Omitted
   *  on the general Map tab, where each pin's category is derived from its resource. */
  needCategory?: NeedCategory;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
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

// The map view of the same result set as the list. Located resources become
// category pins; phone/online-only resources (no coordinates) can't be pinned,
// so they're surfaced as a note instead of silently dropped.
export function ResourceMap({ results, needCategory, selectedId, onSelect }: ResourceMapProps) {
  const mapRef = useRef<MapView>(null);
  const { profile } = useProfile();
  const { status, locate } = useUserLocation(profile?.zip);
  const [hint, setHint] = useState<string | null>(null);
  const [recentering, setRecentering] = useState(false);
  // Gate the focus animation: an animateToRegion issued before the native map is
  // ready can be dropped (notably on Android), so we wait for onMapReady.
  const [mapReady, setMapReady] = useState(false);
  const located = useMemo(
    () => results.filter((r) => r.resource.latitude !== null && r.resource.longitude !== null),
    [results],
  );
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

  // Custom marker children re-rasterize while tracking; let them paint once, then
  // stop tracking to avoid continuous redraw jank.
  const [tracksChanges, setTracksChanges] = useState(true);
  useEffect(() => {
    setTracksChanges(true);
    const t = setTimeout(() => setTracksChanges(false), 800);
    return () => clearTimeout(t);
  }, [located]);

  // The live map region, kept fresh by onRegionChangeComplete so the +/- zoom
  // buttons scale the *current* view (not a stale initial region).
  const regionRef = useRef<Region>(initialRegion);

  // When a pin is selected from outside (a card's "See in map", or the Map tab's
  // ?focus= param), glide the camera to it. The preview for `selected` renders
  // below, so the veteran lands on the pin with its card already open.
  useEffect(() => {
    if (!mapReady || !selectedId) return;
    const target = located.find((r) => r.resource.id === selectedId);
    if (!target) return;
    mapRef.current?.animateToRegion(
      {
        latitude: target.resource.latitude as number,
        longitude: target.resource.longitude as number,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      350,
    );
  }, [selectedId, located, mapReady]);

  const fitToPins = () => {
    // A pre-selected pin *that exists in this set* owns the camera (the focus
    // effect zooms to it); don't fight it by fitting all pins on map-ready. But
    // if the focus id isn't in this dataset, still fit everything — never leave
    // the map parked on an arbitrary initial region.
    if (located.length === 0) return;
    const hasSelectedPin = selectedId !== null && located.some((r) => r.resource.id === selectedId);
    if (hasSelectedPin) return;
    mapRef.current?.fitToCoordinates(
      located.map((r) => ({
        latitude: r.resource.latitude as number,
        longitude: r.resource.longitude as number,
      })),
      { edgePadding: { top: 80, right: 60, bottom: 220, left: 60 }, animated: false },
    );
  };

  // Zoom by scaling the current region's span (factor < 1 zooms in), clamped.
  const zoomBy = (factor: number) => {
    const r = regionRef.current;
    const clamp = (d: number) => Math.min(MAX_DELTA, Math.max(MIN_DELTA, d * factor));
    mapRef.current?.animateToRegion(
      {
        latitude: r.latitude,
        longitude: r.longitude,
        latitudeDelta: clamp(r.latitudeDelta),
        longitudeDelta: clamp(r.longitudeDelta),
      },
      180,
    );
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
        mapRef.current?.animateToRegion({ ...target, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 350);
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

  if (located.length === 0) {
    return (
      <EmptyState
        icon="call-outline"
        title="Phone & online only"
        message="These resources don’t have a map location — reach them by phone or online. Switch to the list to see them."
      />
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => {
          setMapReady(true);
          fitToPins();
        }}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
        }}
        onPress={() => {
          onSelect(null);
          setHint(null);
        }}
        showsUserLocation={status === 'granted'}
        showsPointsOfInterest={false}
      >
        {located.map((r) => {
          const meta = RESOURCE_CATEGORY_META[r.resource.category];
          const isSelected = r.resource.id === selectedId;
          return (
            <Marker
              key={r.resource.id}
              coordinate={{
                latitude: r.resource.latitude as number,
                longitude: r.resource.longitude as number,
              }}
              tracksViewChanges={tracksChanges}
              onPress={(e) => {
                e.stopPropagation();
                onSelect(r.resource.id);
              }}
            >
              <View
                style={[
                  styles.pin,
                  { borderColor: meta.color },
                  isSelected && { backgroundColor: meta.color },
                ]}
              >
                <Ionicons
                  name={meta.icon}
                  size={16}
                  color={isSelected ? colors.background : meta.color}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {offMapCount > 0 ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <AppText variant="caption" color="textSecondary">
            {offMapCount} phone/online {offMapCount === 1 ? 'resource' : 'resources'} not shown on the map
          </AppText>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.preview}>
          <ResourcePreview
            key={selected.resource.id}
            result={selected}
            needCategory={needCategory ?? resourceToNeedCategory(selected.resource.category)}
            onClose={() => onSelect(null)}
          />
        </View>
      ) : (
        <View style={styles.recenterWrap}>
          {hint ? (
            <View style={styles.hint}>
              <AppText variant="caption" color="textSecondary">
                {hint}
              </AppText>
            </View>
          ) : null}
          {/* Zoom sits directly above the recenter, same corner */}
          <View style={styles.zoomWrap}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              onPress={() => zoomBy(0.5)}
              scaleTo={0.9}
              style={styles.zoomBtn}
            >
              <Ionicons name="add" size={22} color={colors.textPrimary} />
            </PressableScale>
            <View style={styles.zoomDivider} />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              onPress={() => zoomBy(2)}
              scaleTo={0.9}
              style={styles.zoomBtn}
            >
              <Ionicons name="remove" size={22} color={colors.textPrimary} />
            </PressableScale>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Recenter the map on your ZIP code"
            onPress={recenter}
            disabled={status === 'locating' || recentering}
            scaleTo={0.92}
            style={styles.recenter}
          >
            {status === 'locating' || recentering ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="locate" size={22} color={colors.accent} />
            )}
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fills whatever container the screen gives it (framed card on the Map tab).
  root: { flex: 1 },
  pin: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomWrap: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  zoomBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  note: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  preview: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  recenterWrap: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  hint: {
    maxWidth: 220,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  recenter: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.md,
  },
});
