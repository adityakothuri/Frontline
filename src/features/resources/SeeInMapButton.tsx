import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';
import type { Resource } from '@/types/resource';

// "See in map" — the one control that ties every opportunity back to the map.
// A resource is "on the map" only when it has real coordinates; address-only or
// referral rows (national hotlines, county-wide SSVF) are NOT pinnable, so the
// button shows a struck-through map glyph and is disabled rather than hidden —
// the veteran still learns *why* it isn't there. Both variants are the
// `ActionPill` shape every other resource action uses, in the same olive ink —
// the card used to print this one label in black beside two olive ones.
type SeeInMapButtonProps = {
  resource: Resource;
  variant: 'card' | 'pill';
  /** Called only when the resource is on the map (has coordinates). */
  onPress: (id: string) => void;
};

export function isOnMap(resource: Resource): boolean {
  return resource.latitude !== null && resource.longitude !== null;
}

export function SeeInMapButton({ resource, variant, onPress }: SeeInMapButtonProps) {
  const onMap = isOnMap(resource);
  const tint = onMap ? colors.accent : colors.textMuted;
  const containerStyle = [
    variant === 'card' ? styles.card : styles.pill,
    !onMap && styles.disabled,
  ];

  // Off-map says so in words too — a struck icon alone reads as "greyed but
  // tappable" to a stressed user; "Not on map" is unambiguous.
  const content = (
    <>
      <MapGlyph color={tint} struck={!onMap} />
      <AppText variant="label" color={onMap ? 'accentPressed' : 'textSecondary'}>
        {onMap ? 'See in map' : 'Not on map'}
      </AppText>
    </>
  );

  if (!onMap) {
    return (
      <View
        style={containerStyle}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel="Not on the map — reach this resource by phone or online"
      >
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`See ${resource.name} on the map`}
      onPress={() => onPress(resource.id)}
      scaleTo={pressScale.chip}
      style={containerStyle}
    >
      {content}
    </PressableScale>
  );
}

// The map icon, with an optional diagonal strike drawn across it for the
// off-map (disabled) state — a plain "not available" cross-out. The strike is
// drawn in textSecondary (darker than the muted glyph) so the cross-out clearly
// contrasts the icon it crosses.
function MapGlyph({ color, struck }: { color: string; struck: boolean }) {
  return (
    <View style={styles.glyph}>
      <Ionicons name="map-outline" size={16} color={color} />
      {struck ? <View style={styles.strike} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same 44pt pill as `ActionPill`, so Call, Directions and this read as one row
  // of the same control. It was a 34pt bordered rectangle beside two others.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.5, backgroundColor: colors.surfaceMuted },
  glyph: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  // Explicit insets center the 22px line over the 18px glyph box (left = (18-22)/2,
  // top = (18-2)/2) so it never drifts if the box styling changes.
  strike: {
    position: 'absolute',
    top: 8,
    left: -2,
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
});
