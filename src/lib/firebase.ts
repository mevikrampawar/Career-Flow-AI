import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase is configured through Vite env vars. The app works without
 * Firebase (localStorage-only mode) — configure the vars below to enable
 * Google Sign-In and cross-device Firestore storage.
 */
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
let _auth: ReturnType<typeof getAuth> | null = null;
let _db: Firestore | null = null;

function ensureApp() {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Add VITE_FIREBASE_* env vars (see .env.example).",
    );
  }
  if (!_app) {
    _app = initializeApp(FIREBASE_CONFIG as FirebaseOptions);
  }
  return _app;
}

export function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(ensureApp());
  }
  return _db;
}

export { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged };
export type { User };

export function getFirebaseAuth() {
  if (!_auth) {
    _auth = getAuth(ensureApp());
  }
  return _auth;
}

export function getGoogleProvider() {
  return new GoogleAuthProvider();
}

// ---- Firestore data access (per-user subcollections) ----

const keyDoc = (uid: string) => doc(getDb(), "users", uid, "settings", "keys");

export async function saveKeysToFirestore(uid: string, keys: { groqApiKey?: string; apifyApiToken?: string }) {
  const data: Record<string, unknown> = { updatedAt: Date.now() };
  if (keys.groqApiKey !== undefined) data.groqApiKey = keys.groqApiKey;
  if (keys.apifyApiToken !== undefined) data.apifyApiToken = keys.apifyApiToken;
  await setDoc(keyDoc(uid), data, { merge: true });
}

export async function fetchKeysFromFirestore(uid: string): Promise<{ groqApiKey?: string; apifyApiToken?: string } | null> {
  const snap = await getDoc(keyDoc(uid));
  if (!snap.exists()) return null;
  return snap.data() as { groqApiKey?: string; apifyApiToken?: string };
}

export function onKeysSnapshot(
  uid: string,
  cb: (keys: { groqApiKey?: string; apifyApiToken?: string } | null) => void,
) {
  return onSnapshot(keyDoc(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as { groqApiKey?: string; apifyApiToken?: string }) : null);
  });
}
