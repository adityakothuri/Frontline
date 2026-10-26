import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Glyph, PressableScale, type GlyphName } from '@/components';
import { colors, pressScale, radii, spacing } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { useSaved } from '@/services/saved';
import { useReminders } from '@/services/reminders';
import type { Resource } from '@/types/resource';
import { confirmUnsaveWithReminder } from './ReminderBell';
import { isOnMap } from './resourceActions';

type ActionRowProps = {
  resource: Resource;
  /** Present only when the resource has a phone; owns engagement recording. */
  onCall?: () => void;
  /** Present only when the resource has an address or coordinates. */
  onDirections?: () => void;
  /** Opens the call-script sheet; omitted when there is no number to call. */
  onGetScript?: () => void;
};

// The detail page's action bar: equal tiles, Call leading in olive. Only actions
// this place supports are shown.
export function ActionRow({ resource, onCall, onDirections, onGetScript }: ActionRowProps) {
  const router = useRouter();
  const { isSaved, toggleSave } = useSaved();
  const { isReminded, clearReminder } = useReminders();
  const saved = isSaved(resource.id);

  // Un-saving leaves the reminder alone unless the veteran says otherwise.
  const onToggleSave = () => {
    toggleSave(resource.id);
    if (saved && isReminded(resource.id)) {
      confirmUnsaveWithReminder(resource.name, () => clearReminder(resource.id));
    }
  };

  return (
    <View style={styles.bar}>
      {onCall ? <Tile glyph="call" label="Call" lead onPress={onCall} /> : null}
      {onDirections ? <Tile glyph="directions" label="Route" onPress={onDirections} /> : null}
      {isOnMap(resource) ? (
        <Tile
          glyph="map"
          label="Map"
          onPress={() => router.navigate({ pathname: '/map', params: { focus: resource.id } })}
        />
      ) : null}
      <Tile
        glyph="bookmark"
        label={saved ? 'Saved' : 'Save'}
        selected={saved}
        onPress={onToggleSave}
      />
      {onGetScript ? <Tile glyph="script" label="Script" onPress={onGetScript} /> : null}
    </View>
  );
}

function Tile({
  glyph,
  label,
  onPress,
  lead = false,
  selected,
}: {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
  lead?: boolean;
  selected?: boolean;
}) {
  const ink = lead ? colors.textOnAccent : colors.textPrimary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={() => {
        tapSelection();
        onPress();
      }}
      scaleTo={pressScale.chip}
      containerStyle={styles.slot}
      style={[styles.tile, lead && styles.lead]}
    >
      <Glyph name={glyph} size={22} color={ink} filled={selected} />
      <AppText variant="kicker" style={{ color: ink }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: spacing.xs },
  slot: { flex: 1 },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 64,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  lead: { backgroundColor: colors.accent, borderColor: colors.accent },
});
