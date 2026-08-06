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

const EMPTY: ApiKeys = { groqApiKey: "", apifyApiToken: "" };

function readLocal(): ApiKeys {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ApiKeys>;
    return {
      groqApiKey: parsed.groqApiKey ?? "",
      apifyApiToken: parsed.apifyApiToken ?? "",
    };
  } catch {
    return { ...EMPTY };
  }
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
  const [keys, setKeysState] = useState<ApiKeys>(readLocal);
  const [syncing, setSyncing] = useState(false);

  // Hydrate from Firestore when signed in (Firestore wins over local).
  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;
    setSyncing(true);
    let unsub: (() => void) | undefined;

    fetchKeysFromFirestore(user.uid)
      .then((remote) => {
        if (remote) {
          const merged: ApiKeys = {
            groqApiKey: remote.groqApiKey ?? readLocal().groqApiKey,
            apifyApiToken: remote.apifyApiToken ?? readLocal().apifyApiToken,
          };
          setKeysState(merged);
          localStorage.setItem(LS_KEY, JSON.stringify(merged));
        }
        unsub = onKeysSnapshot(user.uid, (snap) => {
          if (!snap) return;
          const next: ApiKeys = {
            groqApiKey: snap.groqApiKey ?? readLocal().groqApiKey,
            apifyApiToken: snap.apifyApiToken ?? readLocal().apifyApiToken,
          };
          setKeysState(next);
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        });
      })
      .finally(() => setSyncing(false));

    return () => {
      unsub?.();
    };
  }, [user?.uid]);

  const setKeys = useCallback(
    (patch: Partial<ApiKeys>) => {
      const next = { ...keys, ...patch };
      setKeysState(next);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      if (user && isFirebaseConfigured) {
        saveKeysToFirestore(user.uid, patch).catch(() => {});
      }
    },
    [keys, user],
  );

  const clearKeys = useCallback(() => {
    setKeysState({ ...EMPTY });
    localStorage.removeItem(LS_KEY);
    if (user && isFirebaseConfigured) {
      saveKeysToFirestore(user.uid, { groqApiKey: "", apifyApiToken: "" }).catch(
        () => {},
      );
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
