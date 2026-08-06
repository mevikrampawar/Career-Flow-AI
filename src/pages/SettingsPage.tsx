import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useKeys } from "../lib/keys";
import { testGroqConnection } from "../lib/groq";
import { testApifyConnection } from "../lib/apify";
import { Button, Spinner } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

function KeyField({
  label,
  hint,
  value,
  placeholder,
  onChange,
  onSave,
  testLabel,
  onTest,
  testing,
  saved,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSave: () => void;
  testLabel: string;
  onTest: () => Promise<void>;
  testing: boolean;
  saved?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="rounded-sm border border-outline-variant/70 p-4">
      <Field label={label} hint={hint}>
        <div className="flex gap-2">
          <Input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="ghost" size="md" onClick={() => setShow((s) => !s)}>
            {show ? "Hide" : "Show"}
          </Button>
        </div>
      </Field>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={!value.trim()}>
          Save key
        </Button>
        <Button size="sm" variant="secondary" onClick={onTest} loading={testing} disabled={!value.trim()}>
          {testLabel}
        </Button>
        {saved && <span className="text-label-sm text-success">Saved ✓</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut, firebaseEnabled } = useAuth();
  const { keys, setKeys, clearKeys, syncing } = useKeys();
  const { push } = useToast();

  const [groqDraft, setGroqDraft] = useState(keys.groqApiKey);
  const [apifyDraft, setApifyDraft] = useState(keys.apifyApiToken);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testingApify, setTestingApify] = useState(false);

  function saveGroq() {
    setKeys({ groqApiKey: groqDraft.trim() });
    push("success", "Groq API key saved.");
  }
  function saveApify() {
    setKeys({ apifyApiToken: apifyDraft.trim() });
    push("success", "Apify API token saved.");
  }

  async function testGroq() {
    setTestingGroq(true);
    try {
      await testGroqConnection(groqDraft.trim());
      push("success", "Groq connection OK.");
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setTestingGroq(false);
    }
  }

  async function testApify() {
    setTestingApify(true);
    try {
      const who = await testApifyConnection(apifyDraft.trim());
      push("success", `Apify connected as @${who}.`);
    } catch (e) {
      push("error", e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setTestingApify(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Settings</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Bring your own keys — all AI and scraping calls run from your browser.
        </p>
      </div>

      {syncing && (
        <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <Spinner className="size-4" /> Syncing keys with Firestore…
        </div>
      )}

      {firebaseEnabled ? (
        <Card>
          <CardHeader
            title="Account"
            subtitle={user ? `Signed in as ${user.email}` : "Firebase is configured but not signed in."}
          />
          <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
            {user ? (
              <Button variant="secondary" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            ) : null}
            <p className="text-body-sm text-on-surface-variant">
              Keys are synced to your private Firestore document when signed in.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-body-sm text-on-surface-variant">
            Firebase isn't configured yet — keys stay on this device in
            localStorage. Add <code className="font-mono">VITE_FIREBASE_*</code>{" "}
            env vars to enable Google sign-in and cloud sync.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          title="AI keys"
          subtitle="Free tiers: Groq console and Apify free plan."
        />
        <div className="space-y-4 px-5 pb-5">
          <KeyField
            label="Groq API key"
            hint="Used for resume analysis, job matching, cover letters. Get one free at console.groq.com"
            value={groqDraft}
            placeholder="gsk_…"
            onChange={setGroqDraft}
            onSave={saveGroq}
            testLabel="Test connection"
            onTest={testGroq}
            testing={testingGroq}
            saved={keys.groqApiKey === groqDraft.trim() && Boolean(groqDraft.trim())}
          />
          <KeyField
            label="Apify API token"
            hint="Used to scrape job boards. Free monthly credits at console.apify.com"
            value={apifyDraft}
            placeholder="apify_api_…"
            onChange={setApifyDraft}
            onSave={saveApify}
            testLabel="Test connection"
            onTest={testApify}
            testing={testingApify}
            saved={keys.apifyApiToken === apifyDraft.trim() && Boolean(apifyDraft.trim())}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-headline-md text-on-surface">Danger zone</h3>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-body-sm text-on-surface-variant">
            Remove all locally stored keys.
          </p>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => {
              clearKeys();
              setGroqDraft("");
              setApifyDraft("");
              push("info", "Keys cleared.");
            }}
          >
            Clear keys
          </Button>
        </div>
      </Card>
    </div>
  );
}
