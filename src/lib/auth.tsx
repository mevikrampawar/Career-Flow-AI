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
    const result = await signInWithPopup(
      getFirebaseAuth(),
      getGoogleProvider(),
    );
    setUser(result.user);
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
