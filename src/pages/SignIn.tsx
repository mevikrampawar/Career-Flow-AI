import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

export default function SignIn() {
  const { user, loading, signIn, firebaseEnabled } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-8 shadow-soft">
        <div className="mx-auto grid size-12 place-items-center rounded-sm bg-primary-container text-lg font-semibold text-on-primary">
          CF
        </div>
        <h1 className="mt-5 text-center text-headline-lg text-on-surface">
          Welcome to Career Flow AI
        </h1>
        <p className="mt-2 text-center text-body-sm text-on-surface-variant">
          Your keys, your data. Everything runs in your browser.
        </p>

        {user ? (
          <div className="mt-8 text-center">
            <p className="mb-4 text-body-md text-on-surface">
              Signed in as <strong>{user.email}</strong>
            </p>
            <Button className="w-full" onClick={() => navigate("/app")}>
              Continue to app
            </Button>
          </div>
        ) : (
          <>
            {!firebaseEnabled && (
              <p className="mt-6 rounded-sm border border-warning/40 bg-warning-container px-3 py-2 text-body-sm text-warning">
                Firebase isn't configured yet, so you'll use local-only mode. Add{" "}
                <code className="font-mono">VITE_FIREBASE_*</code> env vars to
                enable Google sign-in and cloud key sync.
              </p>
            )}
            <div className="mt-6 space-y-3">
              {firebaseEnabled && (
                <Button className="w-full" onClick={onSignIn} loading={busy}>
                  Continue with Google
                </Button>
              )}
              <Button
                className="w-full"
                variant="secondary"
                loading={loading}
                onClick={() => navigate("/app")}
              >
                Continue locally
              </Button>
            </div>
            {error && (
              <p className="mt-4 text-center text-body-sm text-error">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
