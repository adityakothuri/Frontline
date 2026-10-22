import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { colors, textVariants, type TextVariant, type ColorToken } from '@/theme';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  style?: StyleProp<TextStyle>;
};

/**
 * How far the serif headlines may grow under Dynamic Type. Body text is left
 * unlimited — that is the whole point of the setting — but a 36pt Fraunces line
 * at 2× or 3× overruns every fixed piece of chrome beside it (the start card's
 * arrow, the location pill, the tab bar) while saying nothing a body line does
 * not. 1.6 keeps the hierarchy legible at the largest accessibility sizes.
 */
const HEADLINE_MAX_SCALE = 1.6;

// Every piece of text in the app goes through here, so the Inter/Fraunces
// families and the type scale stay consistent — screens pick a `variant`, never
// a raw size.
export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: AppTextProps) {
  const headline =
    variant === 'display' ||
    variant === 'displayLarge' ||
    variant === 'title' ||
    variant === 'cardTitle';
  return (
    <Text
      maxFontSizeMultiplier={headline ? HEADLINE_MAX_SCALE : undefined}
      style={[textVariants[variant], { color: colors[color] }, style]}
      {...rest}
    />
  );
}
