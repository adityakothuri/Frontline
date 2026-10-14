import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing } from '@/theme';
import { useSaved } from '@/services/saved';
import { useReminders } from '@/services/reminders';
import type { Resource } from '@/types/resource';
import { ActionPill } from './ActionPill';
import { ReminderBell, confirmUnsaveWithReminder } from './ReminderBell';
import { SeeInMapButton } from './SeeInMapButton';

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
  const router = useRouter();
  const { isSaved, toggleSave } = useSaved();
  const { isReminded, clearReminder } = useReminders();
  const saved = isSaved(resource.id);

  // Un-saving leaves the reminder alone unless the veteran says otherwise; the
  // bell would otherwise vanish from Saved with its alerts still scheduled.
  const onToggleSave = () => {
    toggleSave(resource.id);
    if (saved && isReminded(resource.id)) {
      confirmUnsaveWithReminder(resource.name, () => clearReminder(resource.id));
    }
  };

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
      <SeeInMapButton
        resource={resource}
        variant="pill"
        onPress={(id) => router.navigate({ pathname: '/map', params: { focus: id } })}
      />
      <ActionPill
        icon={saved ? 'bookmark' : 'bookmark-outline'}
        label={saved ? 'Saved' : 'Save'}
        active={saved}
        selected={saved}
        onPress={onToggleSave}
      />
      {/* Renders nothing unless the hours are good enough to schedule against. */}
      <ReminderBell resource={resource} shape="pill" />
      <ActionPill icon="share-outline" label="Share" onPress={share} />
      {onGetScript ? (
        <ActionPill icon="sparkles-outline" label="Call script" active onPress={onGetScript} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
