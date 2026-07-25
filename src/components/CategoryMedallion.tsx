import { View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { categoryVisual, medallionStyle } from '@/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * A category's identity glyph: its icon in its own hue, on a soft tint of that
 * hue. The one visual that makes different opportunity types read as different
 * while staying inside the calm palette. Size scales the whole medallion; the
 * icon is ~half the size.
 */
export function CategoryMedallion({
  icon,
  color,
  size = 44,
  style,
}: {
  icon: IoniconName;
  /** The category hue (from NEED_/RESOURCE_CATEGORY_META). */
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { tint } = categoryVisual(color);
  return (
    <View style={[medallionStyle(tint, size), style]}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}
