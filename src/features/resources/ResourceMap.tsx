import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, EmptyState, PressableScale } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { RESOURCE_CATEGORY_META } from '@/types/resource';
import { SEED_CENTER, resourceToNeedCategory, type ResourceSearchResult } from '@/services/resources';
import { useProfile } from '@/services/profile';
import { useUserLocation } from '@/services/location';
import type { NeedCategory } from '@/types/need';
import { ResourcePreview } from './ResourcePreview';

type ResourceMapProps = {
  results: ResourceSearchResult[];
  /** The searched need category, when the map is scoped to one (Results). Omitted
   *  on the general Map tab, where each pin's category is derived from its resource. */
  needCategory?: NeedCategory;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

// First-paint region: the seed city, then we fit to the actual pins on ready.
const INITIAL_REGION: Region = {
  latitude: SEED_CENTER.latitude,
  longitude: SEED_CENTER.longitude,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

// The map view of the same result set as the list. Located resources become
// category pins; phone/online-only resources (no coordinates) can't be pinned,
// so they're surfaced as a note instead of silently dropped.
export function ResourceMap({ results, needCategory, selectedId, onSelect }: ResourceMapProps) {
  const mapRef = useRef<MapView>(null);
  const { profile } = useProfile();
  const { status, locate } = useUserLocation(profile?.zip);
  const [hint, setHint] = useState<string | null>(null);
  const located = useMemo(
    () => results.filter((r) => r.resource.latitude !== null && r.resource.longitude !== null),
    [results],
  );
  const offMapCount = results.length - located.length;

  // Custom marker children re-rasterize while tracking; let them paint once, then
  // stop tracking to avoid continuous redraw jank.
  const [tracksChanges, setTracksChanges] = useState(true);
  useEffect(() => {
    setTracksChanges(true);
    const t = setTimeout(() => setTracksChanges(false), 800);
    return () => clearTimeout(t);
  }, [located]);

  const fitToPins = () => {
    if (located.length === 0) return;
    mapRef.current?.fitToCoordinates(
      located.map((r) => ({
        latitude: r.resource.latitude as number,
        longitude: r.resource.longitude as number,
      })),
      { edgePadding: { top: 80, right: 60, bottom: 220, left: 60 }, animated: false },
    );
  };

  const recenter = async () => {
    setHint(null);
    const target = await locate();
    if (target) {
      mapRef.current?.animateToRegion(
        { ...target, latitudeDelta: 0.06, longitudeDelta: 0.06 },
        350,
      );
    } else {
      setHint(
        profile?.zip
          ? 'Couldn’t pin your location right now.'
          : 'Turn on location, or add a ZIP in your profile, to recenter.',
      );
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
        initialRegion={INITIAL_REGION}
        onMapReady={fitToPins}
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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Recenter the map on your location"
            onPress={recenter}
            disabled={status === 'locating'}
            scaleTo={0.92}
            style={styles.recenter}
          >
            {status === 'locating' ? (
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
    shadowColor: colors.textPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
