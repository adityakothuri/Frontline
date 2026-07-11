import { View, StyleSheet } from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { spacing } from '@/theme';
import { Chip } from './Chip';
import { SelectableOption } from './SelectableOption';

type IconName = keyof typeof Ionicons.glyphMap;
type Option<T> = { value: T; label: string; description?: string; icon?: IconName; iconColor?: string };

type OptionGroupProps<T> = {
  /** `pill` = compact chips (default); `row` = full-width selectable rows. */
  variant?: 'pill' | 'row';
} & (
  | { multiple?: false; options: Option<T>[]; value: T | undefined; onChange: (value: T) => void }
  | { multiple: true; options: Option<T>[]; value: T[]; onChange: (value: T[]) => void }
);

// One selection component, two looks. Single-select by default, or multi with
// `multiple`. Shared by the setup wizard and the profile form.
export function OptionGroup<T extends string | number>(props: OptionGroupProps<T>) {
  const { variant = 'pill' } = props;

  const isSelected = (value: T): boolean =>
    props.multiple ? props.value.includes(value) : props.value === value;

  const toggle = (value: T) => {
    if (props.multiple) {
      const has = props.value.includes(value);
      const next = has
        ? props.value.filter((v) => v !== value)
        : // keep the display order stable
          props.options.filter((o) => o.value === value || props.value.includes(o.value)).map((o) => o.value);
      props.onChange(next);
    } else {
      props.onChange(value);
    }
  };

  if (variant === 'row') {
    return (
      <View style={styles.rows}>
        {props.options.map((opt) => (
          <SelectableOption
            key={String(opt.value)}
            label={opt.label}
            description={opt.description}
            icon={opt.icon}
            iconColor={opt.iconColor}
            multiple={props.multiple}
            selected={isSelected(opt.value)}
            onPress={() => toggle(opt.value)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.pills}>
      {props.options.map((opt) => (
        <Chip
          key={String(opt.value)}
          label={opt.label}
          icon={opt.icon}
          selected={isSelected(opt.value)}
          onPress={() => toggle(opt.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rows: { gap: spacing.sm },
});
