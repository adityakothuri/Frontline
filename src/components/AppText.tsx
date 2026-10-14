import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { colors, textVariants, type TextVariant, type ColorToken } from '@/theme';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  style?: StyleProp<TextStyle>;
};

// Every piece of text in the app goes through here, so the Inter/Fraunces
// families and the type scale stay consistent — screens pick a `variant`, never
// a raw size.
export function AppText({ variant = 'body', color = 'textPrimary', style, ...rest }: AppTextProps) {
  return <Text style={[textVariants[variant], { color: colors[color] }, style]} {...rest} />;
}
