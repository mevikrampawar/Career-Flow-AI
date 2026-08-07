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
  error: string | null;
}

const SyncContext = createContext<SyncStatus>({
  syncing: false,
  signedIn: false,
  lastSynced: null,
  error: null,
});

export function useSync() {
  return useContext(SyncContext);
}

const UID_KEY = "career-flow:uid";
const WATERMARK_PREFIX = "career-flow:sync-watermark:";
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

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Apply a remote value to local state. Every kind is coerced to a safe shape
 * and wrapped in its own try/catch so a malformed Firestore payload can never
 * crash the snapshot handler or block the other kinds from syncing.
 */
function apply(kind: SyncKind, value: unknown) {
  try {
    const s = useAppStore.getState();
    switch (kind) {
      case "resume":
        s.setResume(asObject(value) as ResumeData | null);
        break;
      case "candidateProfile":
        s.setCandidateProfile(asObject(value) as CandidateProfile | null);
        break;
      case "savedJobs":
        s.setSavedJobs(asArray(value) as JobPosting[]);
        break;
      case "applications":
        s.setApplications(asArray(value) as Application[]);
        break;
      case "searchJobs":
        s.setSearchJobs(asArray(value) as JobPosting[]);
        break;
      case "scrapedJobs":
        s.setScrapedJobs(asArray(value) as JobPosting[]);
        break;
    }
  } catch (e) {
    console.warn("Sync apply failed for", kind, e);
  }
}

const EMPTY = "__empty__";

function watermarkKey(uid: string) {
  return `${WATERMARK_PREFIX}${uid}`;
}

function readWatermarks(uid: string): Partial<Record<SyncKind, number>> {
  try {
    return JSON.parse(localStorage.getItem(watermarkKey(uid)) ?? "{}");
  } catch {
    return {};
  }
}

function writeWatermark(uid: string, kind: SyncKind, t: number) {
  try {
    const all = readWatermarks(uid);
    all[kind] = t;
    localStorage.setItem(watermarkKey(uid), JSON.stringify(all));
  } catch {
    /* private mode / quota — watermark only optimizes ordering, safe to skip */
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [status, setStatus] = useState<SyncStatus>({
    syncing: false,
    signedIn: Boolean(uid),
    lastSynced: null,
    error: null,
  });
  // Serialized remote value we believe is persisted per kind. Only advanced
  // AFTER a write succeeds, so a failed write is always retried on the next
  // local change instead of being silently marked as synced.
  const remoteRef = useRef<Partial<Record<SyncKind, string>>>({});
  // Latest serialized value we WANT persisted per kind.
  const desiredRef = useRef<Partial<Record<SyncKind, string>>>({});
  const inFlightRef = useRef<Partial<Record<SyncKind, boolean>>>({});
  // High-water mark (updatedAt) of the last write we sent per kind. Remote
  // snapshots older than this are stale echoes/cache and must not overwrite
  // local state. Persisted so a reload can't let stale Firestore clobber data.
  const lastWriteRef = useRef<Partial<Record<SyncKind, number>>>({});

  useEffect(() => {
    const unsubs: Unsubscribe[] = [];
    let cancelled = false;
    remoteRef.current = {};
    desiredRef.current = {};
    inFlightRef.current = {};

    if (!uid || !isFirebaseConfigured) {
      setStatus({ syncing: false, signedIn: false, lastSynced: null, error: null });
      return;
    }

    setStatus({ syncing: true, signedIn: true, lastSynced: null, error: null });

    // A blank "not yet synced" baseline so the first local change is always
    // written, even before the first snapshot arrives.
    for (const kind of KINDS) {
      remoteRef.current[kind] = EMPTY;
      desiredRef.current[kind] = EMPTY;
    }

    // If a different user just signed in on this browser, drop the previous
    // user's offline cache and watermark so nothing leaks across accounts.
    let prevUid: string | null = null;
    try {
      prevUid = localStorage.getItem(UID_KEY);
    } catch {
      /* ignore */
    }
    if (prevUid && prevUid !== uid) {
      try {
        localStorage.removeItem(watermarkKey(prevUid));
      } catch {
        /* ignore */
      }
      useAppStore.persist?.clearStorage?.();
      useAppStore.setState({
        resume: null,
        savedJobs: [],
        applications: [],
        searchJobs: [],
        scrapedJobs: [],
      });
    }
    try {
      localStorage.setItem(UID_KEY, uid);
    } catch {
      /* ignore */
    }
    lastWriteRef.current = readWatermarks(uid);

    // Serialize writes per kind: only one setDoc in flight at a time, and a
    // new desired value drains as soon as the current write settles.
    const pump = async (kind: SyncKind) => {
      if (cancelled) return;
      if (inFlightRef.current[kind]) return;
      const desired = desiredRef.current[kind];
      const current = remoteRef.current[kind] ?? EMPTY;
      if (desired === undefined || desired === current) return;

      inFlightRef.current[kind] = true;
      const t = Date.now();
      lastWriteRef.current[kind] = t;
      const value = JSON.parse(desired) as unknown;
      const ref = dataDoc(uid, kind);
      const data = isObjectKind(kind)
        ? { [kindKey(kind)]: value ?? null, updatedAt: t }
        : { items: value ?? [], updatedAt: t };
      try {
        await setDoc(ref, data, { merge: false });
        if (cancelled) return;
        remoteRef.current[kind] = desired;
        writeWatermark(uid, kind, t);
        setStatus((s) => ({ ...s, syncing: false, lastSynced: t, error: null }));
      } catch (e) {
        // Leave remoteRef untouched so the change is retried.
        console.warn("Firestore write failed:", kind, e);
        if (!cancelled) {
          setStatus((s) => ({
            ...s,
            syncing: false,
            error: "Sync to your cloud stalled — retrying. Your data is safe locally.",
          }));
        }
      } finally {
        if (!cancelled) inFlightRef.current[kind] = false;
      }
      if (!cancelled && desiredRef.current[kind] !== (remoteRef.current[kind] ?? EMPTY)) {
        void pump(kind);
      }
    };

    const requestSync = (kind: SyncKind, value: unknown) => {
      desiredRef.current[kind] = JSON.stringify(value ?? null);
      void pump(kind);
    };

    // Local -> Firestore (debounced writes on every store change)
    const subStore = useAppStore.subscribe((state) => {
      if (cancelled) return;
      for (const kind of KINDS) {
        requestSync(kind, pick(kind, state));
      }
    });
    unsubs.push(subStore);

    // Local state wins on reload: push everything we have right away, then let
    // snapshots reconcile. This guarantees the newest local edits are never
    // wiped by a stale Firestore doc.
    for (const kind of KINDS) {
      requestSync(kind, pick(kind, useAppStore.getState()));
    }

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
            const hasLocal = isObjectKind(kind)
              ? Boolean(local)
              : Array.isArray(local) && local.length > 0;
            if (hasLocal) {
              requestSync(kind, local);
            } else {
              remoteRef.current[kind] = EMPTY;
              desiredRef.current[kind] = EMPTY;
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
            setStatus((s) => ({ ...s, syncing: false, error: "Firestore unreachable — changes stay local for now." }));
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
