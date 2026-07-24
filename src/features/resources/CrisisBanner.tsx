import type { StyleProp, ViewStyle } from 'react-native';
import { DangerCallBanner } from './EmergencyCallBanner';
import { callPhone } from './resourceActions';

// Category-level crisis routing shown at the top of the Emergency results page:
// point straight to the real crisis lines before any list of resources.
// Distinct from EmergencyCallBanner, which is per-resource contact on a detail
// page. 911 stays text-only on purpose — a mis-tap must never place an
// emergency call.
export function CrisisBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <DangerCallBanner
      style={style}
      title="If you're in immediate danger, call 911"
      message="The Veterans Crisis Line is free, confidential, and available 24/7."
      callLabel="Call 988, then press 1"
      accessibilityLabel="Call 988, then press 1, for the Veterans Crisis Line"
      onCall={() => callPhone('988')}
    />
  );
}
