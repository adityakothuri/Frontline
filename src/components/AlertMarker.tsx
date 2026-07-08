import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii } from '@/theme';
import {
  categoryMeta,
  severityColor,
  type AlertCategory,
  type AlertSeverity,
} from '@/mock/alerts';

type AlertMarkerProps = {
  category: AlertCategory;
  severity: AlertSeverity;
};

// The custom map pin: a severity-colored disc with the category icon and a small
// pointer beneath it. Rendered as the child of a react-native-maps <Marker> (set
// the marker's anchor to {x:0.5, y:1} so the pointer tip sits on the coordinate).
export function AlertMarker({ category, severity }: AlertMarkerProps) {
  const tint = colors[severityColor[severity]];
  return (
    <View style={styles.root}>
      <View style={[styles.disc, { backgroundColor: tint }]}>
        <Ionicons
          name={categoryMeta[category].icon}
          size={16}
          color={colors.textOnAccent}
        />
      </View>
      <View style={[styles.pointer, { borderTopColor: tint }]} />
    </View>
  );
}

const DISC = 34;
const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
    marginTop: -1,
  },
});
