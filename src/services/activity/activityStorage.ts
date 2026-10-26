import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityState, EngagementEntry, Rating } from '@/types/activity';
import { captureException } from '../monitoring';

const STORAGE_KEY = 'frontline.activity.v1';

export const EMPTY_ACTIVITY: ActivityState = { engagements: [], ratings: {} };

function isEngagement(value: unknown): value is EngagementEntry {
  const e = value as Partial<EngagementEntry>;
  return (
    typeof e?.resourceId === 'string' &&
    typeof e?.resourceName === 'string' &&
    typeof e?.at === 'string'
  );
}

function normalizeRatings(value: unknown): Record<string, Rating> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, Rating> = {};
  for (const [id, vote] of Object.entries(value as Record<string, unknown>)) {
    if (vote === 'up' || vote === 'down') out[id] = vote;
  }
  return out;
}

/** Load the saved activity, or an empty shape (never null — Home has no gate on it). */
export async function loadActivity(): Promise<ActivityState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_ACTIVITY;
    const parsed = JSON.parse(raw) as Partial<ActivityState>;
    return {
      engagements: Array.isArray(parsed.engagements) ? parsed.engagements.filter(isEngagement) : [],
      ratings: normalizeRatings(parsed.ratings),
    };
  } catch {
    return EMPTY_ACTIVITY;
  }
}

/** Persist the activity blob. Never throws. */
export async function saveActivity(state: ActivityState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    captureException(error);
  }
}
