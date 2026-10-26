import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { colors, textVariants, type TextVariant, type ColorToken } from '@/theme';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  style?: StyleProp<TextStyle>;
};

// Condensed display lines overrun fixed chrome at the largest Dynamic Type
// sizes while saying nothing a body line does not, so they cap at 1.6×.
const HEADLINE_MAX_SCALE = 1.6;

// All text goes through here: screens pick a `variant`, never a raw size.
export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: AppTextProps) {
  const headline = variant === 'display' || variant === 'title' || variant === 'itemTitle';
  return (
    <Text
      maxFontSizeMultiplier={headline ? HEADLINE_MAX_SCALE : undefined}
      style={[textVariants[variant], { color: colors[color] }, style]}
      {...rest}
    />
  );
}
