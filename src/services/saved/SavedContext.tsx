import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { loadSaved, saveSaved, type SavedEntry } from './savedStorage';
import { pushSaved, reconcileSaved, unionSaved } from '../sync/backupSync';

// The on-device list of saved resources, mirrored to the backup when sync is on.
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
  // Hydration is the disk read alone; the backup (a slow cold call) lands after.
  const [reconciled, setReconciled] = useState(false);
  // Unsaved this session, so the older backup's union can't resurrect them.
  const unsavedIds = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    loadSaved()
      .then((stored) => {
        if (!active) return null;
        setEntries(stored);
        setIsHydrated(true);
        return reconcileSaved(stored);
      })
      .then((merged) => {
        if (!active || !merged) return;
        // Union against current state: a save made while the pull was in flight
        // is only in `prev`.
        setEntries((prev) => unionSaved(prev, merged).filter((e) => !unsavedIds.current.has(e.id)));
      })
      .catch(() => {
        // `isHydrated` must never stay false.
        if (active) setIsHydrated(true);
      })
      .finally(() => {
        if (active) setReconciled(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) saveSaved(entries);
  }, [entries, isHydrated]);

  // Pushing waits for the reconcile: a reinstalled device's empty list, freshly
  // stamped, would otherwise overwrite the backup it is about to restore from.
  useEffect(() => {
    if (reconciled) pushSaved(entries);
  }, [entries, reconciled]);

  // Lets toggleSave read the current list without being rebuilt on every change.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const toggleSave = useCallback((id: string) => {
    const wasSaved = entriesRef.current.some((e) => e.id === id);
    // Outside the updater, which React may call twice.
    if (wasSaved) unsavedIds.current.add(id);
    else unsavedIds.current.delete(id);
    setEntries((prev) =>
      wasSaved
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
