import { View, StyleSheet } from 'react-native';
import { BottomSheet, NavigatorDisclaimer } from '@/components';
import { spacing } from '@/theme';
import { AI_NOT_ADVICE_DISCLAIMER, type CallScriptTone } from '@/services/ai';
import type { Need } from '@/types/need';
import type { Resource } from '@/types/resource';
import { CallScriptCard } from './CallScriptCard';

type CallScriptSheetProps = {
  visible: boolean;
  onClose: () => void;
  need: Need;
  resource: Resource;
  firstName?: string;
  tone?: CallScriptTone;
};

// The call script, presented as a slide-up sheet over the detail page. The card
// only mounts while the sheet is open, so the script generates when the veteran
// asks for it — same opt-in the inline version had.
export function CallScriptSheet({
  visible,
  onClose,
  need,
  resource,
  firstName,
  tone,
}: CallScriptSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Call script">
      <View style={styles.body}>
        <CallScriptCard need={need} resource={resource} firstName={firstName} tone={tone} />
        {/* The sheet is its own AI surface — a veteran can open it without ever
            scrolling to the disclaimer on the page beneath — so it says the
            not-advice line itself. */}
        <NavigatorDisclaimer text={AI_NOT_ADVICE_DISCLAIMER} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
