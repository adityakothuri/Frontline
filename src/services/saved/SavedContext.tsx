import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadSaved, saveSaved, type SavedEntry } from './savedStorage';
import { pushSaved, reconcileSaved } from '../sync/backupSync';

// The app's on-device list of saved resources. A small Context mirroring
// ProfileContext/ActivityContext — local-only, nothing sensitive. The context is
// the API; there is no swappable service seam here.
interface SavedContextValue {
  /** False until the stored list has been read on launch. */
  isHydrated: boolean;
  /** Saved resource ids, newest-first. */
  savedIds: string[];
  isSaved: (id: string) => boolean;
  /** Save the id if it isn't saved, otherwise remove it. */
  toggleSave: (id: string) => void;
}

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    // Reconcile with the backup before marking hydrated — a reinstall restores
    // its list here, and pushes stay gated on isHydrated so an empty pre-restore
    // state can never be pushed over good backup data. No-op when sync is off.
    loadSaved()
      .then((stored) => reconcileSaved(stored))
      .then((merged) => {
        if (!active) return;
        setEntries(merged);
        setIsHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist locally + mirror to the backup whenever the list changes (after the
  // initial hydrate). pushSaved is debounced and a no-op when sync is off.
  useEffect(() => {
    if (isHydrated) {
      saveSaved(entries);
      pushSaved(entries);
    }
  }, [entries, isHydrated]);

  const toggleSave = useCallback((id: string) => {
    setEntries((prev) =>
      prev.some((e) => e.id === id)
        ? prev.filter((e) => e.id !== id)
        : [{ id, savedAt: new Date().toISOString() }, ...prev],
    );
  }, []);

  // Entries are prepended on save, so mapping preserves newest-first order.
  const savedIds = useMemo(() => entries.map((e) => e.id), [entries]);
  const isSaved = useCallback((id: string) => entries.some((e) => e.id === id), [entries]);

  const value = useMemo(
    () => ({ isHydrated, savedIds, isSaved, toggleSave }),
    [isHydrated, savedIds, isSaved, toggleSave],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

/** Access the saved list. Must be used within a SavedProvider. */
export function useSaved(): SavedContextValue {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
}
