import {
  Text,
  type TextProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {
  colors,
  textVariants,
  type TextVariant,
  type ColorToken,
} from '@/theme';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  /**
   * A raw color string, for the few cases outside the token set — chiefly a
   * category hue (e.g. a medallion label). Wins over `color` when set. Prefer
   * `color` (a token) everywhere else so the palette stays the source of truth.
   */
  rawColor?: string;
  style?: StyleProp<TextStyle>;
};

// Every piece of text in the app goes through here, so the Inter/Fraunces
// families and the type scale stay consistent — screens pick a `variant`, never
// a raw size.
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  rawColor,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[textVariants[variant], { color: rawColor ?? colors[color] }, style]}
      {...rest}
    />
  );
}
