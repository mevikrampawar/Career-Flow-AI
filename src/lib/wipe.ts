import { doc } from "firebase/firestore";
import { useAppStore } from "../store/useAppStore";
import {
  deleteDoc,
  deleteUser,
  getDb,
  getFirebaseAuth,
  isFirebaseConfigured,
  signOut as firebaseSignOut,
} from "./firebase";
// Shared freeze switch: while true, the sync layer neither pushes local state
// nor reacts to snapshots (see sync.tsx).
import { wipeGate } from "./sync";

/**
 * "Start over" button: permanently removes every piece of a user's data —
 * Firestore docs, the Google auth account, all localStorage — then signs out,
 * so the whole flow can be re-tested from a blank slate.
 */

// Must match the sync KINDS so no per-user doc survives the wipe.
const DATA_KINDS = [
  "resume",
  "candidateProfile",
  "savedJobs",
  "applications",
  "searchJobs",
  "scrapedJobs",
] as const;

export interface WipeResult {
  /** Whether the Google auth account itself was deleted. */
  accountDeleted: boolean;
}

export async function wipeAccount(uid: string): Promise<WipeResult> {
  // Freeze the sync layer BEFORE the first deleteDoc so live subscribers can't
  // "back up" local cache onto just-deleted docs, and the local reset below
  // can't dispatch shell-doc writes. Cleared after signOut completes.
  wipeGate.current = true;
  try {
    // 1. Firestore — every per-user data doc and the keys doc. Each delete is
    //    isolated so one failure can't stop the rest of the wipe. The parent
    //    users/{uid} doc is intentionally left: production rules only cover
    //    /users/{userId}/{document=**}, so deleting it is denied at runtime.
    let sweep: (() => Promise<void>) | undefined;
    if (isFirebaseConfigured) {
      const db = getDb();
      const refs = [
        ...DATA_KINDS.map((kind) => doc(db, "users", uid, "data", kind)),
        doc(db, "users", uid, "settings", "keys"),
      ];
      // Re-runs deleteDoc over every ref. Idempotent (deleting an already-gone
      // doc succeeds silently); per-ref errors are ignored because a missed
      // delete is retried by the next sweep.
      sweep = async () => {
        for (const ref of refs) {
          try {
            await deleteDoc(ref);
          } catch {
            /* ignore */
          }
        }
      };
      for (const ref of refs) {
        try {
          await deleteDoc(ref);
        } catch (e) {
          console.warn("Wipe: failed to delete", ref.path, e);
        }
      }
      // Second sweep: Firestore cannot cancel already-dispatched writes, so an
      // in-flight setDoc may land AFTER its deleteDoc above and resurrect the
      // wiped doc. Once the sequential loop has fully settled, deleting again
      // wins that race for every ref.
      await sweep();
    }

    // 2. Auth account — permanent deletion. Needs a recent sign-in; if it fails
    //    the local data is still wiped and the caller reports the account.
    let accountDeleted = false;
    try {
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        await deleteUser(currentUser);
        accountDeleted = true;
      }
    } catch (e) {
      console.warn("Wipe: failed to delete the auth account", e);
    }

    // 3. Local storage — every career-flow:* key (store, uid, watermarks, keys,
    //    Gmail flag, theme), then reset the persisted store to empty.
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("career-flow:")) keys.push(k);
      }
    } catch {
      /* storage unavailable — the in-memory reset below still applies */
    }
    for (const k of keys) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    useAppStore.persist?.clearStorage?.();
    useAppStore.setState({
      resume: null,
      candidateProfile: null,
      savedJobs: [],
      applications: [],
      searchJobs: [],
      scrapedJobs: [],
      lastSearchParams: null,
      activeScrape: null,
    });

    // Third sweep right before signOut: catches any straggler setDoc that
    // landed while auth deletion / local reset was running.
    await sweep?.();

    // 4. Sign out (also covers the case where account deletion already signed us
    //    out — the onAuthStateChanged listener then redirects to /signin).
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      /* ignore */
    }

    return { accountDeleted };
  } finally {
    // Sign-out has completed; the uid-driven effect teardown resets all sync
    // refs, so the next sign-in starts from a clean slate.
    wipeGate.current = false;
  }
}
