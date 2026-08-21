import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  getFirebaseAuth,
  getGoogleProvider,
  isFirebaseConfigured,
  type User,
} from "./firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  firebaseEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    // Complete a redirect-based sign-in if one is in flight (fallback path
    // from signIn below). onAuthStateChanged still drives `user`; consuming
    // the result here just surfaces/clears any pending redirect state.
    getRedirectResult(getFirebaseAuth()).catch(() => undefined);
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured) {
      throw new Error(
        "Firebase is not configured. Add VITE_FIREBASE_* env vars to enable Google sign-in.",
      );
    }
    const auth = getFirebaseAuth();
    const provider = getGoogleProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (err) {
      // Popup flows fail on Safari/iOS, in-app browsers and strict privacy
      // setups. Fall back to the full-page redirect flow for those; rethrow
      // genuine user cancellations (popup-closed-by-user etc.) as-is.
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/web-storage-unsupported" ||
        code === "auth/browser-not-supported"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isFirebaseConfigured) {
      await firebaseSignOut(getFirebaseAuth());
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      firebaseEnabled: isFirebaseConfigured,
    }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
