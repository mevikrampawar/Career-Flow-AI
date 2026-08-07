import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { useAuth } from "./auth";
import { useAppStore, type AppState } from "../store/useAppStore";
import type { Application, CandidateProfile, JobPosting, ResumeData } from "./types";

type SyncKind = "resume" | "candidateProfile" | "savedJobs" | "applications" | "searchJobs" | "scrapedJobs";

interface SyncStatus {
  syncing: boolean;
  signedIn: boolean;
  lastSynced: number | null;
}

const SyncContext = createContext<SyncStatus>({
  syncing: false,
  signedIn: false,
  lastSynced: null,
});

export function useSync() {
  return useContext(SyncContext);
}

const UID_KEY = "career-flow:uid";
const KINDS: SyncKind[] = [
  "resume",
  "candidateProfile",
  "savedJobs",
  "applications",
  "searchJobs",
  "scrapedJobs",
];

function isObjectKind(kind: SyncKind): boolean {
  return kind === "resume" || kind === "candidateProfile";
}

function kindKey(kind: SyncKind): string {
  if (kind === "resume") return "resume";
  if (kind === "candidateProfile") return "profile";
  return "items";
}

function dataDoc(uid: string, kind: SyncKind) {
  return doc(getDb(), "users", uid, "data", kind);
}

function pick(kind: SyncKind, s: AppState): unknown {
  switch (kind) {
    case "resume":
      return s.resume;
    case "candidateProfile":
      return s.candidateProfile;
    case "savedJobs":
      return s.savedJobs;
    case "applications":
      return s.applications;
    case "searchJobs":
      return s.searchJobs;
    case "scrapedJobs":
      return s.scrapedJobs;
  }
}

function apply(kind: SyncKind, value: unknown) {
  const s = useAppStore.getState();
  switch (kind) {
    case "resume":
      s.setResume(value as ResumeData | null);
      break;
    case "candidateProfile":
      s.setCandidateProfile((value as CandidateProfile | null) ?? null);
      break;
    case "savedJobs":
      s.setSavedJobs((value as JobPosting[] | null) ?? []);
      break;
    case "applications":
      s.setApplications((value as Application[] | null) ?? []);
      break;
    case "searchJobs":
      s.setSearchJobs((value as JobPosting[] | null) ?? []);
      break;
    case "scrapedJobs":
      s.setScrapedJobs?.((value as JobPosting[] | null) ?? []);
      break;
  }
}

const EMPTY = "__empty__";

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [status, setStatus] = useState<SyncStatus>({
    syncing: false,
    signedIn: Boolean(uid),
    lastSynced: null,
  });
  const remoteRef = useRef<Partial<Record<SyncKind, string>>>({});
  // High-water mark of the last local write we sent per kind. Remote snapshots
  // older than this are stale echoes/cache and must not overwrite local state.
  const lastWriteRef = useRef<Partial<Record<SyncKind, number>>>({});

  useEffect(() => {
    const unsubs: Unsubscribe[] = [];
    let cancelled = false;
    remoteRef.current = {};
    lastWriteRef.current = {};

    if (!uid || !isFirebaseConfigured) {
      setStatus({ syncing: false, signedIn: false, lastSynced: null });
      return;
    }

    setStatus({ syncing: true, signedIn: true, lastSynced: null });

    // A blank "not yet synced" baseline so the first local change is always
    // written, even before the first snapshot arrives.
    for (const kind of KINDS) remoteRef.current[kind] = EMPTY;

    // If a different user just signed in on this browser, drop the previous
    // user's offline cache so nothing leaks across accounts.
    const prevUid = localStorage.getItem(UID_KEY);
    if (prevUid && prevUid !== uid) {
      useAppStore.persist?.clearStorage?.();
      useAppStore.setState({
        resume: null,
        savedJobs: [],
        applications: [],
        searchJobs: [],
        scrapedJobs: [],
      });
    }
    localStorage.setItem(UID_KEY, uid);

    const writeKind = async (kind: SyncKind, value: unknown) => {
      const ref = dataDoc(uid, kind);
      const t = Date.now();
      lastWriteRef.current[kind] = t;
      const data = isObjectKind(kind)
        ? { [kindKey(kind)]: value ?? null, updatedAt: t }
        : { items: value ?? [], updatedAt: t };
      await setDoc(ref, data, { merge: false });
      if (!cancelled) {
        setStatus((s) => ({ ...s, syncing: false, lastSynced: t }));
      }
    };

    // Local -> Firestore (debounced writes on every store change)
    const subStore = useAppStore.subscribe((state) => {
      if (cancelled) return;
      for (const kind of KINDS) {
        const value = pick(kind, state);
        const serialized = JSON.stringify(value ?? null);
        if (serialized !== remoteRef.current[kind]) {
          remoteRef.current[kind] = serialized;
          void writeKind(kind, value);
        }
      }
    });
    unsubs.push(subStore);

    // Firestore -> Local (hydrate on sign-in + live cross-device sync)
    for (const kind of KINDS) {
      const ref = dataDoc(uid, kind);
      const sub = onSnapshot(
        ref,
        (snap) => {
          if (cancelled) return;

          if (snap.metadata.hasPendingWrites) {
            // Echo of a write we just sent — local state already matches, and
            // applying it here could clobber a newer local edit.
            const echoed = snap.data()?.[kindKey(kind)] ?? null;
            remoteRef.current[kind] = JSON.stringify(echoed);
            return;
          }

          if (!snap.exists()) {
            // Nothing stored yet — back up the local cache if it exists.
            const local = pick(kind, useAppStore.getState());
            const localSerialized = JSON.stringify(local ?? null);
            const hasLocal = isObjectKind(kind)
              ? Boolean(local)
              : Array.isArray(local) && local.length > 0;
            if (hasLocal) {
              remoteRef.current[kind] = localSerialized;
              void writeKind(kind, local);
            } else {
              remoteRef.current[kind] = EMPTY;
            }
            return;
          }

          const raw = snap.data();
          const value = isObjectKind(kind)
            ? (raw[kindKey(kind)] ?? null)
            : (raw[kindKey(kind)] ?? []);
          const serialized = JSON.stringify(value ?? null);

          // Never let a stale remote snapshot (cache or an older commit) wipe
          // out state we've already written locally and are waiting to confirm.
          const remoteUpdatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : 0;
          if (remoteUpdatedAt < (lastWriteRef.current[kind] ?? 0)) {
            return;
          }

          const current = JSON.stringify(
            pick(kind, useAppStore.getState()) ?? null,
          );
          remoteRef.current[kind] = serialized;
          if (serialized !== current) apply(kind, value);
        },
        (err) => {
          if (!cancelled) {
            setStatus((s) => ({ ...s, syncing: false }));
            console.warn("Firestore sync unavailable:", err);
          }
        },
      );
      unsubs.push(sub);
    }

    const timer = setTimeout(() => {
      if (!cancelled) setStatus((s) => ({ ...s, syncing: false }));
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [uid]);

  return (
    <SyncContext.Provider value={status}>{children}</SyncContext.Provider>
  );
}
