import type { ViewStyle } from 'react-native';

/** A category's identity mark: a small solid square of its hue, set beside a
 *  mono category label. Category colour is identity only — never an action. */
export function swatchStyle(color: string, size = 8): ViewStyle {
  return { width: size, height: size, backgroundColor: color };
}
