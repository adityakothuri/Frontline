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
  // The backup pull is a network call to a cold edge function. It used to sit in
  // front of `isHydrated`, which put up to 12s of `sync` round trip between a
  // cold launch and the first frame of the Saved tab. Hydration is now the disk
  // read alone; the backup lands afterwards as a second, additive update.
  const [reconciled, setReconciled] = useState(false);
  // Ids the veteran has unsaved this session. Consulted once, when the backup
  // lands: the union would otherwise hand back an id the veteran just removed,
  // because the backup predates the removal and still lists it.
  const unsavedIds = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    loadSaved()
      .then((stored) => {
        if (!active) return null;
        // Local disk is the source of truth and it's already here: unblock the UI.
        setEntries(stored);
        setIsHydrated(true);
        return reconcileSaved(stored);
      })
      .then((merged) => {
        if (!active || !merged) return;
        // Union against current state, not against `stored` — a save made while
        // the pull was in flight is in `prev` only, and replacing wholesale used
        // to drop it (and it had never been persisted, so it was gone for good).
        setEntries((prev) => unionSaved(prev, merged).filter((e) => !unsavedIds.current.has(e.id)));
      })
      .catch(() => {
        // Every leaf already swallows its own failures, so this is belt-and-braces
        // — but `isHydrated` gates the whole app, and it must never be the thing
        // an unexpected throw leaves stuck at false.
        if (active) setIsHydrated(true);
      })
      .finally(() => {
        if (active) setReconciled(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist locally as soon as the list changes. Safe the moment the disk read
  // is back: the worst case is rewriting what we just read.
  useEffect(() => {
    if (isHydrated) saveSaved(entries);
  }, [entries, isHydrated]);

  // Pushing waits for the reconcile. A reinstalled device is legitimately empty
  // until the backup lands, and pushSaved stamps a fresh updated_at — so pushing
  // that empty list would win the server's monotonicity check and destroy the
  // very backup we were about to restore from.
  useEffect(() => {
    if (reconciled) pushSaved(entries);
  }, [entries, reconciled]);

  // Lets toggleSave read the current list without depending on it (and so
  // without being rebuilt on every change). Written in an effect, never in render.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const toggleSave = useCallback((id: string) => {
    const wasSaved = entriesRef.current.some((e) => e.id === id);
    // Bookkeeping stays outside the updater: React may call an updater twice,
    // and a state setter is the wrong place for a side effect.
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
