import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth as fbGetAuth,
  GoogleAuthProvider,
  signInWithPopup as fbSignInWithPopup,
  signInWithRedirect as fbSignInWithRedirect,
  getRedirectResult as fbGetRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  deleteUser as fbDeleteUser,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirestore as fbGetFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase is configured through Vite env vars and is required — Google
 * Sign-In powers the app, and user data (keys, resume, applications) syncs
 * to Firestore per user. There is no local-only mode for production.
 *
 * For local development (import.meta.env.DEV) provide a safe in-memory
 * fallback so the app can be exercised without real Firebase credentials.
 */
const IS_DEV = Boolean(import.meta.env.DEV);
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ??
    "me-career-flow",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as
    | string
    | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as
    | string
    | undefined,
};

export const isFirebaseConfigured = Boolean(FIREBASE_CONFIG.apiKey);

let _app: FirebaseApp | null = null;
let _auth: ReturnType<typeof fbGetAuth> | any = null;
let _db: Firestore | null = null;

function ensureApp() {
  if (!isFirebaseConfigured) {
    if (IS_DEV) {
      // Provide a lightweight fake app when running locally so callers that
      // expect an app object don't throw. This only applies in development.
      _app = _app ?? ({} as FirebaseApp);
      return _app;
    }
    throw new Error(
      "Firebase is not configured. Set the VITE_FIREBASE_* build env vars.",
    );
  }
  if (!_app) {
    _app = initializeApp(FIREBASE_CONFIG as FirebaseOptions);
  }
  return _app;
}

export function getDb(): Firestore {
  if (!_db) {
    if (!isFirebaseConfigured) {
      throw new Error("Firestore is not available when Firebase is not configured.");
    }
    _db = fbGetFirestore(ensureApp());
  }
  return _db;
}

// Re-export Firebase APIs when configured; otherwise provide safe dev fallbacks
// so the UI can be used locally without credentials.

// Dev simulation shared by the popup and redirect fallbacks: mirrors a real
// Google sign-in result so callers behave identically without credentials.
function devSignInResult() {
  const user: User = {
    uid: "dev-user",
    displayName: "Dev User",
    email: "dev@example.com",
    emailVerified: false,
    phoneNumber: null,
    photoURL: null,
    providerId: "firebase",
    // Minimal shape; other fields are allowed but not required for the app.
  } as unknown as User;
  // Mirror into our stubbed auth.currentUser so other code can read it.
  if (!_auth) _auth = { currentUser: user };
  else _auth.currentUser = user;
  return { user } as any;
}

export const signInWithPopup = isFirebaseConfigured
  ? fbSignInWithPopup
  : async (_authArg: any, _provider: any) => devSignInResult();

export const signInWithRedirect = isFirebaseConfigured
  ? fbSignInWithRedirect
  : async (_authArg: any, _provider: any) => {
    devSignInResult();
  };

export const getRedirectResult = isFirebaseConfigured
  ? fbGetRedirectResult
  : async () => null;

export const getFirebaseAuth = () => {
  if (!_auth) {
    if (isFirebaseConfigured) {
      _auth = fbGetAuth(ensureApp());
    } else if (IS_DEV) {
      // Minimal stub used only in development.
      _auth = { currentUser: null };
    } else {
      throw new Error("Firebase auth is not available when Firebase is not configured.");
    }
  }
  return _auth;
};

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}

export const signOut = isFirebaseConfigured
  ? async (auth: Auth) => { await fbSignOut(auth); }
  : async (auth?: Auth) => {
    // Clear the stubbed user on whichever auth instance we were handed,
    // falling back to our module-level dev auth singleton.
    const target: any = auth ?? _auth;
    if (target) target.currentUser = null;
  };

export const onAuthStateChanged = isFirebaseConfigured
  ? fbOnAuthStateChanged
  : (auth: any, cb: (u: User | null) => void) => {
    // Immediately invoke with the passed-in auth's currentUser for dev and
    // return a noop unsubscriber.
    try {
      cb(auth?.currentUser ?? null);
    } catch (e) {
      /* ignore */
    }
    return () => undefined;
  };

export const deleteUser = isFirebaseConfigured
  ? fbDeleteUser
  : async (_user?: User) => { throw new Error('deleteUser not available in dev fallback'); };

export { deleteDoc };
export type { User };

// ---- Firestore data access (per-user subcollections) ----

const keyDoc = (uid: string) => doc(getDb(), "users", uid, "settings", "keys");

export async function saveKeysToFirestore(
  uid: string,
  keys: { groqApiKey?: string; apifyApiToken?: string; gmailClientId?: string },
) {
  const data: Record<string, unknown> = { updatedAt: Date.now() };
  if (keys.groqApiKey !== undefined) data.groqApiKey = keys.groqApiKey;
  if (keys.apifyApiToken !== undefined) data.apifyApiToken = keys.apifyApiToken;
  if (keys.gmailClientId !== undefined) data.gmailClientId = keys.gmailClientId;
  await setDoc(keyDoc(uid), data, { merge: true });
}

export async function fetchKeysFromFirestore(
  uid: string,
): Promise<{ groqApiKey?: string; apifyApiToken?: string; gmailClientId?: string } | null> {
  const snap = await getDoc(keyDoc(uid));
  if (!snap.exists()) return null;
  return snap.data() as { groqApiKey?: string; apifyApiToken?: string; gmailClientId?: string };
}

export function onKeysSnapshot(
  uid: string,
  cb: (
    keys: { groqApiKey?: string; apifyApiToken?: string; gmailClientId?: string } | null,
  ) => void,
) {
  return onSnapshot(keyDoc(uid), (snap) => {
    cb(
      snap.exists()
        ? (snap.data() as { groqApiKey?: string; apifyApiToken?: string; gmailClientId?: string })
        : null,
    );
  });
}
