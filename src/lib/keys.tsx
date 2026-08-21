import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ApiKeys } from "./types";
import { useAuth } from "./auth";
import {
  fetchKeysFromFirestore,
  isFirebaseConfigured,
  onKeysSnapshot,
  saveKeysToFirestore,
} from "./firebase";

const LS_KEY = "career-flow:keys";

const EMPTY: ApiKeys = { groqApiKey: "", apifyApiToken: "", gmailClientId: "" };

// The local cache is partitioned per account so one user's keys can never leak
// into another account that signs in on the same device. Without a uid it
// falls back to the legacy unscoped key (only used pre-sign-in).
function localKey(uid?: string | null): string {
  return uid ? `${LS_KEY}:${uid}` : LS_KEY;
}

function readLocal(uid?: string | null): ApiKeys {
  try {
    const raw = localStorage.getItem(localKey(uid));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ApiKeys>;
    return {
      groqApiKey: parsed.groqApiKey ?? "",
      apifyApiToken: parsed.apifyApiToken ?? "",
      gmailClientId: parsed.gmailClientId ?? "",
    };
  } catch {
    return { ...EMPTY };
  }
}

// One-time migration: the pre-uid cache (`career-flow:keys`) belongs to whoever
// signs in first after this change. Adopt it into the uid-scoped cache and drop
// the shared key so a later, different account can never inherit it.
function migrateLegacyCache(uid: string) {
  if (localStorage.getItem(localKey(uid)) !== null) return;
  const legacy = localStorage.getItem(LS_KEY);
  if (legacy === null) return;
  localStorage.setItem(localKey(uid), legacy);
  localStorage.removeItem(LS_KEY);
}

interface KeysContextValue {
  keys: ApiKeys;
  hasGroq: boolean;
  hasApify: boolean;
  setKeys: (keys: Partial<ApiKeys>) => void;
  clearKeys: () => void;
  syncing: boolean;
}

const KeysContext = createContext<KeysContextValue | null>(null);

export function KeysProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [keys, setKeysState] = useState<ApiKeys>(() => readLocal(user?.uid));
  const [syncing, setSyncing] = useState(false);

  // Hydrate from Firestore when signed in (Firestore wins over local), seed
  // the Firestore doc from whatever exists locally when it's missing, then
  // keep the live snapshot subscribed so changes from other devices propagate.
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;
    setSyncing(true);
    const uid = user.uid;
    migrateLegacyCache(uid);

    const apply = (remote: { groqApiKey?: string; apifyApiToken?: string; gmailClientId?: string } | null) => {
      const local = readLocal(uid);
      const merged: ApiKeys = {
        groqApiKey: remote?.groqApiKey ?? local.groqApiKey,
        apifyApiToken: remote?.apifyApiToken ?? local.apifyApiToken,
        gmailClientId: remote?.gmailClientId ?? local.gmailClientId,
      };
      setKeysState(merged);
      localStorage.setItem(localKey(uid), JSON.stringify(merged));
    };

    let unsub: (() => void) | undefined;
    let cancelled = false;
    fetchKeysFromFirestore(uid)
      .then((remote) => {
        // Effect was cleaned up while the fetch was in flight (sign-out,
        // account switch, StrictMode remount): drop the stale result instead
        // of applying another account's keys or leaking the listener.
        if (cancelled) return;
        apply(remote);
        if (!remote) {
          // The keys document doesn't exist yet — back it up from the local
          // cache so a future sign-in (or another device) can restore it.
          const local = readLocal(uid);
          if (local.groqApiKey || local.apifyApiToken || local.gmailClientId) {
            saveKeysToFirestore(uid, local).catch(() => {});
          }
        }
        unsub = onKeysSnapshot(uid, apply);
      })
      .catch(() => {
        // Fall back to local keys if Firestore is unreachable.
      })
      .finally(() => setSyncing(false));

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user?.uid]);

  const setKeys = useCallback(
    (patch: Partial<ApiKeys>) => {
      const next = { ...keys, ...patch };
      setKeysState(next);
      localStorage.setItem(localKey(user?.uid), JSON.stringify(next));
      if (user && isFirebaseConfigured) {
        saveKeysToFirestore(user.uid, patch).catch(() => {});
      }
    },
    [keys, user],
  );

  const clearKeys = useCallback(() => {
    setKeysState({ ...EMPTY });
    localStorage.setItem(localKey(user?.uid), JSON.stringify({ ...EMPTY }));
    if (user && isFirebaseConfigured) {
      saveKeysToFirestore(user.uid, {
        groqApiKey: "",
        apifyApiToken: "",
        gmailClientId: "",
      }).catch(() => {});
    }
  }, [user]);

  const value = useMemo(
    () => ({
      keys,
      hasGroq: Boolean(keys.groqApiKey.trim()),
      hasApify: Boolean(keys.apifyApiToken.trim()),
      setKeys,
      clearKeys,
      syncing,
    }),
    [keys, setKeys, clearKeys, syncing],
  );

  return (
    <KeysContext.Provider value={value}>{children}</KeysContext.Provider>
  );
}

export function useKeys() {
  const ctx = useContext(KeysContext);
  if (!ctx) throw new Error("useKeys must be used within KeysProvider");
  return ctx;
}
