import { Share, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, PressableScale } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { useSaved } from '@/services/saved';
import type { Resource } from '@/types/resource';

type ActionRowProps = {
  resource: Resource;
  /** Present only when the resource has a phone; owns engagement recording. */
  onCall?: () => void;
  /** Present only when the resource has an address or coordinates. */
  onDirections?: () => void;
  /** Opens the call-script sheet; omitted when there is no number to call. */
  onGetScript?: () => void;
};

// Every action on a resource, in one compact cluster under the header: pill
// buttons that hug their content (Call filled, the rest quiet) plus the
// call-script entry point. Save state lives here (not in the route header) so
// there is exactly one Save control on the page.
export function ActionRow({ resource, onCall, onDirections, onGetScript }: ActionRowProps) {
  const { isSaved, toggleSave } = useSaved();
  const saved = isSaved(resource.id);

  const share = () => {
    const lines = [resource.name, resource.address, resource.phone, resource.website].filter(
      (line): line is string => Boolean(line),
    );
    // Fire-and-forget: the OS sheet owns the interaction from here. The catch
    // covers web, where navigator.share may be unavailable and reject.
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  return (
    <View style={styles.row}>
      {onCall ? <ActionPill icon="call" label="Call" primary onPress={onCall} /> : null}
      {onDirections ? (
        <ActionPill icon="navigate-outline" label="Directions" onPress={onDirections} />
      ) : null}
      <ActionPill
        icon={saved ? 'bookmark' : 'bookmark-outline'}
        label={saved ? 'Saved' : 'Save'}
        active={saved}
        onPress={() => toggleSave(resource.id)}
      />
      <ActionPill icon="share-outline" label="Share" onPress={share} />
      {onGetScript ? (
        <ActionPill icon="sparkles-outline" label="Call script" active onPress={onGetScript} />
      ) : null}
    </View>
  );
}

function ActionPill({
  icon,
  label,
  onPress,
  primary = false,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.95}
      style={[styles.pill, primary && styles.pillPrimary, active && styles.pillActive]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={primary ? colors.textOnAccent : colors.accent}
      />
      <AppText variant="label" color={primary ? 'textOnAccent' : 'accentPressed'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
});
