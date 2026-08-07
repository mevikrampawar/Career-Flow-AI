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
  // 1. Firestore — every per-user doc (the data subcollection, the keys doc,
  //    and the user doc itself). Each delete is isolated so one failure can't
  //    stop the rest of the wipe.
  if (isFirebaseConfigured) {
    const db = getDb();
    const refs = [
      ...DATA_KINDS.map((kind) => doc(db, "users", uid, "data", kind)),
      doc(db, "users", uid, "settings", "keys"),
      doc(db, "users", uid),
    ];
    for (const ref of refs) {
      try {
        await deleteDoc(ref);
      } catch (e) {
        console.warn("Wipe: failed to delete", ref.path, e);
      }
    }
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

  // 4. Sign out (also covers the case where account deletion already signed us
  //    out — the onAuthStateChanged listener then redirects to /signin).
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch {
    /* ignore */
  }

  return { accountDeleted };
}
