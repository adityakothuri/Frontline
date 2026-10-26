import { StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, pressScale, radii } from '@/theme';
import { tapSelection } from '@/lib/haptics';
import { PressableScale } from './PressableScale';

// The app's icon set on a 24 grid: 1.75 stroke, square caps, mitred joins.
// Glyphs are hidden from screen readers, so glyph-only buttons need a label.
const PATHS = {
  home: ['M4 11 L12 4 L20 11 V20 H4 Z', 'M10 20 V14 H14 V20'],
  search: ['M15 15 L20 20'],
  map: ['M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z', 'M9 4 V18', 'M15 6 V20'],
  bookmark: ['M6 3 H18 V21 L12 16 L6 21 Z'],
  profile: ['M4 21 V18 C4 15.8 5.8 14 8 14 H16 C18.2 14 20 15.8 20 18 V21'],
  call: [
    'M5 4 H9 L11 9 L8.5 10.5 C9.6 12.8 11.2 14.4 13.5 15.5 L15 13 L20 15 V19 C20 19.6 19.6 20 19 20 C11 20 4 13 4 5 C4 4.4 4.4 4 5 4 Z',
  ],
  directions: ['M12 2 L22 12 L12 22 L2 12 Z', 'M9 15 V11 H15', 'M13 9 L15 11 L13 13'],
  bell: ['M6 17 V11 C6 7.7 8.7 5 12 5 C15.3 5 18 7.7 18 11 V17 L20 19 H4 Z', 'M10 22 H14'],
  location: [
    'M12 21 C12 21 5 14.5 5 9.5 C5 5.9 8.1 3 12 3 C15.9 3 19 5.9 19 9.5 C19 14.5 12 21 12 21 Z',
  ],
  back: ['M15 5 L8 12 L15 19'],
  close: ['M6 6 L18 18', 'M18 6 L6 18'],
  check: ['M5 12.5 L10 17.5 L19 7'],
  external: ['M14 4 H20 V10', 'M20 4 L11 13', 'M18 14 V20 H4 V6 H10'],
  arrowRight: ['M4 12 H20', 'M14 6 L20 12 L14 18'],
  arrowUp: ['M12 20 V4', 'M6 10 L12 4 L18 10'],
  edit: ['M4 20 H8 L19 9 L15 5 L4 16 Z'],
  plus: ['M12 5 V19', 'M5 12 H19'],
  minus: ['M5 12 H19'],
  locate: ['M12 2 V6', 'M12 18 V22', 'M2 12 H6', 'M18 12 H22'],
  share: ['M8 9 H5 V21 H19 V9 H16', 'M12 3 V15', 'M8 7 L12 3 L16 7'],
  script: ['M5 3 H15 L19 7 V21 H5 Z', 'M9 10 H15', 'M9 14 H15', 'M9 18 H13'],
  globe: ['M3 12 H21', 'M12 3 C9 6 9 18 12 21', 'M12 3 C15 6 15 18 12 21'],
  clock: ['M12 7 V12 L15 14'],
} as const;

// Circles that belong to a glyph alongside its paths.
const CIRCLES: Partial<Record<GlyphName, { cx: number; cy: number; r: number }>> = {
  search: { cx: 10.5, cy: 10.5, r: 6 },
  profile: { cx: 12, cy: 7.5, r: 3.5 },
  location: { cx: 12, cy: 9.5, r: 2.5 },
  locate: { cx: 12, cy: 12, r: 6 },
  globe: { cx: 12, cy: 12, r: 9 },
  clock: { cx: 12, cy: 12, r: 9 },
};

// Closed shapes that can be drawn solid to show an "on" state.
const FILLABLE = new Set<GlyphName>(['bookmark', 'bell', 'home', 'location']);

export type GlyphName = keyof typeof PATHS;

type GlyphProps = {
  name: GlyphName;
  size?: number;
  color?: string;
  /** Solid fill for an on state (a saved bookmark, an active tab). */
  filled?: boolean;
};

export function Glyph({ name, size = 20, color = colors.textPrimary, filled = false }: GlyphProps) {
  const fill = filled && FILLABLE.has(name) ? color : 'none';
  const circle = CIRCLES[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name].map((d, i) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="square"
          strokeLinejoin="miter"
          // Only the outline takes the fill; inner strokes (a door, a fold) stay lines.
          fill={i === 0 ? fill : 'none'}
        />
      ))}
      {circle ? (
        <Circle
          {...circle}
          stroke={filled && name === 'location' ? colors.surface : color}
          strokeWidth={1.75}
          fill="none"
        />
      ) : null}
    </Svg>
  );
}

type GlyphButtonProps = {
  name: GlyphName;
  /** What the button does, for screen readers — the glyph itself is hidden. */
  label: string;
  onPress: () => void;
  /** Olive rather than ink: for the one action a row leads with (Call). */
  accent?: boolean;
  /** On state for a toggle (saved, answered): solid fill, announced as selected. */
  selected?: boolean;
  /** Drop the frame for a quiet glyph in a header. */
  framed?: boolean;
  disabled?: boolean;
};

/** A 44pt square icon button: the glyph in a 1.5px frame. */
export function GlyphButton({
  name,
  label,
  onPress,
  accent = false,
  selected,
  framed = true,
  disabled = false,
}: GlyphButtonProps) {
  const ink = disabled ? colors.textMuted : accent ? colors.accent : colors.textPrimary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => {
        tapSelection();
        onPress();
      }}
      scaleTo={pressScale.control}
      style={[
        buttonStyles.base,
        framed && { borderWidth: 1.5, borderColor: ink },
        selected && { backgroundColor: ink },
      ]}
    >
      <Glyph name={name} size={20} color={selected ? colors.surface : ink} filled={selected} />
    </PressableScale>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
});
