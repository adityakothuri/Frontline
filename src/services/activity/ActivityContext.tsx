import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ActivityState, EngagementEntry, Rating } from '@/types/activity';
import { loadActivity, saveActivity } from './activityStorage';

// On-device record of the veteran's engagement with opportunities + their
// thumbs votes, used by the Home "How was ___?" prompt. A small Context mirroring
// ProfileContext — local-only, no backend, nothing sensitive.
const EMPTY: ActivityState = { engagements: [], ratings: {} };

// Keep the engagement log small; one entry per resource (latest wins).
const MAX_ENGAGEMENTS = 20;

interface ActivityContextValue {
  /** False until the stored activity has been read on launch. */
  isHydrated: boolean;
  /** Record that the veteran engaged with a resource (deduped by resource, latest wins). */
  recordEngagement: (entry: Omit<EngagementEntry, 'at'>) => void;
  /** Leave a thumbs vote on a resource. */
  rate: (resourceId: string, vote: Rating) => void;
  /** The veteran's own vote on a resource, if any. */
  getRating: (resourceId: string) => Rating | undefined;
  /** The most recent engagement the veteran hasn't rated yet — the review prompt. */
  pendingReview: EngagementEntry | null;
}

const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<ActivityState>(EMPTY);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    loadActivity().then((stored) => {
      if (!active) return;
      setActivity(stored);
      setIsHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist whenever activity changes (after the initial hydrate).
  useEffect(() => {
    if (isHydrated) saveActivity(activity);
  }, [activity, isHydrated]);

  const recordEngagement = useCallback((entry: Omit<EngagementEntry, 'at'>) => {
    setActivity((prev) => {
      const withoutDup = prev.engagements.filter((e) => e.resourceId !== entry.resourceId);
      const next: EngagementEntry = { ...entry, at: new Date().toISOString() };
      return { ...prev, engagements: [next, ...withoutDup].slice(0, MAX_ENGAGEMENTS) };
    });
  }, []);

  const rate = useCallback((resourceId: string, vote: Rating) => {
    setActivity((prev) => ({ ...prev, ratings: { ...prev.ratings, [resourceId]: vote } }));
  }, []);

  const getRating = useCallback(
    (resourceId: string) => activity.ratings[resourceId],
    [activity.ratings],
  );

  // Engagements are newest-first, so the first unrated one is the prompt.
  const pendingReview = useMemo(
    () => activity.engagements.find((e) => !(e.resourceId in activity.ratings)) ?? null,
    [activity.engagements, activity.ratings],
  );

  const value = useMemo(
    () => ({ isHydrated, recordEngagement, rate, getRating, pendingReview }),
    [isHydrated, recordEngagement, rate, getRating, pendingReview],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

/** Access the on-device activity. Must be used within an ActivityProvider. */
export function useActivity(): ActivityContextValue {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}
