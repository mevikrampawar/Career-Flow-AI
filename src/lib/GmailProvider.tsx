import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useKeys } from "./keys";
import {
  ensureToken,
  fetchGmailProfile,
  GmailError,
  requestAccessToken,
  revokeAccess,
} from "./gmail";

interface GmailContextValue {
  connected: boolean;
  connecting: boolean;
  email?: string;
  error?: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getToken: () => Promise<string>;
}

const GmailContext = createContext<GmailContextValue | null>(null);

const CONNECTED_FLAG = "career-flow:gmail-connected";

function wasConnectedBefore(): boolean {
  return localStorage.getItem(CONNECTED_FLAG) === "1";
}

export function GmailProvider({ children }: { children: ReactNode }) {
  const { keys } = useKeys();
  const clientId = keys.gmailClientId.trim();
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const restoredRef = useRef<string | null>(null);

  const connected = Boolean(email);

  // Best-effort silent restore when this browser previously connected: reuses
  // the Google session's existing grant without showing a consent screen.
  useEffect(() => {
    if (!clientId || restoredRef.current === clientId || !wasConnectedBefore()) return;
    restoredRef.current = clientId;
    let cancelled = false;
    ensureToken(clientId)
      .then((token) => fetchGmailProfile(token))
      .then((profile) => {
        if (!cancelled) setEmail(profile.emailAddress);
      })
      .catch(() => {
        /* user re-consents via Connect */
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const connect = useCallback(async () => {
    if (!clientId) {
      setError("Save your Google OAuth Client ID first.");
      throw new GmailError("Google OAuth Client ID is missing.");
    }
    setConnecting(true);
    setError(undefined);
    try {
      const token = await requestAccessToken(clientId, "consent");
      const profile = await fetchGmailProfile(token);
      setEmail(profile.emailAddress);
      localStorage.setItem(CONNECTED_FLAG, "1");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gmail connection failed.";
      setError(message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [clientId]);

  const disconnect = useCallback(async () => {
    try {
      await revokeAccess();
    } finally {
      setEmail(undefined);
      setError(undefined);
      localStorage.removeItem(CONNECTED_FLAG);
    }
  }, []);

  const getToken = useCallback(async () => {
    if (!clientId) {
      throw new GmailError("Google OAuth Client ID is missing. Add it in Settings.");
    }
    return ensureToken(clientId);
  }, [clientId]);

  const value = useMemo(
    () => ({ connected, connecting, email, error, connect, disconnect, getToken }),
    [connected, connecting, email, error, connect, disconnect, getToken],
  );

  return <GmailContext.Provider value={value}>{children}</GmailContext.Provider>;
}

export function useGmail() {
  const ctx = useContext(GmailContext);
  if (!ctx) throw new Error("useGmail must be used within GmailProvider");
  return ctx;
}
